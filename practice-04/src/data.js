// Исходные наборы данных. Текущее состояние и сохранённые изменения здесь не хранятся.
 
export const variantNumber = 3; // Вариант 3 — «Создание сайта-портфолио»
 
// Общий контрольный набор (одинаков для всех).
export const demoTasks = [
  { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
  { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
  { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
  { id: 10, title: "Оформить README", completed: true, priority: "medium" },
];
 
// Индивидуальный набор: id [11, 23, 37, 41, 58, 64], первые K = 2 выполнены.
// Названия тематические; при необходимости замените на свои из ПР2–ПР3.
export const variantTasks = [
  { id: 11, title: "Выбрать структуру сайта-портфолио", completed: true, priority: "high" },
  { id: 23, title: "Подготовить список проектов для портфолио", completed: true, priority: "medium" },
  { id: 37, title: "Сверстать главную страницу", completed: false, priority: "high" },
  { id: 41, title: "Добавить страницу «Обо мне»", completed: false, priority: "medium" },
  { id: 58, title: "Подключить форму обратной связи", completed: false, priority: "low" },
  { id: 64, title: "Опубликовать сайт и проверить ссылки", completed: false, priority: "low" },
];
 