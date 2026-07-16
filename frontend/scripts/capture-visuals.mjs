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
const organizationsOnly = process.argv.includes("--organizations");
const patternsOnly = process.argv.includes("--patterns");
const analyticsOnly = process.argv.includes("--analytics");
const pageMatch = process.env.VERIMED_VISUAL_MATCH;
const requestedWidths = process.env.VERIMED_VISUAL_WIDTHS?.split(",").map(Number).filter((value) => Number.isInteger(value) && value > 0);
const widths = requestedWidths?.length ? requestedWidths : shellOnly || organizationsOnly || patternsOnly || analyticsOnly ? [1440, 1280, 768, 375] : [1440, 768, 375];
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
} else if (organizationsOnly) {
  const organizationId = await firstId("/organizations?sort=priority&page_size=1");
  const organization = await fetch(`${apiUrl}/organizations/${organizationId}`).then((response) => response.json());
  const encodedRegion = encodeURIComponent(organization.region);
  const longName = `${organization.name} — многопрофильный консультативно-диагностический центр регионального значения`;
  pages = [
    ["organizations-list", "/organizations?sort=priority", { readySelector: "[data-testid='organizations-mobile-list']" }],
    ["organizations-list-filtered", `/organizations?region=${encodedRegion}&risk_level=${encodeURIComponent("Критический")}&sort=financial&direction=desc`, { readySelector: "[data-testid='organizations-mobile-list']", widths: [1440, 375] }],
    ["organizations-list-loading", "/organizations?sort=priority", { readySelector: "[data-skeleton='list']", settleMs: 0, stallApiPattern: "*127.0.0.1:8000/api/organizations?*", widths: [1440, 375] }],
    ["organizations-list-empty", "/organizations?search=visual-no-matches", { readyText: "По выбранным условиям организаций нет", widths: [1440, 375] }],
    ["organizations-list-error", "/organizations?sort=priority", { readyText: "Не удалось загрузить организации", failApiPattern: "*127.0.0.1:8000/api/organizations?*", widths: [1440, 375] }],
    ["organizations-export-loading", "/organizations?sort=priority", { readySelector: "[data-testid='organizations-mobile-list']", afterReady: "Array.from(document.querySelectorAll('button')).find((item) => item.textContent.includes('Экспортировать') && item.getBoundingClientRect().width > 0)?.click()", stallApiPattern: "*127.0.0.1:8000/api/exports/organizations.csv*", widths: [1440] }],
    ["organizations-export-error", "/organizations?sort=priority", { readySelector: "[data-testid='organizations-mobile-list']", afterReady: "Array.from(document.querySelectorAll('button')).find((item) => item.textContent.includes('Экспортировать') && item.getBoundingClientRect().width > 0)?.click()", failApiPattern: "*127.0.0.1:8000/api/exports/organizations.csv*", widths: [1440] }],
    ["organization-summary", `/organizations/${organizationId}`, { readySelector: "#summary" }],
    ["organization-summary-reduced-motion", `/organizations/${organizationId}`, { readySelector: "#summary", reducedMotion: true, widths: [375] }],
    ["organization-summary-zoom-200", `/organizations/${organizationId}`, { readySelector: "#summary", pageScaleFactor: 2, widths: [1440] }],
    ["organization-comparison", `/organizations/${organizationId}`, { readySelector: "#comparison", afterReady: "document.getElementById('comparison')?.scrollIntoView()", widths: [1440, 375] }],
    ["organization-signals", `/organizations/${organizationId}`, { readySelector: "#signals", afterReady: "document.getElementById('signals')?.scrollIntoView()", widths: [1440, 375] }],
    ["organization-patterns", `/organizations/${organizationId}`, { readySelector: "#patterns", afterReady: "document.getElementById('patterns')?.scrollIntoView()", widths: [1440, 375] }],
    ["organization-long-name", `/organizations/${organizationId}`, { readySelector: "h1", afterReady: `document.querySelector("h1").textContent = ${JSON.stringify(longName)}`, widths: [1440, 375] }],
    ["organization-empty-signals", `/organizations/${organizationId}`, { readyText: "Сигналы не сформированы", mockApiResponses: [{ pattern: `*127.0.0.1:8000/api/organizations/${organizationId}`, body: { ...organization, recent_signals: [] } }], afterReady: "document.getElementById('signals')?.scrollIntoView()", widths: [1440, 375] }],
    ["organization-empty-patterns", `/organizations/${organizationId}`, { readyText: "Повторяющиеся модели не сформированы", mockApiResponses: [{ pattern: `*127.0.0.1:8000/api/organizations/${organizationId}/patterns`, body: [] }], afterReady: "document.getElementById('patterns')?.scrollIntoView()", widths: [1440, 375] }],
    ["organization-detail-loading", `/organizations/${organizationId}`, { readySelector: "[data-skeleton='detail']", settleMs: 0, stallApiPattern: `*127.0.0.1:8000/api/organizations/${organizationId}`, widths: [1440, 375] }],
    ["organization-detail-error", `/organizations/${organizationId}`, { readyText: "Не удалось загрузить организацию", failApiPattern: `*127.0.0.1:8000/api/organizations/${organizationId}`, widths: [1440, 375] }],
  ];
} else if (patternsOnly) {
  const patternList = await fetch(`${apiUrl}/patterns?sort=importance&page_size=1`).then((response) => response.json());
  const pattern = patternList.items[0];
  if (!pattern?.id) throw new Error("В списке нет модели для визуальной проверки.");
  const patternId = pattern.id;
  const detail = await fetch(`${apiUrl}/patterns/${patternId}`).then((response) => response.json());
  const filteredImportance = encodeURIComponent(pattern.importance_level);
  const filteredType = encodeURIComponent(pattern.pattern_type_label);
  const emptyDetail = { ...detail, organizations: [], doctors: [], patients: [], services: [] };
  const insufficientRecurrence = {
    entity_fingerprint: detail.fingerprint,
    first_detected_at: detail.first_seen,
    last_detected_at: detail.last_seen,
    appeared_runs: 1,
    absent_runs: 0,
    last_expert_status: null,
    points: [{
      analysis_run_id: 1,
      appeared_at: detail.last_seen,
      risk_score: null,
      priority_score: null,
      stability_score: detail.stability_score,
      importance_score: detail.importance_score,
      financial_significance: detail.financial_significance,
      signal_count: detail.signal_count,
      status: "Активна",
      participant_signature: null,
    }],
  };
  pages = [
    ["patterns-list", "/patterns?sort=importance", { readySelector: "[data-testid='patterns-mobile-list']" }],
    ["patterns-list-filtered", `/patterns?importance=${filteredImportance}&pattern_type=${filteredType}&sort=stability`, { readySelector: "[data-testid='patterns-mobile-list']", widths: [1440, 375] }],
    ["patterns-list-loading", "/patterns?sort=importance", { readySelector: "[data-skeleton='list']", settleMs: 0, stallApiPattern: "*127.0.0.1:8000/api/patterns?*", widths: [1440, 375] }],
    ["patterns-list-empty", "/patterns?financial_min=999999999999", { readyText: "По выбранным условиям моделей нет", widths: [1440, 375] }],
    ["patterns-list-error", "/patterns?sort=importance", { readyText: "Не удалось загрузить модели", failApiPattern: "*127.0.0.1:8000/api/patterns?*", widths: [1440, 375] }],
    ["pattern-summary", `/patterns/${patternId}`, { readySelector: "#summary" }],
    ["pattern-summary-reduced-motion", `/patterns/${patternId}`, { readySelector: "#summary", reducedMotion: true, widths: [375] }],
    ["pattern-summary-zoom-200", `/patterns/${patternId}`, { readySelector: "#summary", pageScaleFactor: 2, widths: [1440] }],
    ["pattern-factors", `/patterns/${patternId}`, { readySelector: "#importance", afterReady: "document.getElementById('importance')?.scrollIntoView()", widths: [1440, 375] }],
    ["pattern-dynamics", `/patterns/${patternId}`, { readySelector: "#importance", afterReady: "document.getElementById('importance')?.scrollIntoView(); const summary = Array.from(document.querySelectorAll('summary')).find((item) => item.textContent.includes('Динамика важности')); summary?.click(); setTimeout(() => summary?.closest('details')?.scrollIntoView(), 500)", settleMs: 1000, widths: [1440, 375] }],
    ["pattern-participants", `/patterns/${patternId}`, { readySelector: "#participants", afterReady: "document.getElementById('participants')?.scrollIntoView()", widths: [1440, 375] }],
    ["pattern-graph", `/patterns/${patternId}`, { readySelector: "#graph", afterReady: "document.getElementById('graph')?.scrollIntoView()", settleMs: 1000, widths: [1440] }],
    ["pattern-graph-selected", `/patterns/${patternId}`, { readySelector: "#graph", afterReady: "document.getElementById('graph')?.scrollIntoView(); setTimeout(() => document.querySelector('[data-graph-node-id]:not([data-node-type=\"pattern\"])')?.click(), 650)", settleMs: 1200, widths: [1440] }],
    ["pattern-graph-mobile-list", `/patterns/${patternId}`, { readySelector: "#graph", afterReady: "document.getElementById('graph')?.scrollIntoView()", settleMs: 900, widths: [375] }],
    ["pattern-signals", `/patterns/${patternId}`, { readySelector: "#incoming-signals", afterReady: "document.getElementById('incoming-signals')?.scrollIntoView()", settleMs: 800, widths: [1440, 375] }],
    ["pattern-signal-preview", `/patterns/${patternId}`, { readySelector: "#incoming-signals", afterReady: "document.getElementById('incoming-signals')?.scrollIntoView(); setTimeout(() => document.querySelector('#incoming-signals tbody tr')?.click(), 550)", settleMs: 1000, widths: [1440, 375] }],
    ["pattern-decision", `/patterns/${patternId}`, { readySelector: "#decision", afterReady: "document.getElementById('decision')?.scrollIntoView()", settleMs: 800, widths: [1440, 375] }],
    ["pattern-insufficient-timeline", `/patterns/${patternId}`, { readySelector: "#importance", mockApiResponses: [{ pattern: `*127.0.0.1:8000/api/patterns/${patternId}/recurrence-history`, body: insufficientRecurrence }], afterReady: "document.getElementById('importance')?.scrollIntoView(); const summary = Array.from(document.querySelectorAll('summary')).find((item) => item.textContent.includes('Динамика важности')); summary?.click(); setTimeout(() => summary?.closest('details')?.scrollIntoView(), 500)", settleMs: 1000, widths: [1440, 375] }],
    ["pattern-empty-participants", `/patterns/${patternId}`, { readyText: "Участники не сформированы", mockApiResponses: [{ pattern: `*127.0.0.1:8000/api/patterns/${patternId}`, body: emptyDetail }], afterReady: "document.getElementById('participants')?.scrollIntoView()", widths: [1440, 375] }],
    ["pattern-graph-error", `/patterns/${patternId}`, { readySelector: "#graph", failApiPattern: `*127.0.0.1:8000/api/patterns/${patternId}/graph*`, afterReady: "document.getElementById('graph')?.scrollIntoView()", settleMs: 1000, widths: [1440, 375] }],
    ["pattern-detail-loading", `/patterns/${patternId}`, { readySelector: "[data-skeleton='detail']", settleMs: 0, stallApiPattern: `*127.0.0.1:8000/api/patterns/${patternId}`, widths: [1440, 375] }],
    ["pattern-detail-error", `/patterns/${patternId}`, { readyText: "Не удалось загрузить модель", failApiPattern: `*127.0.0.1:8000/api/patterns/${patternId}`, widths: [1440, 375] }],
  ];
} else if (analyticsOnly) {
  const [home, overview] = await Promise.all([
    fetch(`${apiUrl}/analytics/home`).then((response) => response.json()),
    fetch(`${apiUrl}/analytics/overview`).then((response) => response.json()),
  ]);
  const emptyHome = {
    ...home,
    command_center: {
      ...home.command_center,
      top_financial_signal: null,
      priority_organization: null,
    },
    pattern_summary: {
      ...home.pattern_summary,
      top_importance_pattern: null,
      attention_patterns: [],
    },
    priority_organizations: {
      ...home.priority_organizations,
      items: [],
      total: 0,
    },
  };
  const insufficientTimeline = {
    ...overview,
    timeline: overview.timeline?.slice(0, 1) ?? [],
  };
  const overviewWithoutTimeline = { ...overview };
  delete overviewWithoutTimeline.timeline;
  pages = [
    ["analytics-home", "/", { readySelector: "[data-testid='analytics-home']" }],
    ["analytics-home-loading", "/", { readySelector: "[data-skeleton='dashboard']", settleMs: 0, stallApiPattern: "*127.0.0.1:8000/api/analytics/home*", widths: [1440, 375] }],
    ["analytics-home-empty", "/", { readyText: "Приоритетный сигнал пока не определён", mockApiResponses: [{ pattern: "*127.0.0.1:8000/api/analytics/home*", body: emptyHome }], widths: [1440, 375] }],
    ["analytics-home-error", "/", { readyText: "Не удалось получить данные", failApiPattern: "*127.0.0.1:8000/api/analytics/home*", widths: [1440, 375] }],
    ["analytics-overview-signals", "/overview", { readySelector: "[data-testid='regional-monitoring']" }],
    ["analytics-overview-financial", "/overview", { readySelector: "[data-testid='regional-monitoring']", afterReady: "Array.from(document.querySelectorAll(\"button[role='radio']\")).find((item) => item.textContent.includes('Финансовая'))?.click()", widths: [1440] }],
    ["analytics-overview-priority", "/overview", { readySelector: "[data-testid='regional-monitoring']", afterReady: "Array.from(document.querySelectorAll(\"button[role='radio']\")).find((item) => item.textContent.includes('Приоритет'))?.click()", widths: [1440] }],
    ["analytics-overview-selected-region", "/overview", { readySelector: "[data-region-code][data-state='data']", afterReady: "document.querySelector(\"[data-region-code][data-state='data']\")?.closest('a')?.focus()", widths: [1440] }],
    ["analytics-overview-region-no-data", "/overview", { readySelector: "[data-region-code][data-state='no-data']", afterReady: "document.querySelector(\"[data-region-code][data-state='no-data']\")?.closest('a')?.focus()", widths: [1440] }],
    ["analytics-overview-mobile-map", "/overview", { readyText: "Показать карту", afterReady: "const summary = Array.from(document.querySelectorAll('summary')).find((item) => item.textContent.includes('Показать карту')); summary?.click(); document.querySelector(\"[data-testid='regional-map-mobile'] svg\")?.scrollIntoView({ block: 'center' })", settleMs: 500, widths: [375] }],
    ["analytics-overview-timeline-insufficient", "/overview", { readyText: "Недостаточно периодов для динамики", mockApiResponses: [{ pattern: "*127.0.0.1:8000/api/analytics/overview*", body: insufficientTimeline }], afterReady: "Array.from(document.querySelectorAll('p')).find((item) => item.textContent.includes('Недостаточно периодов для динамики'))?.closest('section')?.scrollIntoView()", widths: [1440, 375] }],
    ["analytics-overview-map-error", "/overview", { readySelector: "[data-testid='regional-monitoring']", failApiPattern: "*127.0.0.1:3000/maps/kazakhstan-adm1.geojson*", afterReady: "const summary = Array.from(document.querySelectorAll('summary')).find((item) => item.textContent.includes('Показать карту')); summary?.click(); document.querySelector(\"[data-testid='regional-map-mobile'] p\")?.closest('div.flex')?.scrollIntoView({ block: 'center' })", settleMs: 500, widths: [1440, 375] }],
    ["analytics-overview-timeline-error", "/overview", { readyText: "Динамика недоступна", mockApiResponses: [{ pattern: "*127.0.0.1:8000/api/analytics/overview*", body: overviewWithoutTimeline }], afterReady: "Array.from(document.querySelectorAll('p')).find((item) => item.textContent.includes('Динамика недоступна'))?.closest('section')?.scrollIntoView()", widths: [1440, 375] }],
    ["analytics-overview-print", "/overview", { readySelector: "#overview-content", printMedia: true, printPdf: true, widths: [1440] }],
    ["analytics-overview-fullscreen", "/overview", { readySelector: "#overview-content", afterReady: "Array.from(document.querySelectorAll('button')).find((item) => item.textContent.includes('Развернуть'))?.click()", settleMs: 500, widths: [1440] }],
    ["analytics-overview-reduced-motion", "/overview", { readySelector: "#overview-content", reducedMotion: true, widths: [375] }],
    ["analytics-overview-zoom-200", "/overview", { readySelector: "#overview-content", pageScaleFactor: 2, widths: [1440] }],
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
if (pageMatch) pages = pages.filter(([name]) => name.includes(pageMatch));

mkdirSync(output, { recursive: true });
const manifest = [];
for (const [, route] of pages) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) throw new Error(`Не удалось подготовить страницу ${route}: ${response.status}`);
  await response.text();
}
for (const width of widths) {
  for (const [name, route, options = {}] of pages) {
    if (options.widths && !options.widths.includes(width)) continue;
    const file = join(output, `${name}-${width}.png`);
    try {
      await captureScreenshot(`${baseUrl}${route}`, width, file, options);
    } catch (error) {
      throw new Error(`Не удалось создать снимок ${name} (${width}px): ${error instanceof Error ? error.message : String(error)}`);
    }
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
    const runtimeIssues = [];
    client.onEvent = (message) => {
      if (message.method === "Runtime.exceptionThrown") {
        runtimeIssues.push(message.params.exceptionDetails?.text ?? "Необработанное исключение");
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        runtimeIssues.push(message.params.args?.map((argument) => argument.value ?? argument.description ?? "").join(" ") || "Ошибка браузерной консоли");
      }
    };

    if (options.failApi || options.failApiPattern || options.stallApiPattern || options.mockApiResponses) {
      const runtimeHandler = client.onEvent;
      client.onEvent = (message) => {
        runtimeHandler(message);
        if (message.method === "Fetch.requestPaused") {
          const mock = options.mockApiResponses?.find((entry) => wildcardMatch(message.params.request.url, entry.pattern));
          if (mock) {
            const isPreflight = message.params.request.method === "OPTIONS";
            void client.send("Fetch.fulfillRequest", {
              requestId: message.params.requestId,
              responseCode: isPreflight ? 204 : 200,
              responseHeaders: [
                { name: "content-type", value: "application/json; charset=utf-8" },
                { name: "access-control-allow-origin", value: "*" },
                { name: "access-control-allow-methods", value: "GET, POST, OPTIONS" },
                { name: "access-control-allow-headers", value: "content-type" },
              ],
              body: isPreflight ? undefined : Buffer.from(JSON.stringify(mock.body)).toString("base64"),
            });
          } else if (options.stallApiPattern) {
            return;
          } else {
            void client.send("Fetch.failRequest", { requestId: message.params.requestId, errorReason: "Failed" });
          }
        }
      };
      const patterns = options.mockApiResponses?.map((entry) => ({ urlPattern: entry.pattern, requestStage: "Request" })) ?? [{ urlPattern: options.failApiPattern ?? options.stallApiPattern ?? "*127.0.0.1:8000/api/signals*", requestStage: "Request" }];
      await client.send("Fetch.enable", { patterns });
    }

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    const scale = options.pageScaleFactor ?? 1;
    const effectiveWidth = Math.round(width / scale);
    const effectiveHeight = Math.round(1000 / scale);
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: effectiveWidth,
      height: effectiveHeight,
      deviceScaleFactor: scale,
      mobile: effectiveWidth < 768,
      screenWidth: effectiveWidth,
      screenHeight: effectiveHeight,
    });
    if (options.reducedMotion || options.printMedia) {
      await client.send("Emulation.setEmulatedMedia", {
        media: options.printMedia ? "print" : "",
        features: options.reducedMotion ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [],
      });
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
    const overflow = await client.send("Runtime.evaluate", {
      expression: "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1",
      returnByValue: true,
    });
    if (overflow.result?.value === true) {
      const overflowDetails = await client.send("Runtime.evaluate", {
        expression: `JSON.stringify(Array.from(document.querySelectorAll("*"))
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return { tag: node.tagName, className: String(node.className || "").slice(0, 160), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), scrollWidth: node.scrollWidth };
          })
          .filter((item) => item.right > document.documentElement.clientWidth + 1 || item.left < -1 || item.scrollWidth > item.width + 1)
          .sort((left, right) => (right.right - document.documentElement.clientWidth) - (left.right - document.documentElement.clientWidth))
          .slice(0, 8))`,
        returnByValue: true,
      });
      throw new Error(`Обнаружено горизонтальное переполнение документа: ${overflowDetails.result?.value ?? "элемент не определён"}`);
    }
    if (runtimeIssues.length > 0) {
      throw new Error(`Ошибки браузерной консоли: ${runtimeIssues.join(" | ")}`);
    }
    await client.send("Runtime.evaluate", { expression: "document.querySelectorAll('nextjs-portal').forEach((node) => node.remove())" });
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(file, Buffer.from(screenshot.data, "base64"));
    if (options.printPdf) {
      const pdf = await client.send("Page.printToPDF", {
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
      });
      writeFileSync(file.replace(/\.png$/, ".pdf"), Buffer.from(pdf.data, "base64"));
    }
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

function wildcardMatch(value, pattern) {
  const expression = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${expression}$`).test(value);
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
  const diagnostic = await client.send("Runtime.evaluate", {
    expression: "document.body?.innerText.slice(0, 800) ?? ''",
    returnByValue: true,
  });
  throw new Error(`Страница не достигла ожидаемого состояния: ${expression}. Видимый текст: ${diagnostic.result?.value ?? "недоступен"}`);
}
