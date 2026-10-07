import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ reducedMotion: "reduce" });

async function openApp(page: Page, hash = "home") {
  await page.goto(`/#${hash}`);
  await expect(page.locator(".app-shell")).toBeVisible();
}
async function purchase(page: Page, amount: string, merchant = "Insta360") {
  await openApp(page, "what-card");
  await page.getByLabel("Purchase amount in Singapore dollars").fill(amount);
  await page.locator("#merchant").fill(merchant);
  await expect(page.locator(".recommendation")).toBeVisible();
}
async function profile(page: Page) {
  await page.getByRole("button", { name: /Profile and settings/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))); });
  return page.getByRole("dialog");
}

test("online purchase records the original reward, reduces capacity and reverses safely", async ({ page }) => {
  await purchase(page, "512");
  await expect(page.locator(".recommendation")).toContainText("Use Aleem’s");
  await expect(page.locator(".reward-miles")).toHaveText("≈ 2,048 miles");
  await expect(page.locator(".confidence")).toContainText("Likely");
  await page.getByRole("button", { name: "Record this purchase" }).click();
  await expect(page.getByText("Purchase recorded", { exact: true })).toBeVisible();
  await expect(page.locator(".recommendation")).toContainText("Aleem’s");
  await expect(page.locator(".recommendation")).not.toContainText("Nurul’s");
  await expect(page.locator(".alternatives")).toHaveCount(0);
  await openApp(page, "wallet");
  await expect(page.getByRole("button", { name: "Aleem's Citi Rewards, S$100 bonus capacity left", exact: true })).toBeVisible();
  await openApp(page, "activity");
  await page.getByRole("button", { name: /Insta360/ }).click();
  const details = page.getByRole("dialog");
  await expect(details).toContainText("Aleem’s Citi Rewards");
  await expect(details).toContainText("2,048");
  await details.getByRole("button", { name: "Reverse this record" }).click();
  await expect(page.getByText("Reversed", { exact: true })).toBeVisible();
  await openApp(page, "wallet");
  await expect(page.getByRole("button", { name: "Aleem's Citi Rewards, S$612 bonus capacity left", exact: true })).toBeVisible();
});

test("reaching the cap switches the next recommendation to the other owner", async ({ page }) => {
  await purchase(page, "612", "Online shop");
  await expect(page.locator(".recommendation")).toContainText("Use Aleem’s");
  await page.getByRole("button", { name: "Record this purchase" }).click();
  await openApp(page, "wallet");
  const capped = page.getByRole("button", { name: "Aleem's Citi Rewards, S$0 bonus capacity left", exact: true });
  await expect(capped).toContainText("Bonus cap reached");
  await purchase(page, "512", "Insta360");
  await expect(page.locator(".recommendation")).toContainText("Use Nurul’s");
  await expect(page.locator(".recommendation")).toContainText("S$780 left");
});

test("profile choice persists and breaks a tied recommendation across both wallets", async ({ page }) => {
  await openApp(page);
  const sheet = await profile(page);
  await sheet.getByRole("button", { name: "Nurul", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /current person Nurul/ })).toBeVisible();
  await purchase(page, "512");
  await expect(page.locator(".recommendation")).toContainText("Use Nurul’s");
  await page.reload();
  await expect(page.getByRole("button", { name: /current person Nurul/ })).toBeVisible();
});

test("an attainable welcome threshold changes the recommendation without requiring extra spending", async ({ page }) => {
  await openApp(page, "bonuses");
  await page.getByRole("button", { name: "Edit offer & planned spend" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Already planned qualifying spend (S$)").fill("0");
  await sheet.getByLabel("Offer terms URL").fill("https://example.test/sample-terms");
  await sheet.getByRole("button", { name: "Save offer" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".bonus-guidance strong")).toHaveText("Not worth chasing");
  await purchase(page, "240", "Already planned purchase");
  await expect(page.locator(".recommendation h2")).toHaveText("Trust Freedom Miles");
  await expect(page.locator(".welcome-increment")).toContainText("20,000 extra welcome miles");
});

test("foreign purchase exposes SGD conversion, FX cost and net value", async ({ page }) => {
  await purchase(page, "512");
  await page.getByText("Currency, wallet & merchant details", { exact: false }).click();
  await page.getByLabel("Purchase currency").selectOption("USD");
  await expect(page.getByText("Enter the SGD equivalent of your USD purchase")).toBeVisible();
  await page.locator(".calculation-details summary").click();
  const costs = page.locator(".calculation-details");
  await expect(costs).toContainText("FX fee");
  await expect(costs).toContainText("Value after tracked costs");
  const fee = await costs.locator("dl div").filter({ hasText: "FX fee" }).locator("dd").innerText();
  expect(fee).not.toBe("S$0.00");
  await expect(page.locator(".alternatives")).toContainText("Trust Freedom Miles");
});

test("navigation keeps the purchase context and browser back restores the prior destination", async ({ page }) => {
  await openApp(page);
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: "What Card?", exact: true }).click();
  await page.getByLabel("Purchase amount in Singapore dollars").fill("512");
  await page.locator("#merchant").fill("Insta360");
  await navigation.getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Our wallet.", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Purchase amount in Singapore dollars")).toHaveValue("512");
  await expect(page.locator("#merchant")).toHaveValue("Insta360");
  await expect(navigation.getByRole("button", { name: "What Card?", exact: true })).toHaveAttribute("aria-current", "page");
});

test("a fresh wallet has no invented card ownership, balance, offers or recommendation", async ({ page }) => {
  await openApp(page);
  const sheet = await profile(page);
  await sheet.getByRole("button", { name: "Start fresh" }).click();
  await sheet.getByRole("button", { name: "Clear sample wallet" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".balance-number")).toContainText("0");
  await purchaseWithoutWinner(page);
  await openApp(page, "wallet");
  await expect(page.locator(".wallet-toolbar")).toContainText("0 active");
  await expect(page.getByText("Ownership unconfirmed", { exact: false }).first()).toBeVisible();
  await openApp(page, "bonuses");
  await expect(page.getByText("A good welcome, when it fits.")).toBeVisible();
  await openApp(page, "activity");
  await expect(page.getByText("Our next step starts here.")).toBeVisible();
});
async function purchaseWithoutWinner(page: Page) {
  await openApp(page, "what-card");
  await page.getByLabel("Purchase amount in Singapore dollars").fill("512");
  await expect(page.locator(".recommendation")).toHaveCount(0);
  await expect(page.getByText("Let’s set up our wallet.")).toBeVisible();
}

test("recommendation action is reachable with a short viewport and invalid inputs do not recommend", async ({ page }) => {
  await openApp(page, "what-card");
  await page.setViewportSize({ width: 390, height: 500 });
  await page.getByLabel("Purchase amount in Singapore dollars").fill("512");
  const action = page.getByRole("button", { name: /See our best card/ });
  await expect(action).toBeEnabled();
  await action.click();
  const box = await page.locator(".recommendation").boundingBox();
  expect(box?.y).toBeLessThan(180);
  await page.getByLabel("Purchase amount in Singapore dollars").fill("1000001");
  await expect(page.getByText("Use an amount up to S$1,000,000.")).toBeVisible();
  await expect(page.locator(".recommendation")).toHaveCount(0);
});

test("all six screens and the owner sheet pass automated accessibility checks", async ({ page }) => {
  test.setTimeout(120000);
  for (const view of ["home", "what-card", "wallet", "activity", "goals", "bonuses"]) {
    await openApp(page, view);
    if (view === "what-card") await page.getByLabel("Purchase amount in Singapore dollars").fill("512");
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))); });
    const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(report.violations, `Accessibility violations on ${view}`).toEqual([]);
  }
  await profile(page);
  const sheetReport = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(sheetReport.violations, "Accessibility violations in profile sheet").toEqual([]);
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Profile and settings/ })).toBeFocused();
});

test("installed public shell reopens offline demo records without caching private APIs", async ({ page, context }) => {
  test.setTimeout(60000);
  await purchase(page, "512");
  await page.getByRole("button", { name: "Record this purchase" }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect(await manifest.json()).toMatchObject({ display: "standalone" });
  for (const asset of ["icon-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png"]) {
    expect((await page.request.get(`/icons/${asset}`)).status()).toBe(200);
  }
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".connection-banner")).toHaveText("Offline · changes saved on this device");
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("button", { name: /Insta360/ })).toBeVisible();
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    return urls;
  });
  expect(cached.length).toBeGreaterThan(5);
  expect(cached.some((path) => path.startsWith("/api/"))).toBe(false);
  await context.setOffline(false);
  await expect(page.locator(".connection-banner")).not.toBeVisible();
});
