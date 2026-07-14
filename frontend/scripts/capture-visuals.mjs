import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.env.VERIMED_BASE_URL ?? "http://127.0.0.1:3000";
const apiUrl = process.env.VERIMED_API_URL ?? "http://127.0.0.1:8000/api";
const output = process.env.VERIMED_VISUAL_OUTPUT ?? join(tmpdir(), "verimed-visuals");
const includeFoundation = process.env.VERIMED_INCLUDE_FOUNDATION === "true" || process.argv.includes("--foundation");
const widths = [1440, 768, 375];
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

const [signalId, organizationId, patternId] = await Promise.all([
  firstId("/signals?sort=priority&page_size=1"),
  firstId("/organizations?sort=priority&page_size=1"),
  firstId("/patterns?sort=importance&page_size=1"),
]);

const pages = [
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

mkdirSync(output, { recursive: true });
const manifest = [];
for (const [, route] of pages) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) throw new Error(`Не удалось подготовить страницу ${route}: ${response.status}`);
  await response.text();
}
for (const width of widths) {
  for (const [name, route] of pages) {
    const file = join(output, `${name}-${width}.png`);
    execFileSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--virtual-time-budget=8000",
      `--window-size=${width},1000`,
      `--screenshot=${file}`,
      `${baseUrl}${route}`,
    ], { stdio: "ignore" });
    manifest.push({ page: name, route, width, file });
  }
}

writeFileSync(join(output, "manifest.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, pages: manifest }, null, 2)}\n`);
process.stdout.write(`Создано снимков: ${manifest.length}. Каталог: ${output}\n`);
