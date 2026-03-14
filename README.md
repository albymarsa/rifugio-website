# Sito Web Rifugio Alpine

Sito web per il rifugio alpino con pagina informativa e sistema di prenotazione.

## Come funziona

Il sito ha due pagine:
- **Homepage** — informazioni sul rifugio, come arrivare, regolamento, galleria foto
- **Prenota** — modulo per richiedere una prenotazione

Quando qualcuno compila il modulo, i dati vengono salvati in un foglio Google e ti arriva una email di notifica.

---

## Come avviare il sito in locale (per vederlo sul tuo computer)

1. Apri il terminale nella cartella del progetto
2. Esegui: `npm run dev`
3. Apri il browser e vai su `http://localhost:4321`

---

## Come configurare le prenotazioni (Google Sheets + Email)

Segui questi passaggi per collegare il modulo del sito a Google Sheets:

### Passo 1: Crea un foglio Google

1. Vai su [Google Sheets](https://sheets.google.com)
2. Crea un nuovo foglio vuoto
3. Dagli un nome, ad esempio "Prenotazioni Rifugio"

### Passo 2: Apri l'editor degli script

1. Nel foglio Google, clicca su **Estensioni** nel menu in alto
2. Clicca su **Apps Script**
3. Si apre una nuova finestra con un editor di codice

### Passo 3: Incolla lo script

1. Cancella tutto il testo che trovi nell'editor
2. Apri il file `google-apps-script/prenotazioni.js` dal progetto
3. Copia tutto il contenuto e incollalo nell'editor di Apps Script
4. **Importante**: modifica la riga con l'email, mettendo l'email dell'associazione:
   ```
   const EMAIL_NOTIFICA = 'la-vostra-email@gmail.com';
   ```
5. Clicca l'icona del dischetto (Salva) oppure premi Ctrl+S

### Passo 4: Testa lo script

1. Nell'editor di Apps Script, seleziona la funzione `test` dal menu a tendina in alto
2. Clicca il pulsante **Esegui** (il triangolo play)
3. La prima volta ti chiederà i permessi: clicca "Autorizza" e segui le istruzioni
4. Controlla che nel foglio Google sia apparsa una riga con i dati di test
5. Controlla che ti sia arrivata la email di notifica

### Passo 5: Pubblica lo script

1. Clicca su **Deployment** (Deploy) in alto a destra
2. Clicca su **Nuovo deployment** (New deployment)
3. Clicca sull'icona dell'ingranaggio e seleziona **App web** (Web app)
4. Compila:
   - Descrizione: "Prenotazioni rifugio"
   - Esegui come: **Me** (il tuo account)
   - Chi ha accesso: **Chiunque** (Anyone)
5. Clicca **Deployment** (Deploy)
6. Copia l'URL che appare (inizia con `https://script.google.com/...`)

### Passo 6: Collega lo script al sito

1. Apri il file `src/components/BookingForm.astro`
2. Trova la riga:
   ```
   const GOOGLE_SCRIPT_URL = '';
   ```
3. Incolla l'URL copiato tra le virgolette:
   ```
   const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';
   ```
4. Salva il file

Fatto! Ora quando qualcuno compila il modulo sul sito, i dati verranno salvati nel foglio Google e riceverai una email.

---

## Come configurare l'Area Soci (Supabase)

L'area soci permette ai membri dell'associazione di registrarsi, inserire i propri dati e quelli dei componenti del proprio gruppo. I soci fondatori possono vedere tutti i soci.

### Passo 1: Crea un account Supabase

1. Vai su [Supabase](https://supabase.com) e crea un account gratuito
2. Crea un nuovo progetto (scegli una regione europea, es. Frankfurt)
3. Scegli una password per il database (salvala in un posto sicuro)
4. Attendi che il progetto sia pronto (circa 1 minuto)

### Passo 2: Crea la tabella dei soci

1. Nel pannello Supabase, vai su **SQL Editor** nella barra laterale
2. Clicca su **New query**
3. Copia e incolla questo codice SQL, poi clicca **Run**:

```sql
-- Crea la tabella soci
CREATE TABLE soci (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  data_nascita DATE,
  luogo_nascita TEXT,
  codice_fiscale TEXT,
  indirizzo_residenza TEXT,
  tipo_documento TEXT CHECK (tipo_documento IN ('carta_identita','patente','passaporto')),
  numero_documento TEXT,
  tipo_socio TEXT NOT NULL DEFAULT 'ordinario' CHECK (tipo_socio IN ('fondatore','ordinario')),
  registrato_da UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indice per ricerca veloce
CREATE INDEX idx_soci_registrato_da ON soci(registrato_da);

-- Abilita la sicurezza per riga (RLS)
ALTER TABLE soci ENABLE ROW LEVEL SECURITY;

-- I soci vedono solo i propri dati e quelli del proprio gruppo
CREATE POLICY "select_own" ON soci FOR SELECT
  USING (registrato_da = auth.uid());

-- I soci fondatori vedono tutti i soci
CREATE POLICY "select_all_founders" ON soci FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM soci WHERE email = auth.jwt()->>'email' AND tipo_socio = 'fondatore'
  ));

-- I soci possono inserire dati per se stessi e il proprio gruppo
CREATE POLICY "insert_own" ON soci FOR INSERT
  WITH CHECK (registrato_da = auth.uid());

-- I soci possono modificare i propri dati
CREATE POLICY "update_own" ON soci FOR UPDATE
  USING (registrato_da = auth.uid());

-- I fondatori possono modificare i dati di tutti
CREATE POLICY "update_all_founders" ON soci FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM soci WHERE email = auth.jwt()->>'email' AND tipo_socio = 'fondatore'
  ));
```

### Passo 3: Configura l'autenticazione

1. Nel pannello Supabase, vai su **Authentication** > **Providers**
2. Verifica che **Email** sia abilitato (dovrebbe esserlo di default)
3. Vai su **Authentication** > **URL Configuration**
4. In **Site URL** metti l'URL del tuo sito (es. `https://tuosito.pages.dev`)
5. In **Redirect URLs** aggiungi anche `http://localhost:4321` (per sviluppo locale)

### Passo 4: Collega Supabase al sito

1. Nel pannello Supabase, vai su **Settings** > **API**
2. Copia il **Project URL** e la chiave **anon public**
3. Crea un file `.env` nella cartella del progetto con:
   ```
   PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=eyJ...la-tua-chiave...
   ```
4. **Importante**: questo file NON va caricato su GitHub (e' gia' nel .gitignore)
5. Per il deploy su Cloudflare: vai nelle impostazioni del progetto su Cloudflare Pages > **Environment variables** e aggiungi le stesse variabili

### Passo 5: Registra i soci fondatori

1. I soci fondatori devono registrarsi normalmente dal sito (pagina `/soci/registrazione`)
2. Dopo la registrazione, vai nel pannello Supabase > **Table Editor** > tabella `soci`
3. Trova la riga del socio fondatore e modifica `tipo_socio` da `ordinario` a `fondatore`
4. Ripeti per ogni socio fondatore

---

## Come personalizzare i contenuti

I testi del sito sono nei file dentro la cartella `src/components/`. Per modificarli:

- **Descrizione rifugio**: `src/components/InfoSection.astro`
- **Come arrivare**: `src/components/HowToArrive.astro`
- **Regolamento**: `src/components/Rules.astro`
- **Galleria foto**: `src/components/Gallery.astro`
- **Nome e contatti nel footer**: `src/components/Footer.astro`
- **Titolo hero in homepage**: `src/pages/index.astro`

Cerca i testi tra parentesi quadre `[COME QUESTO]` e sostituiscili con le informazioni reali.

---

## Come aggiungere le foto

1. Metti le foto nella cartella `public/images/`
2. Nei componenti, sostituisci i segnaposto con:
   ```html
   <img src="/images/nome-foto.jpg" alt="Descrizione della foto" />
   ```

Per l'immagine grande dell'hero in homepage, aggiungi un file chiamato `hero.jpg` in `public/images/`.

---

## Come pubblicare il sito online (Cloudflare Pages)

1. Carica il progetto su GitHub (crea un nuovo repository e fai push)
2. Vai su [Cloudflare Pages](https://pages.cloudflare.com)
3. Crea un account gratuito se non ce l'hai
4. Clicca "Create a project" e collega il tuo repository GitHub
5. Nelle impostazioni di build:
   - Framework: **Astro**
   - Comando di build: `npm run build`
   - Directory di output: `dist`
6. Clicca "Save and Deploy"

Il sito sarà disponibile su un indirizzo tipo `nome-progetto.pages.dev`.
Quando avrete il dominio, potrete collegarlo dalle impostazioni di Cloudflare.
