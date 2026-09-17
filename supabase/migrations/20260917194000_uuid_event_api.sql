-- Gestionale OW - API eventi basata su UUID
-- Il campo events.code resta solo per compatibilita con gli import storici.
-- I nuovi eventi non richiedono piu un codice applicativo.

begin;

alter table public.events alter column code drop not null;

create or replace function public.list_events_v2()
returns table (
  event_id uuid,
  name text,
  event_date date,
  venue text,
  athlete_total integer,
  updated_at timestamptz
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
    e.updated_at
  from public.events e
  order by e.event_date desc nulls last, e.updated_at desc;
$$;

revoke all on function public.list_events_v2() from public;
revoke all on function public.list_events_v2() from anon;
grant execute on function public.list_events_v2() to authenticated;

create or replace function public.get_event_v2(p_event_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_result jsonb;
begin
  select *
    into v_event
  from public.events
  where id = p_event_id;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'version', v_event.data_version,
    'eventId', v_event.id,
    'createdAt', v_event.created_at,
    'savedAt', v_event.updated_at,
    'roleSubcategoriesEnabled', v_event.role_subcategories_enabled,
    'event', jsonb_build_object(
      'name', v_event.name,
      'date', coalesce(to_char(v_event.event_date, 'YYYY-MM-DD'), ''),
      'venue', coalesce(v_event.venue, ''),
      'notes', coalesce(v_event.notes, ''),
      'pathNotes', coalesce(v_event.path_notes, ''),
      'athleteTotal', v_event.athlete_total,
      'athleteDescription', coalesce(v_event.athlete_description, ''),
      'athleteDepartures', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'time', coalesce(to_char(d.start_time, 'HH24:MI'), ''),
            'athletes', coalesce(d.athlete_count, 0),
            'numbers', coalesce(d.numbers, ''),
            'notes', coalesce(d.notes, '')
          ) order by d.sort_order, d.id
        )
        from public.event_departures d
        where d.event_id = v_event.id
      ), '[]'::jsonb)
    ),
    'timeline', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'time', coalesce(to_char(t.item_time, 'HH24:MI'), ''),
          'title', t.title,
          'place', coalesce(t.place, ''),
          'notes', coalesce(t.notes, '')
        ) order by t.sort_order, t.id
      )
      from public.timeline_items t
      where t.event_id = v_event.id
    ), '[]'::jsonb),
    'officials', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'name', o.name,
          'notes', coalesce(o.notes, '')
        ) order by o.sort_order, o.id
      )
      from public.officials o
      where o.event_id = v_event.id
    ), '[]'::jsonb),
    'roleCategories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'notes', coalesce(c.notes, ''),
          'subcategories', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', s.id, 'name', s.name)
              order by s.sort_order, s.id
            )
            from public.role_subcategories s
            where s.category_id = c.id
          ), '[]'::jsonb),
          'roles', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', r.id,
                'name', r.name,
                'notes', coalesce(r.notes, ''),
                'officialIds', coalesce((
                  select jsonb_agg(a.official_id order by a.sort_order, a.id)
                  from public.role_assignments a
                  where a.role_id = r.id and a.subcategory_id is null
                ), '[]'::jsonb),
                'officialIdsBySubcategory', coalesce((
                  select jsonb_object_agg(x.subcategory_id, x.official_ids)
                  from (
                    select
                      a.subcategory_id,
                      jsonb_agg(a.official_id order by a.sort_order, a.id) as official_ids
                    from public.role_assignments a
                    where a.role_id = r.id and a.subcategory_id is not null
                    group by a.subcategory_id
                  ) x
                ), '{}'::jsonb)
              ) order by r.sort_order, r.id
            )
            from public.roles r
            where r.category_id = c.id
          ), '[]'::jsonb)
        ) order by c.sort_order, c.id
      )
      from public.role_categories c
      where c.event_id = v_event.id
    ), '[]'::jsonb),
    'refereeNotes', jsonb_build_object(
      'briefingAthletes', coalesce(v_event.briefing_athletes, ''),
      'briefingJury', coalesce(v_event.briefing_jury, ''),
      'checklist', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'label', i.label,
            'checked', i.checked
          ) order by i.sort_order, i.id
        )
        from public.referee_checklist_items i
        where i.event_id = v_event.id
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_event_v2(uuid) from public;
revoke all on function public.get_event_v2(uuid) from anon;
grant execute on function public.get_event_v2(uuid) to authenticated;

create or replace function public.save_event_v2(p_event jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_event_obj jsonb;
  v_referee jsonb;
  v_category jsonb;
  v_role jsonb;
  v_subcategory jsonb;
  v_departure jsonb;
  v_timeline jsonb;
  v_official jsonb;
  v_check jsonb;
  v_official_id jsonb;
  v_sub_key text;
  v_sub_values jsonb;
  v_category_id text;
  v_role_id text;
  v_subcategory_id text;
  v_item_order integer;
  v_category_order integer;
  v_role_order integer;
  v_subcategory_order integer;
  v_assignment_order integer;
begin
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'Payload evento non valido' using errcode = '22023';
  end if;

  v_event_obj := coalesce(p_event->'event', '{}'::jsonb);
  v_referee := coalesce(p_event->'refereeNotes', '{}'::jsonb);
  v_event_id := nullif(p_event->>'eventId', '')::uuid;

  if v_event_id is null then
    insert into public.events (
      code,
      name,
      event_date,
      venue,
      notes,
      path_notes,
      athlete_total,
      athlete_description,
      role_subcategories_enabled,
      briefing_athletes,
      briefing_jury,
      data_version
    ) values (
      null,
      coalesce(nullif(v_event_obj->>'name', ''), 'Nuova gara di nuoto'),
      nullif(v_event_obj->>'date', '')::date,
      nullif(v_event_obj->>'venue', ''),
      nullif(v_event_obj->>'notes', ''),
      nullif(v_event_obj->>'pathNotes', ''),
      greatest(coalesce((v_event_obj->>'athleteTotal')::integer, 0), 0),
      nullif(v_event_obj->>'athleteDescription', ''),
      coalesce((p_event->>'roleSubcategoriesEnabled')::boolean, false),
      nullif(v_referee->>'briefingAthletes', ''),
      nullif(v_referee->>'briefingJury', ''),
      coalesce((p_event->>'version')::integer, 4)
    )
    returning id into v_event_id;
  else
    if not exists (select 1 from public.events e where e.id = v_event_id) then
      raise exception 'Evento non trovato' using errcode = 'P0002';
    end if;

    update public.events
       set name = coalesce(nullif(v_event_obj->>'name', ''), 'Nuova gara di nuoto'),
           event_date = nullif(v_event_obj->>'date', '')::date,
           venue = nullif(v_event_obj->>'venue', ''),
           notes = nullif(v_event_obj->>'notes', ''),
           path_notes = nullif(v_event_obj->>'pathNotes', ''),
           athlete_total = greatest(coalesce((v_event_obj->>'athleteTotal')::integer, 0), 0),
           athlete_description = nullif(v_event_obj->>'athleteDescription', ''),
           role_subcategories_enabled = coalesce((p_event->>'roleSubcategoriesEnabled')::boolean, false),
           briefing_athletes = nullif(v_referee->>'briefingAthletes', ''),
           briefing_jury = nullif(v_referee->>'briefingJury', ''),
           data_version = coalesce((p_event->>'version')::integer, 4)
     where id = v_event_id;
  end if;

  delete from public.event_departures where event_id = v_event_id;
  delete from public.timeline_items where event_id = v_event_id;
  delete from public.role_categories where event_id = v_event_id;
  delete from public.officials where event_id = v_event_id;
  delete from public.referee_checklist_items where event_id = v_event_id;

  v_item_order := 0;
  for v_departure in select value from jsonb_array_elements(coalesce(v_event_obj->'athleteDepartures', '[]'::jsonb)) loop
    insert into public.event_departures (id, event_id, name, start_time, athlete_count, numbers, notes, sort_order)
    values (
      coalesce(nullif(v_departure->>'id', ''), gen_random_uuid()::text),
      v_event_id,
      coalesce(nullif(v_departure->>'name', ''), 'Partenza'),
      nullif(v_departure->>'time', '')::time,
      case when coalesce(v_departure->>'athletes', '') = '' then null else (v_departure->>'athletes')::integer end,
      nullif(v_departure->>'numbers', ''),
      nullif(v_departure->>'notes', ''),
      v_item_order
    );
    v_item_order := v_item_order + 1;
  end loop;

  v_item_order := 0;
  for v_timeline in select value from jsonb_array_elements(coalesce(p_event->'timeline', '[]'::jsonb)) loop
    insert into public.timeline_items (id, event_id, item_time, title, place, notes, sort_order)
    values (
      coalesce(nullif(v_timeline->>'id', ''), gen_random_uuid()::text),
      v_event_id,
      nullif(v_timeline->>'time', '')::time,
      coalesce(v_timeline->>'title', ''),
      nullif(v_timeline->>'place', ''),
      nullif(v_timeline->>'notes', ''),
      v_item_order
    );
    v_item_order := v_item_order + 1;
  end loop;

  v_item_order := 0;
  for v_official in select value from jsonb_array_elements(coalesce(p_event->'officials', '[]'::jsonb)) loop
    insert into public.officials (id, event_id, name, notes, sort_order)
    values (
      coalesce(nullif(v_official->>'id', ''), gen_random_uuid()::text),
      v_event_id,
      coalesce(v_official->>'name', ''),
      nullif(v_official->>'notes', ''),
      v_item_order
    );
    v_item_order := v_item_order + 1;
  end loop;

  v_category_order := 0;
  for v_category in select value from jsonb_array_elements(coalesce(p_event->'roleCategories', '[]'::jsonb)) loop
    v_category_id := coalesce(nullif(v_category->>'id', ''), gen_random_uuid()::text);
    insert into public.role_categories (id, event_id, name, notes, sort_order)
    values (v_category_id, v_event_id, coalesce(v_category->>'name', ''), nullif(v_category->>'notes', ''), v_category_order);

    v_subcategory_order := 0;
    for v_subcategory in select value from jsonb_array_elements(coalesce(v_category->'subcategories', '[]'::jsonb)) loop
      v_subcategory_id := coalesce(nullif(v_subcategory->>'id', ''), gen_random_uuid()::text);
      insert into public.role_subcategories (id, category_id, name, sort_order)
      values (v_subcategory_id, v_category_id, coalesce(v_subcategory->>'name', ''), v_subcategory_order);
      v_subcategory_order := v_subcategory_order + 1;
    end loop;

    v_role_order := 0;
    for v_role in select value from jsonb_array_elements(coalesce(v_category->'roles', '[]'::jsonb)) loop
      v_role_id := coalesce(nullif(v_role->>'id', ''), gen_random_uuid()::text);
      insert into public.roles (id, category_id, name, notes, sort_order)
      values (v_role_id, v_category_id, coalesce(v_role->>'name', ''), nullif(v_role->>'notes', ''), v_role_order);

      v_assignment_order := 0;
      for v_official_id in select value from jsonb_array_elements(coalesce(v_role->'officialIds', '[]'::jsonb)) loop
        insert into public.role_assignments (role_id, official_id, subcategory_id, sort_order)
        values (v_role_id, trim(both '"' from v_official_id::text), null, v_assignment_order);
        v_assignment_order := v_assignment_order + 1;
      end loop;

      for v_sub_key, v_sub_values in
        select key, value from jsonb_each(coalesce(v_role->'officialIdsBySubcategory', '{}'::jsonb))
      loop
        v_assignment_order := 0;
        for v_official_id in select value from jsonb_array_elements(coalesce(v_sub_values, '[]'::jsonb)) loop
          insert into public.role_assignments (role_id, official_id, subcategory_id, sort_order)
          values (v_role_id, trim(both '"' from v_official_id::text), v_sub_key, v_assignment_order);
          v_assignment_order := v_assignment_order + 1;
        end loop;
      end loop;

      v_role_order := v_role_order + 1;
    end loop;

    v_category_order := v_category_order + 1;
  end loop;

  v_item_order := 0;
  for v_check in select value from jsonb_array_elements(coalesce(v_referee->'checklist', '[]'::jsonb)) loop
    insert into public.referee_checklist_items (id, event_id, label, checked, sort_order)
    values (
      coalesce(nullif(v_check->>'id', ''), gen_random_uuid()::text),
      v_event_id,
      coalesce(v_check->>'label', ''),
      coalesce((v_check->>'checked')::boolean, false),
      v_item_order
    );
    v_item_order := v_item_order + 1;
  end loop;

  return public.get_event_v2(v_event_id);
end;
$$;

revoke all on function public.save_event_v2(jsonb) from public;
revoke all on function public.save_event_v2(jsonb) from anon;
grant execute on function public.save_event_v2(jsonb) to authenticated;

create or replace function public.delete_event_v2(p_event_id uuid)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.events where id = p_event_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.delete_event_v2(uuid) from public;
revoke all on function public.delete_event_v2(uuid) from anon;
grant execute on function public.delete_event_v2(uuid) to authenticated;

commit;
