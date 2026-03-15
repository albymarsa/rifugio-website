# Sito Web Rifugio Alpine

Sito web per il rifugio alpino con pagina informativa, sistema di prenotazione e area soci.

## Come funziona

Il sito ha queste sezioni:
- **Homepage** — informazioni sul rifugio, come arrivare, regolamento, galleria foto
- **Prenota** — modulo per richiedere una prenotazione (i dati vanno nel database Supabase)
- **Area Soci** — dashboard per i soci con gestione gruppo e visualizzazione prenotazioni
- **Gestione Prenotazioni** — pannello per i fondatori per confermare/gestire le prenotazioni

Quando qualcuno compila il modulo di prenotazione, la richiesta viene salvata nel database con stato "da confermare". I soci fondatori possono poi confermarla e associarla ai soci dal pannello di gestione.

---

## Come avviare il sito in locale (per vederlo sul tuo computer)

1. Apri il terminale nella cartella del progetto
2. Esegui: `npm run dev`
3. Apri il browser e vai su `http://localhost:4321`

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

### Passo 3: Crea la tabella dei profili utente

1. Nel pannello Supabase, vai su **SQL Editor**
2. Clicca su **New query**
3. Copia e incolla questo codice SQL, poi clicca **Run**:

```sql
-- Tabella profili utente (dati di base di chi si registra al sito)
CREATE TABLE profili (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profili ENABLE ROW LEVEL SECURITY;

-- L'utente vede e modifica il proprio profilo
CREATE POLICY "select_own" ON profili FOR SELECT USING (id = auth.uid());
CREATE POLICY "insert_own" ON profili FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "update_own" ON profili FOR UPDATE USING (id = auth.uid());

-- I fondatori vedono tutti i profili
CREATE POLICY "select_all_founders" ON profili FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM soci WHERE email = auth.jwt()->>'email' AND tipo_socio = 'fondatore'
  ));
```

### Passo 4: Crea le tabelle delle prenotazioni

1. Nel pannello Supabase, vai su **SQL Editor**
2. Clicca su **New query**
3. Copia e incolla questo codice SQL, poi clicca **Run**:

```sql
-- Tabella prenotazioni
CREATE TABLE prenotazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_arrivo DATE NOT NULL,
  data_partenza DATE NOT NULL,
  num_persone INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  richiedente_nome TEXT NOT NULL,
  richiedente_email TEXT NOT NULL,
  richiedente_telefono TEXT,
  stato TEXT NOT NULL DEFAULT 'da_confermare'
    CHECK (stato IN ('da_confermare', 'confermata', 'annullata')),
  creata_da UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella associazione prenotazioni-soci
CREATE TABLE prenotazioni_soci (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenotazione_id UUID NOT NULL REFERENCES prenotazioni(id) ON DELETE CASCADE,
  socio_id UUID NOT NULL REFERENCES soci(id) ON DELETE CASCADE,
  aggiunto_da UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prenotazione_id, socio_id)
);

-- Indici
CREATE INDEX idx_prenotazioni_stato ON prenotazioni(stato);
CREATE INDEX idx_prenotazioni_soci_pren ON prenotazioni_soci(prenotazione_id);
CREATE INDEX idx_prenotazioni_soci_socio ON prenotazioni_soci(socio_id);

-- RLS per prenotazioni
ALTER TABLE prenotazioni ENABLE ROW LEVEL SECURITY;

-- Solo utenti autenticati possono inserire prenotazioni
CREATE POLICY "insert_authenticated" ON prenotazioni FOR INSERT
  WITH CHECK (creata_da = auth.uid() AND stato = 'da_confermare');

-- Gli utenti vedono le prenotazioni che hanno creato
CREATE POLICY "select_own_created" ON prenotazioni FOR SELECT
  USING (creata_da = auth.uid());

-- I fondatori vedono tutte le prenotazioni
CREATE POLICY "select_all_founders" ON prenotazioni FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM soci WHERE email = auth.jwt()->>'email' AND tipo_socio = 'fondatore'
  ));

-- I soci vedono le prenotazioni a cui sono associati tramite il loro gruppo
CREATE POLICY "select_own" ON prenotazioni FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM prenotazioni_soci ps
    JOIN soci s ON s.id = ps.socio_id
    WHERE ps.prenotazione_id = prenotazioni.id
    AND s.registrato_da = auth.uid()
  ));

-- Solo i fondatori possono aggiornare le prenotazioni
CREATE POLICY "update_founders" ON prenotazioni FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM soci WHERE email = auth.jwt()->>'email' AND tipo_socio = 'fondatore'
  ));

-- Solo i fondatori possono eliminare le prenotazioni
CREATE POLICY "delete_founders" ON prenotazioni FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM soci WHERE email = auth.jwt()->>'email' AND tipo_socio = 'fondatore'
  ));

-- RLS per prenotazioni_soci
ALTER TABLE prenotazioni_soci ENABLE ROW LEVEL SECURITY;

-- I fondatori hanno accesso completo alle associazioni
CREATE POLICY "all_founders" ON prenotazioni_soci FOR ALL
  USING (EXISTS (
    SELECT 1 FROM soci WHERE email = auth.jwt()->>'email' AND tipo_socio = 'fondatore'
  ));

-- I soci vedono le associazioni dei propri membri del gruppo
CREATE POLICY "select_own" ON prenotazioni_soci FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM soci
    WHERE soci.id = prenotazioni_soci.socio_id
    AND soci.registrato_da = auth.uid()
  ));

-- I soci possono associare i propri membri del gruppo
CREATE POLICY "insert_own" ON prenotazioni_soci FOR INSERT
  WITH CHECK (
    aggiunto_da = auth.uid()
    AND EXISTS (
      SELECT 1 FROM soci
      WHERE soci.id = prenotazioni_soci.socio_id
      AND soci.registrato_da = auth.uid()
    )
  );
```

### Passo 6: Configura l'autenticazione

1. Nel pannello Supabase, vai su **Authentication** > **Providers**
2. Verifica che **Email** sia abilitato (dovrebbe esserlo di default)
3. Vai su **Authentication** > **URL Configuration**
4. In **Site URL** metti l'URL del tuo sito (es. `https://tuosito.pages.dev`)
5. In **Redirect URLs** aggiungi anche `http://localhost:4321` (per sviluppo locale)

### Passo 7: Collega Supabase al sito

1. Nel pannello Supabase, vai su **Settings** > **API**
2. Copia il **Project URL** e la chiave **anon public**
3. Crea un file `.env` nella cartella del progetto con:
   ```
   PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=eyJ...la-tua-chiave...
   ```
4. **Importante**: questo file NON va caricato su GitHub (e' gia' nel .gitignore)
5. Per il deploy su Cloudflare: vai nelle impostazioni del progetto su Cloudflare Pages > **Environment variables** e aggiungi le stesse variabili

### Passo 8: Registra i soci fondatori

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
