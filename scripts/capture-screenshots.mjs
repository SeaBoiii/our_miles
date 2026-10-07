import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const origin = process.env.OUR_MILES_QA_URL ?? "http://127.0.0.1:3000";
const output = "artifacts/qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const report = [];
const sample = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const samplePage = await sample.newPage();
async function open(page, view) {
  await page.goto(`${origin}/#${view}`);
  await page.locator(".app-shell").waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function enter(page, amount, merchant) {
  await page.getByLabel("Purchase amount in Singapore dollars").fill(amount);
  await page.locator("#merchant").fill(merchant);
  await page.locator(".recommendation").waitFor();
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))); });
}
await open(samplePage, "what-card");
await enter(samplePage, "512", "Insta360");
await samplePage.getByRole("button", { name: "Record this purchase" }).click();
await samplePage.getByRole("button", { name: /See our best card/ }).click();
await samplePage.screenshot({ path: `${output}/purchase-recorded-390.png` });
const fixture = await samplePage.evaluate(() => localStorage.getItem("our-miles-demo"));
await sample.close();

for (const [width, height] of [[360, 800], [390, 844], [393, 873], [412, 915], [430, 932], [1440, 1000]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await context.addInitScript((saved) => localStorage.setItem("our-miles-demo", saved), fixture);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push({ width, message: error.message }));
  for (const view of ["home", "what-card", "wallet", "bonuses", "goals", "activity"]) {
    await open(page, view);
    if (view === "what-card") await enter(page, "512", "Insta360");
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: `${output}/${view}-${width}.png`, fullPage: true });
    if (view === "what-card") {
      await page.locator(".recommendation").screenshot({ path: `${output}/recommendation-${width}.png` });
      if (width < 768) {
        await page.getByRole("button", { name: /See our best card/ }).click();
        await page.screenshot({ path: `${output}/recommendation-reached-${width}.png` });
      }
    }
    const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
    report.push({ view, width, height, ...geometry });
  }
  if (width === 390) {
    await open(page, "what-card");
    await enter(page, "512", "Insta360");
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, "height", { configurable: true, get: () => 410 });
      window.visualViewport.dispatchEvent(new Event("resize"));
    });
    await page.getByLabel("Purchase amount in Singapore dollars").focus();
    await page.screenshot({ path: `${output}/keyboard-viewport-emulation-390.png` });
    report.push({ keyboardEmulation: true, navHidden: await page.locator(".bottom-nav").evaluate((node) => node.classList.contains("keyboard-hidden")) });
    await page.getByRole("button", { name: /Profile and settings/ }).click();
    await page.getByRole("dialog").screenshot({ path: `${output}/profile-sheet-390.png` });
  }
  await context.close();
}

const stressContext = await browser.newContext({ viewport: { width: 360, height: 800 }, reducedMotion: "reduce" });
await stressContext.addInitScript((saved) => localStorage.setItem("our-miles-demo", saved), fixture);
const stressPage = await stressContext.newPage();
await open(stressPage, "what-card");
await enter(stressPage, "999999.99", "Singapore Airlines and Air New Zealand — multi-city honeymoon flights with a very long merchant description");
await stressPage.getByRole("button", { name: "Record this purchase" }).click();
await stressPage.getByRole("button", { name: /Profile and settings/ }).click();
await stressPage.getByLabel("Opening miles balance").fill("999999999");
await stressPage.getByRole("button", { name: "Save preferences" }).click();
await stressPage.locator(".toast").waitFor({ state: "hidden" });
for (const view of ["home", "activity", "goals"]) {
  await open(stressPage, view);
  await stressPage.screenshot({ path: `${output}/stress-${view}-360.png`, fullPage: true });
  report.push({ stress: true, view, overflow: await stressPage.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
}
await stressPage.getByRole("button", { name: /Profile and settings/ }).click();
await stressPage.getByRole("button", { name: "Start fresh" }).click();
await stressPage.getByRole("button", { name: "Clear sample wallet" }).click();
for (const view of ["home", "wallet", "bonuses", "activity"]) {
  await open(stressPage, view);
  await stressPage.screenshot({ path: `${output}/empty-${view}-360.png`, fullPage: true });
}
await stressContext.close();

// Capture the actionable edge states with real editor interactions, not invented reward snapshots.
const edgeContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const edgePage = await edgeContext.newPage();
await open(edgePage, "wallet");
for (const [name, spend] of [["unused", "0"], ["half", "500"], ["near-cap", "950"], ["capped", "1000"], ["exceeded", "1150"]]) {
  await edgePage.getByRole("button", { name: /Aleem's Citi Rewards/ }).click();
  await edgePage.getByRole("dialog").getByLabel("Bonus-eligible spend before our app records", { exact: false }).fill(spend);
  await edgePage.getByRole("dialog").getByRole("button", { name: "Save card" }).click();
  await edgePage.getByRole("button", { name: /Aleem's Citi Rewards/ }).screenshot({ path: `${output}/capacity-${name}-390.png` });
}
await open(edgePage, "bonuses");
const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
const past = new Date(`${localDate}T00:00:00Z`); past.setUTCDate(past.getUTCDate() - 1);
const expired = past.toISOString().slice(0, 10);
for (const [name, spend, isExpired] of [["started", "0", false], ["almost-complete", "990", false], ["target-reached", "3000", false], ["expired", "760", true]]) {
  await edgePage.getByRole("button", { name: "Edit offer & planned spend" }).click();
  const sheet = edgePage.getByRole("dialog");
  await sheet.getByLabel("Eligible spend before our records (S$)").fill(spend);
  await sheet.getByLabel("Offer terms URL").fill("https://example.test/sample-terms");
  if (isExpired) {
    const start = new Date(past); start.setUTCDate(start.getUTCDate() - 10);
    await sheet.getByLabel("Starts", { exact: true }).fill(start.toISOString().slice(0, 10));
    await sheet.getByLabel("Deadline", { exact: true }).fill(expired);
  }
  await sheet.getByRole("button", { name: "Save offer" }).click();
  await edgePage.locator(".bonus-detail").screenshot({ path: `${output}/offer-${name}-390.png` });
}
await edgeContext.close();
for (const [width, height] of [[360, 800], [393, 873], [412, 915], [430, 932]]) {
  const tiles = [];
  for (const [index, view] of ["home", "what-card", "wallet", "bonuses", "goals", "activity"].entries()) {
    const tile = await sharp(`${output}/${view}-${width}.png`).extract({ left: 0, top: 0, width, height }).resize({ width: 300 }).png().toBuffer();
    tiles.push({ input: tile, left: index * 300, top: 0 });
  }
  await sharp({ create: { width: 1800, height: Math.round(height / width * 300), channels: 3, background: "#ffffff" } }).composite(tiles).png().toFile(`${output}/mobile-first-folds-${width}.png`);
}
await writeFile(`${output}/geometry-report.json`, JSON.stringify({ report, errors }, null, 2));
await browser.close();
console.log(`Captured six screens at six widths, plus result, sheet, keyboard, empty, stress, cap and offer states in ${output}.`);
console.log(JSON.stringify({ overflows: report.filter((entry) => entry.overflow), errors }, null, 2));
