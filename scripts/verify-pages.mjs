/**
 * GitHub Pages smoke test against the exported files at /our_miles/.
 * Supabase is MOCKED; this does not claim live authentication or deployed RLS QA.
 * Build with https://example.supabase.co + sb_publishable_our_miles_qa first.
 * No real credentials are read, printed, sent or required by this script.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, realpath, stat, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const basePath = "/our_miles";
const exportRoot = await realpath(path.resolve("out"));
const artifacts = path.resolve("artifacts/pages");
const mimeTypes = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".map": "application/json; charset=utf-8" };
const staticRequests = [];

function insideRoot(target) {
  const relative = path.relative(exportRoot, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

const server = createServer(async (request, response) => {
  let pathname = "";
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    if (!["GET", "HEAD"].includes(request.method ?? "")) { response.writeHead(405); response.end(); return; }
    if (pathname === basePath) { response.writeHead(308, { Location: `${basePath}/` }); response.end(); return; }
    if (!pathname.startsWith(`${basePath}/`) || pathname.includes("\0") || pathname.includes("\\") || pathname.includes(":")) { response.writeHead(404); response.end(); return; }
    let target = path.resolve(exportRoot, pathname.slice(basePath.length + 1));
    if (!insideRoot(target)) { response.writeHead(404); response.end(); return; }
    if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
    target = await realpath(target);
    if (!insideRoot(target)) { response.writeHead(404); response.end(); return; }
    const bytes = await readFile(target);
    const extension = path.extname(target);
    response.writeHead(200, { "Content-Type": mimeTypes[extension] ?? "application/octet-stream", "Content-Length": bytes.byteLength, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...(pathname.endsWith("/sw.js") ? { "Service-Worker-Allowed": `${basePath}/` } : {}) });
    if (request.method === "HEAD") response.end(); else response.end(bytes);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  } finally {
    staticRequests.push({ path: pathname, status: response.statusCode });
  }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const appUrl = `${origin}${basePath}/`;

async function inventory(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await inventory(target, `${relative}/`));
    else if (entry.isFile()) files.push(relative);
    else throw new Error("The static export contains an unexpected filesystem link.");
  }
  return files;
}

function scanSecretLiterals(text) {
  assert(!/sb_secret_[A-Za-z0-9_-]{20,}/.test(text), "A secret Supabase key literal is present in exported text.");
  for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try { assert.notEqual(JSON.parse(Buffer.from(match[0].split(".")[1], "base64url").toString()).role, "service_role", "A service-role JWT is present in exported text."); }
    catch (error) { if (error?.code === "ERR_ASSERTION") throw error; }
  }
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), "A private key is present in the static export.");
}

const userId = "7cf95692-26ef-4a57-98f0-5f0218727690";
const fakeEmail = "aleem.qa@example.test";
const fakePassword = "OurMilesMockPassword2026!";
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const jwtPart = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = `${jwtPart({ alg: "HS256", typ: "JWT" })}.${jwtPart({ sub: userId, aud: "authenticated", role: "authenticated", exp: expiresAt })}.mock_signature_only`;
const fakeUser = { id: userId, aud: "authenticated", role: "authenticated", email: fakeEmail, email_confirmed_at: "2026-10-05T00:00:00Z", created_at: "2026-10-05T00:00:00Z", updated_at: "2026-10-05T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [] };
const fakeSession = { access_token: accessToken, refresh_token: "mock-refresh-token-not-a-real-credential", expires_in: 3600, expires_at: expiresAt, token_type: "bearer", user: fakeUser };

function emptyMockWallet() {
  return { schemaVersion: 1, cards: [{ id: "aleem-citi-rewards", templateId: "citi-rewards", owner: "Aleem", status: "unconfirmed", usageKnown: false }], transactions: [], offers: [], goals: [{ id: "qa-goal", name: "New Zealand Honeymoon", destination: "New Zealand", targetMiles: 240000 }], mileBalance: 0, mileValueSgd: 0.015 };
}

function backendFixture() {
  return { version: 0, state: emptyMockWallet(), owner: "Aleem", membershipAllowed: true, online: true, conflictNext: false, calls: [], saves: [], logoutCount: 0, forbiddenCalls: [] };
}

async function mockSupabase(context, backend) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api" || url.pathname.startsWith("/api/") || url.pathname.startsWith(`${basePath}/api/`)) {
      backend.forbiddenCalls.push("Node API request");
      await route.abort("blockedbyclient"); return;
    }
    if (url.origin === origin) { await route.continue(); return; }
    if (url.protocol === "data:" || url.protocol === "blob:") { await route.continue(); return; }
    if (url.hostname !== "example.supabase.co") {
      backend.forbiddenCalls.push("Unexpected external request");
      await route.abort("blockedbyclient"); return;
    }
    if (!backend.online) { await route.abort("internetdisconnected"); return; }
    const method = request.method();
    backend.calls.push({ method, path: url.pathname, grant: url.searchParams.get("grant_type") });
    const headers = { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version", "access-control-allow-methods": "GET, POST, OPTIONS", "content-type": "application/json" };
    const fulfill = (status, body) => route.fulfill({ status, headers, body: JSON.stringify(body) });
    if (method === "OPTIONS") { await route.fulfill({ status: 204, headers }); return; }
    if (url.pathname === "/auth/v1/token" && method === "POST") {
      const body = request.postDataJSON();
      if (url.searchParams.get("grant_type") === "refresh_token") { await fulfill(200, fakeSession); return; }
      if (body.email !== fakeEmail || body.password !== fakePassword) { await fulfill(400, { code: "invalid_credentials", error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" }); return; }
      await fulfill(200, fakeSession); return;
    }
    if (url.pathname === "/auth/v1/logout" && method === "POST") { backend.logoutCount++; await fulfill(200, {}); return; }
    if (request.headers().authorization !== `Bearer ${accessToken}`) { await fulfill(401, { message: "Mock authentication required" }); return; }
    if (url.pathname === "/auth/v1/user" && method === "GET") { await fulfill(200, fakeUser); return; }
    if (url.pathname === "/rest/v1/our_miles_members" && method === "GET") {
      assert.equal(url.searchParams.get("user_id"), `eq.${userId}`, "Membership must be checked for the authenticated user.");
      assert.equal(url.searchParams.get("select"), "owner");
      await fulfill(200, backend.membershipAllowed ? { owner: backend.owner } : null); return;
    }
    if (url.pathname === "/rest/v1/our_miles_state" && method === "GET") {
      assert.equal(url.searchParams.get("id"), "eq.true");
      assert.equal(url.searchParams.get("select"), "version,state");
      await fulfill(200, { version: backend.version, state: structuredClone(backend.state) }); return;
    }
    if (url.pathname === "/rest/v1/rpc/save_our_miles_state" && method === "POST") {
      const body = request.postDataJSON();
      assert.deepEqual(Object.keys(body).sort(), ["expected_version", "next_state"]);
      backend.saves.push(structuredClone(body));
      if (backend.conflictNext || body.expected_version !== backend.version) {
        backend.conflictNext = false;
        backend.version++;
        backend.state = { ...backend.state, mileBalance: 777777 };
        await fulfill(200, []); return;
      }
      backend.version++;
      backend.state = structuredClone(body.next_state);
      await fulfill(200, [{ version: backend.version, state: structuredClone(backend.state) }]); return;
    }
    backend.forbiddenCalls.push("Unexpected Supabase endpoint");
    await fulfill(404, { message: "Unhandled mock endpoint" });
  });
}

async function signIn(page, { remember = true, password = fakePassword } = {}) {
  await page.getByLabel("Email", { exact: true }).fill(fakeEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const remembered = page.getByLabel("Remember this trusted device", { exact: true });
  if (remember) await remembered.check(); else await remembered.uncheck();
  const response = page.waitForResponse((candidate) => new URL(candidate.url()).pathname === "/auth/v1/token" && candidate.request().method() === "POST");
  await page.getByRole("button", { name: "Open our wallet", exact: true }).click();
  await response;
}

async function storageEvidence(page) {
  return page.evaluate(() => {
    const containsAuth = (storage) => Object.values(storage).some((value) => {
      try { const parsed = JSON.parse(value); return !!parsed?.access_token || !!parsed?.currentSession?.access_token; } catch { return false; }
    });
    const containsWallet = (storage) => Object.values(storage).some((value) => {
      try { const parsed = JSON.parse(value); return !!parsed?.cards && !!parsed?.transactions && parsed.schemaVersion === 1; } catch { return false; }
    });
    return { localAuth: containsAuth(localStorage), sessionAuth: containsAuth(sessionStorage), localWallet: containsWallet(localStorage), sessionWallet: containsWallet(sessionStorage) };
  });
}

async function profile(page) {
  await page.getByRole("button", { name: /Profile and settings/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function logout(page) {
  const sheet = await profile(page);
  await sheet.getByRole("button", { name: /Lock wallet|Sign out|Log out/ }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect.poll(async () => { const stored = await storageEvidence(page); return stored.localAuth || stored.sessionAuth || stored.localWallet || stored.sessionWallet; }).toBe(false);
}

async function accessibilityAudit(page, backend, configure) {
  // Axe injects its auditor as inline code. Audit in a separate CSP-bypassing
  // context; the complete functional context retains and validates CSP.
  const stored = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const auditContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", bypassCSP: true, serviceWorkers: "block" });
  try {
    await mockSupabase(auditContext, backend);
    await auditContext.addInitScript(({ local, session, appOrigin }) => {
      if (location.origin !== appOrigin) return;
      for (const [key, value] of Object.entries(local)) localStorage.setItem(key, value);
      for (const [key, value] of Object.entries(session)) sessionStorage.setItem(key, value);
    }, { ...stored, appOrigin: origin });
    const auditPage = await auditContext.newPage();
    await auditPage.goto(page.url());
    if (await page.locator(".app-shell").count()) await expect(auditPage.locator(".app-shell")).toBeVisible();
    else await expect(auditPage.getByLabel("Email", { exact: true })).toBeVisible();
    if (configure) await configure(auditPage);
    await auditPage.evaluate(() => document.fonts.ready);
    return await new AxeBuilder({ page: auditPage }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  } finally {
    await auditContext.close();
  }
}

async function verifyNurulCards(page, backend, report) {
  const singaporeDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const month = `${singaporeDate.slice(0, 7)}-01`;
  const fixtures = ["uob-ladys", "uob-ppv", "uob-krisflyer", "dbs-wwmc", "maybank-xl"].map((templateId) => ({ id: `qa-nurul-${templateId}`, templateId, owner: "Nurul", status: "active", usageKnown: false }));
  backend.state = { ...backend.state, cards: fixtures, transactions: [], offers: [] };
  backend.version++;
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  const navigation = page.locator("nav:visible");
  const goWallet = async () => navigation.getByRole("button", { name: "Wallet", exact: true }).click();
  const openCard = async (name) => {
    await goWallet();
    await page.locator(".wallet-row").filter({ hasText: name }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    return page.getByRole("dialog");
  };
  const savedCard = (id) => backend.state.cards.find((card) => card.templateId === id);
  const saveCard = async (dialog) => {
    await dialog.getByRole("button", { name: "Save card", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  };
  const onlyCard = async (templateId) => {
    backend.state = { ...backend.state, cards: backend.state.cards.map((card) => ({ ...card, status: card.templateId === templateId ? "active" : "inactive" })), transactions: [] };
    backend.version++;
    await page.reload();
    await expect(page.locator(".app-shell")).toBeVisible();
    await navigation.getByRole("button", { name: "What Card?", exact: true }).click();
  };
  const details = async () => {
    const summary = page.locator("summary").filter({ hasText: "Currency, wallet & merchant details" });
    const open = await summary.evaluate((node) => node.parentElement.open);
    if (!open) await summary.click();
  };
  const purchase = async ({ amount = "100", mcc = "5732", category = "shopping", channel = "online", recurring = false, method = "card", partner = "" } = {}) => {
    await page.getByLabel("Purchase amount in Singapore dollars", { exact: true }).fill(amount);
    await page.getByRole("textbox", { name: /^Merchant optional/ }).fill("Nurul QA intended purchase");
    await page.locator(".channel-field").getByRole("button", { name: channel === "online" ? "Online" : "Contactless", exact: true }).click();
    await details();
    await page.getByLabel(/^Specific purchase category/).selectOption(category);
    await page.getByLabel("Merchant category code (MCC)", { exact: true }).fill(mcc);
    await page.getByLabel("Confirmed from the issuer or a posted transaction", { exact: true }).check();
    await page.getByLabel(/^Payment method/).selectOption(method);
    await page.getByLabel("Recurring payment / subscription", { exact: true }).setChecked(recurring);
    await page.getByLabel(/^Confirmed KrisFlyer UOB partner payment/).selectOption(partner);
    if (await page.getByRole("button", { name: "See our best card", exact: true }).isVisible()) await page.getByRole("button", { name: "See our best card", exact: true }).click();
    return page.getByRole("region", { name: "Card recommendation" });
  };

  await goWallet();
  await expect(page.locator(".wallet-row")).toHaveCount(5);
  let dialog = await openCard("Preferred Visa");
  await dialog.getByLabel("Online usage checked", { exact: true }).check();
  await dialog.getByLabel("Online opening spend (S$)", { exact: true }).fill("520");
  await dialog.getByLabel("Mobile contactless usage checked", { exact: true }).check();
  await dialog.getByLabel("Mobile contactless opening spend (S$)", { exact: true }).fill("200");
  await saveCard(dialog);
  assert.deepEqual(savedCard("uob-ppv").openingCapSpendSgd, { "uob-ppv-online": 520, "uob-ppv-mobile": 200 });
  assert.deepEqual(savedCard("uob-ppv").capUsageKnown, { "uob-ppv-online": true, "uob-ppv-mobile": true });

  dialog = await openCard("Lady");
  await dialog.getByLabel(/^Category registered with UOB/).selectOption("dining");
  await dialog.getByLabel(/I have checked this period/).check();
  await dialog.getByLabel(/Bonus-eligible spend before our app records/).fill("0");
  await saveCard(dialog);
  assert.equal(savedCard("uob-ladys").selectedRewardCategory, "dining");
  assert.equal(savedCard("uob-ladys").selectedRewardCategoryPeriodStart, undefined, "A selection alone must not assert bank registration.");
  await onlyCard("uob-ladys");
  await expect(await purchase({ category: "dining", mcc: "5812" })).toContainText("40 miles");
  dialog = await openCard("Lady");
  await dialog.getByLabel(/UOB confirms this category/).check();
  await saveCard(dialog);
  assert.match(savedCard("uob-ladys").selectedRewardCategoryPeriodStart, /^\d{4}-\d{2}-01$/);
  await navigation.getByRole("button", { name: "What Card?", exact: true }).click();
  await expect(await purchase({ category: "dining", mcc: "5812" })).toContainText("400 miles");
  report.checks.ladyCategory = "unconfirmed selection stays base; explicit bank confirmation enables selected-category bonus";

  await onlyCard("dbs-wwmc");
  dialog = await openCard("Woman");
  await dialog.getByLabel(/I have checked this period/).check();
  await dialog.getByLabel("SGD online spend before our records (S$)", { exact: true }).fill("100.25");
  await dialog.getByLabel("Foreign-currency online spend before our records (S$)", { exact: true }).fill("150.75");
  await saveCard(dialog);
  assert.deepEqual(savedCard("dbs-wwmc").openingRewardSpendSgd, { "dbs-wwmc-online-local": 100.25, "dbs-wwmc-online-foreign": 150.75 });
  assert.equal(savedCard("dbs-wwmc").openingSpendSgd, 251);
  assert.equal(savedCard("dbs-wwmc").openingPeriodStart, month);
  await navigation.getByRole("button", { name: "What Card?", exact: true }).click();
  await expect(await purchase({ amount: "5.10" })).toContainText("20 miles");
  await page.getByRole("button", { name: "Record this purchase", exact: true }).click();
  assert.equal(backend.state.transactions.at(-1).reward.miles, 20);
  assert.equal(backend.state.transactions.at(-1).reward.bonusRoundingGroup, "dbs-wwmc-online-local");
  report.checks.dbsSplit = "local/foreign opening accumulators save separately, share gross cap, and preserve marginal monthly rounding group";

  await onlyCard("uob-krisflyer");
  dialog = await openCard("KrisFlyer UOB");
  await dialog.locator("summary").filter({ hasText: "Annual airline qualification" }).click();
  await dialog.getByLabel(/^Current membership year starts/).fill(month.slice(0,7));
  await dialog.getByLabel("Airline-group spend before our records (S$)", { exact: true }).fill("1000");
  await dialog.getByLabel("I have checked this membership year and its qualifying spend", { exact: true }).check();
  await saveCard(dialog);
  const annual = savedCard("uob-krisflyer");
  assert.equal(annual.annualQualificationStart, month);
  assert.equal(annual.annualQualificationEnd, `${Number(month.slice(0,4))+1}${month.slice(4)}`);
  assert.equal(annual.annualUsageKnown, true);
  await navigation.getByRole("button", { name: "What Card?", exact: true }).click();
  await expect(await purchase({ category: "dining", mcc: "5812" })).toContainText("240 miles");
  await expect(await purchase({ category: "travel", mcc: "4511", partner: "singapore-airlines" })).toContainText("300 miles");
  report.checks.krisAnnualPartner = "approval month defines exact 12-month year; confirmed annual spend enables deferred accelerator; confirmed airline path enables 3mpd";

  await onlyCard("uob-ppv");
  await expect(await purchase()).toContainText("328 miles");
  await expect(await purchase({ recurring: true })).toContainText("40 miles");
  await page.getByRole("button", { name: "Record this purchase", exact: true }).click();
  assert.equal(backend.state.transactions.at(-1).recurring, true);
  assert.equal(backend.state.transactions.at(-1).reward.miles, 40);
  await navigation.getByRole("button", { name: "What Card?", exact: true }).click();
  await expect(await purchase({ channel: "contactless", method: "apple-pay" })).toContainText("400 miles");
  report.checks.ppvBucketsRecurring = "independent saved caps affect blended online earn; recurring excludes online bonus and survives recording; mobile tap uses its separate capacity";

  backend.state = { ...backend.state, cards: backend.state.cards.map((card) => ({ ...card, status: "active" })), transactions: [] };
  backend.version++;
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  for (const label of [null,"Preferred Visa","Lady","Woman","KrisFlyer UOB"]) {
    const audit = await accessibilityAudit(page,backend,async auditor=>{
      await auditor.locator("nav:visible").getByRole("button",{name:"Wallet",exact:true}).click();
      if (label) {
        await auditor.locator(".wallet-row").filter({hasText:label}).click();
        await expect(auditor.getByRole("dialog")).toBeVisible();
        if (label==="KrisFlyer UOB") await auditor.getByRole("dialog").locator("summary").filter({hasText:"Annual airline qualification"}).click();
      }
    });
    assert.equal(audit.violations.length,0,`${label??"Wallet"} accessibility violations: ${audit.violations.map(violation=>violation.id).join(", ")}`);
  }
  report.checks.nurulAccessibility = "wallet and PPV/Lady’s/DBS/KrisFlyer setup sheets have zero WCAG A/AA axe violations in separate auditor contexts";
  // Fresh contexts avoid a mobile layout viewport retaining desktop zoom/scroll
  // after resizing an already focused, open dialog.
  for (const [width,height] of [[360,800],[390,844],[412,915],[430,932],[1440,1000]]) {
    const visualContext = await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,deviceScaleFactor:1,reducedMotion:"reduce",serviceWorkers:"block",timezoneId:"Asia/Singapore"});
    try {
      await mockSupabase(visualContext, backend);
      const visual = await visualContext.newPage();
      await visual.goto(appUrl);
      await signIn(visual, {remember:false});
      await expect(visual.locator(".app-shell")).toBeVisible();
      await visual.locator("nav:visible").getByRole("button", {name:"Wallet",exact:true}).click();
      const capture = async (name) => {
        await visual.evaluate(async () => { await document.fonts.ready; await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); });
        await expect.poll(()=>visual.evaluate(()=>innerWidth)).toBe(width);
        assert(await visual.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal page overflow: ${name} ${width}px`);
        const visibleDialog = visual.getByRole("dialog");
        if (await visibleDialog.count()) assert(await visibleDialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1),`Horizontal sheet overflow: ${name} ${width}px`);
        const file = `nurul-${name}-${width}.png`;
        await visual.screenshot({path:path.join(artifacts,file),fullPage:false});
        report.screenshots.push(`artifacts/pages/${file}`);
      };
      await visual.evaluate(()=>window.scrollTo(0,0));
      await capture("wallet");
      await visual.locator(".wallet-row").nth(2).scrollIntoViewIfNeeded();
      await capture("wallet-lower");
      for (const [name,label] of [["ppv-setup","Preferred Visa"],["lady-setup","Lady"],["dbs-setup","Woman"],["kris-setup","KrisFlyer UOB"]]) {
        await visual.locator(".wallet-row").filter({hasText:label}).click();
        const visualDialog = visual.getByRole("dialog");
        await expect(visualDialog).toBeVisible();
        if (name==="kris-setup") await visualDialog.locator("summary").filter({hasText:"Annual airline qualification"}).click();
        await visual.evaluate(()=>{document.activeElement?.blur();document.querySelector(".sheet-body")?.scrollTo(0,0);document.querySelector(".sheet-content")?.scrollTo(0,0);});
        await capture(name);
        if (name==="dbs-setup" && width===390) {
          await visualDialog.locator("summary").filter({hasText:"Benefits & things to know"}).click();
          await visualDialog.locator("summary").filter({hasText:"Fees & waivers"}).click();
          await visualDialog.getByText("Annual fee and revised waiver",{exact:true}).scrollIntoViewIfNeeded();
          await capture("dbs-benefits");
          await expect(visualDialog.getByRole("link",{name:"Woman’s World benefits",exact:true}).first()).toHaveAttribute("href","https://www.dbs.com.sg/personal/cards/credit-cards/dbs-woman-mastercard-card");
        }
        await visual.keyboard.press("Escape");
        await expect(visual.getByRole("dialog")).not.toBeVisible();
      }
    } finally { await visualContext.close(); }
  }
  report.checks.nurulResponsive = "fresh-context five-card wallet and four sheets at 360/390/412/430/1440; exact viewport width, no horizontal overflow, source links rendered";
}

const report = { authentication: "mocked Supabase Auth/REST only; live project not accessed", checks: {}, screenshots: [] };
let browser;
try {
  const files = await inventory(exportRoot);
  const textFiles = files.filter((file) => /\.(?:html|js|css|json|txt|webmanifest|map)$/.test(file));
  let fixtureConfigPresent = false;
  for (const file of textFiles) {
    const text = await readFile(path.join(exportRoot, file), "utf8");
    scanSecretLiterals(text);
    fixtureConfigPresent ||= text.includes("example.supabase.co");
  }
  assert(fixtureConfigPresent, "Build out using the fake public QA Supabase URL before running this mocked test.");
  const assets = files.filter((file) => /\.(?:js|css|woff2?|png|svg|webmanifest|ico)$/.test(file));
  for (const file of assets) {
    const response = await fetch(`${appUrl}${file.split("/").map(encodeURIComponent).join("/")}`);
    assert.equal(response.status, 200, `Static asset failed under the project subpath: ${file}`);
  }
  assert(assets.some((asset) => asset.endsWith(".woff2")), "Self-hosted font files are missing.");
  const manifestResponse = await fetch(`${appUrl}manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.display, "standalone");
  assert(manifest.start_url.startsWith(`${basePath}/`), "The PWA start URL must use the GitHub project subpath.");
  assert(manifest.scope?.startsWith(`${basePath}/`), "The PWA scope must use the GitHub project subpath.");
  for (const icon of manifest.icons) assert.equal((await fetch(new URL(icon.src, `${appUrl}manifest.webmanifest`))).status, 200);
  assert.equal((await fetch(`${origin}/api/session`)).status, 404);
  assert.equal((await fetch(`${origin}/icons/icon-192.png`)).status, 404);
  assert.equal((await fetch(`${appUrl}..%5Cpackage.json`)).status, 404);
  assert.equal((await fetch(`${appUrl}index.html:credential-stream`)).status, 404);
  assert.equal((await fetch(appUrl, { method: "POST" })).status, 405);
  const shellHead = await fetch(appUrl, { method: "HEAD" });
  assert.equal(shellHead.status, 200);
  assert.equal((await shellHead.arrayBuffer()).byteLength, 0);
  report.checks.staticExport = { files: files.length, assets: assets.length, manifest: "project subpath", secrets: "no secret-key/private-key literals" };

  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: "reduce", serviceWorkers: "allow" });
  const backend = backendFixture();
  const policyViolations = [];
  await context.exposeBinding("recordOurMilesPolicyViolation", (_, violation) => policyViolations.push(violation));
  await context.addInitScript(() => document.addEventListener("securitypolicyviolation", (event) => { void window.recordOurMilesPolicyViolation({ directive: event.violatedDirective, blocked: event.blockedURI, source: event.sourceFile ? new URL(event.sourceFile).pathname : "", line: event.lineNumber, column: event.columnNumber }); }));
  await mockSupabase(context, backend);
  const page = await context.newPage();
  const runtimeErrors = [];
  const assetFailures = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.name));
  page.on("console", (message) => { if (message.type() === "error" && /content security policy|content-security-policy/i.test(message.text())) policyViolations.push("console CSP error"); });
  page.on("response", (response) => { const url = new URL(response.url()); if (url.origin === origin && response.status() >= 400) assetFailures.push(url.pathname); });
  await page.goto(appUrl);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const authAccessibility = await accessibilityAudit(page, backend);
  assert.equal(authAccessibility.violations.length, 0, `Auth accessibility violations: ${authAccessibility.violations.map((violation) => violation.id).join(", ")}`);
  await page.getByLabel("Email", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Remember this trusted device", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const submit = page.getByRole("button", { name: "Open our wallet", exact: true });
  await expect(submit).toBeFocused();
  assert(await submit.evaluate((button) => { const style = getComputedStyle(button); return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0; }), "The auth button has no visible keyboard focus outline.");
  await submit.blur();
  report.checks.authAccessibility = "zero WCAG A/AA axe violations; keyboard order and visible submit focus verified";
  await page.screenshot({ path: path.join(artifacts, "auth-390.png"), fullPage: true });
  report.screenshots.push("artifacts/pages/auth-390.png");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: path.join(artifacts, "auth-360.png"), fullPage: true });
  report.screenshots.push("artifacts/pages/auth-360.png");
  await page.setViewportSize({ width: 390, height: 560 });
  await page.getByLabel("Password", { exact: true }).focus();
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  await page.screenshot({ path: path.join(artifacts, "auth-keyboard-space-390.png"), fullPage: false });
  report.screenshots.push("artifacts/pages/auth-keyboard-space-390.png");
  await page.getByLabel("Password", { exact: true }).blur();
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, { password: "incorrect-mock-password" });
  await expect(page.locator(".form-error[role='alert']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open our wallet", exact: true })).toBeEnabled();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  report.checks.rejectedPassword = "login rejected; wallet hidden";

  backend.membershipAllowed = false;
  const membershipDenied = page.waitForResponse((candidate) => new URL(candidate.url()).pathname === "/rest/v1/our_miles_members");
  await signIn(page);
  await membershipDenied;
  await expect(page.locator(".form-error[role='alert']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open our wallet", exact: true })).toBeEnabled();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  assert(!backend.calls.some((call) => call.path === "/rest/v1/our_miles_state"), "Wallet was fetched before allowlist verification.");
  report.checks.membershipGate = "non-member blocked before wallet GET";

  backend.membershipAllowed = true;
  await signIn(page, { remember: false });
  await expect(page.getByRole("button", { name: "Profile and settings, current person Aleem", exact: true })).toBeVisible();
  assert(backend.calls.some((call) => call.path === "/auth/v1/user"), "The server-verified current user was not fetched.");
  const temporaryStorage = await storageEvidence(page);
  assert.equal(temporaryStorage.localAuth, false, "An unremembered auth session was written to localStorage.");
  assert.equal(temporaryStorage.sessionAuth, true, "An unremembered auth session did not use sessionStorage.");
  assert.equal(temporaryStorage.localWallet || temporaryStorage.sessionWallet, false, "Private wallet data entered browser storage.");
  const homeAccessibility = await accessibilityAudit(page, backend);
  assert.equal(homeAccessibility.violations.length, 0, `Home accessibility violations: ${homeAccessibility.violations.map((violation) => violation.id).join(", ")}`);
  report.checks.homeAccessibility = "zero WCAG A/AA axe violations";
  report.checks.accessibilityAuditor = "axe runs in a separate CSP-bypassing context; application flow retains strict CSP";
  await page.screenshot({ path: path.join(artifacts, "home-390.png"), fullPage: true });
  report.screenshots.push("artifacts/pages/home-390.png");

  let sheet = await profile(page);
  await sheet.getByLabel("Opening miles balance", { exact: true }).fill("123456");
  await sheet.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByText("Preferences saved", { exact: true })).toBeVisible();
  assert.equal(backend.version, 1);
  assert.equal(backend.state.mileBalance, 123456);
  await page.reload();
  await expect(page.getByRole("region", { name: "Shared estimated miles" })).toContainText("123,456");
  report.checks.optimisticSaveReload = "expected_version 0 saved and version 1 reloaded";

  backend.conflictNext = true;
  sheet = await profile(page);
  await sheet.getByLabel("Opening miles balance", { exact: true }).fill("123457");
  await sheet.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.locator(".form-error[role='alert']")).toBeVisible();
  assert.equal(backend.state.mileBalance, 777777, "A conflict overwrote the other device's wallet.");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("region", { name: "Shared estimated miles" })).toContainText("777,777");
  report.checks.conflict = "empty RPC result rejected; newer server state preserved";

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: "Wallet", exact: true }).click();
  await page.getByRole("button", { name: /Citi Rewards.*Ownership unconfirmed/ }).click();
  sheet = page.getByRole("dialog");
  await sheet.getByLabel(/^Owner/).selectOption("Nurul");
  await sheet.getByLabel(/^Status/).selectOption("active");
  await sheet.getByLabel(/Statement cycle starts on day/).fill("1");
  await sheet.getByLabel(/I have checked this period/).check();
  await sheet.getByLabel(/Bonus-eligible spend before our app records/).fill("0");
  await sheet.getByRole("button", { name: "Save card", exact: true }).click();
  await expect(page.getByRole("button", { name: "Nurul's Citi Rewards, S$1,000 bonus capacity left", exact: true })).toBeVisible();
  await navigation.getByRole("button", { name: "What Card?", exact: true }).click();
  await page.getByLabel("Purchase amount in Singapore dollars", { exact: true }).fill("512");
  await page.getByRole("textbox", { name: /^Merchant optional/ }).fill("Insta360 QA purchase");
  await page.getByRole("button", { name: "See our best card", exact: true }).click();
  await expect(page.getByRole("region", { name: "Card recommendation" })).toContainText("2,048 miles");
  await page.getByRole("button", { name: "Record this purchase", exact: true }).click();
  await expect(page.getByRole("region", { name: "Card recommendation" })).toContainText("Recorded with Nurul");
  assert.equal(backend.state.transactions.length, 1);
  const recorded = structuredClone(backend.state.transactions[0]);
  assert.equal(recorded.status, "pending", "A newly entered purchase must remain pending until posting is confirmed.");
  assert.equal(recorded.reward.miles, 2048);
  assert.equal(backend.state.cards.find((card) => card.id === recorded.cardId).owner, "Nurul");
  await navigation.getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(page.getByRole("button", { name: "Nurul's Citi Rewards, S$488 bonus capacity left", exact: true })).toBeVisible();
  await navigation.getByRole("button", { name: "Activity", exact: true }).click();
  await page.getByRole("button", { name: /Insta360 QA purchase/ }).click();
  sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Confirm bank posting", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  assert.equal(backend.state.transactions[0].status, "posted");
  assert.deepEqual(backend.state.transactions[0].reward, recorded.reward, "Posting rewrote the original reward evidence.");
  assert.equal(backend.state.cards.find((card) => card.id === recorded.cardId).owner, "Nurul");
  report.checks.ownerPendingSnapshot = "Nurul ownership preserved; pending reserves cap; posting preserves snapshot";

  await verifyNurulCards(page, backend, report);

  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  const cacheUrls = await page.evaluate(async () => { const result = []; for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) result.push(request.url); return result; });
  assert(cacheUrls.length > 5, "The public offline shell did not populate Cache Storage.");
  assert(cacheUrls.every((url) => new URL(url).origin === origin), "Supabase responses entered Cache Storage.");
  assert(!cacheUrls.some((url) => /\/api(?:\/|$)/.test(new URL(url).pathname)), "Private API responses entered Cache Storage.");
  backend.online = false;
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Try again|Reconnect/ })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "offline-private-gate-390.png"), fullPage: true });
  report.screenshots.push("artifacts/pages/offline-private-gate-390.png");
  await context.setOffline(false);
  backend.online = true;
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  report.checks.offline = { coldPrivateGate: "wallet hidden until server authentication", supabaseCache: "empty", publicCachedFiles: cacheUrls.length };

  await logout(page);
  const loggedOutStorage = await storageEvidence(page);
  assert.equal(loggedOutStorage.localAuth || loggedOutStorage.sessionAuth || loggedOutStorage.localWallet || loggedOutStorage.sessionWallet, false);
  assert(backend.logoutCount > 0);
  await page.reload();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  report.checks.logout = "wallet and auth session cleared; reload stays gated";

  await signIn(page, { remember: true });
  await expect(page.locator(".app-shell")).toBeVisible();
  const rememberedStorage = await storageEvidence(page);
  assert.equal(rememberedStorage.localAuth, true, "Remembered auth session did not use localStorage.");
  assert.equal(rememberedStorage.sessionAuth, false, "Remembered auth session remained in sessionStorage.");
  assert.equal(rememberedStorage.localWallet || rememberedStorage.sessionWallet, false);
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  report.checks.rememberedDevice = "localStorage auth; sessionStorage auth when unremembered; wallet never persisted locally";
  await logout(page);
  assert.equal(backend.forbiddenCalls.length, 0, "The app attempted a Node API, unexpected endpoint or real external request.");
  assert.equal(runtimeErrors.length, 0, "Browser runtime errors occurred.");
  assert.equal(assetFailures.length, 0, "Browser assets failed under the GitHub Pages subpath.");
  assert.equal(policyViolations.length, 0, `Content Security Policy violations occurred: ${JSON.stringify(policyViolations)}`);
  report.checks.requests = { nodeApi: "none", unexpectedExternal: "none", browserAssetFailures: assetFailures.length, runtimeErrors: runtimeErrors.length, cspViolations: policyViolations.length, mockedSupabaseCalls: backend.calls.length };
  await writeFile(path.join(artifacts, "verification.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
