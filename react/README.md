# Gestione OW React

Nuova implementazione React della struttura attuale di Gestione OW.

## Stack

- React
- TypeScript
- Vite
- Material UI
- TanStack Query
- Supabase Auth + RPC + RLS

## Funzionalità migrate

- Login Supabase
- Homepage eventi a card
- Creazione e import evento
- Generali
- Ondate / partenze
- Timeline
- Ufficiali gara
- Ruoli con categorie, sottocategorie e assegnazioni UG
- Note e checklist
- Permessi Admin / Responsabile / Visualizzatore
- Export JSON
- Copia evento
- Stampa sintetica con lo stesso CSS/layout della versione attuale
- Layout responsive desktop/mobile

## Avvio locale

```bash
cd react
npm install
npm run dev
```

## Build

```bash
npm run build
```

Il risultato viene scritto in `react/dist/`.

## Variabili

Copia `.env.example` in `.env.local` se vuoi sovrascrivere URL/key Supabase o base path.
