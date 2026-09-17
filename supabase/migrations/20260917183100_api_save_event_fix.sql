-- Gestionale OW - correzione save_event
-- Mantiene correttamente gli ordinamenti e gestisce anche ID mancanti nel payload.

begin;

create or replace function public.save_event(p_event jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_code text;
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

  v_code := btrim(coalesce(p_event->>'id', ''));
  if v_code = '' or v_code !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Codice evento non valido' using errcode = '22023';
  end if;

  v_event_obj := coalesce(p_event->'event', '{}'::jsonb);
  v_referee := coalesce(p_event->'refereeNotes', '{}'::jsonb);

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
    v_code,
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
  on conflict ((lower(code))) do update set
    name = excluded.name,
    event_date = excluded.event_date,
    venue = excluded.venue,
    notes = excluded.notes,
    path_notes = excluded.path_notes,
    athlete_total = excluded.athlete_total,
    athlete_description = excluded.athlete_description,
    role_subcategories_enabled = excluded.role_subcategories_enabled,
    briefing_athletes = excluded.briefing_athletes,
    briefing_jury = excluded.briefing_jury,
    data_version = excluded.data_version
  returning id into v_event_id;

  delete from public.event_departures where event_id = v_event_id;
  delete from public.timeline_items where event_id = v_event_id;
  delete from public.role_categories where event_id = v_event_id;
  delete from public.officials where event_id = v_event_id;
  delete from public.referee_checklist_items where event_id = v_event_id;

  v_item_order := 0;
  for v_departure in select value from jsonb_array_elements(coalesce(v_event_obj->'athleteDepartures', '[]'::jsonb)) loop
    insert into public.event_departures (
      id, event_id, name, start_time, athlete_count, numbers, notes, sort_order
    ) values (
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
    insert into public.timeline_items (
      id, event_id, item_time, title, place, notes, sort_order
    ) values (
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
    insert into public.officials (
      id, event_id, name, notes, sort_order
    ) values (
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

    insert into public.role_categories (
      id, event_id, name, notes, sort_order
    ) values (
      v_category_id,
      v_event_id,
      coalesce(v_category->>'name', ''),
      nullif(v_category->>'notes', ''),
      v_category_order
    );

    v_subcategory_order := 0;
    for v_subcategory in select value from jsonb_array_elements(coalesce(v_category->'subcategories', '[]'::jsonb)) loop
      v_subcategory_id := coalesce(nullif(v_subcategory->>'id', ''), gen_random_uuid()::text);
      insert into public.role_subcategories (
        id, category_id, name, sort_order
      ) values (
        v_subcategory_id,
        v_category_id,
        coalesce(v_subcategory->>'name', ''),
        v_subcategory_order
      );
      v_subcategory_order := v_subcategory_order + 1;
    end loop;

    v_role_order := 0;
    for v_role in select value from jsonb_array_elements(coalesce(v_category->'roles', '[]'::jsonb)) loop
      v_role_id := coalesce(nullif(v_role->>'id', ''), gen_random_uuid()::text);

      insert into public.roles (
        id, category_id, name, notes, sort_order
      ) values (
        v_role_id,
        v_category_id,
        coalesce(v_role->>'name', ''),
        nullif(v_role->>'notes', ''),
        v_role_order
      );

      v_assignment_order := 0;
      for v_official_id in select value from jsonb_array_elements(coalesce(v_role->'officialIds', '[]'::jsonb)) loop
        insert into public.role_assignments (
          role_id, official_id, subcategory_id, sort_order
        ) values (
          v_role_id,
          trim(both '"' from v_official_id::text),
          null,
          v_assignment_order
        );
        v_assignment_order := v_assignment_order + 1;
      end loop;

      for v_sub_key, v_sub_values in
        select key, value
        from jsonb_each(coalesce(v_role->'officialIdsBySubcategory', '{}'::jsonb))
      loop
        v_assignment_order := 0;
        for v_official_id in select value from jsonb_array_elements(coalesce(v_sub_values, '[]'::jsonb)) loop
          insert into public.role_assignments (
            role_id, official_id, subcategory_id, sort_order
          ) values (
            v_role_id,
            trim(both '"' from v_official_id::text),
            v_sub_key,
            v_assignment_order
          );
          v_assignment_order := v_assignment_order + 1;
        end loop;
      end loop;

      v_role_order := v_role_order + 1;
    end loop;

    v_category_order := v_category_order + 1;
  end loop;

  v_item_order := 0;
  for v_check in select value from jsonb_array_elements(coalesce(v_referee->'checklist', '[]'::jsonb)) loop
    insert into public.referee_checklist_items (
      id, event_id, label, checked, sort_order
    ) values (
      coalesce(nullif(v_check->>'id', ''), gen_random_uuid()::text),
      v_event_id,
      coalesce(v_check->>'label', ''),
      coalesce((v_check->>'checked')::boolean, false),
      v_item_order
    );
    v_item_order := v_item_order + 1;
  end loop;

  return public.get_event(v_code);
end;
$$;

revoke all on function public.save_event(jsonb) from public;
revoke all on function public.save_event(jsonb) from anon;
grant execute on function public.save_event(jsonb) to authenticated;

commit;
