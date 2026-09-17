# Gestionale OW

Gestionale per eventi Open Water pubblicato tramite GitHub Pages, con autenticazione e persistenza su Supabase.

## Applicazione principale

La versione pubblicata dalla root del repository usa esclusivamente Supabase:

- `index.html`: interfaccia principale e homepage eventi
- `css/`: stile e layout di stampa
- `js/auth.js`: autenticazione Supabase
- `js/database.js`: client RPC del backend
- `js/app-v2.js`: logica gestionale
- `js/copy-event.js`: clonazione eventi
- `js/import-export.js`: import/export JSON
- `js/ui.js`: helper UI e stampa sintetica
- `supabase/`: schema, migrazioni e API del backend

Gli eventi sono identificati internamente tramite UUID e non richiedono un codice visibile all'utente.

## Archivio versione GitHub

La precedente versione completa, che salvava gli eventi come JSON nel repository e usava un token GitHub dal browser, e conservata in:

`archive/github-full/`

L'archivio non e usato dall'applicazione principale e rimane disponibile solo come riferimento storico.

## GitHub Pages

Pubblicazione dal branch `main`, directory `/(root)`.
