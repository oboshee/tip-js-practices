const PRIORITIES = new Set(["low", "medium", "high"]);

export function validateTaskDraft(draft, categories) {
  const errors = {};
  const source = draft !== null && typeof draft === "object" ? draft : {};
  let title = "";
  let priority = "";
  let categoryId = null;

  if (typeof source.title === "string") {
    title = source.title.trim();
    if (title.length < 1 || title.length > 100) {
      errors.title = "Название должно содержать от 1 до 100 символов.";
    }
  } else {
    errors.title = "Название обязательно.";
  }

  if (PRIORITIES.has(source.priority)) {
    priority = source.priority;
  } else {
    errors.priority = "Выберите корректный приоритет.";
  }

  const rawCategory = source.categoryId;
  const parsedCategoryId = typeof rawCategory === "number" || (typeof rawCategory === "string" && rawCategory.trim() !== "")
    ? Number(rawCategory)
    : NaN;
  if (
    Number.isSafeInteger(parsedCategoryId) &&
    parsedCategoryId > 0 &&
    Array.isArray(categories) &&
    categories.some((c) => c.id === parsedCategoryId)
  ) {
    categoryId = parsedCategoryId;
  } else {
    errors.categoryId = "Выберите существующую категорию.";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors };
  }

  return {
    valid: true,
    value: { title, priority, categoryId },
    errors: {},
  };
}