-- Gestionale OW - hardening sicurezza
-- Sposta l'helper RLS fuori dallo schema API pubblico e completa gli indici.

begin;

-- L'ordine degli UG assegnati deve essere persistente come negli array JSON originali.
alter table public.role_assignments
  add column if not exists sort_order integer not null default 0;

-- Copre la FK events.created_by segnalata dal database linter.
create index if not exists idx_events_created_by
  on public.events(created_by);

-- L'helper per le policy vive nello schema private, non esposto da PostgREST.
create or replace function private.is_app_user()
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

revoke all on function private.is_app_user() from public;
revoke all on function private.is_app_user() from anon;
grant usage on schema private to authenticated;
grant execute on function private.is_app_user() to authenticated;

-- Ricrea le policy dati usando l'helper privato.
drop policy if exists "app users manage events" on public.events;
create policy "app users manage events"
on public.events
for all
to authenticated
using ((select private.is_app_user()))
with check ((select private.is_app_user()));

drop policy if exists "app users manage departures" on public.event_departures;
create policy "app users manage departures"
on public.event_departures
for all
to authenticated
using ((select private.is_app_user()))
with check ((select private.is_app_user()));

drop policy if exists "app users manage timeline" on public.timeline_items;
create policy "app users manage timeline"
on public.timeline_items
for all
to authenticated
using ((select private.is_app_user()))
with check ((select private.is_app_user()));

drop policy if exists "app users manage officials" on public.officials;
create policy "app users manage officials"
on public.officials
for all
to authenticated
using ((select private.is_app_user()))
with check ((select private.is_app_user()));

drop policy if exists "app users manage role categories" on public.role_categories;
create policy "app users manage role categories"
on public.role_categories
for all
to authenticated
using ((select private.is_app_user()))
with check ((select private.is_app_user()));

drop policy if exists "app users manage role subcategories" on public.role_subcategories;
create policy "app users manage role subcategories"
on public.role_subcategories
for all
to authenticated
using ((select private.is_app_user()))
with check ((select private.is_app_user()));

drop policy if exists "app users manage roles" on public.roles;
create policy "app users manage roles"
on public.roles
for all
to authenticated
using ((select private.is_app_user()))
with check ((select private.is_app_user()));

drop policy if exists "app users manage role assignments" on public.role_assignments;
create policy "app users manage role assignments"
on public.role_assignments
for all
to authenticated
using ((select private.is_app_user()))
with check ((select private.is_app_user()));

drop policy if exists "app users manage referee checklist" on public.referee_checklist_items;
create policy "app users manage referee checklist"
on public.referee_checklist_items
for all
to authenticated
using ((select private.is_app_user()))
with check ((select private.is_app_user()));

-- Rimuove l'helper precedentemente esposto come RPC pubblico.
revoke all on function public.is_app_user() from public;
revoke all on function public.is_app_user() from anon;
revoke all on function public.is_app_user() from authenticated;
drop function public.is_app_user();

commit;
