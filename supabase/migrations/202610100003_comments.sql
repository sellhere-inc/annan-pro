create table public.person_comments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  activity_id uuid unique references public.activity(id),
  author_name text not null,
  author_role text not null,
  body text not null check(char_length(btrim(body)) between 1 and 160),
  created_at timestamptz not null default now()
);
create index comments_person on public.person_comments(person_id,created_at);
alter table public.person_comments enable row level security;
revoke all on public.person_comments from anon,authenticated;
grant select on public.person_comments to authenticated;
grant all on public.person_comments to service_role;
create policy comments_read on public.person_comments for select to authenticated using(public.member_role() is not null);
insert into public.person_comments(person_id,activity_id,author_name,author_role,body,created_at)
select person_id,id,coalesce(actor_name,'Admin'),coalesce(actor_role,'admin'),note,created_at from public.activity where btrim(note)<>'';
create function public.capture_comment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if btrim(new.note)<>'' then
    insert into public.person_comments(person_id,activity_id,author_name,author_role,body,created_at)
    values(new.person_id,new.id,coalesce(new.actor_name,'Admin'),coalesce(new.actor_role,'admin'),new.note,new.created_at);
  end if;
  return new;
end;
$$;
create trigger circle_capture_comment after insert on public.activity for each row execute function public.capture_comment();
create function public.add_comment(p_person_id uuid,p_body text) returns void language plpgsql security definer set search_path = '' as $$
declare person public.people; actor_role text; actor_name text;
begin
  actor_role := public.member_role();
  if actor_role is null or actor_role not in ('admin','annan') then raise exception 'Only admin and Annan can comment'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 160 then raise exception 'Add a comment with 1–160 characters'; end if;
  select * into person from public.people where id=p_person_id for update;
  if not found then raise exception 'Person not found'; end if;
  select full_name into actor_name from public.profiles where user_id=auth.uid();
  update public.people set note=case when is_on then '' else btrim(p_body) end,version=version+1,updated_at=now() where id=p_person_id;
  insert into public.activity(person_id,person_name,kind,note,actor_name,actor_role) values(person.id,person.name,'note',btrim(p_body),actor_name,actor_role);
end;
$$;
create function public.delete_comment(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare comment public.person_comments; latest text;
begin
  if not public.is_admin() then raise exception 'Only admin can delete comments'; end if;
  select * into comment from public.person_comments where id=p_id;
  if not found then raise exception 'Comment already deleted'; end if;
  perform 1 from public.people where id=comment.person_id for update;
  delete from public.person_comments where id=p_id;
  if not found then raise exception 'Comment already deleted'; end if;
  update public.activity set note='Comment removed by admin.' where id=comment.activity_id;
  update public.push_deliveries set body='Status updated.' where activity_id=comment.activity_id and status in ('queued','processing');
  select body into latest from public.person_comments where person_id=comment.person_id order by created_at desc,id desc limit 1;
  update public.people set note=case when is_on then '' else coalesce(latest,'No comment.') end,version=version+1,updated_at=now() where id=comment.person_id;
end;
$$;
revoke all on function public.capture_comment(),public.add_comment(uuid,text),public.delete_comment(uuid) from public,anon,authenticated;
grant execute on function public.add_comment(uuid,text),public.delete_comment(uuid) to authenticated;
alter publication supabase_realtime add table public.person_comments;
