-- Autorizzazione utente al Gestionale OW
-- 1. Crea prima l'utente in Supabase Authentication.
-- 2. Copia il suo UUID da Authentication > Users.
-- 3. Sostituisci i valori qui sotto ed esegui la query nel SQL Editor.

insert into public.app_users (user_id, display_name)
values ('UUID-UTENTE-SUPABASE', 'Nome utente')
on conflict (user_id) do update
set display_name = excluded.display_name;

-- Verifica:
select user_id, display_name, created_at
from public.app_users
order by created_at;
