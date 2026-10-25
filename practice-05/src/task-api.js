import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);
const MAX_QUERY_LENGTH = 100;

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTask(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.title === "string"
    && value.title.trim().length >= 1
    && value.title.trim().length <= 100
    && typeof value.completed === "boolean"
    && ALLOWED_PRIORITIES.has(value.priority)
    && isPositiveSafeInteger(value.categoryId),
  );
}

function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

// Проверка допустимых фильтров до запроса. Возвращает новый объект query.
function normalizeFilters(filters = {}) {
  if (!isObject(filters)) {
    throw new TypeError("Фильтры должны быть обычным объектом.");
  }

  const query = {};
  for (const [name, value] of Object.entries(filters)) {
    if (!ALLOWED_FILTERS.has(name)) {
      throw new TypeError(`Неизвестный фильтр: ${name}.`);
    }
    if (value === undefined) continue;

    if (name === "completed") {
      if (typeof value !== "boolean") {
        throw new TypeError("completed должен быть логическим значением.");
      }
      query.completed = value; // false сохраняется; строку создаст URLSearchParams
    } else if (name === "priority") {
      if (!ALLOWED_PRIORITIES.has(value)) {
        throw new TypeError("priority должен быть low, medium или high.");
      }
      query.priority = value;
    } else if (name === "categoryId") {
      if (!isPositiveSafeInteger(value)) {
        throw new TypeError("categoryId должен быть положительным целым числом.");
      }
      query.categoryId = value;
    } else {
      if (typeof value !== "string") {
        throw new TypeError("q должен быть строкой.");
      }
      const text = value.trim();
      if (text.length > MAX_QUERY_LENGTH) {
        throw new TypeError(`q не должен быть длиннее ${MAX_QUERY_LENGTH} символов.`);
      }
      if (text !== "") query.q = text;
    }
  }
  return query;
}

function validateUniqueItems(data, predicate, label) {
  if (!Array.isArray(data)) {
    throw invalidResponse(`Поле data (${label}) должно быть массивом.`);
  }
  const ids = new Set();
  for (const item of data) {
    if (!predicate(item)) {
      throw invalidResponse(`Получена некорректная запись (${label}).`);
    }
    if (ids.has(item.id)) {
      throw invalidResponse(`Повторяющийся id ${item.id} (${label}).`);
    }
    ids.add(item.id);
  }
}

function validateCollection(payload, predicate, label) {
  if (!isObject(payload)) {
    throw invalidResponse(`Ответ (${label}) должен быть объектом.`);
  }
  validateUniqueItems(payload.data, predicate, label);
  if (!isObject(payload.meta) || payload.meta.total !== payload.data.length) {
    throw invalidResponse(`meta.total не совпадает с длиной коллекции (${label}).`);
  }
  return payload;
}

// client — объект, созданный createApiClient.
// getTasks(filters) -> Promise<{ tasks, meta }>
// getTaskById(id) -> Promise<task>
// getCategories() -> Promise<category[]>
// loadInitialData(filters) -> Promise<{ tasks, categories, meta }>
export function createTaskApi(client) {
  if (!client || typeof client.requestJson !== "function") {
    throw new TypeError("client должен содержать метод requestJson.");
  }

  async function getTasks(filters = {}) {
    const query = normalizeFilters(filters);
    const payload = validateCollection(
      await client.requestJson("/tasks", { query }),
      isTask,
      "задачи",
    );
    if (!isObject(payload.meta.filters)) {
      throw invalidResponse("meta.filters должен быть объектом (задачи).");
    }
    return { tasks: payload.data, meta: payload.meta };
  }

  async function getTaskById(id) {
    if (!isPositiveSafeInteger(id)) {
      throw new TypeError("id должен быть положительным безопасным целым числом.");
    }
    const payload = await client.requestJson(`/tasks/${id}`);
    if (!isObject(payload) || !isTask(payload.data)) {
      throw invalidResponse("Получена некорректная задача.");
    }
    return payload.data;
  }

  async function getCategories() {
    const payload = validateCollection(
      await client.requestJson("/categories"),
      isCategory,
      "категории",
    );
    return payload.data;
  }

  // Оба запроса начинаются до общего await: независимые ресурсы грузятся параллельно.
  async function loadInitialData(filters = {}) {
    const tasksPromise = getTasks(filters);
    const categoriesPromise = getCategories();
    const [{ tasks, meta }, categories] = await Promise.all([tasksPromise, categoriesPromise]);
    return { tasks, categories, meta };
  }

  return { getTasks, getTaskById, getCategories, loadInitialData };
}
