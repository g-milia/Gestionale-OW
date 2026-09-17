-- Gestionale OW - preserva timestamp originali in import e nuovi eventi
-- Regole:
-- 1) al primo salvataggio di un evento, createdAt/savedAt del payload vengono preservati;
-- 2) ai salvataggi successivi, created_at resta invariato e updated_at viene aggiornato dal DB;
-- 3) l'evento WPS gia importato viene riallineato ai timestamp del JSON GitHub.

begin;

-- Consente aggiornamenti espliciti di updated_at (necessari per import storici),
-- continuando ad aggiornare automaticamente il timestamp quando il chiamante
-- non lo modifica esplicitamente.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

-- Nasconde l'implementazione precedente nello schema private: resta invocata
-- come security invoker, quindi RLS continua ad applicarsi all'utente autenticato.
alter function public.save_event(jsonb) rename to save_event_core;
alter function public.save_event_core(jsonb) set schema private;

revoke all on function private.save_event_core(jsonb) from public;
revoke all on function private.save_event_core(jsonb) from anon;
grant execute on function private.save_event_core(jsonb) to authenticated;

create or replace function public.save_event(p_event jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_code text;
  v_existed boolean;
  v_created_at timestamptz;
  v_saved_at timestamptz;
  v_result jsonb;
begin
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'Payload evento non valido' using errcode = '22023';
  end if;

  v_code := btrim(coalesce(p_event->>'id', ''));
  if v_code = '' or v_code !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Codice evento non valido' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.events e
    where lower(e.code) = lower(v_code)
  ) into v_existed;

  v_created_at := nullif(p_event->>'createdAt', '')::timestamptz;
  v_saved_at := nullif(p_event->>'savedAt', '')::timestamptz;

  v_result := private.save_event_core(p_event);

  -- I timestamp del payload vengono usati solo alla prima creazione/importazione.
  -- Nei salvataggi successivi private.save_event_core aggiorna updated_at via trigger.
  if not v_existed and (v_created_at is not null or v_saved_at is not null) then
    update public.events
       set created_at = coalesce(v_created_at, created_at),
           updated_at = coalesce(v_saved_at, updated_at)
     where lower(code) = lower(v_code);
  end if;

  return public.get_event(v_code);
end;
$$;

revoke all on function public.save_event(jsonb) from public;
revoke all on function public.save_event(jsonb) from anon;
grant execute on function public.save_event(jsonb) to authenticated;

-- Correzione una tantum dell'evento gia importato prima di questa migration.
update public.events
   set created_at = '2026-09-16T06:58:39.830Z'::timestamptz,
       updated_at = '2026-09-17T09:49:31.979Z'::timestamptz
 where lower(code) = lower('WPS-OW-CUP-Sardinia-2026');

commit;
