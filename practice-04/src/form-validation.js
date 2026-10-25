// Чистая проверка черновика формы: без DOM, без побочных эффектов.

const PRIORITIES = ["low", "medium", "high"];
const MAX_TITLE_LENGTH = 100;

/**
 * @param {{id: unknown, title: unknown, priority: unknown}} draft
 * @param {Array<{id: number}>} tasks
 * @param {number|null} editingId
 * @returns {{ok: true, value: {id: number, title: string, priority: string}}
 *          | {ok: false, errors: Record<string, string>}}
 */
export function validateTaskDraft(draft, tasks, editingId = null) {
  const errors = {};
  const source = draft !== null && typeof draft === "object" ? draft : {};
  const list = Array.isArray(tasks) ? tasks : [];
  const isEditing = editingId !== null && editingId !== undefined;

  // --- id ---
  let id = null;
  if (isEditing) {
    // В режиме редактирования draft.id игнорируется (поле disabled).
    if (!Number.isSafeInteger(editingId) || editingId < 1) {
      errors.id = "Некорректный идентификатор редактируемой задачи.";
    } else if (!list.some((task) => task.id === editingId)) {
      errors.id = "Редактируемая задача не найдена.";
    } else {
      id = editingId;
    }
  } else {
    const raw = source.id;
    const text = typeof raw === "string" ? raw.trim() : raw;
    if (text === "" || text === null || text === undefined) {
      errors.id = "Укажите идентификатор.";
    } else if (typeof text !== "string" && typeof text !== "number") {
      errors.id = "Идентификатор должен быть числом.";
    } else {
      const number = Number(text); // пустая строка отсечена выше
      if (!Number.isSafeInteger(number) || number < 1) {
        errors.id = "Идентификатор должен быть положительным целым числом.";
      } else if (list.some((task) => task.id === number)) {
        errors.id = "Задача с таким идентификатором уже существует.";
      } else {
        id = number;
      }
    }
  }

  // --- title ---
  let title = null;
  if (typeof source.title !== "string") {
    errors.title = "Название должно быть строкой.";
  } else {
    const normalized = source.title.trim();
    if (normalized.length === 0) {
      errors.title = "Название не может быть пустым.";
    } else if (normalized.length > MAX_TITLE_LENGTH) {
      errors.title = `Название не должно быть длиннее ${MAX_TITLE_LENGTH} символов.`;
    } else {
      title = normalized;
    }
  }

  // --- priority ---
  let priority = null;
  if (!PRIORITIES.includes(source.priority)) {
    errors.priority = "Выберите приоритет: low, medium или high.";
  } else {
    priority = source.priority;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { id, title, priority } };
}