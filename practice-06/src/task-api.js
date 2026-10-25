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
    value && typeof value === "object" &&
    isPositiveSafeInteger(value.id) &&
    typeof value.title === "string" &&
    value.title.trim().length >= 1 &&
    value.title.trim().length <= 100 &&
    typeof value.completed === "boolean" &&
    ALLOWED_PRIORITIES.has(value.priority) &&
    isPositiveSafeInteger(value.categoryId)
  );
}

function isCategory(value) {
  return Boolean(
    value && typeof value === "object" &&
    isPositiveSafeInteger(value.id) &&
    typeof value.name === "string" &&
    value.name.trim().length >= 1 &&
    value.name.trim().length <= 100
  );
}

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
      if (typeof value !== "boolean") throw new TypeError("completed должен быть boolean.");
      query.completed = value;
    } else if (name === "priority") {
      if (!ALLOWED_PRIORITIES.has(value)) throw new TypeError("priority должен быть low, medium или high.");
      query.priority = value;
    } else if (name === "categoryId") {
      if (!isPositiveSafeInteger(value)) throw new TypeError("categoryId должен быть положительным целым числом.");
      query.categoryId = value;
    } else {
      if (typeof value !== "string") throw new TypeError("q должен быть строкой.");
      const text = value.trim();
      if (text.length > MAX_QUERY_LENGTH) throw new TypeError(`q не должен быть длиннее ${MAX_QUERY_LENGTH} символов.`);
      if (text !== "") query.q = text;
    }
  }
  return query;
}

function validateCollection(payload, predicate, label) {
  if (!isObject(payload) || !Array.isArray(payload.data)) {
    throw invalidResponse(`Ответ (${label}) должен содержать массив data.`);
  }
  const ids = new Set();
  for (const item of payload.data) {
    if (!predicate(item)) {
      throw invalidResponse(`Получена некорректная запись (${label}).`);
    }
    if (ids.has(item.id)) {
      throw invalidResponse(`Повторяющийся id ${item.id} (${label}).`);
    }
    ids.add(item.id);
  }
  if (!isObject(payload.meta) || payload.meta.total !== payload.data.length) {
    throw invalidResponse(`meta.total не совпадает с длиной коллекции (${label}).`);
  }
  return payload;
}

export function createTaskApi(client) {
  if (!client || typeof client.requestJson !== "function") {
    throw new TypeError("client должен содержать метод requestJson.");
  }

  async function getTasks(filters = {}, options = {}) {
    const query = normalizeFilters(filters);
    const payload = validateCollection(
      await client.requestJson("/tasks", { query, signal: options.signal }),
      isTask,
      "задачи",
    );
    return { tasks: payload.data, meta: payload.meta };
  }

  async function getTaskById(id, options = {}) {
    if (!isPositiveSafeInteger(id)) throw new TypeError("id должен быть положительным безопасным целым числом.");
    const payload = await client.requestJson(`/tasks/${id}`, { signal: options.signal });
    if (!isObject(payload) || !isTask(payload.data)) throw invalidResponse("Получена некорректная задача.");
    return payload.data;
  }

  async function getCategories(options = {}) {
    const payload = validateCollection(
      await client.requestJson("/categories", { signal: options.signal }),
      isCategory,
      "категории",
    );
    return payload.data;
  }

  async function loadInitialData(filters = {}, options = {}) {
    const [taskResult, categories] = await Promise.all([
      getTasks(filters, options),
      getCategories(options),
    ]);
    return { tasks: taskResult.tasks, categories, meta: taskResult.meta };
  }

  async function createTask(draft, options = {}) {
    const payload = await client.requestJson("/tasks", {
      method: "POST",
      body: draft,
      signal: options.signal,
    });
    if (!isObject(payload) || !isTask(payload.data)) throw invalidResponse("Некорректная задача при создании.");
    return payload.data;
  }

  async function updateTask(id, changes, options = {}) {
    if (!isPositiveSafeInteger(id)) throw new TypeError("id должен быть положительным безопасным целым числом.");
    const payload = await client.requestJson(`/tasks/${id}`, {
      method: "PATCH",
      body: changes,
      signal: options.signal,
    });
    if (!isObject(payload) || !isTask(payload.data)) throw invalidResponse("Некорректная задача при обновлении.");
    return payload.data;
  }

  async function setTaskCompleted(id, completed, options = {}) {
    return updateTask(id, { completed }, options);
  }

  async function deleteTask(id, options = {}) {
    if (!isPositiveSafeInteger(id)) throw new TypeError("id должен быть положительным безопасным целым числом.");
    const result = await client.requestJson(`/tasks/${id}`, {
      method: "DELETE",
      signal: options.signal,
    });
    if (result !== null) throw invalidResponse("Ожидался пустой ответ 204.");
    return null;
  }

  async function resetDemoData(options = {}) {
    const payload = await client.requestJson("/debug/reset", {
      method: "POST",
      signal: options.signal,
    });
    if (!isObject(payload) || !isObject(payload.data)) throw invalidResponse("Некорректный ответ сброса.");
    return payload.data;
  }

  return {
    getTasks,
    getTaskById,
    getCategories,
    loadInitialData,
    createTask,
    updateTask,
    setTaskCompleted,
    deleteTask,
    resetDemoData,
  };
}