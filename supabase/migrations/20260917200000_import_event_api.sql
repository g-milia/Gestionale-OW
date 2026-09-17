-- Gestionale OW - importazione evento con preservazione degli ID
-- Se eventId non esiste, importa l'evento mantenendo eventId e tutti gli ID figli.
-- Se eventId esiste, la funzione rifiuta l'import: il frontend puo proporre la clonazione
-- rigenerando tutti gli ID prima di richiamare questa stessa funzione.

begin;

create or replace function public.import_event_v2(p_event jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_created_at timestamptz;
  v_saved_at timestamptz;
  v_name text;
  v_result jsonb;
begin
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'Payload evento non valido' using errcode = '22023';
  end if;

  begin
    v_event_id := nullif(p_event->>'eventId', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'eventId non valido' using errcode = '22023';
  end;

  if v_event_id is null then
    raise exception 'eventId obbligatorio per l''importazione' using errcode = '22023';
  end if;

  if exists (select 1 from public.events e where e.id = v_event_id) then
    raise exception 'Evento gia presente' using errcode = '23505';
  end if;

  v_name := coalesce(nullif(p_event->'event'->>'name', ''), 'Evento importato');
  v_created_at := nullif(p_event->>'createdAt', '')::timestamptz;
  v_saved_at := nullif(p_event->>'savedAt', '')::timestamptz;

  -- Crea soltanto il record padre con lo stesso UUID esportato.
  -- save_event_v2 popola poi l'intero grafo mantenendo gli ID presenti nel JSON.
  insert into public.events (id, code, name)
  values (v_event_id, null, v_name);

  v_result := public.save_event_v2(p_event);

  -- L'import non deve alterare i timestamp storici quando presenti nel file.
  if v_created_at is not null or v_saved_at is not null then
    update public.events
       set created_at = coalesce(v_created_at, created_at),
           updated_at = coalesce(v_saved_at, updated_at)
     where id = v_event_id;
  end if;

  return public.get_event_v2(v_event_id);
end;
$$;

revoke all on function public.import_event_v2(jsonb) from public;
revoke all on function public.import_event_v2(jsonb) from anon;
grant execute on function public.import_event_v2(jsonb) to authenticated;

commit;
