-- Gestionale OW - sicurezza e Row Level Security
-- Modello iniziale: nessun accesso anonimo; gli utenti autenticati possono
-- accedere ai dati solo se presenti e attivi in public.app_users.

begin;

alter table public.app_users enable row level security;
alter table public.events enable row level security;
alter table public.event_departures enable row level security;
alter table public.timeline_items enable row level security;
alter table public.officials enable row level security;
alter table public.role_categories enable row level security;
alter table public.role_subcategories enable row level security;
alter table public.roles enable row level security;
alter table public.role_assignments enable row level security;
alter table public.referee_checklist_items enable row level security;

create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users
    where user_id = (select auth.uid())
      and active = true
  );
$$;

revoke all on function public.is_app_user() from public;
grant execute on function public.is_app_user() to authenticated;

-- Nessun privilegio applicativo per il ruolo anonimo.
revoke all on table public.app_users from anon;
revoke all on table public.events from anon;
revoke all on table public.event_departures from anon;
revoke all on table public.timeline_items from anon;
revoke all on table public.officials from anon;
revoke all on table public.role_categories from anon;
revoke all on table public.role_subcategories from anon;
revoke all on table public.roles from anon;
revoke all on table public.role_assignments from anon;
revoke all on table public.referee_checklist_items from anon;

-- La whitelist e' leggibile dall'utente solo per la propria riga.
revoke all on table public.app_users from authenticated;
grant select on table public.app_users to authenticated;

drop policy if exists "app user can read own membership" on public.app_users;
create policy "app user can read own membership"
on public.app_users
for select
to authenticated
using (user_id = (select auth.uid()));

-- Permessi CRUD sulle tabelle dati; le policy RLS limitano l'accesso ai soli
-- utenti presenti e attivi in app_users.
revoke all on table public.events from authenticated;
revoke all on table public.event_departures from authenticated;
revoke all on table public.timeline_items from authenticated;
revoke all on table public.officials from authenticated;
revoke all on table public.role_categories from authenticated;
revoke all on table public.role_subcategories from authenticated;
revoke all on table public.roles from authenticated;
revoke all on table public.role_assignments from authenticated;
revoke all on table public.referee_checklist_items from authenticated;

grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.event_departures to authenticated;
grant select, insert, update, delete on table public.timeline_items to authenticated;
grant select, insert, update, delete on table public.officials to authenticated;
grant select, insert, update, delete on table public.role_categories to authenticated;
grant select, insert, update, delete on table public.role_subcategories to authenticated;
grant select, insert, update, delete on table public.roles to authenticated;
grant select, insert, update, delete on table public.role_assignments to authenticated;
grant select, insert, update, delete on table public.referee_checklist_items to authenticated;

drop policy if exists "app users manage events" on public.events;
create policy "app users manage events"
on public.events
for all
to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage departures" on public.event_departures;
create policy "app users manage departures"
on public.event_departures
for all
to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage timeline" on public.timeline_items;
create policy "app users manage timeline"
on public.timeline_items
for all
to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage officials" on public.officials;
create policy "app users manage officials"
on public.officials
for all
to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage role categories" on public.role_categories;
create policy "app users manage role categories"
on public.role_categories
for all
to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage role subcategories" on public.role_subcategories;
create policy "app users manage role subcategories"
on public.role_subcategories
for all
to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage roles" on public.roles;
create policy "app users manage roles"
on public.roles
for all
to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage role assignments" on public.role_assignments;
create policy "app users manage role assignments"
on public.role_assignments
for all
to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage referee checklist" on public.referee_checklist_items;
create policy "app users manage referee checklist"
on public.referee_checklist_items
for all
to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

commit;
