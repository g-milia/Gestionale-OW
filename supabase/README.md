# Supabase - Gestionale OW

Questa cartella contiene la base per migrare il Gestionale OW da file JSON salvati su GitHub a un database PostgreSQL Supabase con autenticazione.

## Struttura

```text
supabase/
├── schema.sql          # crea tabelle, indici, trigger e policy RLS
├── add-app-user.sql    # esempio per autorizzare un utente gia' creato in Supabase Auth
└── README.md           # questa guida
```

## Architettura prevista

```text
GitHub Pages
    |
    | Supabase JS client
    v
Supabase
├── Auth
├── PostgreSQL
└── Row Level Security
```

Il frontend puo' restare pubblico su GitHub Pages. La protezione dei dati avviene nel database tramite Supabase Auth e Row Level Security.

L'applicazione non deve mai contenere la `service_role` key. Nel browser si usa esclusivamente la chiave pubblicabile/anon del progetto. Le policy RLS stabiliscono cosa puo' fare l'utente autenticato.

## 1. Creare il progetto Supabase

1. Accedi a Supabase.
2. Crea un nuovo progetto.
3. Scegli regione e password del database.
4. Attendi la creazione del progetto.

Non inserire credenziali Supabase nella repository durante questa fase.

## 2. Creare lo schema

Nel progetto Supabase:

1. Apri **SQL Editor**.
2. Crea una nuova query.
3. Copia tutto il contenuto di `supabase/schema.sql`.
4. Esegui lo script.

Lo script crea:

- `app_users`
- `events`
- `event_departures`
- `timeline_items`
- `officials`
- `role_categories`
- `role_subcategories`
- `roles`
- `role_assignments`
- `referee_checklist_items`

Crea inoltre:

- chiavi esterne con cancellazione a cascata;
- ordinamento tramite `sort_order`;
- trigger `updated_at` sugli eventi;
- controllo di coerenza delle assegnazioni UG;
- Row Level Security su tutte le tabelle applicative;
- whitelist utenti tramite `app_users`.

## 3. Configurare Authentication

Per iniziare con 2-3 utenti, la configurazione piu' semplice e' email + password.

Nel pannello Supabase:

1. Vai in **Authentication**.
2. Crea gli utenti autorizzati oppure abilita la registrazione secondo la modalita' desiderata.
3. Recupera l'UUID dell'utente dalla pagina utenti.
4. Inserisci l'UUID nella tabella `public.app_users`.

Esempio:

```sql
insert into public.app_users (user_id, display_name)
values ('UUID-UTENTE-SUPABASE', 'Gianmarco');
```

E' disponibile anche `add-app-user.sql` come modello.

### Perche' esiste app_users

Un account presente in `auth.users` non ottiene automaticamente accesso ai dati del gestionale.

Le policy RLS consentono CRUD solo quando:

```sql
public.is_app_user() = true
```

In questo modo puoi creare utenti in Supabase Auth ma decidere separatamente chi puo' entrare nel Gestionale OW.

## 4. Recuperare URL e chiave pubblicabile

Dal progetto Supabase recupera:

- Project URL
- publishable key / anon key

Questi valori possono essere usati dal frontend browser.

Non usare mai nel frontend:

- `service_role` key;
- password del database;
- Personal Access Token Supabase;
- credenziali amministrative.

## 5. Collegare il frontend

Il passo successivo sara' sostituire il layer GitHub con un layer Supabase.

Architettura attuale:

```text
app.js
  -> github.js
  -> events/<codice>.json
```

Architettura prevista:

```text
app.js
  -> database.js
  -> Supabase PostgreSQL
```

Il frontend potra' inizializzare Supabase in questo modo:

```js
const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
```

Il login email/password sara' poi eseguito tramite Supabase Auth. Dopo l'autenticazione, la sessione viene inviata automaticamente alle query del database.

## 6. Mappatura del JSON attuale

L'attuale JSON evento viene trasformato cosi':

```text
event                  -> events
athleteDepartures      -> event_departures
timeline               -> timeline_items
officials              -> officials
roleCategories         -> role_categories
subcategories          -> role_subcategories
roles                  -> roles
officialIds            -> role_assignments con subcategory_id NULL
officialIdsBySubcategory
                       -> role_assignments con subcategory_id valorizzato
refereeNotes.checklist -> referee_checklist_items
briefingAthletes       -> events.briefing_athletes
briefingJury           -> events.briefing_jury
```

Il flag corrente:

```text
roleSubcategoriesEnabled
```

diventa:

```text
events.role_subcategories_enabled
```

Gli ID testuali usati oggi per UG, categorie, ruoli e sottocategorie sono mantenibili nel database. Questo permette una migrazione diretta dei JSON esistenti senza dover rigenerare tutti gli identificativi.

## 7. Gestione degli eventi

`events.code` sostituisce il nome del file JSON come identificativo leggibile.

Esempio:

```text
WPS-OW-CUP-Sardinia-2026
```

Il codice e' univoco nel database.

Il frontend potra' quindi aprire un evento con una query equivalente a:

```js
const { data, error } = await supabase
  .from('events')
  .select('*')
  .eq('code', eventCode)
  .single();
```

## 8. Sicurezza RLS

Tutte le tabelle applicative hanno RLS attiva.

Il modello iniziale e' volutamente semplice:

- gli utenti non autenticati non hanno accesso ai dati;
- gli utenti autenticati ma non presenti in `app_users` non hanno accesso ai dati;
- gli utenti presenti in `app_users` condividono tutti gli eventi e possono creare, leggere, modificare ed eliminare dati.

Questa scelta e' adatta alla fase iniziale con 2-3 utenti.

In futuro si potra' aggiungere una tabella `event_users` per limitare ogni utente a eventi specifici senza cambiare la struttura delle tabelle principali.

## 9. Ordine di migrazione consigliato

Non sostituire subito il sistema GitHub esistente.

Procedere in questo ordine:

1. creare progetto Supabase;
2. eseguire `schema.sql`;
3. creare gli utenti Auth;
4. popolare `app_users`;
5. aggiungere login Supabase al frontend;
6. creare `js/database.js`;
7. implementare lettura evento da Supabase;
8. implementare salvataggio evento;
9. migrare un singolo JSON di prova;
10. verificare entrambe le stampe;
11. solo dopo rimuovere la persistenza tramite GitHub API.

In questo modo la versione attuale resta utilizzabile durante tutta la migrazione.

## 10. Test minimi dopo la configurazione

Verificare almeno questi casi:

1. utente non autenticato: nessuna lettura delle tabelle applicative;
2. utente autenticato non presente in `app_users`: nessuna lettura;
3. utente autorizzato: lettura e modifica eventi;
4. cancellazione evento: eliminazione automatica dei record figli;
5. categorie senza sottocategorie: assegnazioni con `subcategory_id = NULL`;
6. categorie con sottocategorie: assegnazioni separate per sottocategoria;
7. impossibilita' di assegnare un UG di un evento a un ruolo di un altro evento.

## 11. Backup e migrazione

Finche' la migrazione non e' completata, mantenere i JSON correnti nella cartella `events/` come copia storica.

Una volta che Supabase sara' il sistema ufficiale, sara' possibile aggiungere un export JSON periodico o un workflow GitHub Actions di backup se lo desideri.
