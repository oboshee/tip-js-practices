// Общий HTTP-клиент: транспорт, JSON, тайм-аут, отмена и единый тип ошибок.
// Предметных знаний (задачи, категории) здесь нет — они в task-api.js.

const ERROR_KINDS = new Set(["http", "network", "invalid-response", "timeout", "aborted"]);
const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Единый тип ошибок клиента.
 * kind: http | network | invalid-response | timeout | aborted
 */
export class ApiError extends Error {
  constructor(
    message,
    { kind, status = null, code = null, details = null, url = null, cause } = {},
  ) {
    if (!ERROR_KINDS.has(kind)) {
      throw new TypeError(`Недопустимый вид ошибки: ${String(kind)}`);
    }
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
    this.url = url;
  }
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function parseBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    throw new TypeError("baseUrl должен быть непустой строкой.");
  }
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch (error) {
    throw new TypeError("baseUrl должен быть абсолютным адресом.", { cause: error });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError("baseUrl должен использовать http или https.");
  }
  if (parsed.search !== "" || parsed.hash !== "") {
    throw new TypeError("baseUrl не должен содержать query или hash.");
  }
  return parsed;
}

/**
 * Формирует URL запроса. Параметры кодируются URLSearchParams;
 * undefined, null и "" пропускаются, false и 0 сохраняются.
 */
export function buildUrl(baseUrl, path, query = {}) {
  const base = parseBaseUrl(baseUrl);

  if (typeof path !== "string" || path.trim() === "") {
    throw new TypeError("path должен быть непустой строкой.");
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) {
    throw new TypeError("path должен быть относительным.");
  }
  if (path.includes("?") || path.includes("#")) {
    throw new TypeError("path не должен содержать query или hash.");
  }
  if (query === null || typeof query !== "object" || Array.isArray(query)) {
    throw new TypeError("query должен быть обычным объектом.");
  }

  const basePath = base.pathname.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  const url = new URL(`${base.origin}${basePath}/${cleanPath}`);

  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(name, String(value));
  }
  return url.toString();
}

function isJsonContentType(response) {
  return (response.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

/**
 * @param {{ baseUrl: string, fetchFn?: Function, timeoutMs?: number }} options
 */
export function createApiClient(options = {}) {
  const { baseUrl, fetchFn = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  parseBaseUrl(baseUrl);
  if (typeof fetchFn !== "function") {
    throw new TypeError("fetchFn должен быть функцией.");
  }
  if (!isPositiveSafeInteger(timeoutMs)) {
    throw new TypeError("timeoutMs должен быть положительным целым числом.");
  }

  async function requestJson(path, requestOptions = {}) {
    const { query = {}, signal: externalSignal, timeoutMs: ownTimeout } = requestOptions;

    const limit = ownTimeout === undefined ? timeoutMs : ownTimeout;
    if (!isPositiveSafeInteger(limit)) {
      throw new TypeError("timeoutMs должен быть положительным целым числом.");
    }
    if (externalSignal !== undefined && !(externalSignal instanceof AbortSignal)) {
      throw new TypeError("signal должен быть экземпляром AbortSignal.");
    }

    const url = buildUrl(baseUrl, path, query);
    const timeoutSignal = AbortSignal.timeout(limit);
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : timeoutSignal;

    // Внешняя отмена приоритетнее: если вызывающий код отменил запрос — это aborted.
    function classifyInterruption(cause) {
      if (externalSignal?.aborted) {
        return new ApiError("Запрос отменён.", { kind: "aborted", url, cause });
      }
      if (timeoutSignal.aborted || cause?.name === "TimeoutError") {
        return new ApiError(`Превышено время ожидания ответа (${limit} мс).`, {
          kind: "timeout",
          url,
          cause,
        });
      }
      return null;
    }

    // 1. Только сетевой этап: обработка Response вне этого try,
    //    чтобы HTTP-ошибка не превратилась в network.
    let response;
    try {
      response = await fetchFn(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (cause) {
      throw classifyInterruption(cause)
        ?? new ApiError(`Не удалось выполнить запрос: ${cause?.message ?? "нет ответа"}.`, {
          kind: "network",
          url,
          cause,
        });
    }

    if (!(response instanceof Response)) {
      throw new ApiError("Клиент получил не HTTP-ответ.", { kind: "invalid-response", url });
    }

    // 2. HTTP-ошибка: статус важнее содержимого тела.
    if (!response.ok) {
      let apiError = null;
      if (isJsonContentType(response)) {
        try {
          const payload = await response.json();
          if (payload && typeof payload === "object" && payload.error
              && typeof payload.error === "object") {
            apiError = payload.error;
          }
        } catch {
          // Тело ошибки не JSON — достаточно статуса.
        }
      }
      throw new ApiError(
        typeof apiError?.message === "string" && apiError.message.trim() !== ""
          ? apiError.message
          : `Сервер вернул ошибку HTTP ${response.status}.`,
        {
          kind: "http",
          status: response.status,
          code: typeof apiError?.code === "string" ? apiError.code : null,
          details: apiError?.details ?? null,
          url,
        },
      );
    }

    // 3. Успешный ответ без тела.
    if (response.status === 204) return null;

    // 4. Формат: Content-Type, затем синтаксис JSON.
    if (!isJsonContentType(response)) {
      await response.body?.cancel().catch(() => {});
      throw new ApiError(
        `Ожидался JSON, получен ${response.headers.get("content-type") ?? "ответ без Content-Type"}.`,
        { kind: "invalid-response", status: response.status, url },
      );
    }

    try {
      return await response.json();
    } catch (cause) {
      throw classifyInterruption(cause)
        ?? new ApiError("Тело ответа не является корректным JSON.", {
          kind: "invalid-response",
          status: response.status,
          url,
          cause,
        });
    }
  }

  return { requestJson };
}
