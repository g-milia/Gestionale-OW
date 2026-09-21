
create or replace function public.list_event_permissions(p_event_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Permesso negato' using errcode = '42501';
  end if;

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'Evento non trovato' using errcode = 'P0002';
  end if;

  return query
  select
    au.user_id,
    u.email::text,
    au.display_name,
    case when au.is_admin then 'admin' else em.role end as role,
    au.active
  from public.app_users au
  join auth.users u on u.id = au.user_id
  left join public.event_memberships em
    on em.user_id = au.user_id
   and em.event_id = p_event_id
  where au.active = true
  order by
    case when au.is_admin then 0 else 1 end,
    coalesce(au.display_name, u.email);
end;
$$;

revoke all on function public.get_current_user_access() from public;
revoke all on function public.get_current_user_access() from anon;
grant execute on function public.get_current_user_access() to authenticated;

revoke all on function public.get_my_event_access(uuid) from public;
revoke all on function public.get_my_event_access(uuid) from anon;
grant execute on function public.get_my_event_access(uuid) to authenticated;

revoke all on function public.list_event_permissions(uuid) from public;
revoke all on function public.list_event_permissions(uuid) from anon;
grant execute on function public.list_event_permissions(uuid) to authenticated;

revoke all on function public.set_event_permission(uuid, uuid, text) from public;
revoke all on function public.set_event_permission(uuid, uuid, text) from anon;
grant execute on function public.set_event_permission(uuid, uuid, text) to authenticated;

revoke all on function public.list_events_v2() from public;
revoke all on function public.list_events_v2() from anon;
grant execute on function public.list_events_v2() to authenticated;
