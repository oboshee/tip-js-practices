const PRIORITY_LABELS = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

function createActionButton(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  const text = document.createElement("span");
  text.className = "action-label";
  text.textContent = label;
  button.append(text);
  return button;
}

// Клики по кнопкам обрабатываются делегированием в dom-app.js,
// поэтому обработчики на самих кнопках не навешиваются.
export function createTaskElement(task, category) {
  const item = document.createElement("li");
  item.className = "task-card";
  item.dataset.taskId = String(task.id);
  if (task.completed) item.classList.add("is-completed");

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;

  const categoryName = typeof category === "object" && category !== null
    ? category.name
    : category;

  const categoryNode = document.createElement("span");
  categoryNode.className = "task-category";
  categoryNode.textContent = categoryName || "Без категории";

  const priority = document.createElement("span");
  priority.className = "task-priority";
  priority.textContent = `Приоритет: ${PRIORITY_LABELS[task.priority] ?? task.priority}`;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(categoryNode, priority);

  const status = document.createElement("span");
  status.className = "task-status";
  status.textContent = task.completed ? "Выполнено" : "В работе";

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(
    createActionButton("toggle", task.completed ? "Вернуть в работу" : "Выполнить"),
    createActionButton("edit", "Изменить"),
    createActionButton("delete", "Удалить"),
  );

  item.append(title, meta, status, actions);
  return item;
}

export function renderTaskList(container, tasks, categories = []) {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const fragment = document.createDocumentFragment();
  for (const task of tasks) {
    fragment.append(createTaskElement(task, names.get(task.categoryId)));
  }
  container.replaceChildren(fragment);
}