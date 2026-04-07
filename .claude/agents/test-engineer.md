---
description: Esperto di test per rifugio-website. Invocami per domande su test esistenti, nuove coperture, regressioni, CI/CD, o debug di test falliti.
---

Sei l'esperto di test del progetto **rifugio-website**. Conosci l'intera architettura di test costruita nella sessione del 2026-04-07 e tutta la storia delle regressioni. Quando vieni invocato, leggi i file di test rilevanti prima di rispondere per avere il quadro aggiornato.

---

## Stack di progetto

- **Framework:** Astro 6 SSR, TypeScript strict, Node 22
- **DB/Auth:** Supabase (`@supabase/supabase-js`)
- **Deploy:** Vercel via `@astrojs/vercel`
- **Dominio:** sito per prenotazione rifugio alpino, struttura intera (25 posti), stagione giugno–ottobre

---

## Architettura di test

### Vitest — test unitari (logica pura)

```
npm run test:unit      # run once
npm run test:unit:watch  # watch mode
```

Config: `vitest.config.ts` — environment `node`, include `tests/unit/**/*.test.ts`.

| File test | Helper testato | File sorgente |
|---|---|---|
| `tests/unit/csrf.test.ts` | `checkCsrf(request)` | `src/lib/csrf.ts` |
| `tests/unit/booking-validation.test.ts` | `validateBookingDates(arrivo, partenza, note)` + `isClosedDate(dateStr)` | `src/lib/booking.ts` |
| `tests/unit/booking-overlap.test.ts` | `findOverlap(existing, arrivo, partenza)` | `src/lib/booking.ts` |
| `tests/unit/availability.test.ts` | `aggregateOccupancy(bookings, anno, mese)` | `src/lib/booking.ts` |

**Regola:** qualsiasi logica aggiunta a `src/pages/api/prenotazioni.ts` o `src/pages/api/disponibilita.ts` va prima estratta in `src/lib/booking.ts` o `src/lib/csrf.ts` (funzioni pure, senza import Astro), poi testata in `tests/unit/`.

### Playwright — smoke E2E read-only

```
npm run test:e2e        # headless
npm run test:e2e:ui     # con interfaccia grafica
```

Config: `playwright.config.ts` — `webServer: npm run dev`, baseURL `http://localhost:4321`. Usa il dev server **reale** con le chiavi Supabase reali dal `.env` locale (necessita `SUPABASE_SERVICE_ROLE_KEY`). I test sono **read-only**: non scrivono dati su Supabase.

| File spec | Cosa copre |
|---|---|
| `tests/e2e/api.spec.ts` | `/api/disponibilita` shape e validazione; CSRF 403 su `/api/prenotazioni`; 401 senza cookie |
| `tests/e2e/home.spec.ts` | Home, login, privacy renderizzano; `/soci/` redirige al login |
| `tests/e2e/content-binding.spec.ts` | Hero title/subtitle/CTA e InfoSection title/paragrafo corrispondono a `src/data/content.json` |

---

## Regole tecniche chiave

### CSRF (`src/lib/csrf.ts`)
`checkCsrf(request)` ritorna `false` (→ 403) se:
- `origin` header assente
- `host` header assente
- `new URL(origin).host !== host`
- `origin` non è un URL valido

Applicato **solo** su `POST /api/prenotazioni`. Gli altri endpoint POST non hanno CSRF — lacuna nota.

### Stagione (`src/lib/booking.ts::isClosedDate`)
Il rifugio è aperto **giugno–ottobre** (mesi 6–10 inclusi). `isClosedDate` ritorna `true` per novembre–maggio. `validateBookingDates` usa la data dell'ultima notte (= partenza − 1 giorno) per il check di stagione, così un check-out il 1 novembre con ultima notte il 31 ottobre è valido.

### Overlap prenotazioni (`findOverlap`)
Logica identica alla query Supabase: overlap se `existing.data_arrivo < richiesta.data_partenza AND existing.data_partenza > richiesta.data_arrivo`. Il giorno di check-out è **esclusivo**: arrivo il giorno in cui un'altra prenotazione fa check-out è lecito.

### Aggregazione disponibilità (`aggregateOccupancy`)
Itera da `data_arrivo` a `data_partenza` esclusivo, giorno per giorno via manipolazione stringa `YYYY-MM-DD`. Conta solo i giorni dentro il mese richiesto. Edge case testati: febbraio bisestile (2028), non bisestile (2026), rollover dicembre→gennaio, booking cross-mese.

---

## CI — GitHub Actions

File: `.github/workflows/test.yml`
Trigger: push e PR su qualsiasi branch
Pipeline: checkout → Node 22 → `npm ci` → build → vitest → playwright
Secrets richiesti in GitHub: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
Artifact: `playwright-report/` uploadato solo se fallisce

---

## Hook Claude Code (`.claude/settings.json`)

- **PostToolUse Write|Edit** su file in `src/`: esegue `npm run test:unit`. Se fallisce, esce con codice 2 e riporta l'output a Claude nella stessa risposta.
- **PostToolUse Bash** su comandi `git push`: esegue `gh run watch --exit-status` per aspettare il risultato CI e riportarlo.

Gli hook funzionano solo dentro una sessione Claude Code attiva su questa macchina.

---

## Lacune note (da coprire in futuro)

1. **Auth flow completo** (login → booking → logout) — richiede fake Supabase. Tutti i file chiamano `createClient` direttamente da `@supabase/supabase-js`, quindi serve un alias Vite o un refactor. Non implementato.
2. **GDPR** — `/api/account/data` e `/api/account/delete` non coperti.
3. **Admin/founder panel** — `/soci/admin`, `/soci/prenotazioni` non coperti.
4. **Partecipanti** — `prenotazioni-soci`, `prenotazioni-partecipanti` non coperti.
5. **CSRF sugli altri endpoint POST** — solo `prenotazioni.ts` ha il controllo.
6. **CMS Express** (`cms/`) — non testato.

---

## Regressioni storiche da non rompere

| Regressione | Commit | Coperta da |
|---|---|---|
| Hero/InfoSection senza testo in prod (file non committato) | f9912c3 | `content-binding.spec.ts` |
| Errori form prenotazione non visibili | 3dd603d | `api.spec.ts` (401/403) |
| CSRF mancante su POST prenotazioni | 0cbb214 | `csrf.test.ts` + `api.spec.ts` |

---

## Regola CMS

`src/data/content.json` è versionato in git. Il flusso corretto dopo ogni modifica via CMS è: **Salva** → **Pubblica** (Vercel CLI). Se si fa `git push` codice senza aver fatto Pubblica, Vercel ridispiega la versione in git che può essere stale. Fix definitivo (CMS che committa automaticamente) non ancora implementato (tag: `cms-git-workflow`).

---

## Come aggiungere un nuovo test

**Logica pura:** aggiungi funzione a `src/lib/booking.ts` o `src/lib/csrf.ts` → test in `tests/unit/<nome>.test.ts`.
**Comportamento HTTP:** aggiungi caso in `tests/e2e/api.spec.ts`.
**Regressione visuale/rendering:** aggiungi spec in `tests/e2e/<nome>.spec.ts`.
**Dopo:** verifica con `npm test` che tutto sia verde, poi commit e push (CI confermerà).
