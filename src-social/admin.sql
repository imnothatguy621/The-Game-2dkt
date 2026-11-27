-- Admin accounts and the admin dashboard for Kickoff Rivals + Skywarden. Safe to run more than once.
-- Who is an admin is decided here on the server, by the email the player signed in with.
-- The admins table has row level security on and no policies, so nobody can read or change it through the API.

create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;
insert into public.admins (email) values ('kabir.vr.shah@gmail.com'), ('kabir.shah2033@oberoi-is.net') on conflict do nothing;

create or replace function public.soc_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- turns a saved string into JSON, or null if it isn't valid JSON
create or replace function public.soc_try_json(t text) returns jsonb
language plpgsql immutable set search_path = public as $$
begin return t::jsonb; exception when others then return null; end $$;

-- "ka***@gmail.com": enough to tell players apart without showing full emails on screen
create or replace function public.soc_mask_email(e text) returns text
language sql immutable set search_path = public as $$
  select case when e is null or position('@' in e) = 0 then null
    else left(split_part(e, '@', 1), 2) || '***@' || split_part(e, '@', 2) end;
$$;

create or replace function public.soc_admin_players()
returns table (
  user_id uuid, username text, email text, joined timestamptz, last_sign_in timestamptz, last_seen timestamptz,
  online boolean, game text, kickoff_saved timestamptz, coins numeric, xp numeric,
  rts jsonb, mc jsonb, pc jsonb, sky jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not soc_is_admin() then raise exception 'not allowed'; end if;
  return query
  with k as (
    select p.id,
      soc_try_json(p.kickoff -> 'd' ->> 'kr_profile') as prof,
      soc_try_json(p.kickoff -> 'd' ->> 'kr_rts') as r,
      soc_try_json(p.kickoff -> 'd' ->> 'kr_mc') as m,
      soc_try_json(p.kickoff -> 'd' ->> 'kr_pc') as c
    from profiles p
  )
  select u.id,
    coalesce(p.username, '(no username)'),
    soc_mask_email(u.email::text),
    u.created_at, u.last_sign_in_at, p.last_seen,
    coalesce(p.last_seen > now() - interval '2 minutes', false),
    p.current_game,
    case when (p.kickoff ->> 't') ~ '^\d+$' then to_timestamp((p.kickoff ->> 't')::numeric / 1000) end,
    case when jsonb_typeof(k.prof -> 'coins') = 'number' then (k.prof ->> 'coins')::numeric end,
    case when jsonb_typeof(k.prof -> 'xp') = 'number' then (k.prof ->> 'xp')::numeric end,
    case when k.r is null or jsonb_typeof(k.r) <> 'object' then null else jsonb_build_object(
      'club', k.r ->> 'club', 'div', k.r -> 'div', 'played', k.r -> 'played', 'wins', k.r -> 'wins', 'draws', k.r -> 'draws', 'losses', k.r -> 'losses',
      'gf', k.r -> 'gf', 'ga', k.r -> 'ga',
      'squad', case when jsonb_typeof(k.r -> 'players') = 'array' then jsonb_array_length(k.r -> 'players') end,
      'top', (select max((x ->> 'ovr')::numeric) from jsonb_array_elements(case when jsonb_typeof(k.r -> 'players') = 'array' then k.r -> 'players' else '[]'::jsonb end) x where (x ->> 'ovr') ~ '^\d+(\.\d+)?$')) end,
    case when k.m is null or jsonb_typeof(k.m) <> 'object' then null else jsonb_build_object(
      'club', k.m ->> 'club', 'season', k.m -> 'seasonNo', 'budget', k.m -> 'budget',
      'trophies', case when jsonb_typeof(k.m -> 'trophies') = 'array' then jsonb_array_length(k.m -> 'trophies') end,
      'stadium', k.m -> 'g' -> 'stadium',
      'top', (select max((x ->> 'ovr')::numeric) from jsonb_array_elements(case when jsonb_typeof(k.m -> 'players') = 'array' then k.m -> 'players' else '[]'::jsonb end) x where (x ->> 'ovr') ~ '^\d+(\.\d+)?$')) end,
    case when k.c is null or jsonb_typeof(k.c) <> 'object' then null else jsonb_build_object(
      'name', k.c ->> 'name', 'pos', k.c ->> 'pos', 'ovr', k.c -> 'ovr', 'goals', k.c -> 'careerGoals', 'club', k.c ->> 'club', 'season', k.c -> 'seasonNo') end,
    case when p.stats is null and p.progress is null then null else jsonb_build_object(
      'stats', p.stats, 'credits', p.progress -> 'credits' -> 'bal',
      'quests', case when jsonb_typeof(p.progress -> 'quests' -> 'done') = 'array' then jsonb_array_length(p.progress -> 'quests' -> 'done') end) end
  from auth.users u
  left join profiles p on p.id = u.id
  left join k on k.id = u.id
  order by greatest(coalesce(p.last_seen, 'epoch'), coalesce(u.last_sign_in_at, 'epoch')) desc
  limit 2000;
end $$;

do $$ declare f text; begin
  foreach f in array array['soc_is_admin()', 'soc_admin_players()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke all on function public.soc_try_json(text) from public, anon, authenticated';
  execute 'revoke all on function public.soc_mask_email(text) from public, anon, authenticated';
end $$;
