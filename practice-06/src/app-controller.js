import { validateTaskDraft } from "./form-validation.js";
import { ApiError } from "./api-client.js";

export function messageForError(error) {
  if (error instanceof ApiError) {
    if (error.kind === "http") return `Ошибка API (${error.status}): ${error.message}`;
    if (error.kind === "network") return "Ошибка соединения с сервером. Проверьте, запущен ли API.";
    if (error.kind === "timeout") return "Сервер не ответил вовремя.";
    return error.message;
  }
  return "Не удалось выполнить операцию.";
}

function isAbort(error) {
  return (error instanceof ApiError && error.kind === "aborted") || error?.name === "AbortError";
}

export function createAppController({ api, view }) {
  if (!api || typeof api.getTasks !== "function" || typeof api.loadInitialData !== "function") {
    throw new TypeError("api должен содержать методы getTasks и loadInitialData.");
  }
  if (!view || typeof view !== "object") {
    throw new TypeError("view должен быть объектом.");
  }

  // Снимок последнего ответа сервера. Источник данных — API.
  let tasks = [];
  let categories = [];
  let filters = {};
  let editingId = null;
  let loadController = null;
  let loadSequence = 0;

  // Загружает задачи с текущими фильтрами.
  // Пока категории не получены, вместо getTasks вызывается loadInitialData.
  async function loadCurrentTasks() {
    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;
    const sequence = ++loadSequence;
    const { signal } = controller;

    view.setListState("loading");
    try {
      let result;
      let loadedCategories = null;
      if (categories.length === 0) {
        const initial = await api.loadInitialData(filters, { signal });
        result = initial;
        loadedCategories = initial.categories;
      } else {
        result = await api.getTasks(filters, { signal });
      }

      // Устаревший ответ игнорируется, даже если запрос не удалось отменить.
      if (sequence !== loadSequence) return;

      if (loadedCategories) {
        categories = loadedCategories;
        view.setCategories(categories);
      }
      tasks = result.tasks;
      view.setTasks(tasks, categories);
      view.setTotal(result.meta.total);
      view.setListState(tasks.length === 0 ? "empty" : "ready");
    } catch (error) {
      // Отмена — штатное управление потоком, пользователю она не показывается.
      if (isAbort(error) || sequence !== loadSequence) return;
      view.setListState("error", messageForError(error));
    }
  }

  // Общая схема изменяющей операции: блокировка → запрос → повторный GET → разблокировка.
  async function performMutation(action, successMessage) {
    view.setMutationPending(true);
    try {
      await action();
      view.notify(successMessage, "success");
      await loadCurrentTasks();
    } catch (error) {
      view.notify(messageForError(error), "error");
    } finally {
      view.setMutationPending(false);
    }
  }

  function leaveEditMode() {
    editingId = null;
    view.setFormTask(null);
  }

  return {
    async start(initialFilters = {}) {
      filters = { ...initialFilters };
      await loadCurrentTasks();
    },

    async applyFilters(newFilters = {}) {
      filters = { ...newFilters };
      await loadCurrentTasks();
    },

    async refresh() {
      await loadCurrentTasks();
    },

    async submit(draft) {
      const validation = validateTaskDraft(draft, categories);
      if (!validation.valid) {
        view.showFormErrors(validation.errors);
        return;
      }
      view.showFormErrors({});

      const idToEdit = editingId;
      const isEdit = idToEdit !== null;
      await performMutation(async () => {
        if (isEdit) await api.updateTask(idToEdit, validation.value);
        else await api.createTask(validation.value);
        leaveEditMode();
      }, isEdit ? "Задача обновлена." : "Задача создана.");
    },

    beginEdit(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      editingId = id;
      view.setFormTask(task);
    },

    cancelEdit() {
      leaveEditMode();
    },

    async toggleTask(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      await performMutation(
        () => api.setTaskCompleted(id, !task.completed),
        "Статус задачи обновлён.",
      );
    },

    async deleteTask(id) {
      await performMutation(async () => {
        await api.deleteTask(id);
        if (editingId === id) leaveEditMode();
      }, "Задача удалена.");
    },

    async resetData() {
      await performMutation(async () => {
        await api.resetDemoData();
        leaveEditMode();
      }, "Данные восстановлены.");
    },

    destroy() {
      loadController?.abort();
    },
  };
}