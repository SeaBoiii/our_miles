/* Actual PostgreSQL SQL/RLS checks with trusted Supabase JWT functions stubbed.
 * PGlite is an isolated test engine. No live Auth server, gateway or credentials. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();
const aleem = "11111111-1111-4111-8111-111111111111";
const nurul = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
let checks = 0;

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
  for (const migration of ["202610050001_private_wallet.sql", "202610050002_browser_auth.sql"]) {
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

  await actor(null);
  await database.query("delete from public.our_miles_members where owner='Nurul'");
  await actor("authenticated", aleem);
  assert.equal((await database.query("select version,state from public.our_miles_state")).rows.length, 0);
  await denied("select * from public.save_our_miles_state(6, $1::jsonb)", [JSON.stringify(posted)]);
  checks++;

  console.log(JSON.stringify({ engine: "PostgreSQL/PGlite", checks, migrations: "applied", anonymous: "denied", outsider: "no rows/RPC denied", members: "own membership/shared wallet", clientWrites: "RPC only", staleVersion: "empty result", snapshotEvidence: "immutable", credentials: "rejected", serviceRole: "preserved", liveSupabase: "not tested" }));
} finally { await database.close(); }
