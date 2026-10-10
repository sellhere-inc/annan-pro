-- Registration, payment review, Annan permissions, and browser push.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 60),
  email text not null,
  role text not null default 'member' check (role in ('member','annan','admin')),
  status text not null default 'payment' check (status in ('payment','pending','approved','rejected')),
  payment_reference text not null default '',
  rejection_reason text not null default '',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);
alter table public.profiles enable row level security;
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and not coalesce(new.is_anonymous,false) then
    insert into public.profiles(user_id,full_name,email) values (new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1)),60),new.email);
  end if;
  return new;
end;
$$;
create trigger circle_create_profile after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles(user_id,full_name,email,role,status,approved_at)
select u.id,left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1)),60),u.email,
  case when a.user_id is not null then 'admin' else 'member' end,
  case when a.user_id is not null then 'approved' else 'payment' end,
  case when a.user_id is not null then now() else null end
from auth.users u left join public.admins a on a.user_id=u.id where u.email is not null and not coalesce(u.is_anonymous,false);

create function public.member_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where user_id=auth.uid() and status='approved';
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.member_role()='admin',false);
$$;
create function public.bootstrap_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role='admin',status='approved',approved_at=now() where user_id=new.user_id;
  return new;
end;
$$;
create trigger circle_bootstrap_admin after insert on public.admins for each row execute function public.bootstrap_admin();
create policy profiles_read on public.profiles for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy people_read on public.people;
drop policy activity_read on public.activity;
revoke select on public.people,public.activity from anon;
create policy people_read on public.people for select to authenticated using(public.member_role() is not null);
create policy activity_read on public.activity for select to authenticated using(public.member_role() is not null);
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy notifications_own on public.notifications for select to authenticated using(user_id=auth.uid());
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.push_tokens add column transport text not null default 'expo' check(transport in ('expo','web'));
alter table public.push_tokens add column subscription jsonb;
alter table public.push_deliveries alter column activity_id drop not null;
alter table public.push_deliveries add column recipient_id uuid references auth.users(id) on delete cascade;
alter table public.push_deliveries add column notification_id uuid references public.notifications(id) on delete cascade;
alter table public.push_deliveries add column transport text not null default 'expo';
alter table public.push_deliveries add column subscription jsonb;
create unique index delivery_notification_device on public.push_deliveries(notification_id,token);
update public.push_deliveries d set recipient_id=t.user_id from public.push_tokens t where t.token=d.token;

create function public.submit_payment(p_reference text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_reference is null or btrim(p_reference) !~ '^[0-9]{12}$' then raise exception 'Enter the 12-digit UPI transaction reference'; end if;
  update public.profiles set payment_reference=btrim(p_reference),status='pending',rejection_reason=''
  where user_id=auth.uid() and status in ('payment','rejected');
  if not found then raise exception 'This account cannot submit a payment'; end if;
end;
$$;
create unique index unique_payment_reference on public.profiles(payment_reference) where payment_reference <> '' and status in ('pending','approved');
create function public.review_member(p_user_id uuid,p_approve boolean,p_role text default 'member',p_reason text default '') returns void language plpgsql security definer set search_path = '' as $$
declare member public.profiles; notification uuid;
begin
  if not public.is_admin() then raise exception 'Only admin can approve members'; end if;
  if p_approve is null or p_role is null or p_role not in ('member','annan') then raise exception 'Choose member or Annan'; end if;
  if not p_approve and (p_reason is null or char_length(btrim(p_reason)) not between 1 and 160) then raise exception 'Add a short rejection reason'; end if;
  select * into member from public.profiles where user_id=p_user_id for update;
  if not found or member.status <> 'pending' then raise exception 'This request is no longer awaiting approval'; end if;
  update public.profiles set status=case when p_approve then 'approved' else 'rejected' end,
    role=case when p_approve then p_role else 'member' end,
    approved_at=case when p_approve then now() else null end,approved_by=auth.uid(),
    rejection_reason=case when p_approve then '' else btrim(p_reason) end where user_id=p_user_id;
  insert into public.notifications(user_id,title,body) values(p_user_id,
    case when p_approve then 'You are approved' else 'Payment needs another look' end,
    case when p_approve then 'Your Annan Pro account is ready. Open the app to continue.' else btrim(p_reason) end) returning id into notification;
  insert into public.push_deliveries(notification_id,recipient_id,token,title,body,transport,subscription)
  select notification,p_user_id,t.token,n.title,n.body,t.transport,t.subscription from public.push_tokens t
  join public.notifications n on n.id=notification where t.user_id=p_user_id;
end;
$$;
create function public.set_member_role(p_user_id uuid,p_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only admin can assign roles'; end if;
  if p_role is null or p_role not in ('member','annan') then raise exception 'Choose member or Annan'; end if;
  update public.profiles set role=p_role where user_id=p_user_id and status='approved' and role <> 'admin';
  if not found then raise exception 'This member cannot be changed'; end if;
end;
$$;

-- Historical point totals remain, now representing outstanding violations.
-- Existing on rows with violations become off without generating duplicate alerts.
update public.people set is_on=false,note=case when note='' then 'Outstanding violations from the previous record.' else note end where negative_points>0 and is_on;
update public.people set negative_points=1 where not is_on and negative_points=0;
alter table public.people add constraint status_matches_violations check(is_on=(negative_points=0));
alter table public.activity add column actor_name text;
alter table public.activity add column actor_role text;
create or replace function public.update_person(p_id uuid,p_is_on boolean,p_note text,p_points integer,p_version integer)
returns public.people language plpgsql security definer set search_path = '' as $$
declare old_person public.people; result public.people; actor_role text; actor_name text; event_kind text; total integer;
begin
  actor_role := public.member_role();
  if actor_role is null or actor_role not in ('admin','annan') then raise exception 'Only admin and Annan can edit people'; end if;
  if p_is_on is null or p_points is null or abs(p_points::bigint)>100 then raise exception 'Enter a whole number from -100 to 100'; end if;
  if p_points<0 and actor_role <> 'annan' then raise exception 'Only Annan can reduce violations'; end if;
  if p_note is null or char_length(btrim(p_note)) not between 1 and 160 then raise exception 'Add a comment with 1–160 characters'; end if;
  select * into old_person from public.people where id=p_id for update;
  if not found then raise exception 'Person not found'; end if;
  if p_version is distinct from old_person.version then raise exception 'This person was updated. Refresh and reopen the editor.'; end if;
  total := old_person.negative_points+p_points;
  if total<0 then raise exception 'Cannot remove more violations than the current count'; end if;
  if p_is_on <> (total=0) then raise exception 'A person stays off until Annan clears all violations'; end if;
  if not old_person.is_on and p_is_on and not(actor_role='annan' and p_points<0) then raise exception 'Only a reduction by Annan can turn this person on'; end if;
  select full_name into actor_name from public.profiles where user_id=auth.uid();
  event_kind := case when old_person.is_on <> p_is_on then case when p_is_on then 'on' else 'off' end when p_points<>0 then 'points' else 'note' end;
  update public.people set is_on=p_is_on,note=case when p_is_on then '' else btrim(p_note) end,negative_points=total,version=version+1,updated_at=now() where id=p_id returning * into result;
  insert into public.activity(person_id,person_name,kind,note,points,actor_name,actor_role)
    values(result.id,result.name,event_kind,btrim(p_note),p_points,actor_name,actor_role);
  return result;
end;
$$;
create or replace function public.queue_off_notification() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind='off' then
    insert into public.push_deliveries(activity_id,recipient_id,token,title,body,transport,subscription)
    select new.id,t.user_id,t.token,new.person_name || ' is now off',new.note,t.transport,t.subscription
    from public.push_tokens t join public.profiles p on p.user_id=t.user_id where p.status='approved';
  end if;
  return new;
end;
$$;
create or replace function public.register_push_token(p_token text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where user_id=auth.uid()) then raise exception 'Register an account first'; end if;
  if p_token is null or char_length(p_token)>255 or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'Invalid Expo push token'; end if;
  if (select count(*) from public.push_tokens where user_id=auth.uid())>=10 and not exists(select 1 from public.push_tokens where token=p_token and user_id=auth.uid()) then raise exception 'Device registration limit reached'; end if;
  insert into public.push_tokens(token,user_id) values(p_token,auth.uid()) on conflict(token) do update set user_id=auth.uid(),updated_at=now();
end;
$$;
create function public.register_web_push(p_subscription jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare endpoint text;
begin
  if not exists(select 1 from public.profiles where user_id=auth.uid()) then raise exception 'Register an account first'; end if;
  endpoint := p_subscription->>'endpoint';
  if endpoint is null or char_length(endpoint)>2048 or endpoint !~ '^https://(web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)/' then raise exception 'Unsupported push service'; end if;
  if coalesce(p_subscription->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{87}={0,1}$' or coalesce(p_subscription->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{22}={0,2}$' then raise exception 'Invalid subscription keys'; end if;
  if (select count(*) from public.push_tokens where user_id=auth.uid())>=10 and not exists(select 1 from public.push_tokens where token=endpoint and user_id=auth.uid()) then raise exception 'Device registration limit reached'; end if;
  insert into public.push_tokens(token,user_id,transport,subscription) values(endpoint,auth.uid(),'web',p_subscription)
    on conflict(token) do update set user_id=auth.uid(),subscription=p_subscription,updated_at=now();
end;
$$;
create function public.unregister_push(p_token text) returns void language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token=p_token and user_id=auth.uid();
$$;
revoke all on function public.create_profile(),public.member_role(),public.bootstrap_admin(),public.submit_payment(text),public.review_member(uuid,boolean,text,text),public.set_member_role(uuid,text),public.register_web_push(jsonb),public.unregister_push(text) from public,anon,authenticated;
grant execute on function public.member_role(),public.submit_payment(text),public.review_member(uuid,boolean,text,text),public.set_member_role(uuid,text),public.register_web_push(jsonb),public.unregister_push(text) to authenticated;
alter publication supabase_realtime add table public.profiles, public.notifications;

-- Keep a batch within the free Edge Function execution window, including web-push timeouts.
create or replace function public.claim_push_deliveries() returns setof public.push_deliveries language sql security definer set search_path = '' as $$
  update public.push_deliveries set status='processing',attempts=attempts+1,next_attempt_at=now()+interval '5 minutes'
  where id in (select id from public.push_deliveries where status in ('queued','processing') and attempts<5 and next_attempt_at<=now() order by created_at for update skip locked limit 25)
  returning *;
$$;
