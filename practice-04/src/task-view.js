import { getTaskStats } from "./task-service.js";

// Здесь создаётся DOM, но не изменяются данные и localStorage.

const PRIORITY_LABELS = { low: "Низкий", medium: "Средний", high: "Высокий" };

function createActionButton(action, text) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;

  const label = document.createElement("span");
  label.className = "action-label";
  label.textContent = text;
  button.append(label);
  return button;
}

export function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task-card";
  item.dataset.taskId = String(task.id);
  item.classList.toggle("is-completed", task.completed === true);

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title; // только текст, HTML не интерпретируется

  const status = document.createElement("span");
  status.className = "task-status";
  status.textContent = task.completed ? "Выполнена" : "В работе";

  const priority = document.createElement("span");
  priority.className = "task-priority";
  priority.textContent = PRIORITY_LABELS[task.priority] ?? task.priority;

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(
    createActionButton("toggle", task.completed ? "Вернуть в работу" : "Выполнить"),
    createActionButton("edit", "Изменить"),
    createActionButton("delete", "Удалить"),
  );

  item.append(title, status, priority, actions);
  return item;
}

export function renderTaskList(listElement, tasks) {
  listElement.replaceChildren(...tasks.map(createTaskElement));
}

export function renderSummary(summaryElement, tasks, visibleCount) {
  const stats = getTaskStats(tasks);
  const values = {
    total: String(stats.total),
    completed: String(stats.completed),
    pending: String(stats.pending),
    progress: `${stats.progress.toFixed(1)}%`,
    visible: String(visibleCount),
  };
  for (const [name, value] of Object.entries(values)) {
    const node = summaryElement.querySelector(`[data-stat="${name}"]`);
    if (node) node.textContent = value;
  }
}

export function renderEmptyState(messageElement, total, visibleCount) {
  if (total === 0) {
    messageElement.textContent = "Список задач пуст.";
    messageElement.hidden = false;
  } else if (visibleCount === 0) {
    messageElement.textContent = "Нет задач по выбранному фильтру.";
    messageElement.hidden = false;
  } else {
    messageElement.textContent = "";
    messageElement.hidden = true;
  }
}