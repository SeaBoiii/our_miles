-- Add browser Supabase Auth without changing the existing singleton/RPC contract.
-- Apply AFTER 202610050001_private_wallet.sql. No members are seeded: access fails closed.
begin;

create schema if not exists our_miles_private;
revoke all on schema our_miles_private from public, anon, authenticated;
grant usage on schema our_miles_private to authenticated, service_role;

create table if not exists public.our_miles_members (
  owner text primary key check (owner in ('Aleem', 'Nurul')),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.our_miles_members enable row level security;
revoke all on public.our_miles_members from public, anon, authenticated;
grant select (owner, user_id) on public.our_miles_members to authenticated;

create or replace function our_miles_private.is_member()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and (select count(*) from public.our_miles_members) = 2
    and exists (select 1 from public.our_miles_members where user_id = auth.uid());
$$;

-- A closed schema for personal state. Rules remain separately versioned in application code.
create or replace function our_miles_private.wallet_schema()
returns jsonb language sql immutable set search_path = ''
as $function$
select $schema${
  "type":"object","additionalProperties":false,
  "required":["schemaVersion","cards","transactions","offers","goals","mileBalance","mileValueSgd"],
  "properties":{
    "schemaVersion":{"type":"integer","enum":[1]},
    "cards":{"type":"array","maxItems":100,"items":{"$ref":"card"}},
    "transactions":{"type":"array","maxItems":5000,"items":{"$ref":"transaction"}},
    "offers":{"type":"array","maxItems":100,"items":{"$ref":"offer"}},
    "goals":{"type":"array","maxItems":30,"items":{"$ref":"goal"}},
    "mileBalance":{"$ref":"miles"},"mileValueSgd":{"type":"number","minimum":0.001,"maximum":1}
  },
  "$defs":{
    "id":{"type":"string","minLength":1,"maxLength":120,"pattern":"^[a-zA-Z0-9_-]+$"},
    "text":{"type":"string","minLength":1,"maxLength":240,"pattern":"[^[:space:]]"},
    "money":{"type":"number","minimum":0,"maximum":100000000},
    "miles":{"type":"number","minimum":0,"maximum":10000000000},
    "date":{"type":"string","format":"date","maxLength":10},
    "dateTime":{"type":"string","format":"date-time","maxLength":40},
    "purchaseDate":{"anyOf":[{"$ref":"date"},{"$ref":"dateTime"}]},
    "url":{"type":"string","format":"https-url","maxLength":2048},
    "confidence":{"type":"string","enum":["Confirmed","Likely","Unverified"]},
    "category":{"type":"string","enum":["dining","online","shopping","travel","transport","fuel","groceries","other","utilities","insurance","education","government","financial"]},
    "channel":{"type":"string","enum":["online","contactless","in-store"]},
    "method":{"type":"string","enum":["card","apple-pay","google-pay","mobile-wallet"]},
    "mcc":{"type":"integer","minimum":1,"maximum":9999},
    "mccRange":{"type":"array","minItems":2,"maxItems":2,"items":{"$ref":"mcc"}},
    "conditions":{
      "type":"object","additionalProperties":false,"properties":{
        "categories":{"type":"array","maxItems":20,"items":{"$ref":"category"}},
        "channels":{"type":"array","maxItems":5,"items":{"$ref":"channel"}},
        "paymentMethods":{"type":"array","maxItems":6,"items":{"$ref":"method"}},
        "currency":{"type":"string","enum":["local","foreign"]},
        "mccs":{"type":"array","maxItems":200,"items":{"$ref":"mcc"}},
        "mccRanges":{"type":"array","maxItems":100,"items":{"$ref":"mccRange"}},
        "excludedMccs":{"type":"array","maxItems":200,"items":{"$ref":"mcc"}},
        "excludedMccRanges":{"type":"array","maxItems":100,"items":{"$ref":"mccRange"}},
        "excludedCategories":{"type":"array","maxItems":20,"items":{"$ref":"category"}},
        "excludedPaymentMethods":{"type":"array","maxItems":6,"items":{"$ref":"method"}},
        "merchantIncludes":{"type":"array","maxItems":100,"items":{"$ref":"text"}},
        "excludedMerchantIncludes":{"type":"array","maxItems":100,"items":{"$ref":"text"}}
      }
    },
    "card":{
      "type":"object","additionalProperties":false,"required":["id","templateId","owner","status","usageKnown"],
      "properties":{
        "id":{"$ref":"id"},"templateId":{"$ref":"id"},"owner":{"type":"string","enum":["Aleem","Nurul"]},
        "status":{"type":"string","enum":["active","inactive","unconfirmed"]},
        "statementDay":{"type":"integer","minimum":1,"maximum":31},"usageKnown":{"type":"boolean"},
        "openingSpendSgd":{"$ref":"money"},"openingPeriodStart":{"$ref":"date"},
        "openingQualifyingSpendSgd":{"$ref":"money"},"openingLifetimeCashbackSgd":{"$ref":"money"},
        "transferFeePerMileSgd":{"type":"number","minimum":0,"maximum":1}
      }
    },
    "reward":{
      "type":"object","additionalProperties":false,
      "required":["calculatedAt","templateId","ruleId","ruleVersion","sourceUrl","lastVerifiedAt","miles","cashbackSgd","fxFeeSgd","effectiveMpd","confidence","bonusSpendSgd","qualifyingSpendSgd","welcomeContributionSgd","welcomeIncrementalMiles","reason","warnings"],
      "properties":{
        "calculatedAt":{"$ref":"purchaseDate"},"templateId":{"$ref":"id"},"ruleId":{"$ref":"id"},
        "ruleVersion":{"type":"integer","minimum":1,"maximum":1000000},"sourceUrl":{"$ref":"url"},"lastVerifiedAt":{"$ref":"date"},
        "miles":{"$ref":"miles"},"cashbackSgd":{"$ref":"money"},"fxFeeSgd":{"$ref":"money"},
        "effectiveMpd":{"type":"number","minimum":0,"maximum":1000},"confidence":{"$ref":"confidence"},
        "minimumSpendIncrementalMiles":{"$ref":"miles"},"bonusSpendSgd":{"$ref":"money"},"bonusCapGroup":{"$ref":"id"},
        "periodStart":{"$ref":"date"},"periodEnd":{"$ref":"date"},"qualifyingSpendSgd":{"$ref":"money"},
        "welcomeOfferId":{"$ref":"id"},"welcomeContributionSgd":{"$ref":"money"},"welcomeIncrementalMiles":{"$ref":"miles"},
        "reason":{"type":"string","maxLength":2000},"warnings":{"type":"array","maxItems":30,"items":{"type":"string","maxLength":1000}}
      }
    },
    "transaction":{
      "type":"object","additionalProperties":false,
      "required":["id","cardId","amountSgd","merchant","category","channel","paymentMethod","currency","date","reward"],
      "properties":{
        "id":{"$ref":"id"},"cardId":{"$ref":"id"},"amountSgd":{"$ref":"money"},"merchant":{"$ref":"text"},
        "category":{"$ref":"category"},"channel":{"$ref":"channel"},"paymentMethod":{"$ref":"method"},
        "currency":{"type":"string","pattern":"^[A-Z]{3}$"},"date":{"$ref":"purchaseDate"},
        "mcc":{"$ref":"mcc"},"mccConfidence":{"$ref":"confidence"},"excluded":{"type":"boolean"},"processedOverseas":{"type":"boolean"},
        "postedDate":{"$ref":"date"},"status":{"type":"string","enum":["pending","posted","reversed"]},"reward":{"$ref":"reward"}
      }
    },
    "offer":{
      "type":"object","additionalProperties":false,
      "required":["id","cardId","name","startsOn","deadline","tiers","openingSpendSgd","plannedNaturalSpendSgd","sourceUrl","verified","eligibilityConfirmed"],
      "properties":{
        "id":{"$ref":"id"},"cardId":{"$ref":"id"},"name":{"$ref":"text"},"startsOn":{"$ref":"date"},"deadline":{"$ref":"date"},
        "tiers":{"type":"array","minItems":1,"maxItems":20,"items":{"type":"object","additionalProperties":false,"required":["spendSgd","miles"],"properties":{"spendSgd":{"$ref":"money"},"miles":{"$ref":"miles"}}}},
        "openingSpendSgd":{"$ref":"money"},"plannedNaturalSpendSgd":{"$ref":"money"},
        "sourceUrl":{"anyOf":[{"$ref":"url"},{"type":"string","enum":[""]}]},
        "verified":{"type":"boolean"},"eligibilityConfirmed":{"type":"boolean"},"conditions":{"$ref":"conditions"}
      }
    },
    "goal":{
      "type":"object","additionalProperties":false,"required":["id","name","destination","targetMiles"],
      "properties":{"id":{"$ref":"id"},"name":{"$ref":"text"},"destination":{"$ref":"text"},"targetMiles":{"type":"number","minimum":1,"maximum":10000000000},"targetDate":{"$ref":"date"}}
    }
  }
}$schema$::jsonb;
$function$;

-- This closed-schema validator needs only standard PostgreSQL, not a project extension.
create or replace function our_miles_private.valid_json(value jsonb, spec jsonb, definitions jsonb)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare
  field text;
  item jsonb;
  actual_type text;
  raw text;
  number_value numeric;
begin
  if value is null or spec is null then return false; end if;
  if spec ? '$ref' then return our_miles_private.valid_json(value, definitions -> (spec ->> '$ref'), definitions); end if;
  if spec ? 'anyOf' then
    for item in select jsonb_array_elements(spec -> 'anyOf') loop
      if our_miles_private.valid_json(value, item, definitions) then return true; end if;
    end loop;
    return false;
  end if;
  actual_type := jsonb_typeof(value);
  if spec ->> 'type' = 'integer' then
    if actual_type <> 'number' then return false; end if;
    number_value := (value #>> '{}')::numeric;
    if trunc(number_value) <> number_value then return false; end if;
  elsif actual_type is distinct from spec ->> 'type' then return false;
  end if;
  if spec ? 'enum' and not ((spec -> 'enum') @> jsonb_build_array(value)) then return false; end if;
  if actual_type = 'object' then
    for field in select jsonb_object_keys(value) loop
      if not (spec -> 'properties' ? field) then return false; end if;
      if not our_miles_private.valid_json(value -> field, spec -> 'properties' -> field, definitions) then return false; end if;
    end loop;
    for field in select jsonb_array_elements_text(coalesce(spec -> 'required', '[]'::jsonb)) loop
      if not value ? field then return false; end if;
    end loop;
  elsif actual_type = 'array' then
    if spec ? 'maxItems' and jsonb_array_length(value) > (spec ->> 'maxItems')::int then return false; end if;
    if spec ? 'minItems' and jsonb_array_length(value) < (spec ->> 'minItems')::int then return false; end if;
    for item in select jsonb_array_elements(value) loop
      if not our_miles_private.valid_json(item, spec -> 'items', definitions) then return false; end if;
    end loop;
  elsif actual_type = 'string' then
    raw := value #>> '{}';
    if spec ? 'minLength' and length(raw) < (spec ->> 'minLength')::int then return false; end if;
    if spec ? 'maxLength' and length(raw) > (spec ->> 'maxLength')::int then return false; end if;
    if spec ? 'pattern' and raw !~ (spec ->> 'pattern') then return false; end if;
    if spec ->> 'format' = 'date' then
      if raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(raw::date, 'YYYY-MM-DD') <> raw then return false; end if;
    elsif spec ->> 'format' = 'date-time' then
      if raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then return false; end if;
      perform raw::timestamptz;
      if to_char(substring(raw from 1 for 10)::date, 'YYYY-MM-DD') <> substring(raw from 1 for 10) then return false; end if;
    elsif spec ->> 'format' = 'https-url' then
      if raw !~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$' then return false; end if;
    end if;
  elsif actual_type = 'number' then
    number_value := (value #>> '{}')::numeric;
    if spec ? 'minimum' and number_value < (spec ->> 'minimum')::numeric then return false; end if;
    if spec ? 'maximum' and number_value > (spec ->> 'maximum')::numeric then return false; end if;
  end if;
  return true;
exception when others then return false;
end;
$$;

create or replace function our_miles_private.valid_wallet(value jsonb)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare
  spec jsonb := our_miles_private.wallet_schema();
  collection text;
  entry jsonb;
  tier jsonb;
  previous_spend numeric;
  previous_miles numeric;
begin
  if value is null or octet_length(value::text) > 1048576 then return false; end if;
  if not our_miles_private.valid_json(value, spec, spec -> '$defs') then return false; end if;
  foreach collection in array array['cards','transactions','offers','goals'] loop
    if exists (select 1 from jsonb_array_elements(value -> collection) as records(entry)
      group by records.entry ->> 'id' having count(*) > 1) then return false; end if;
  end loop;
  foreach collection in array array['transactions','offers'] loop
    for entry in select jsonb_array_elements(value -> collection) loop
      if not exists (select 1 from jsonb_array_elements(value -> 'cards') as cards(card)
        where cards.card ->> 'id' = entry ->> 'cardId') then return false; end if;
    end loop;
  end loop;
  for entry in select jsonb_array_elements(value -> 'offers') loop
    if entry ->> 'deadline' < entry ->> 'startsOn' then return false; end if;
    if (entry ->> 'verified')::boolean and entry ->> 'sourceUrl' = '' then return false; end if;
    previous_spend := -1;
    previous_miles := -1;
    for tier in select jsonb_array_elements(entry -> 'tiers') loop
      if (tier ->> 'spendSgd')::numeric <= previous_spend or (tier ->> 'miles')::numeric < previous_miles then return false; end if;
      previous_spend := (tier ->> 'spendSgd')::numeric;
      previous_miles := (tier ->> 'miles')::numeric;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create or replace function our_miles_private.snapshots_preserved(previous_state jsonb, next_state jsonb)
returns boolean language sql immutable set search_path = ''
as $$
  select not exists (
    select 1
    from jsonb_array_elements(coalesce(previous_state -> 'transactions', '[]'::jsonb)) as old_records(entry)
    join jsonb_array_elements(coalesce(next_state -> 'transactions', '[]'::jsonb)) as new_records(entry)
      on old_records.entry ->> 'id' = new_records.entry ->> 'id'
    where old_records.entry - array['status','postedDate'] is distinct from new_records.entry - array['status','postedDate']
  );
$$;

-- Do not expose an older wallet containing data outside the application's closed schema.
do $$
begin
  if exists (select 1 from public.our_miles_state where state is not null
    and not our_miles_private.valid_wallet(state)) then
    raise exception using errcode = '22023', message = 'Existing wallet data must be validated before enabling browser access.';
  end if;
end;
$$;

-- Preserve evidence across deletion/re-insertion as well as adjacent saves.
-- This private integrity record is never readable or writable by browser users.
create table if not exists our_miles_private.transaction_evidence (
  transaction_id text primary key,
  evidence jsonb not null
);
alter table our_miles_private.transaction_evidence enable row level security;
revoke all on our_miles_private.transaction_evidence from public, anon, authenticated, service_role;
insert into our_miles_private.transaction_evidence (transaction_id, evidence)
select entry ->> 'id', entry - array['status','postedDate']
from public.our_miles_state
cross join lateral jsonb_array_elements(coalesce(state -> 'transactions', '[]'::jsonb)) as records(entry)
on conflict (transaction_id) do nothing;

create or replace function our_miles_private.guard_wallet_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare entry jsonb;
begin
  if new.version < 0 or new.version > 9007199254740991 then
    raise exception using errcode = '22023', message = 'Invalid wallet version.';
  end if;
  if new.state is not null and not our_miles_private.valid_wallet(new.state) then
    raise exception using errcode = '22023', message = 'Invalid wallet data.';
  end if;
  if tg_op = 'UPDATE' and not our_miles_private.snapshots_preserved(old.state, new.state) then
    raise exception using errcode = '22023', message = 'Recorded purchase evidence cannot be overwritten.';
  end if;
  for entry in select jsonb_array_elements(coalesce(new.state -> 'transactions', '[]'::jsonb)) loop
    if exists (select 1 from our_miles_private.transaction_evidence
      where transaction_id = entry ->> 'id'
        and evidence is distinct from entry - array['status','postedDate']) then
      raise exception using errcode = '22023', message = 'Recorded purchase evidence cannot be overwritten.';
    end if;
    insert into our_miles_private.transaction_evidence (transaction_id, evidence)
    values (entry ->> 'id', entry - array['status','postedDate'])
    on conflict (transaction_id) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists our_miles_guard_write on public.our_miles_state;
create trigger our_miles_guard_write before insert or update on public.our_miles_state
for each row execute function our_miles_private.guard_wallet_write();

drop policy if exists our_miles_member_self on public.our_miles_members;
create policy our_miles_member_self on public.our_miles_members for select to authenticated
using (user_id = (select auth.uid()) and (select our_miles_private.is_member()));

alter table public.our_miles_state enable row level security;
revoke all on public.our_miles_state from public, anon, authenticated;
grant select (id, version, state) on public.our_miles_state to authenticated;
-- Existing private Node servers retain their service-role adapter and RPC access.
grant select, update on public.our_miles_state to service_role;
drop policy if exists our_miles_member_read on public.our_miles_state;
create policy our_miles_member_read on public.our_miles_state for select to authenticated
using (id = true and (select our_miles_private.is_member()));

create or replace function public.save_our_miles_state(expected_version bigint, next_state jsonb)
returns table(version bigint, state jsonb)
language plpgsql security definer set search_path = ''
as $$
declare current_version bigint;
begin
  -- Supabase validates the JWT; clients cannot grant themselves this role via user metadata.
  if coalesce(auth.role(), '') <> 'service_role' and coalesce(current_setting('role', true), '') <> 'service_role'
    and not our_miles_private.is_member() then
    raise exception using errcode = '42501', message = 'This wallet is private to Aleem and Nurul.';
  end if;
  if expected_version is null or expected_version < 0 or expected_version > 9007199254740990
    or not our_miles_private.valid_wallet(next_state) then
    raise exception using errcode = '22023', message = 'Invalid wallet update.';
  end if;
  -- Lock before checking the version, so two devices cannot both save the same version.
  select wallet.version into current_version from public.our_miles_state as wallet where wallet.id = true for update;
  if not found then raise exception using errcode = '55000', message = 'Initialize the shared wallet first.'; end if;
  if expected_version <> current_version then return; end if;
  return query update public.our_miles_state as wallet
    set version = wallet.version + 1, state = next_state, updated_at = now()
    where wallet.id = true
    returning wallet.version, wallet.state;
end;
$$;

revoke execute on all functions in schema our_miles_private from public, anon, authenticated;
grant execute on function our_miles_private.is_member() to authenticated, service_role;
revoke execute on function public.save_our_miles_state(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_our_miles_state(bigint, jsonb) to authenticated, service_role;

commit;
