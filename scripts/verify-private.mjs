/* Isolated production smoke test. Run after npm run build; never uses real credentials. */
import { spawn } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const port = Number(process.env.OUR_MILES_QA_PORT || 3001);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Choose an unprivileged local QA port.");
// Never send random test sign-in attempts or writes to an existing private server.
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", () => reject(new Error("The private QA port is already in use. Choose another OUR_MILES_QA_PORT.")));
  probe.listen(port, "127.0.0.1", () => probe.close(resolve));
});
const origin = `http://localhost:${port}`;
const directory = await mkdtemp(path.join(tmpdir(), "our-miles-private-smoke-"));
const pin = String(randomInt(100000, 1000000));
const secret = randomBytes(48).toString("hex");
const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--port", String(port), "--hostname", "127.0.0.1"], {
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    OUR_MILES_PIN: pin,
    OUR_MILES_SESSION_SECRET: secret,
    OUR_MILES_PUBLIC_ORIGIN: origin,
    OUR_MILES_DATA_DIR: directory,
    OUR_MILES_SUPABASE_URL: "",
    OUR_MILES_SUPABASE_SECRET_KEY: "",
    OUR_MILES_TRUST_PROXY: "false",
  },
});
let browser;

try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/session`);
      const session = await response.json();
      if (response.ok && session.mode === "private") { ready = true; break; }
    } catch { /* The isolated server is still starting. */ }
    if (server.exitCode !== null) throw new Error("The isolated production server exited before it was ready.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("The isolated production server did not become ready.");
  const denied = await fetch(`${origin}/api/state`);
  if (denied.status !== 401) throw new Error("Private state was accessible without sign-in.");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("radio", { name: "Nurul", exact: true }).check();
  await page.getByLabel("Our private PIN").fill(pin);
  await page.getByRole("button", { name: "Open our wallet" }).click();
  await expect(page.getByRole("button", { name: "Profile and settings, current person Nurul" })).toBeVisible();
  await expect(page.getByText("Sample wallet · your real data starts fresh")).toHaveCount(0);
  const cookie = (await context.cookies()).find((item) => item.name === "our_miles_session");
  if (!cookie?.httpOnly || !cookie.secure || cookie.sameSite !== "Strict") throw new Error("The private session cookie lacks required protection.");

  await page.getByRole("button", { name: "Profile and settings, current person Nurul" }).click();
  await page.getByLabel("Opening miles balance").fill("123456");
  const saving = page.waitForResponse((response) => response.url().endsWith("/api/state") && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Save preferences" }).click();
  if ((await saving).status() !== 200) throw new Error("The private browser save failed.");
  await expect(page.getByText("Preferences saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Profile and settings, current person Nurul" })).toBeVisible();
  const saved = await page.evaluate(async () => (await fetch("/api/state", { cache: "no-store" })).json());
  if (saved.version !== 1 || saved.state.mileBalance !== 123456) throw new Error("Private state did not survive reload.");
  await mkdir("artifacts/private", { recursive: true });
  await page.screenshot({ path: "artifacts/private/saved-mobile.png", fullPage: true });

  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const secondPage = await second.newPage();
  await secondPage.goto(origin);
  await secondPage.getByLabel("Our private PIN").fill(pin);
  await secondPage.getByRole("button", { name: "Open our wallet" }).click();
  await expect(secondPage.getByRole("button", { name: "Profile and settings, current person Aleem" })).toBeVisible();
  const shared = await secondPage.evaluate(async () => (await fetch("/api/state", { cache: "no-store" })).json());
  if (shared.state.mileBalance !== 123456 || shared.version !== 1) throw new Error("A second device did not receive the shared wallet.");
  const changed = await secondPage.evaluate(async () => {
    const current = await (await fetch("/api/state", { cache: "no-store" })).json();
    return (await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: current.version, state: { ...current.state, mileBalance: 123457 } }) })).json();
  });
  if (changed.version !== 2) throw new Error("The second device could not save a shared update.");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("region", { name: "Shared estimated miles" })).toContainText("123,457");
  await second.close();

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: "Wallet", exact: true }).click();
  await page.getByRole("button", { name: /Citi Rewards.*Ownership unconfirmed/ }).click();
  await page.getByLabel(/^Owner/).selectOption("Nurul");
  await page.getByLabel(/^Status/).selectOption("active");
  await page.getByLabel(/Statement cycle starts on day/).fill("1");
  await page.getByLabel("I have checked this period’s usage").check();
  await page.getByLabel(/Bonus-eligible spend before our app records/).fill("0");
  const confirmingCard = page.waitForResponse((response) => response.url().endsWith("/api/state") && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  if ((await confirmingCard).status() !== 200) throw new Error("The owned card could not be confirmed through the private UI.");
  await expect(page.getByRole("button", { name: "Nurul's Citi Rewards, S$1,000 bonus capacity left", exact: true })).toBeVisible();
  await navigation.getByRole("button", { name: "What Card?", exact: true }).click();
  await page.getByLabel("Purchase amount in Singapore dollars").fill("512");
  await page.getByRole("textbox", { name: /^Merchant optional/ }).fill("Insta360");
  await page.getByRole("button", { name: "See our best card", exact: true }).click();
  const recommendation = page.getByRole("region", { name: "Card recommendation" });
  await expect(recommendation.getByRole("heading", { name: "Citi Rewards", exact: true })).toBeVisible();
  await expect(recommendation).toContainText("2,048 miles");
  const recording = page.waitForResponse((response) => response.url().endsWith("/api/state") && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Record this purchase", exact: true }).click();
  const recordedResponse = await recording;
  if (recordedResponse.status() !== 200) throw new Error("The S$512 private purchase could not be recorded.");
  const recordedState = await recordedResponse.json();
  if (recordedState.state.transactions.length !== 1 || recordedState.state.transactions[0].reward.miles !== 2048) throw new Error("The recorded private reward snapshot is incorrect.");
  await expect(recommendation).toContainText("Recorded with Nurul");
  await expect(recommendation).toContainText("2,048 miles");
  await page.screenshot({ path: "artifacts/private/recorded-result-mobile.png" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/private/recorded-mobile.png", fullPage: true });
  await navigation.getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(page.getByRole("button", { name: "Nurul's Citi Rewards, S$488 bonus capacity left", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Nurul's Citi Rewards, S$488 bonus capacity left", exact: true })).toBeVisible();
  const recordedAfterReload = await page.evaluate(async () => (await fetch("/api/state", { cache: "no-store" })).json());
  if (recordedAfterReload.state.transactions[0].reward.miles !== 2048 || recordedAfterReload.state.transactions[0].merchant !== "Insta360") throw new Error("The recorded purchase did not survive a private reload.");
  await page.screenshot({ path: "artifacts/private/wallet-after-record-mobile.png", fullPage: true });

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole("button", { name: "Profile and settings, current person Nurul" })).toBeVisible();
  const cachedUrls = await page.evaluate(async () => {
    const urls = [];
    for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) urls.push(request.url);
    return urls;
  });
  if (cachedUrls.some((url) => new URL(url).pathname.startsWith("/api/"))) throw new Error("Private API responses entered Cache Storage.");
  const localValues = await page.evaluate(() => ({ mode: localStorage.getItem("our-miles-mode"), keys: Object.keys(localStorage) }));
  if (localValues.mode !== "private" || localValues.keys.includes("our-miles-private")) throw new Error("Private data was persisted in browser storage.");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile and settings, current person Nurul" })).toHaveCount(0);
  await page.screenshot({ path: "artifacts/private/offline-mobile.png", fullPage: true });
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "Profile and settings, current person Nurul" })).toBeVisible();
  if (errors.length) throw new Error(`Browser runtime errors: ${errors.join("; ")}`);
  console.log(JSON.stringify({ mode: "private", login: "passed", secureCookie: "passed", saveReload: "passed", secondDevice: "passed", foregroundSync: "passed", ownedCard: "passed", purchase512: "2048 miles persisted", capacityAfterRecord: "S$488 persisted", originalResult: "preserved", offlineGate: "passed", apiCache: "empty", cachedPublicFiles: cachedUrls.length, runtimeErrors: errors.length }));
} finally {
  if (browser) await browser.close();
  server.kill();
  if (server.exitCode === null) await new Promise((resolve) => { server.once("exit", resolve); setTimeout(resolve, 3000); });
  const resolved = path.resolve(directory);
  if (!resolved.startsWith(path.join(path.resolve(tmpdir()), "our-miles-private-smoke-"))) throw new Error("Refusing to delete an unexpected smoke-test directory.");
  await rm(resolved, { recursive: true, force: true });
}
