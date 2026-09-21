begin;

alter table public.app_users
  add column if not exists is_admin boolean not null default false;

update public.app_users au
set is_admin = true
from auth.users u
where u.id = au.user_id
  and lower(u.email) = 'gianmarco.milia96@gmail.com';

create table if not exists public.event_memberships (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('responsabile', 'visualizzatore')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  primary key (event_id, user_id)
);

alter table public.event_memberships enable row level security;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users au
    where au.user_id = auth.uid()
      and au.active = true
      and au.is_admin = true
  );
$$;

create or replace function private.event_access_role(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.is_app_user() then null
    when private.is_admin() then 'admin'
    else (
      select em.role
      from public.event_memberships em
      where em.event_id = p_event_id
        and em.user_id = auth.uid()
      limit 1
    )
  end;
$$;

create or replace function private.can_read_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.event_access_role(p_event_id) is not null;
$$;

create or replace function private.can_edit_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.event_access_role(p_event_id) in ('admin', 'responsabile'), false);
$$;

drop policy if exists "admin can read app users" on public.app_users;
create policy "admin can read app users"
on public.app_users
for select
to authenticated
using (private.is_admin());

drop policy if exists "members can read own event membership" on public.event_memberships;
create policy "members can read own event membership"
on public.event_memberships
for select
to authenticated
using (private.is_admin() or user_id = auth.uid());

drop policy if exists "admins manage event memberships" on public.event_memberships;
create policy "admins manage event memberships"
on public.event_memberships
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "app users manage events" on public.events;
drop policy if exists "event access read" on public.events;
drop policy if exists "event admin insert" on public.events;
drop policy if exists "event managers update" on public.events;
drop policy if exists "event admin delete" on public.events;

create policy "event access read"
on public.events
for select
to authenticated
using (private.can_read_event(id));

create policy "event admin insert"
on public.events
for insert
to authenticated
with check (private.is_admin());

create policy "event managers update"
on public.events
for update
to authenticated
using (private.can_edit_event(id))
with check (private.can_edit_event(id));

create policy "event admin delete"
on public.events
for delete
to authenticated
using (private.is_admin());

drop policy if exists "app users manage departures" on public.event_departures;
drop policy if exists "departures read by event access" on public.event_departures;
drop policy if exists "departures edit by event access" on public.event_departures;
create policy "departures read by event access"
on public.event_departures
for select
to authenticated
using (private.can_read_event(event_id));
create policy "departures edit by event access"
on public.event_departures
for all
to authenticated
using (private.can_edit_event(event_id))
with check (private.can_edit_event(event_id));

drop policy if exists "app users manage timeline" on public.timeline_items;
drop policy if exists "timeline read by event access" on public.timeline_items;
drop policy if exists "timeline edit by event access" on public.timeline_items;
create policy "timeline read by event access"
on public.timeline_items
for select
to authenticated
using (private.can_read_event(event_id));
create policy "timeline edit by event access"
on public.timeline_items
for all
to authenticated
using (private.can_edit_event(event_id))
with check (private.can_edit_event(event_id));

drop policy if exists "app users manage officials" on public.officials;
drop policy if exists "officials read by event access" on public.officials;
drop policy if exists "officials edit by event access" on public.officials;
create policy "officials read by event access"
on public.officials
for select
to authenticated
using (private.can_read_event(event_id));
create policy "officials edit by event access"
on public.officials
for all
to authenticated
using (private.can_edit_event(event_id))
with check (private.can_edit_event(event_id));

drop policy if exists "app users manage role categories" on public.role_categories;
drop policy if exists "role categories read by event access" on public.role_categories;
drop policy if exists "role categories edit by event access" on public.role_categories;
create policy "role categories read by event access"
on public.role_categories
for select
to authenticated
using (private.can_read_event(event_id));
create policy "role categories edit by event access"
on public.role_categories
for all
to authenticated
using (private.can_edit_event(event_id))
with check (private.can_edit_event(event_id));

drop policy if exists "app users manage role subcategories" on public.role_subcategories;
drop policy if exists "role subcategories read by event access" on public.role_subcategories;
drop policy if exists "role subcategories edit by event access" on public.role_subcategories;
create policy "role subcategories read by event access"
on public.role_subcategories
for select
to authenticated
using (
  exists (
    select 1
    from public.role_categories c
    where c.id = category_id
      and private.can_read_event(c.event_id)
  )
);
create policy "role subcategories edit by event access"
on public.role_subcategories
for all
to authenticated
using (
  exists (
    select 1
    from public.role_categories c
    where c.id = category_id
      and private.can_edit_event(c.event_id)
  )
)
with check (
  exists (
    select 1
    from public.role_categories c
    where c.id = category_id
      and private.can_edit_event(c.event_id)
  )
);

drop policy if exists "app users manage roles" on public.roles;
drop policy if exists "roles read by event access" on public.roles;
drop policy if exists "roles edit by event access" on public.roles;
create policy "roles read by event access"
on public.roles
for select
to authenticated
using (
  exists (
    select 1
    from public.role_categories c
    where c.id = category_id
      and private.can_read_event(c.event_id)
  )
);
create policy "roles edit by event access"
on public.roles
for all
to authenticated
using (
  exists (
    select 1
    from public.role_categories c
    where c.id = category_id
      and private.can_edit_event(c.event_id)
  )
)
with check (
  exists (
    select 1
    from public.role_categories c
    where c.id = category_id
      and private.can_edit_event(c.event_id)
  )
);

drop policy if exists "app users manage role assignments" on public.role_assignments;
drop policy if exists "role assignments read by event access" on public.role_assignments;
drop policy if exists "role assignments edit by event access" on public.role_assignments;
create policy "role assignments read by event access"
on public.role_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.roles r
    join public.role_categories c on c.id = r.category_id
    where r.id = role_id
      and private.can_read_event(c.event_id)
  )
);
create policy "role assignments edit by event access"
on public.role_assignments
for all
to authenticated
using (
  exists (
    select 1
    from public.roles r
    join public.role_categories c on c.id = r.category_id
    where r.id = role_id
      and private.can_edit_event(c.event_id)
  )
)
with check (
  exists (
    select 1
    from public.roles r
    join public.role_categories c on c.id = r.category_id
    where r.id = role_id
      and private.can_edit_event(c.event_id)
  )
);

drop policy if exists "app users manage referee checklist" on public.referee_checklist_items;
drop policy if exists "checklist read by event access" on public.referee_checklist_items;
drop policy if exists "checklist edit by event access" on public.referee_checklist_items;
create policy "checklist read by event access"
on public.referee_checklist_items
for select
to authenticated
using (private.can_read_event(event_id));
create policy "checklist edit by event access"
on public.referee_checklist_items
for all
to authenticated
using (private.can_edit_event(event_id))
with check (private.can_edit_event(event_id));

create or replace function public.get_current_user_access()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'isAdmin', private.is_admin(),
    'canCreate', private.is_admin(),
    'canImport', private.is_admin()
  );
$$;

create or replace function public.get_my_event_access(p_event_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := private.event_access_role(p_event_id);
  return jsonb_build_object(
    'role', v_role,
    'canRead', v_role is not null,
    'canEdit', v_role in ('admin', 'responsabile'),
    'canDelete', v_role = 'admin',
    'canManagePermissions', v_role = 'admin',
    'canExport', v_role in ('admin', 'responsabile'),
    'canPrint', v_role is not null
  );
end;
$$;

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

create or replace function public.set_event_permission(
  p_event_id uuid,
  p_user_id uuid,
  p_role text
)
returns boolean
language plpgsql
volatile
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

  if not exists (
    select 1
    from public.app_users au
    where au.user_id = p_user_id
      and au.active = true
  ) then
    raise exception 'Utente non abilitato' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.app_users au
    where au.user_id = p_user_id
      and au.is_admin = true
  ) then
    raise exception 'Il ruolo Admin e globale e non si modifica dal singolo evento' using errcode = '22023';
  end if;

  if p_role is null or btrim(p_role) = '' then
    delete from public.event_memberships
    where event_id = p_event_id
      and user_id = p_user_id;
    return true;
  end if;

  if p_role not in ('responsabile', 'visualizzatore') then
    raise exception 'Ruolo non valido' using errcode = '22023';
  end if;

  insert into public.event_memberships (event_id, user_id, role, created_by)
  values (p_event_id, p_user_id, p_role, auth.uid())
  on conflict (event_id, user_id)
  do update set role = excluded.role;

  return true;
end;
$$;

drop function if exists public.list_events_v2();
create function public.list_events_v2()
returns table (
  event_id uuid,
  name text,
  event_date date,
  venue text,
  athlete_total integer,
  updated_at timestamptz,
  access_role text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.id as event_id,
    e.name,
    e.event_date,
    e.venue,
    e.athlete_total,
    e.updated_at,
    private.event_access_role(e.id) as access_role
  from public.events e
  where private.can_read_event(e.id)
  order by e.event_date desc nulls last, e.updated_at desc;
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

commit;
