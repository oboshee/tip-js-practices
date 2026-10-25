// Граница localStorage: JSON, проверка схемы, обработка исключений.
// storage передаётся аргументом — модуль не обращается к глобальному localStorage.
 
export const STORAGE_VERSION = 1;
const PRIORITIES = ["low", "medium", "high"];
const MAX_TITLE_LENGTH = 100;
 
function isValidTask(task) {
  if (task === null || typeof task !== "object" || Array.isArray(task)) return false;
  if (!Number.isSafeInteger(task.id) || task.id < 1) return false;
  if (typeof task.title !== "string") return false;
  if (task.title !== task.title.trim()) return false; // название должно быть нормализовано
  if (task.title.length < 1 || task.title.length > MAX_TITLE_LENGTH) return false;
  if (typeof task.completed !== "boolean") return false;
  if (!PRIORITIES.includes(task.priority)) return false;
  return true;
}
 
function copyTasks(tasks) {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    completed: task.completed,
    priority: task.priority,
  }));
}
 
/** Проверяет весь массив и уникальность id. Ничего не исправляет. */
export function isValidTaskList(value) {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  for (const task of value) {
    if (!isValidTask(task) || ids.has(task.id)) return false;
    ids.add(task.id);
  }
  return true;
}
 
function errorMessage(error, fallback) {
  return error && error.message ? `${fallback} (${error.message})` : fallback;
}
 
/**
 * @returns {{ok: boolean, source: "initial"|"storage"|"fallback", tasks: object[], error?: string}}
 */
export function loadTasks(storage, key, fallbackTasks) {
  const fallback = copyTasks(fallbackTasks);
  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return { ok: true, source: "initial", tasks: fallback };
    }
 
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || parsed.version !== STORAGE_VERSION) {
      return {
        ok: false,
        source: "fallback",
        tasks: fallback,
        error: "Неподдерживаемая версия или структура сохранённых данных.",
      };
    }
    if (!isValidTaskList(parsed.tasks)) {
      return {
        ok: false,
        source: "fallback",
        tasks: fallback,
        error: "Сохранённый список задач повреждён.",
      };
    }
    return { ok: true, source: "storage", tasks: copyTasks(parsed.tasks) };
  } catch (error) {
    return {
      ok: false,
      source: "fallback",
      tasks: fallback,
      error: errorMessage(error, "Не удалось прочитать сохранённые данные."),
    };
  }
}
 
/** @returns {{ok: true} | {ok: false, error: string}} */
export function saveTasks(storage, key, tasks) {
  if (!isValidTaskList(tasks)) {
    return { ok: false, error: "Список задач некорректен и не был сохранён." };
  }
  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, tasks }));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Не удалось сохранить данные.") };
  }
}
 
/** Удаляет ровно один ключ. */
export function removeSavedTasks(storage, key) {
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Не удалось удалить сохранённые данные.") };
  }
}