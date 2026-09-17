# Modalita di stampa

## Due anteprime indipendenti

**Anteprima PDF** mantiene il formato preesistente. La funzione `pdf()` e il
contenuto HTML che genera non sono stati modificati da questo intervento.

**Stampa sintetica** aggiunge il foglio operativo compatto ispirato al PDF
`Gestione Gara Nuoto.pdf` fornito dal committente:

- titolo evento, luogo e data, contatori di atleti e partenze;
- timeline a sinistra e riepilogo atleti/partenze a destra;
- ruoli a tutta larghezza, raggruppati per categoria nell'ordine scelto;
- note percorso in fondo al foglio.

Le note generali dell'evento, quando compilate, sono riportate sotto
l'intestazione; gli orari delle partenze, quando compilati, sotto il relativo
nome. Gli UG assegnati sono separati da trattini, senza modificare i dati.

Il foglio sintetico usa attualmente il modello della schermata Ruoli:
`roleCategories[].roles[].officialIds`, con colonne Ruolo e Ufficiali gara
assegnati. Le sottocategorie opzionali per evento e il loro utilizzo in
entrambe le stampe sono il terzo intervento richiesto, non incluso qui.
La revisione delle sezioni vuote nelle due stampe e il secondo intervento
richiesto, da effettuare solo dopo conferma.

## Utilizzo

Aprire l'evento e premere **Stampa sintetica**, poi **Stampa / PDF**.
Impostazioni consigliate: A4 verticale, scala 100%, intestazioni e pie di
pagina automatici del browser disattivati. Il numero di pagine dipende dalla
quantita dei dati: il foglio non taglia ne nasconde contenuti per forzare
una pagina unica. Le categorie molto lunghe possono proseguire su piu pagine
con le intestazioni di tabella ripetute.

La stampa legge lo stato attualmente aperto, comprese le modifiche non ancora
salvate. Non effettua commit, non cambia il JSON e non stampa token o secret.
Per conservare le modifiche dell'evento resta necessario il pulsante Salva.

## Codice

`js/ui.js` contiene `OWUI.buildSummaryPrintHtml(state, stylesheetUrl)`, una
funzione senza effetti collaterali. `css/print-summary.css` contiene gli stili
isolati del nuovo documento. `js/app.js` collega i due pulsanti alla stessa
finestra di anteprima senza sostituire il formato originale. Non sono state
aggiunte librerie o dipendenze runtime.

## Verifiche

Eseguire i test senza dipendenze aggiuntive con Node:

```sh
node --test tests/print-summary.test.cjs
```

Sono stati eseguiti anche test locali in Chromium con richieste GitHub
simulate (nessuna scrittura remota): equivalenza byte per byte del documento
originale, passaggi ripetuti tra le due anteprime, modifiche non salvate,
apertura a 390px, foglio con 20 ruoli/13 fasi su un A4 e stress test con 130
ruoli su piu pagine. I dati dei test sono dimostrativi, non eventi reali.
