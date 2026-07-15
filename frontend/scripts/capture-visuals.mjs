import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const baseUrl = process.env.VERIMED_BASE_URL ?? "http://127.0.0.1:3000";
const apiUrl = process.env.VERIMED_API_URL ?? "http://127.0.0.1:8000/api";
const output = process.env.VERIMED_VISUAL_OUTPUT ?? join(tmpdir(), "verimed-visuals");
const includeFoundation = process.env.VERIMED_INCLUDE_FOUNDATION === "true" || process.argv.includes("--foundation");
const shellOnly = process.argv.includes("--shell");
const reviewFlowOnly = process.argv.includes("--review-flow");
const widths = shellOnly ? [1440, 1280, 768, 375] : [1440, 768, 375];
const chromeCandidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => existsSync(candidate));

if (!chrome) {
  throw new Error("Не найден Chrome или Chromium. Укажите путь в переменной CHROME_BIN.");
}

async function firstId(endpoint) {
  const response = await fetch(`${apiUrl}${endpoint}`);
  if (!response.ok) throw new Error(`Не удалось получить данные для ${endpoint}: ${response.status}`);
  const payload = await response.json();
  const item = Array.isArray(payload) ? payload[0] : payload.items?.[0];
  if (!item?.id) throw new Error(`В ответе ${endpoint} нет объекта для визуальной проверки.`);
  return item.id;
}

let pages;
if (shellOnly) {
  pages = [
    ["shell-analytics", "/"],
    ["shell-signals", "/signals?sort=priority"],
    ["shell-organizations", "/organizations"],
    ["shell-patterns", "/patterns?sort=importance"],
    ["shell-profile", "/profile"],
  ];
} else if (reviewFlowOnly) {
  const signalId = await firstId("/signals?sort=priority&page_size=1");
  const encodedStatus = encodeURIComponent("Не проверено");
  pages = [
    ["review-signals", "/signals?sort=priority", { readySelector: "[data-testid='signals-mobile-list']" }],
    ["review-signals-filtered", `/signals?priority_level=${encodeURIComponent("Критический")}&status=${encodedStatus}&sort=financial`, { readySelector: "[data-testid='signals-mobile-list']" }],
    ["review-signals-selection", "/signals?sort=priority", { readySelector: "[data-testid='signals-mobile-list']", afterReady: "Array.from(document.querySelectorAll(\"input[type='checkbox']\")).find((item) => item.getBoundingClientRect().width > 0)?.click()" }],
    ["review-signals-empty", "/signals?search=visual-no-matches", { readyText: "По выбранным условиям сигналов нет" }],
    ["review-signals-loading", "/signals?sort=priority", { readySelector: "h1", settleMs: 0 }],
    ["review-signals-error", "/signals?sort=priority", { readyText: "Не удалось загрузить очередь", failApi: true }],
    ["review-signal-preview", `/signals?sort=priority&signal=${signalId}`, { readySelector: "[role='dialog'] h2" }],
    ["review-signal-preview-disclosure", `/signals?sort=priority&signal=${signalId}`, { readySelector: "[role='dialog'] h2", afterReady: "Array.from(document.querySelectorAll(\"[role='dialog'] summary\")).find((item) => item.textContent.includes('Обоснование'))?.click()" }],
    ["review-signal-preview-loading", `/signals?sort=priority&signal=${signalId}`, { readySelector: "[role='dialog']", settleMs: 0 }],
    ["review-signal-preview-error", `/signals?sort=priority&signal=${signalId}`, { readyText: "Не удалось загрузить сигнал", failApiPattern: `*127.0.0.1:8000/api/signals/${signalId}*` }],
    ["review-signal-summary", `/signals/${signalId}#summary`, { readySelector: "nav[aria-label='Этапы проверки']" }],
    ["review-signal-reduced-motion", `/signals/${signalId}#summary`, { readySelector: "nav[aria-label='Этапы проверки']", reducedMotion: true }],
    ["review-signal-rationale", `/signals/${signalId}#rationale`, { readySelector: "nav[aria-label='Этапы проверки']" }],
    ["review-signal-related", `/signals/${signalId}#related`, { readySelector: "nav[aria-label='Этапы проверки']" }],
    ["review-signal-decision", `/signals/${signalId}#decision`, { readySelector: "nav[aria-label='Этапы проверки']" }],
  ];
} else {
  const [signalId, organizationId, patternId] = await Promise.all([
    firstId("/signals?sort=priority&page_size=1"),
    firstId("/organizations?sort=priority&page_size=1"),
    firstId("/patterns?sort=importance&page_size=1"),
  ]);

  pages = [
    ["analytics", "/"],
    ["analytics-overview", "/overview"],
    ["signals", "/signals?sort=priority"],
    ["signal-preview", `/signals?sort=priority&signal=${signalId}`],
    ["signal-card", `/signals/${signalId}`],
    ["organization-card", `/organizations/${organizationId}`],
    ["patterns", "/patterns?sort=importance"],
    ["pattern-card", `/patterns/${patternId}`],
    ["decision-journal", "/decision-journal"],
  ];
  if (includeFoundation) pages.push(["foundation-v2", "/foundation-preview"]);
}

mkdirSync(output, { recursive: true });
const manifest = [];
for (const [, route] of pages) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) throw new Error(`Не удалось подготовить страницу ${route}: ${response.status}`);
  await response.text();
}
for (const width of widths) {
  for (const [name, route, options = {}] of pages) {
    const file = join(output, `${name}-${width}.png`);
    await captureScreenshot(`${baseUrl}${route}`, width, file, options);
    manifest.push({ page: name, route, width, file });
  }
}

writeFileSync(join(output, "manifest.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, pages: manifest }, null, 2)}\n`);
process.stdout.write(`Создано снимков: ${manifest.length}. Каталог: ${output}\n`);

async function captureScreenshot(url, width, file, options) {
  const profileDirectory = mkdtempSync(join(tmpdir(), "verimed-visual-chrome-"));
  const process = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let socket;
  try {
    const browserSocketUrl = await debugSocketUrl(process);
    const debugOrigin = new URL(browserSocketUrl);
    const targets = await fetch(`http://${debugOrigin.host}/json/list`).then((response) => response.json());
    const pageTarget = targets.find((target) => target.type === "page");
    if (!pageTarget?.webSocketDebuggerUrl) throw new Error("Chrome не создал страницу для визуальной проверки.");
    socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await once(socket, "open");
    const client = createCdpClient(socket);

    if (options.failApi || options.failApiPattern) {
      client.onEvent = (message) => {
        if (message.method === "Fetch.requestPaused") {
          void client.send("Fetch.failRequest", { requestId: message.params.requestId, errorReason: "Failed" });
        }
      };
      await client.send("Fetch.enable", { patterns: [{ urlPattern: options.failApiPattern ?? "*127.0.0.1:8000/api/signals*", requestStage: "Request" }] });
    }

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 768,
      screenWidth: width,
      screenHeight: 1000,
    });
    if (options.reducedMotion) {
      await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    }
    await client.send("Page.navigate", { url });

    const readyExpression = options.readyText
      ? `document.body?.innerText.includes(${JSON.stringify(options.readyText)})`
      : `document.querySelector(${JSON.stringify(options.readySelector ?? "body")}) !== null`;
    await waitForExpression(client, `document.readyState === "complete" && (${readyExpression})`);
    await client.send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
    if (options.afterReady) {
      await client.send("Runtime.evaluate", { expression: options.afterReady });
    }
    await new Promise((resolve) => setTimeout(resolve, options.settleMs ?? 250));
    await client.send("Runtime.evaluate", { expression: "document.querySelectorAll('nextjs-portal').forEach((node) => node.remove())" });
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(file, Buffer.from(screenshot.data, "base64"));
  } finally {
    socket?.close();
    if (process.exitCode === null) {
      process.kill();
      await Promise.race([
        once(process, "exit"),
        new Promise((resolve) => setTimeout(resolve, 1_000)),
      ]);
    }
    rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function debugSocketUrl(process) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`Chrome не открыл DevTools. ${output}`)), 10_000);
    process.stderr.setEncoding("utf8");
    process.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    process.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Chrome завершился до подключения DevTools: ${code}. ${output}`));
    });
  });
}

function createCdpClient(socket) {
  let sequence = 0;
  const pending = new Map();
  const client = {
    onEvent: undefined,
    send(method, params = {}) {
      const id = ++sequence;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
  };
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (!message.id) {
      client.onEvent?.(message);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result ?? {});
  });
  return client;
}

async function waitForExpression(client, expression, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await client.send("Runtime.evaluate", { expression, returnByValue: true });
    if (result.result?.value === true) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Страница не достигла ожидаемого состояния: ${expression}`);
}
