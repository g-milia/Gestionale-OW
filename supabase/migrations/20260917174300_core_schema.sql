-- Gestionale OW - core schema
-- Schema relazionale canonico del backend Supabase.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

create table public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  code text not null check (
    length(btrim(code)) > 0
    and code ~ '^[A-Za-z0-9_-]+$'
  ),
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

create unique index uq_events_code_ci on public.events (lower(code));
create index idx_events_date on public.events (event_date desc nulls last);
create index idx_events_updated_at on public.events (updated_at desc);

create table public.event_departures (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null default 'Partenza',
  start_time time without time zone,
  athlete_count integer check (athlete_count is null or athlete_count >= 0),
  numbers text,
  notes text,
  sort_order integer not null default 0
);
create index idx_event_departures_event on public.event_departures(event_id, sort_order);

create table public.timeline_items (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  item_time time without time zone,
  title text not null default '',
  place text,
  notes text,
  sort_order integer not null default 0
);
create index idx_timeline_items_event on public.timeline_items(event_id, sort_order);

create table public.officials (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  notes text,
  sort_order integer not null default 0
);
create index idx_officials_event on public.officials(event_id, sort_order);

create table public.role_categories (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  notes text,
  sort_order integer not null default 0
);
create index idx_role_categories_event on public.role_categories(event_id, sort_order);

create table public.role_subcategories (
  id text primary key default (gen_random_uuid()::text),
  category_id text not null references public.role_categories(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);
create index idx_role_subcategories_category on public.role_subcategories(category_id, sort_order);

create table public.roles (
  id text primary key default (gen_random_uuid()::text),
  category_id text not null references public.role_categories(id) on delete cascade,
  name text not null,
  notes text,
  sort_order integer not null default 0
);
create index idx_roles_category on public.roles(category_id, sort_order);

create table public.role_assignments (
  id text primary key default (gen_random_uuid()::text),
  role_id text not null references public.roles(id) on delete cascade,
  official_id text not null references public.officials(id) on delete cascade,
  subcategory_id text references public.role_subcategories(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index uq_role_assignments
  on public.role_assignments (
    role_id,
    official_id,
    coalesce(subcategory_id, '__base__')
  );
create index idx_role_assignments_role on public.role_assignments(role_id);
create index idx_role_assignments_official on public.role_assignments(official_id);
create index idx_role_assignments_subcategory on public.role_assignments(subcategory_id)
  where subcategory_id is not null;

create table public.referee_checklist_items (
  id text primary key default (gen_random_uuid()::text),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  sort_order integer not null default 0
);
create index idx_referee_checklist_event on public.referee_checklist_items(event_id, sort_order);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_events_updated_at
before update on public.events
for each row execute function private.set_updated_at();

create or replace function private.validate_role_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role_category_id text;
  v_role_event_id uuid;
  v_official_event_id uuid;
  v_subcategory_category_id text;
begin
  select r.category_id, c.event_id
    into v_role_category_id, v_role_event_id
  from public.roles r
  join public.role_categories c on c.id = r.category_id
  where r.id = new.role_id;

  select o.event_id
    into v_official_event_id
  from public.officials o
  where o.id = new.official_id;

  if v_role_event_id is distinct from v_official_event_id then
    raise exception 'Ruolo e ufficiale gara appartengono a eventi differenti'
      using errcode = '23514';
  end if;

  if new.subcategory_id is not null then
    select s.category_id
      into v_subcategory_category_id
    from public.role_subcategories s
    where s.id = new.subcategory_id;

    if v_subcategory_category_id is distinct from v_role_category_id then
      raise exception 'La sottocategoria non appartiene alla categoria del ruolo'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_validate_role_assignment
before insert or update on public.role_assignments
for each row execute function private.validate_role_assignment();

commit;
