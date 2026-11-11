-- Shared friends, lobby invites and Kickoff cloud saves for Kickoff Rivals + Skywarden.
-- One account (auth.users + public.profiles) is used by both games. Safe to run more than once.

alter table public.profiles add column if not exists kickoff jsonb;
alter table public.profiles add column if not exists current_game text;
alter table public.profiles add column if not exists last_seen timestamptz;

create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null references auth.users on delete cascade,
  addressee uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;
drop policy if exists "friendships: see own" on public.friendships;
create policy "friendships: see own" on public.friendships for select to authenticated using ((select auth.uid()) in (requester, addressee));

create table if not exists public.game_invites (
  id bigint generated always as identity primary key,
  from_user uuid not null references auth.users on delete cascade,
  to_user uuid not null references auth.users on delete cascade,
  game text not null check (game in ('kickoff','skywarden')),
  room text not null check (room ~ '^[A-Z0-9]{4,5}$'),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);
create index if not exists game_invites_to on public.game_invites (to_user, created_at desc);
create index if not exists game_invites_from on public.game_invites (from_user, room);
alter table public.game_invites enable row level security;
drop policy if exists "invites: see own" on public.game_invites;
create policy "invites: see own" on public.game_invites for select to authenticated using ((select auth.uid()) in (from_user, to_user));

-- everything below runs as the database owner but always checks auth.uid() itself
create or replace function public.soc_set_username(name text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'signin'; end if;
  if name !~ '^[A-Za-z0-9_]{3,16}$' then return 'bad'; end if;
  if exists (select 1 from profiles where lower(username) = lower(name) and id <> me) then return 'taken'; end if;
  insert into profiles (id, username, display_name, updated_at) values (me, name, name, now())
    on conflict (id) do update set username = excluded.username, display_name = excluded.display_name, updated_at = now();
  return 'ok';
exception when unique_violation then return 'taken';
end $$;

create or replace function public.soc_heartbeat(game text) returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen = now(), current_game = case when game in ('kickoff','skywarden') then game else current_game end
  where id = auth.uid();
$$;

create or replace function public.soc_save_kickoff(data jsonb) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'signin'; end if;
  if octet_length(data::text) > 400000 then return 'big'; end if;
  update profiles set kickoff = data, updated_at = now() where id = auth.uid();
  if not found then insert into profiles (id, kickoff, updated_at) values (auth.uid(), data, now()); end if;
  return 'ok';
end $$;

create or replace function public.soc_friend_request(target text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); them uuid; f friendships;
begin
  if me is null then return 'signin'; end if;
  if target !~ '^[A-Za-z0-9_]{3,16}$' then return 'bad'; end if;
  select id into them from profiles where lower(username) = lower(target) limit 1;
  if them is null then return 'notfound'; end if;
  if them = me then return 'self'; end if;
  select * into f from friendships where least(requester, addressee) = least(me, them) and greatest(requester, addressee) = greatest(me, them);
  if found then
    if f.status = 'accepted' then return 'already'; end if;
    if f.requester = them then update friendships set status = 'accepted' where id = f.id; return 'accepted'; end if;
    return 'pending';
  end if;
  if (select count(*) from friendships where requester = me and status = 'pending' and created_at > now() - interval '1 hour') >= 30 then return 'slow'; end if;
  insert into friendships (requester, addressee) values (me, them);
  return 'sent';
end $$;

create or replace function public.soc_friend_respond(fid bigint, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  if accept then update friendships set status = 'accepted' where id = fid and addressee = auth.uid() and status = 'pending';
  else delete from friendships where id = fid and addressee = auth.uid() and status = 'pending'; end if;
  return case when found then 'ok' else 'nope' end;
end $$;

create or replace function public.soc_friend_remove(fid bigint) returns text
language plpgsql security definer set search_path = public as $$
begin
  delete from friendships where id = fid and auth.uid() in (requester, addressee);
  return case when found then 'ok' else 'nope' end;
end $$;

create or replace function public.soc_friend_list()
returns table (fid bigint, user_id uuid, username text, state text, online boolean, game text)
language sql stable security definer set search_path = public as $$
  select f.id,
         p.id,
         coalesce(p.username, 'player'),
         case when f.status = 'accepted' then 'friend' when f.addressee = auth.uid() then 'incoming' else 'outgoing' end,
         coalesce(p.last_seen > now() - interval '2 minutes', false),
         p.current_game
  from friendships f
  join profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by f.created_at desc
  limit 300;
$$;

create or replace function public.soc_send_invite(target uuid, game text, room text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'signin'; end if;
  if game not in ('kickoff','skywarden') or room !~ '^[A-Z0-9]{4,5}$' then return 'bad'; end if;
  if not exists (select 1 from friendships where status = 'accepted' and least(requester, addressee) = least(me, target) and greatest(requester, addressee) = greatest(me, target)) then return 'notfriends'; end if;
  if (select count(*) from game_invites where from_user = me and created_at > now() - interval '1 minute') >= 10 then return 'slow'; end if;
  insert into game_invites (from_user, to_user, game, room) values (me, target, game, room);
  return 'sent';
end $$;

create or replace function public.soc_my_invites()
returns table (id bigint, from_name text, game text, room text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, coalesce(p.username, 'A friend'), i.game, i.room, i.created_at
  from game_invites i join profiles p on p.id = i.from_user
  where i.to_user = auth.uid() and i.status = 'pending' and i.created_at > now() - interval '10 minutes'
  order by i.created_at desc limit 5;
$$;

create or replace function public.soc_invite_respond(iid bigint, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  update game_invites set status = case when accept then 'accepted' else 'declined' end where id = iid and to_user = auth.uid();
  return case when found then 'ok' else 'nope' end;
end $$;

create or replace function public.soc_lobby(game text, room text)
returns table (username text, status text)
language sql stable security definer set search_path = public as $$
  select distinct on (p.id) coalesce(p.username, 'player'), i.status
  from game_invites i join profiles p on p.id = i.to_user
  where i.from_user = auth.uid() and i.game = soc_lobby.game and i.room = soc_lobby.room and i.created_at > now() - interval '3 hours'
  order by p.id, i.created_at desc;
$$;

-- old invites are cleaned up whenever someone sends a new one
create or replace function public.soc_invites_gc() returns trigger language plpgsql security definer set search_path = public as $$
begin delete from game_invites where created_at < now() - interval '1 day'; return null; end $$;
drop trigger if exists soc_invites_gc on public.game_invites;
create trigger soc_invites_gc after insert on public.game_invites for each statement execute function public.soc_invites_gc();

do $$ declare f text; begin
  foreach f in array array['soc_set_username(text)','soc_heartbeat(text)','soc_save_kickoff(jsonb)','soc_friend_request(text)','soc_friend_respond(bigint,boolean)',
    'soc_friend_remove(bigint)','soc_friend_list()','soc_send_invite(uuid,text,text)','soc_my_invites()','soc_invite_respond(bigint,boolean)','soc_lobby(text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke all on function public.soc_invites_gc() from public, anon, authenticated';
end $$;
