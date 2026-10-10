create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  is_on boolean not null default true,
  note text not null default '' check (char_length(note) <= 160),
  negative_points integer not null default 0 check (negative_points >= 0),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  check (is_on or char_length(btrim(note)) > 0)
);
create unique index people_unique_name on public.people (lower(name));
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  person_name text not null,
  kind text not null check (kind in ('off','on','points','note','added')),
  note text not null default '',
  points integer not null default 0,
  created_at timestamptz not null default now()
);
create index activity_recent on public.activity(created_at desc);
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens(user_id);
create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activity(id),
  token text not null,
  title text not null,
  body text not null,
  status text not null default 'queued' check(status in ('queued','processing','sent','delivered','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  ticket_id text,
  last_error text,
  created_at timestamptz not null default now(),
  unique(activity_id, token)
);
create index deliveries_pending on public.push_deliveries(status, next_attempt_at);
alter table public.people enable row level security;
alter table public.activity enable row level security;
alter table public.push_tokens enable row level security;
alter table public.push_deliveries enable row level security;
create policy people_read on public.people for select to anon, authenticated using (true);
create policy activity_read on public.activity for select to anon, authenticated using (true);
-- All writes go through narrowly scoped RPCs; tokens and admin membership stay private.
revoke all on public.admins, public.people, public.activity, public.push_tokens, public.push_deliveries from anon, authenticated;
grant select on public.people, public.activity to anon, authenticated;
grant all on public.admins, public.people, public.activity, public.push_tokens, public.push_deliveries to service_role;

create function public.add_person(p_name text) returns public.people language plpgsql security definer set search_path = '' as $$
declare result public.people;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'Enter a name with 1–60 characters'; end if;
  insert into public.people(name) values (btrim(p_name)) returning * into result;
  insert into public.activity(person_id,person_name,kind) values (result.id,result.name,'added');
  return result;
end;
$$;
create function public.update_person(p_id uuid, p_is_on boolean, p_note text, p_points integer, p_version integer)
returns public.people language plpgsql security definer set search_path = '' as $$
declare old_person public.people; result public.people; event_kind text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_is_on is null or p_points is null or p_points < 0 or p_points > 100 or (p_is_on and p_points <> 0) then raise exception 'Invalid points or status'; end if;
  if p_note is null or char_length(btrim(p_note)) > 160 or (not p_is_on and char_length(btrim(p_note)) = 0) then raise exception 'Add an off reason with 1–160 characters'; end if;
  select * into old_person from public.people where id = p_id for update;
  if not found then raise exception 'Person not found'; end if;
  if p_version is distinct from old_person.version then raise exception 'Someone already updated this person. Refresh and reopen their editor.'; end if;
  if old_person.is_on = p_is_on and old_person.note = (case when p_is_on then '' else btrim(p_note) end) and p_points = 0 then return old_person; end if;
  event_kind := case when old_person.is_on <> p_is_on then case when p_is_on then 'on' else 'off' end when p_points > 0 then 'points' else 'note' end;
  update public.people set is_on=p_is_on, note=case when p_is_on then '' else btrim(p_note) end,
    negative_points=negative_points+p_points, version=version+1, updated_at=now() where id=p_id returning * into result;
  insert into public.activity(person_id,person_name,kind,note,points) values (result.id,result.name,event_kind,result.note,p_points);
  return result;
end;
$$;
create function public.register_push_token(p_token text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in before registering a device'; end if;
  if p_token is null or char_length(p_token) > 255 or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'Invalid Expo push token'; end if;
  if (select count(*) from public.push_tokens where user_id=auth.uid()) >= 10 and not exists(select 1 from public.push_tokens where token=p_token and user_id=auth.uid()) then raise exception 'Device registration limit reached'; end if;
  insert into public.push_tokens(token,user_id) values (p_token,auth.uid()) on conflict(token) do update set user_id=auth.uid(), updated_at=now();
end;
$$;
create function public.queue_off_notification() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'off' then
    insert into public.push_deliveries(activity_id,token,title,body)
    select new.id,token,new.person_name || ' is now off',new.note from public.push_tokens;
  end if;
  return new;
end;
$$;
create trigger queue_off after insert on public.activity for each row execute function public.queue_off_notification();
create function public.claim_push_deliveries() returns setof public.push_deliveries language sql security definer set search_path = '' as $$
  update public.push_deliveries set status='processing', attempts=attempts+1, next_attempt_at=now()+interval '5 minutes'
  where id in (select id from public.push_deliveries where status in ('queued','processing') and attempts < 5 and next_attempt_at <= now() order by created_at for update skip locked limit 100)
  returning *;
$$;

revoke all on function public.is_admin(), public.add_person(text), public.update_person(uuid,boolean,text,integer,integer), public.register_push_token(text), public.queue_off_notification(), public.claim_push_deliveries() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.add_person(text), public.update_person(uuid,boolean,text,integer,integer), public.register_push_token(text) to authenticated;
grant execute on function public.claim_push_deliveries() to service_role;
alter publication supabase_realtime add table public.people, public.activity;
