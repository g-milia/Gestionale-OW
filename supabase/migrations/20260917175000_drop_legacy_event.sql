-- Gestionale OW - rimozione tabella legacy
-- La tabella public.event appartiene a una struttura precedente e non viene usata
-- dal nuovo backend, che usa public.events.

drop table if exists public.event;
