// src/task-service.js — прикладные функции ПР2 + updateTask (ПР4)

// ===== Внутренние помощники =====

function isValidId(id) {
  return Number.isSafeInteger(id) && id > 0;
}

function normalizeTitle(title) {
  if (typeof title !== "string") {
    return { ok: false, error: "Название должно быть строкой" };
  }
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    return { ok: false, error: "Название должно быть от 1 до 100 символов" };
  }
  return { ok: true, title: trimmed };
}

const ALLOWED_PRIORITIES = ["low", "medium", "high"];

// ===== 1. Создание задачи =====

export function createTask(id, title, priority = "medium") {
  if (!isValidId(id)) {
    return { ok: false, error: "id должен быть положительным безопасным целым числом" };
  }

  const normalized = normalizeTitle(title);
  if (!normalized.ok) {
    return normalized;
  }

  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return { ok: false, error: "Приоритет должен быть low, medium или high" };
  }

  return {
    ok: true,
    task: {
      id,
      title: normalized.title,
      completed: false,
      priority,
    },
  };
}

// ===== 2. Поиск по id =====

export function findTaskById(tasks, id) {
  return tasks.find((task) => task.id === id);
}

// ===== 3. Невыполненные задачи =====

export function getPendingTasks(tasks) {
  return tasks.filter((task) => task.completed === false);
}

// ===== 4. Названия задач =====

export function getTaskTitles(tasks) {
  return tasks.map((task) => task.title);
}

// ===== 5. Сводка =====

export function getTaskStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed === true).length;
  const pending = total - completed;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return { total, completed, pending, progress };
}

// ===== 6. Добавление =====

export function addTask(tasks, id, title, priority = "medium") {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный идентификатор задачи" };
  }
  if (findTaskById(tasks, id) !== undefined) {
    return { ok: false, error: "Задача с таким id уже существует" };
  }

  const created = createTask(id, title, priority);
  if (!created.ok) {
    return created;
  }

  return { ok: true, tasks: [...tasks, created.task] };
}

// ===== 7. Изменение статуса =====

export function setTaskCompleted(tasks, id, completed) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный идентификатор задачи" };
  }
  if (typeof completed !== "boolean") {
    return { ok: false, error: "Признак выполнения должен быть логическим" };
  }

  if (findTaskById(tasks, id) === undefined) {
    return { ok: false, error: "Задача не найдена" };
  }

  return {
    ok: true,
    tasks: tasks.map((task) =>
      task.id === id ? { ...task, completed } : task,
    ),
  };
}

// ===== 8. Переименование =====

export function renameTask(tasks, id, title) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный идентификатор задачи" };
  }

  const normalized = normalizeTitle(title);
  if (!normalized.ok) {
    return normalized;
  }

  if (findTaskById(tasks, id) === undefined) {
    return { ok: false, error: "Задача не найдена" };
  }

  return {
    ok: true,
    tasks: tasks.map((task) =>
      task.id === id ? { ...task, title: normalized.title } : task,
    ),
  };
}

// ===== 9. Удаление =====

export function removeTask(tasks, id) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный идентификатор задачи" };
  }

  if (findTaskById(tasks, id) === undefined) {
    return { ok: false, error: "Задача не найдена" };
  }

  return {
    ok: true,
    tasks: tasks.filter((task) => task.id !== id),
  };
}

// ===== 10. Изменение названия и приоритета (ПР4) =====

export function updateTask(tasks, id, title, priority) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный идентификатор задачи" };
  }

  const normalized = normalizeTitle(title);
  if (!normalized.ok) {
    return normalized;
  }

  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return { ok: false, error: "Приоритет должен быть low, medium или high" };
  }

  if (findTaskById(tasks, id) === undefined) {
    return { ok: false, error: "Задача не найдена" };
  }

  // Меняются только title и priority; id и completed сохраняются.
  // Остальные объекты остаются прежними (как в setTaskCompleted/renameTask).
  return {
    ok: true,
    tasks: tasks.map((task) =>
      task.id === id ? { ...task, title: normalized.title, priority } : task,
    ),
  };
}