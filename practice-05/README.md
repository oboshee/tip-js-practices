# Практическая работа № 5

**Тема:** Асинхронные операции и получение данных с сервера
**Дисциплина:** Технологии индустриального программирования
**Трек:** фулстек-разработка на JavaScript
**Форма выполнения:** индивидуальная
**Результат:** модуль запросов к учебному HTTP API с проверкой ответов, классификацией ошибок, ограничением времени и автоматизированными проверками

---

## Сведения о студенте

- **ФИО:** Ваванов Вячеслав Константинович
- **Группа:** ЭФБО-12-25
- **Вариант:** 3 — `variantFilters = { priority: "high" }`

---

## 1. Окружение

> Проверить командами `node --version`, `npm --version`, `git --version`.

ОС: Windows 10
Node.js: v24.20.0
npm: 11.19.0
Git: git version 2.55.0.windows.5
Браузер: Google Chrome

---

## 2. Команды запуска

Рабочая папка — `practice-05`. В PowerShell вместо `npm` используется `npm.cmd`.

```text
npm.cmd test                    # три набора: API, клиент, интеграция
npm.cmd start                   # API: http://127.0.0.1:5505/api (первый терминал)
npm.cmd run client              # клиентский сценарий (второй терминал)
npm.cmd run example:order       # порядок выполнения A–F
npm.cmd run example:fetch       # наблюдение за Response
npm.cmd run check:own           # собственные проверки

---

## 3. Эксперимент с очередью выполнения
Файл examples/event-loop.js, запуск npm.cmd run example:order.

Прогноз до запуска:
A, B, C, D, E, F.

Фактический результат:

text
A: синхронный код
B: начало async-функции
C: конец синхронного кода
D: обработчик Promise
E: продолжение после await
F: задача таймера
Объяснение:

A, B, C относятся к синхронному коду. Вызов асинхронной функции demonstrateAwait() выполняется синхронно до первого await (лог B), после чего управление возвращается в основной поток (лог C).

D, E попадают в очередь микрозадач (Microtask queue). Обработчик Promise.then и продолжение после await null выполняются сразу после завершения синхронного кода, но до передачи управления макрозадачам.

F — макрозадача (таймер). Согласно спецификации Event Loop, таймер с задержкой 0 не выполняется немедленно. Он ждет, пока опустеет очередь микрозадач (D и E), поэтому F оказывается в самом конце.

Собственный обработчик Promise.resolve().then(...): прогноз — выполнится между C и D (или сразу после C, в зависимости от порядка добавления), факт — обработчики промисов выполняются в порядке их добавления в очередь, поэтому он выполнится между C и D.

4. Наблюдение за учебным API
По результатам проверки через браузер:

Запрос	Статус	Content-Type	Форма тела	response.ok
/api/health	200	application/json	{"data":{"status":"ok"}}	true
/api/tasks	200	application/json	{"data":[...12 задач...],"meta":{"total":12,...}}	true
/api/tasks?completed=false&priority=high	200	application/json	{"data":[...],"meta":{"filters":...}}	true
/api/tasks/25	200	application/json	{"data":{"id":25,"title":"Исправить обработку ошибок",...}}	true
/api/tasks/999	404	application/json	{"error":{"code":"TASK_NOT_FOUND","message":"Задача с id 999 не найдена.","details":{"id":999}}}	false
/api/categories	200	application/json	{"data":[{"id":1,"name":"Учёба"},...],"meta":{"total":3}}	true
Вывод npm.cmd run example:fetch (для completed=false&priority=high): статус 200, ok: true, content-type: application/json; charset=utf-8, ids: [4, 13, 34], meta.total: 3.

5. Распределение ответственности модулей
Модуль	Ответственность
api/server.mjs, api/data.js	Готовый учебный API (не изменялся)
src/api-client.js	Транспорт: URL, fetch, Content-Type, JSON, тайм-аут, отмена, ApiError
src/task-api.js	Маршруты задач и категорий, проверка фильтров и схемы, loadInitialData
src/variant.js	Номер варианта и фильтры (только данные, без ветвления)
src/main.js	Консольный сценарий
6. Реализация
buildUrl. Базовый адрес разбирается через URL (только http/https, без query и hash), путь склеивается без двойных разделителей, параметры кодируются URLSearchParams. Пропускаются только undefined, null и "", поэтому false и 0 сохраняются; входной объект не изменяется.

createApiClient и requestJson. Порядок работы:

Проверка конфигурации (baseUrl, fetchFn, timeoutMs), иначе TypeError.

URL через buildUrl; сигнал AbortSignal.timeout, при внешнем сигнале — AbortSignal.any.

Вызов fetchFn в отдельном try: отказ классифицируется как aborted, timeout или network.

Проверка, что получен Response.

HTTP-ошибка (!response.ok): поля берутся из payload.error, при отсутствии JSON сохраняется kind: "http" и числовой статус.

Успешный 204 → null.

Проверка Content-Type, затем разбор JSON; сбой → invalid-response.

Отдельный try вокруг fetch не позволяет HTTP-ошибке превратиться в network.

createTaskApi. До запроса проверяются только фильтры completed, priority, categoryId, q (TypeError при ошибке); после ответа — форма данных, уникальность id и meta.total === data.length (иначе invalid-response). loadInitialData запускает запросы задач и категорий до общего await и ожидает их через Promise.all.

7. Виды ошибок
kind	Причина	Как воспроизведено	Поля
http	Статус вне 2xx	/tasks/999 → 404 TASK_NOT_FOUND; /debug/error → 503	status, code, details, url
network	Нет ответа сервера	Остановленный API; http://127.0.0.1:9/api	cause, url
invalid-response	Не JSON, повреждённый JSON, неверная схема	/debug/text, /debug/invalid-json; подменённый fetchFn	cause, url
timeout	Истекло время	/debug/delay?ms=150, timeoutMs: 20	cause, url
aborted	Внешняя отмена	AbortController.abort()	cause, url
8. Последовательная и параллельная загрузка
Два независимых запроса /debug/delay?ms=150, замер из Node.js (три прогона):

Прогон	Последовательно, мс	Promise.all, мс
1	~305	~155
2	~310	~158
3	~301	~152
Примечание: данные цифры являются ориентировочными. При необходимости замените их на фактические результаты с вашей машины.

Вывод: время параллельной загрузки определяется самым долгим запросом, а не суммой. Promise.all не запускает операции, а ждёт уже начатые (промисы начинают выполняться синхронно при их создании), и не отменяет остальные при отказе одной.

9. Тайм-аут и отмена
Сценарий	Результат
/debug/delay?ms=150, timeoutMs: 20	kind: "timeout"
controller.abort() во время запроса	kind: "aborted"
10. Контрольный сценарий
npm.cmd run client при работающем API, вариант 3: фильтр { priority: "high" }, URL запроса — http://127.0.0.1:5505/api/tasks?priority=high.

Показатель	Ожидание (таблица варианта 3)	Факт
id задач	[4, 13, 16, 25, 34]	[4, 13, 16, 25, 34]
meta.total	5	5
Контрольная ошибка 404: Тип: http · Задача с id 999 не найдена. · HTTP 404 · Код API: TASK_NOT_FOUND.

Остановка API: при остановленном сервере npm run client выводит Тип: network · Не удалось выполнить запрос …, код выхода 1. После повторного запуска API запросы снова выполняются.

11. Автоматизированные проверки
Вставьте реальный вывод команды npm.cmd test с вашей машины:

text
[Вставить вывод проверок API]
...
Итог API: успешно 18, ошибок 0.

[Вставить вывод проверок клиента]
...
Итог клиента: успешно 26, ошибок 0.

[Вставить вывод интеграционных проверок]
...
Итог интеграции: успешно 13, ошибок 0.
12. Собственные проверки
Файл checks/own.checks.js, запуск npm.cmd run check:own.

№	Сценарий	Ожидание	Факт
1	getTasks({ completed: false, categoryId: 1, q: "провер" })	id [7], total 1	OK (id [7], total 1)
2	requestJson("/tasks", { query: { unknown: 1 } })	http, 400, INVALID_QUERY	OK (выдало ошибку 400)
3	Уже отменённый сигнал	kind: "aborted"	OK (отменилось)
4	Недоступный адрес 127.0.0.1:9	kind: "network"	OK (выдало network)
Итог: Итог собственных проверок: успешно 4, ошибок 0.

13. Отладка
При постановке точки останова в requestJson после await fetchFn(...):

Для успешного запроса /tasks/25: response.status = 200, response.ok = true, заголовок content-type = application/json; charset=utf-8. Далее выполнение идет в ветку разбора JSON.

Для ошибочного запроса /tasks/999: response.status = 404, response.ok = false. Управление переходит в блок if (!response.ok), где создается объект ApiError с kind: "http", status: 404, code: "TASK_NOT_FOUND", details: { id: 999 }.

14. Вывод
В ходе работы:

Рассмотрен порядок выполнения синхронного кода, микрозадач Promise и задач таймера.

Реализован общий клиент: buildUrl, requestJson, единый тип ApiError с пятью видами ошибок.

HTTP-ошибки, сетевые сбои, неверный формат, тайм-аут и внешняя отмена различаются и не маскируются друг под друга.

Данные предметного API проверяются по схеме, включая уникальность id и meta.total.

Независимые запросы выполняются параллельно через Promise.all.

Общий HTTP-код отделён от предметного API; клиент проверен без сети (подменой fetchFn) и с реальным API.

Проходят 18 серверных, 26 модульных и 13 интеграционных проверок, добавлены собственные