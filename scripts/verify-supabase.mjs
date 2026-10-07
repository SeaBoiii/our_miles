/* Actual PostgreSQL SQL/RLS checks with trusted Supabase JWT functions stubbed.
 * PGlite is an isolated test engine. No live Auth server, gateway or credentials. */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();
const aleem = "11111111-1111-4111-8111-111111111111";
const nurul = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
let checks = 0;
let ownershipArtifact = "not provided";

async function actor(role, id = null, claimsRole = role) {
  await database.exec("reset role");
  await database.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: claimsRole, ...(id ? { sub: id } : {}) })]);
  if (role) await database.exec(`set role ${role}`);
}
async function denied(sql, values, code = "42501") {
  let rejected = false;
  try { await database.query(sql, values); }
  catch (error) { assert.equal(error.code, code); rejected = true; }
  assert.equal(rejected, true, "Expected the database to deny the operation.");
  checks++;
}
async function save(version, state) {
  return (await database.query("select * from public.save_our_miles_state($1, $2::jsonb)", [version, JSON.stringify(state)])).rows;
}

try {
  // Mirror the trusted JWT functions/roles supplied by Supabase; the DB is real PostgreSQL.
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
    $$;
    grant usage on schema auth to public;
    insert into auth.users values ('${aleem}'), ('${nurul}'), ('${outsider}');
  `);
  const migrations = (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter((file) => file.endsWith(".sql")).sort();
  for (const migration of migrations) {
    await database.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  const state = { schemaVersion: 1, cards: [{ id: "citi", templateId: "citi-rewards", owner: "Aleem", status: "active", usageKnown: true, statementDay: 1, openingSpendSgd: 0, openingPeriodStart: "2026-10-01" }], transactions: [], offers: [], goals: [], mileBalance: 0, mileValueSgd: 0.015 };
  await actor("authenticated", aleem);
  assert.equal((await database.query("select owner from public.our_miles_members")).rows.length, 0);
  assert.equal((await database.query("select version,state from public.our_miles_state")).rows.length, 0);
  await denied("select * from public.save_our_miles_state(0, $1::jsonb)", [JSON.stringify(state)]);
  checks += 2;

  await actor(null);
  await database.query("insert into public.our_miles_members(owner,user_id) values ('Aleem',$1),('Nurul',$2)", [aleem, nurul]);
  await denied("insert into public.our_miles_members(owner,user_id) values ('Other',$1)", [outsider], "23514");
  await denied("insert into public.our_miles_members(owner,user_id) values ('Aleem',$1)", [outsider], "23505");

  await actor("anon");
  await denied("select version,state from public.our_miles_state");
  await denied("select owner from public.our_miles_members");
  await denied("select * from public.save_our_miles_state(0, $1::jsonb)", [JSON.stringify(state)]);
  await actor("authenticated", outsider);
  assert.equal((await database.query("select version,state from public.our_miles_state")).rows.length, 0);
  assert.equal((await database.query("select owner from public.our_miles_members")).rows.length, 0);
  await denied("select * from public.save_our_miles_state(0, $1::jsonb)", [JSON.stringify(state)]);
  checks += 2;

  await actor("authenticated", aleem);
  assert.deepEqual((await database.query("select owner from public.our_miles_members")).rows, [{ owner: "Aleem" }]);
  assert.deepEqual((await database.query("select version,state from public.our_miles_state")).rows, [{ version: 0, state: null }]);
  await denied("insert into public.our_miles_members(owner,user_id) values ('Nurul',$1)", [outsider]);
  await denied("update public.our_miles_members set user_id=$1 where owner='Aleem'", [outsider]);
  await denied("delete from public.our_miles_members");
  await denied("update public.our_miles_state set version=99");
  await denied("select updated_at from public.our_miles_state");
  await denied("select evidence from our_miles_private.transaction_evidence");
  assert.equal((await save(0, state))[0].version, 1);
  await actor("authenticated", nurul);
  assert.deepEqual((await database.query("select owner from public.our_miles_members")).rows, [{ owner: "Nurul" }]);
  assert.equal((await save(0, state)).length, 0, "A stale write must return an empty result.");
  assert.equal((await database.query("select version from public.our_miles_state")).rows[0].version, 1);
  checks += 6;

  const transaction = {
    id: "purchase", cardId: "citi", amountSgd: 512, merchant: "Insta360", category: "online", channel: "online", paymentMethod: "card", currency: "SGD", date: "2026-10-05", status: "pending",
    reward: { calculatedAt: "2026-10-05", templateId: "citi-rewards", ruleId: "citi-online-2026-10", ruleVersion: 1, sourceUrl: "https://bank.example.com/terms", lastVerifiedAt: "2026-10-05", miles: 2048, cashbackSgd: 0, fxFeeSgd: 0, effectiveMpd: 4, confidence: "Likely", minimumSpendIncrementalMiles: 0, bonusSpendSgd: 512, bonusCapGroup: "citi-10x", periodStart: "2026-10-01", periodEnd: "2026-11-01", qualifyingSpendSgd: 512, welcomeContributionSgd: 0, welcomeIncrementalMiles: 0, reason: "Online retail", warnings: [] },
  };
  state.transactions = [transaction];
  assert.equal((await save(1, state))[0].version, 2);
  const posted = structuredClone(state);
  posted.transactions[0].status = "posted";
  posted.transactions[0].postedDate = "2026-10-06";
  assert.equal((await save(2, posted))[0].version, 3);
  const rewritten = structuredClone(posted);
  rewritten.transactions[0].reward.miles = 99999;
  await denied("select * from public.save_our_miles_state(3, $1::jsonb)", [JSON.stringify(rewritten)], "22023");
  const changedAmount = structuredClone(posted);
  changedAmount.transactions[0].amountSgd = 999;
  await denied("select * from public.save_our_miles_state(3, $1::jsonb)", [JSON.stringify(changedAmount)], "22023");
  checks += 2;

  const invalid = [
    { ...posted, cardNumber: "not-allowed" },
    { ...posted, mileBalance: -1 },
    { ...posted, cards: [{ ...posted.cards[0], cvv: "not-allowed" }] },
    { ...posted, cards: [{ ...posted.cards[0], owner: "Third person" }] },
    { ...posted, cards: [...posted.cards, posted.cards[0]] },
    { ...posted, transactions: [{ ...transaction, cardId: "missing" }] },
    { ...posted, goals: [{ id: "trip", name: "Trip", destination: "NZ", targetMiles: 1000, targetDate: "2026-02-30" }] },
    { ...posted, goals: [{ id: "trip", name: "x".repeat(1048576), destination: "NZ", targetMiles: 1000 }] },
    { ...posted, offers: [{ id: "offer", cardId: "citi", name: "Offer", startsOn: "2026-10-01", deadline: "2026-10-31", tiers: [{ spendSgd: 100, miles: 1000 }], openingSpendSgd: 0, plannedNaturalSpendSgd: 0, sourceUrl: "", verified: true, eligibilityConfirmed: true }] },
  ];
  for (const value of invalid) await denied("select * from public.save_our_miles_state(3, $1::jsonb)", [JSON.stringify(value)], "22023");
  assert.equal((await database.query("select version from public.our_miles_state")).rows[0].version, 3);
  checks++;

  // Exercise the real SQL role fallback when a new server secret has no user JWT/sub claim.
  await actor("service_role", null, "");
  const serviceSaved = await save(3, posted);
  assert.equal(serviceSaved[0].version, 4);
  await denied("update public.our_miles_state set state=$1::jsonb", [JSON.stringify({ ...posted, cvv: "not-allowed" })], "22023");
  await database.exec("update public.our_miles_state set updated_at=now()");
  checks += 2;

  await actor("authenticated", aleem);
  const withoutTransaction = { ...posted, transactions: [] };
  assert.equal((await save(4, withoutTransaction))[0].version, 5);
  await denied("select * from public.save_our_miles_state(5, $1::jsonb)", [JSON.stringify(rewritten)], "22023");
  assert.equal((await save(5, posted))[0].version, 6);
  checks += 2;

  // New fields are optional for legacy wallets, explicit for newly confirmed preferences.
  const preferences = structuredClone(posted);
  Object.assign(preferences.cards[0], {
    openingCapSpendSgd: { "ppv-mobile": 184.12, "ppv-online": 50 },
    capUsageKnown: { "ppv-mobile": true, "ppv-online": false },
    openingRewardSpendSgd: { "dbs-local": 200.25, "dbs-foreign": 20 },
    selectedRewardCategory: "dining", selectedRewardCategoryPeriodStart: "2026-10-01",
    annualQualificationStart: "2026-05-01", annualQualificationEnd: "2027-05-01",
    openingAnnualQualifyingSpendSgd: 999.95, annualUsageKnown: true,
  });
  const preferencePurchase = {
    ...structuredClone(transaction), id: "preference-purchase", mcc: 763,
    paymentMethod: "samsung-pay", recurring: false, rewardPartner: "singapore-airlines",
    reward: { ...structuredClone(transaction.reward), roundingGroup: "ppv-simplygo", bonusRoundingGroup: "dbs-local" },
  };
  preferences.transactions.push(preferencePurchase, { ...structuredClone(preferencePurchase), id: "zero-mcc", mcc: 0 });
  preferences.offers = [{ id: "synthetic-test-offer", cardId: "citi", name: "Validation fixture", startsOn: "2026-10-01", deadline: "2026-10-31", tiers: [{ spendSgd: 100, miles: 1000 }], openingSpendSgd: 0, plannedNaturalSpendSgd: 0, sourceUrl: "", verified: false, eligibilityConfirmed: false, conditions: { excludeRecurring: true, rewardPartners: ["krisplus", "singapore-airlines"], paymentMethods: ["samsung-pay"], mccs: [0, 763], excludedMerchantWords: ["spc", "shell"] } }];
  const preferenceSaved = await save(6, preferences);
  assert.equal(preferenceSaved[0].version, 7);
  assert.deepEqual(preferenceSaved[0].state, preferences);
  assert.deepEqual((await database.query("select state from public.our_miles_state")).rows[0].state, preferences);
  checks += 3;

  const invalidCardPreferences = [
    { selectedRewardCategory: "miles" },
    { selectedRewardCategoryPeriodStart: "2026-02-30" },
    { openingCapSpendSgd: { "ppv-mobile": -1 } },
    { openingRewardSpendSgd: { "invalid group": 1 } },
    { openingRewardSpendSgd: { "dbs-local": 100000001 } },
    { openingCapSpendSgd: Array(1).fill(0) },
    { openingCapSpendSgd: Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`group-${index}`, 0])) },
    { capUsageKnown: { "ppv-mobile": "yes" } },
    { annualQualificationEnd: "2026-05-01" },
    { annualQualificationEnd: "2027-06-01" },
    { annualQualificationStart: "2026-05-02", annualQualificationEnd: "2027-05-02" },
    { annualQualificationEnd: undefined },
    { openingAnnualQualifyingSpendSgd: -1 },
    { bankingPassword: "not-allowed" },
  ];
  for (const fields of invalidCardPreferences) {
    const invalidPreference = structuredClone(preferences);
    Object.assign(invalidPreference.cards[0], fields);
    await denied("select * from public.save_our_miles_state(7, $1::jsonb)", [JSON.stringify(invalidPreference)], "22023");
  }
  for (const fields of [{ rewardPartner: "unknown-airline" }, { recurring: "yes" }, { mcc: -1 }, { mcc: 10000 }, { bankingPassword: "not-allowed" }]) {
    const invalidPurchase = structuredClone(preferences);
    invalidPurchase.transactions.push({ ...structuredClone(preferencePurchase), ...fields, id: "invalid-new-purchase" });
    await denied("select * from public.save_our_miles_state(7, $1::jsonb)", [JSON.stringify(invalidPurchase)], "22023");
  }
  for (const fields of [{ roundingGroup: "invalid group" }, { bonusRoundingGroup: "invalid group" }, { bankPassword: "not-allowed" }]) {
    const invalidReward = structuredClone(preferences);
    invalidReward.transactions.push({ ...structuredClone(preferencePurchase), id: "invalid-new-reward", reward: { ...structuredClone(preferencePurchase.reward), ...fields } });
    await denied("select * from public.save_our_miles_state(7, $1::jsonb)", [JSON.stringify(invalidReward)], "22023");
  }
  for (const fields of [{ rewardPartners: ["unknown-airline"] }, { excludeRecurring: "yes" }, { password: "not-allowed" }, { excludedMerchantWords: [""] }, { excludedMerchantWords: ["x".repeat(241)] }, { excludedMerchantWords: Array(101).fill("spc") }, { excludedMerchantWords: [42] }]) {
    const invalidConditions = structuredClone(preferences);
    Object.assign(invalidConditions.offers[0].conditions, fields);
    await denied("select * from public.save_our_miles_state(7, $1::jsonb)", [JSON.stringify(invalidConditions)], "22023");
  }
  const rewrittenPartner = structuredClone(preferences);
  rewrittenPartner.transactions[1].rewardPartner = "scoot";
  await denied("select * from public.save_our_miles_state(7, $1::jsonb)", [JSON.stringify(rewrittenPartner)], "22023");
  const rewrittenGrouping = structuredClone(preferences);
  rewrittenGrouping.transactions[1].reward.bonusRoundingGroup = "dbs-foreign";
  await denied("select * from public.save_our_miles_state(7, $1::jsonb)", [JSON.stringify(rewrittenGrouping)], "22023");
  assert.equal((await database.query("select version from public.our_miles_state")).rows[0].version, 7);
  checks++;

  await actor(null);
  await database.query("delete from public.our_miles_members where owner='Nurul'");
  await actor("authenticated", aleem);
  assert.equal((await database.query("select version,state from public.our_miles_state")).rows.length, 0);
  await denied("select * from public.save_our_miles_state(7, $1::jsonb)", [JSON.stringify(preferences)]);
  checks++;

  // Local ownership provisioning is deliberately ignored by Git and absent from CI.
  let ownershipSql;
  try { ownershipSql = await readFile(new URL("../.our-miles/add-nurul-cards.sql", import.meta.url), "utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (ownershipSql) {
    await actor(null);
    const targetLoop = [...ownershipSql.matchAll(/foreach template in array array\[([^\]]+)\] loop/g)].at(-1);
    assert.ok(targetLoop, "The private provisioning plan must identify its card templates.");
    const targetTemplates = [...targetLoop[1].matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]);
    const evidenceBefore = (await database.query("select * from our_miles_private.transaction_evidence order by transaction_id")).rows;
    await database.exec(ownershipSql);
    const provisioned = (await database.query("select version,state from public.our_miles_state")).rows[0];
    const nurulCards = provisioned.state.cards.filter((card) => card.owner === "Nurul");
    assert.deepEqual(nurulCards.map((card) => card.templateId).sort(), [...targetTemplates].sort());
    assert.equal(nurulCards.every((card) => card.status === "active" && card.usageKnown === false && card.selectedRewardCategory === undefined && card.annualUsageKnown === undefined), true);
    assert.equal(provisioned.version, 8);
    assert.deepEqual(provisioned.state.cards.filter((card) => card.owner !== "Nurul"), preferences.cards);
    assert.deepEqual({ ...provisioned.state, cards: [] }, { ...preferences, cards: [] });
    assert.deepEqual((await database.query("select * from our_miles_private.transaction_evidence order by transaction_id")).rows, evidenceBefore);
    await database.exec(ownershipSql);
    assert.deepEqual((await database.query("select version,state from public.our_miles_state")).rows[0], provisioned);
    checks += 7;

    // A fresh singleton has null state; signing in alone need not persist defaults.
    await database.exec("update public.our_miles_state set state=null");
    await database.exec(ownershipSql);
    const initialized = (await database.query("select version,state from public.our_miles_state")).rows[0];
    assert.equal(initialized.version, 9);
    assert.deepEqual(initialized.state.cards.filter((card) => card.owner === "Aleem"), ["maybank-xl", "citi-rewards", "hsbc-revolution", "trust-freedom", "dbs-esso", "mari", "uob-one"].map((template) => ({ id: `aleem-${template}`, templateId: template, owner: "Aleem", status: template === "uob-one" ? "inactive" : "unconfirmed", usageKnown: false })));
    assert.deepEqual(initialized.state.cards.filter((card) => card.owner === "Nurul"), nurulCards);
    assert.deepEqual({ ...initialized.state, cards: [] }, { schemaVersion: 1, cards: [], transactions: [], offers: [], goals: [{ id: "new-zealand", name: "New Zealand Honeymoon", destination: "New Zealand", targetMiles: 240000 }], mileBalance: 0, mileValueSgd: 0.015 });
    assert.deepEqual((await database.query("select * from our_miles_private.transaction_evidence order by transaction_id")).rows, evidenceBefore);
    await database.exec(ownershipSql);
    assert.deepEqual((await database.query("select version,state from public.our_miles_state")).rows[0], initialized);
    checks += 6;

    // Existing matched cards must retain user-entered settings and IDs while activating.
    const configured = structuredClone(initialized.state);
    const configuredTargets = configured.cards.filter((card) => card.owner === "Nurul").slice(0, 2);
    configuredTargets.forEach((card, index) => Object.assign(card, {
      id: `synthetic-existing-${index}`, status: index ? "unconfirmed" : "inactive",
      usageKnown: true, openingPeriodStart: "2026-10-01", openingSpendSgd: 184.12,
      openingCapSpendSgd: { "synthetic-cap": 184.12 }, capUsageKnown: { "synthetic-cap": true },
      selectedRewardCategory: "dining", selectedRewardCategoryPeriodStart: "2026-10-01",
      annualQualificationStart: "2026-05-01", annualQualificationEnd: "2027-05-01",
      annualUsageKnown: true, openingAnnualQualifyingSpendSgd: 999.95,
    }));
    // A Nurul-owned template outside this private plan must retain its current status.
    configured.cards.push({ id: "synthetic-unrelated", templateId: "synthetic-unrelated", owner: "Nurul", status: "inactive", usageKnown: false });
    await database.query("update public.our_miles_state set state=$1::jsonb", [JSON.stringify(configured)]);
    await database.exec(ownershipSql);
    const activated = (await database.query("select version,state from public.our_miles_state")).rows[0];
    const expectedActivated = structuredClone(configured);
    expectedActivated.cards.filter((card) => card.owner === "Nurul" && targetTemplates.includes(card.templateId)).forEach((card) => { card.status = "active"; });
    assert.equal(activated.version, 10);
    assert.deepEqual(activated.state, expectedActivated);
    assert.deepEqual((await database.query("select * from our_miles_private.transaction_evidence order by transaction_id")).rows, evidenceBefore);
    await database.exec(ownershipSql);
    assert.deepEqual((await database.query("select version,state from public.our_miles_state")).rows[0], activated);
    checks += 4;

    await database.exec("delete from public.our_miles_state");
    let missingRowRejected = false;
    try { await database.exec(ownershipSql); }
    catch (error) { assert.equal(error.code, "P0001"); missingRowRejected = true; }
    assert.equal(missingRowRejected, true, "Provisioning must fail closed when the singleton was not created.");
    await database.exec("rollback");
    assert.equal((await database.query("select version from public.our_miles_state")).rows.length, 0);
    checks += 2;
    ownershipArtifact = "existing/null/missing paths/activate-preserving-preferences/idempotent/evidence preserved";
  }

  console.log(JSON.stringify({ engine: "PostgreSQL/PGlite", checks, migrations: migrations.length, anonymous: "denied", outsider: "no rows/RPC denied", members: "own membership/shared wallet", clientWrites: "RPC only", staleVersion: "empty result", snapshotEvidence: "immutable", preferences: "optional/bounded/validated", credentials: "rejected", serviceRole: "preserved", ownershipArtifact, liveSupabase: "not tested" }));
} finally { await database.close(); }
