# Gestionale OW

Gestionale statico per GitHub Pages.

## Struttura

- `index.html`: interfaccia
- `css/style.css`: stile
- `js/app.js`: logica gestionale
- `js/github.js`: chiamate GitHub API
- `js/storage.js`: configurazione browser
- `js/ui.js`: helper UI
- `events/`: un JSON per evento

## Uso

Aprire la pagina, configurare owner/repository/branch e inserire un token GitHub con permesso `Contents: Read and write`. Il token viene conservato solo in `sessionStorage`. Gli eventi vengono salvati in `events/<codice>.json` e aperti tramite codice + secret.

## GitHub Pages

Pubblicazione dal branch `main`, directory `/(root)`.
