-- Apply in the Supabase SQL editor. Only the authenticated Next.js server accesses this table.
create table if not exists public.our_miles_state (
  id boolean primary key default true check (id = true),
  version bigint not null default 0 check (version >= 0),
  state jsonb,
  updated_at timestamptz not null default now()
);

alter table public.our_miles_state enable row level security;
revoke all on public.our_miles_state from public, anon, authenticated;
grant select, update on public.our_miles_state to service_role;

insert into public.our_miles_state (id, version, state)
values (true, 0, null)
on conflict (id) do nothing;

create or replace function public.save_our_miles_state(expected_version bigint, next_state jsonb)
returns table(version bigint, state jsonb)
language sql
security invoker
set search_path = ''
as $$
  update public.our_miles_state as wallet
  set version = wallet.version + 1,
      state = next_state,
      updated_at = now()
  where wallet.id = true and wallet.version = expected_version
  returning wallet.version, wallet.state;
$$;

revoke execute on function public.save_our_miles_state(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_our_miles_state(bigint, jsonb) to service_role;
