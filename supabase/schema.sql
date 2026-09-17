-- Gestionale OW - schema Supabase
-- Eseguire questo file nel SQL Editor di Supabase su un progetto nuovo.
-- Il modello e' relazionale ma mantiene ID testuali per gli oggetti figli,
-- cosi' gli ID gia' presenti nei JSON GitHub possono essere importati senza conversioni.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Utenti autorizzati
-- Supabase Auth gestisce credenziali e sessioni in auth.users.
-- Questa tabella e' una whitelist applicativa: solo gli utenti presenti qui
-- possono leggere o modificare i dati del gestionale.
-- -----------------------------------------------------------------------------
create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Evento
-- -----------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) > 0),
  name text not null default 'Nuova gara di nuoto',
  event_date date,
  venue text,
  notes text,
  path_notes text,
  athlete_total integer not null default 0 check (athlete_total >= 0),
  athlete_description text,
  role_subcategories_enabled boolean not null default false,
  briefing_athletes text,
  briefing_jury text,
  data_version integer not null default 4,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Partenze
-- -----------------------------------------------------------------------------
create table if not exists public.event_departures (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null default 'Partenza',
  start_time time without time zone,
  athlete_count integer check (athlete_count is null or athlete_count >= 0),
  numbers text,
  notes text,
  sort_order integer not null default 0
);

create index if not exists idx_event_departures_event
  on public.event_departures(event_id, sort_order);

-- -----------------------------------------------------------------------------
-- Timeline
-- -----------------------------------------------------------------------------
create table if not exists public.timeline_items (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  item_time time without time zone,
  title text not null default '',
  place text,
  notes text,
  sort_order integer not null default 0
);

create index if not exists idx_timeline_items_event
  on public.timeline_items(event_id, sort_order);

-- -----------------------------------------------------------------------------
-- Ufficiali gara
-- -----------------------------------------------------------------------------
create table if not exists public.officials (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  notes text,
  sort_order integer not null default 0
);

create index if not exists idx_officials_event
  on public.officials(event_id, sort_order);

-- -----------------------------------------------------------------------------
-- Categorie ruoli
-- -----------------------------------------------------------------------------
create table if not exists public.role_categories (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  notes text,
  sort_order integer not null default 0
);

create index if not exists idx_role_categories_event
  on public.role_categories(event_id, sort_order);

-- -----------------------------------------------------------------------------
-- Sottocategorie opzionali della categoria
-- Vengono usate dall'interfaccia solo quando events.role_subcategories_enabled=true.
-- -----------------------------------------------------------------------------
create table if not exists public.role_subcategories (
  id text primary key default (gen_random_uuid()::text),
  category_id text not null references public.role_categories(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

create index if not exists idx_role_subcategories_category
  on public.role_subcategories(category_id, sort_order);

-- -----------------------------------------------------------------------------
-- Ruoli
-- -----------------------------------------------------------------------------
create table if not exists public.roles (
  id text primary key default (gen_random_uuid()::text),
  category_id text not null references public.role_categories(id) on delete cascade,
  name text not null,
  notes text,
  sort_order integer not null default 0
);

create index if not exists idx_roles_category
  on public.roles(category_id, sort_order);

-- -----------------------------------------------------------------------------
-- Assegnazioni UG ai ruoli
-- subcategory_id NULL = assegnazione normale senza sottocategorie.
-- subcategory_id valorizzato = assegnazione specifica per sottocategoria.
-- -----------------------------------------------------------------------------
create table if not exists public.role_assignments (
  id text primary key default (gen_random_uuid()::text),
  role_id text not null references public.roles(id) on delete cascade,
  official_id text not null references public.officials(id) on delete cascade,
  subcategory_id text references public.role_subcategories(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Evita assegnazioni duplicate, considerando NULL come il gruppo base.
create unique index if not exists uq_role_assignments
  on public.role_assignments (
    role_id,
    official_id,
    coalesce(subcategory_id, '__base__')
  );

create index if not exists idx_role_assignments_role
  on public.role_assignments(role_id);

create index if not exists idx_role_assignments_official
  on public.role_assignments(official_id);

-- -----------------------------------------------------------------------------
-- Checklist arbitro
-- -----------------------------------------------------------------------------
create table if not exists public.referee_checklist_items (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  sort_order integer not null default 0
);

create index if not exists idx_referee_checklist_event
  on public.referee_checklist_items(event_id, sort_order);

-- -----------------------------------------------------------------------------
-- Trigger updated_at sugli eventi
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Controllo di coerenza delle assegnazioni
-- Impedisce di assegnare a un ruolo un UG appartenente a un altro evento
-- o una sottocategoria appartenente a un'altra categoria.
-- -----------------------------------------------------------------------------
create or replace function public.validate_role_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  role_category_id text;
  role_event_id uuid;
  official_event_id uuid;
  subcategory_category_id text;
begin
  select r.category_id, c.event_id
    into role_category_id, role_event_id
  from public.roles r
  join public.role_categories c on c.id = r.category_id
  where r.id = new.role_id;

  select o.event_id
    into official_event_id
  from public.officials o
  where o.id = new.official_id;

  if role_event_id is distinct from official_event_id then
    raise exception 'Ruolo e ufficiale gara appartengono a eventi differenti';
  end if;

  if new.subcategory_id is not null then
    select s.category_id
      into subcategory_category_id
    from public.role_subcategories s
    where s.id = new.subcategory_id;

    if subcategory_category_id is distinct from role_category_id then
      raise exception 'La sottocategoria non appartiene alla categoria del ruolo';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_role_assignment on public.role_assignments;
create trigger trg_validate_role_assignment
before insert or update on public.role_assignments
for each row execute function public.validate_role_assignment();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
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

-- Helper: restituisce true solo per utenti presenti nella whitelist.
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
  );
$$;

revoke all on function public.is_app_user() from public;
grant execute on function public.is_app_user() to authenticated;

-- Nessun accesso ai dati applicativi per utenti non autenticati.
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

-- Gli utenti autenticati possono vedere solo la propria riga nella whitelist.
revoke all on table public.app_users from authenticated;
grant select on table public.app_users to authenticated;

drop policy if exists "app user can read own membership" on public.app_users;
create policy "app user can read own membership"
on public.app_users
for select
to authenticated
using (user_id = (select auth.uid()));

-- Accesso CRUD completo ai dati solo se l'utente e' in app_users.
-- Gli utenti del Gestionale OW condividono gli stessi eventi.
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
create policy "app users manage events" on public.events
for all to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage departures" on public.event_departures;
create policy "app users manage departures" on public.event_departures
for all to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage timeline" on public.timeline_items;
create policy "app users manage timeline" on public.timeline_items
for all to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage officials" on public.officials;
create policy "app users manage officials" on public.officials
for all to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage role categories" on public.role_categories;
create policy "app users manage role categories" on public.role_categories
for all to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage role subcategories" on public.role_subcategories;
create policy "app users manage role subcategories" on public.role_subcategories
for all to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage roles" on public.roles;
create policy "app users manage roles" on public.roles
for all to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage role assignments" on public.role_assignments;
create policy "app users manage role assignments" on public.role_assignments
for all to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

drop policy if exists "app users manage referee checklist" on public.referee_checklist_items;
create policy "app users manage referee checklist" on public.referee_checklist_items
for all to authenticated
using ((select public.is_app_user()))
with check ((select public.is_app_user()));

commit;
