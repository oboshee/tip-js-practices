// Собственные проверки ПР5 (поверх готовых наборов). Запускают API на свободном порту.
import assert from "node:assert/strict";
import { createApiServer } from "../api/server.mjs";
import { ApiError, createApiClient } from "../src/api-client.js";
import { createTaskApi } from "../src/task-api.js";

let passed = 0;
let failed = 0;

async function check(name, action) {
  try {
    await action();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(error.stack ?? error.message);
  }
}

const server = createApiServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
const client = createApiClient({ baseUrl, timeoutMs: 1000 });
const api = createTaskApi(client);

try {
  await check("01. своя комбинация completed + categoryId + q", async () => {
    const result = await api.getTasks({ completed: false, categoryId: 1, q: "провер" });
    assert.deepEqual(result.tasks.map((task) => task.id), [7]);
    assert.equal(result.meta.total, 1);
  });

  await check("02. неизвестный query-параметр даёт http 400 INVALID_QUERY", async () => {
    await assert.rejects(
      () => client.requestJson("/tasks", { query: { unknown: 1 } }),
      (error) => error instanceof ApiError
        && error.kind === "http" && error.status === 400 && error.code === "INVALID_QUERY",
    );
  });

  await check("03. уже отменённый сигнал сразу даёт aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => client.requestJson("/tasks", { signal: controller.signal }),
      (error) => error instanceof ApiError && error.kind === "aborted",
    );
  });

  await check("04. недоступный сервер даёт kind network", async () => {
    const offline = createApiClient({ baseUrl: "http://127.0.0.1:9/api", timeoutMs: 1000 });
    await assert.rejects(
      () => offline.requestJson("/health"),
      (error) => error instanceof ApiError && error.kind === "network",
    );
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(`\nИтог собственных проверок: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
