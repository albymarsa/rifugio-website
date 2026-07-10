---
name: rilascio
description: Percorso di rilascio guidato per rifugio-website — coinvolge gli ingegneri pertinenti (sicurezza, test, infrastruttura) in sola segnalazione, poi si ferma prima di commit/push/deploy per l'ok esplicito dell'utente. Invocare quando una funzionalità è implementata e pronta per la pubblicazione.
---

# Rilascio guidato

Sei l'orchestratore del rilascio di **rifugio-website**. Segui questi passi **nell'ordine**,
sempre. Non saltare il cancello (passo 5) e non fare `git push` senza il "via" esplicito
dell'utente: su questo progetto **`push` su `main` = deploy live su Vercel**
(`www.rifugiorosmini.it`), un'azione verso l'esterno difficile da annullare.

Gli hook meccanici sono già configurati in `.claude/settings.json` e scattano da soli — **non
duplicarli**:
- `PostToolUse Write|Edit` → esegue `npm run test:unit` a ogni modifica in `src/`.
- `PostToolUse Bash(git push*)` → osserva la CI dopo il push.

Regole di fondo:
- **Gli ingegneri segnalano soltanto**: non modificano file. I fix li decide l'utente, caso per caso.
- **Solo gli ingegneri pertinenti** al changeset, non sempre tutti e tre.
- Spiegazioni all'utente concettuali e senza gergo; cauto sulla produzione.

---

## 1. Raccolta del changeset

Determina cosa **non è ancora su `origin/main`** (commit locali non pushati + modifiche non committate):

```
git fetch origin
git diff --name-only origin/main    # file modificati/committati ma non pushati
git status --porcelain              # include untracked (colonna ??)
```

Unisci le due liste in un unico elenco di path toccati. Mostra all'utente un **riepilogo
sintetico** (lista dei file, non il diff intero). Se non c'è nulla da rilasciare, dillo e fermati.

## 2. Classificazione — quali ingegneri sono pertinenti

Confronta i path del changeset con questa tabella. Attiva un ingegnere se **almeno un** file rientra:

| Ingegnere | Si attiva se il changeset tocca |
|---|---|
| **security-engineer** | `src/pages/api/**`, `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/csrf.ts`, `src/lib/supabase.ts`, `src/lib/member-*.ts`, componenti `*Form.astro`, `src/pages/privacy.astro`, nuove dipendenze in `package.json`, qualsiasi cosa tratti dati personali |
| **test-engineer** | qualsiasi logica in `src/**` o `src/lib/**`, endpoint API, file in `tests/**` (di fatto quasi ogni modifica di codice) |
| **infrastructure-engineer** | `astro.config.mjs`, `src/layouts/Layout.astro` (tag OG), `.vercel/**`, `vercel.json`, `cms/**` (logica deploy), configurazione dominio/DNS/email/`SITE_URL`, nuovi servizi o sottodomini |

Comunica all'utente **quali** ingegneri hai selezionato e perché (quali file li hanno attivati).

Se **nessuno** è pertinente (es. solo `src/data/content.json`, immagini in `public/`, o file
non di codice), dillo e **salta direttamente al cancello (passo 5)**.

## 3. Revisione (solo segnalazione)

Invoca **in parallelo** (un solo messaggio, più chiamate) solo gli ingegneri selezionati, via
subagent con i rispettivi `subagent_type`: `security-engineer`, `test-engineer`,
`infrastructure-engineer`.

> **Fallback se il subagent per nome non è disponibile.** In alcuni runtime (es. SDK/FleetView)
> i subagent personalizzati del progetto non sono richiamabili per nome e l'invocazione fallisce
> con "Agent type '<nome>' not found". In quel caso usa `subagent_type: general-purpose` e
> istruiscilo, come **prima riga del prompt**, a leggere `.claude/agents/<nome>.md` e ad assumerne
> il ruolo prima di eseguire la revisione. Il resto del prompt resta identico.

A ciascuno passa nel prompt:
- l'elenco dei file del changeset e il diff rilevante (`git diff origin/main -- <file...>`),
- l'istruzione esplicita: **"Sola segnalazione: analizza il changeset e riporta i problemi
  ordinati per gravità. NON modificare alcun file. Restituisci un elenco puntato di findings."**

## 4. Presentazione e decisioni

- Consolida i risultati **raggruppati per ingegnere**, ordinati per gravità.
- Per **ogni** segnalazione chiedi all'utente se applicarla: la decisione è **caso per caso**.
- Applica **solo** i fix approvati, con il normale flusso di edit. L'hook `PostToolUse Write|Edit`
  eseguirà da sé i test unitari; se falliscono, correggi prima di proseguire.
- Se non emerge nessun problema, dillo e prosegui.

## 5. 🚦 CANCELLO prima della pubblicazione

**Fermati qui.** Mostra all'utente:
- il riepilogo finale di cosa verrà committato,
- l'avviso esplicito che **`git push` su `main` pubblica il sito dal vivo su Vercel**
  (`www.rifugiorosmini.it`) ed è difficile da annullare (solo rollback dopo che il pubblico ha già visto).

Chiedi il **"via" esplicito**. Senza un ok chiaro, **non procedere** oltre.

## 6. Rilascio

Dopo il "via":
1. `git add` dei soli file pertinenti al rilascio.
2. `git commit` con messaggio **in italiano** che descrive la funzionalità (convenzione del repo).
3. `git push`.

L'hook `PostToolUse Bash(git push*)` osserva automaticamente la CI; Vercel ridispiega da solo
(1–2 min). Riporta all'utente l'esito della CI.

> Nota: una CI rossa **non** blocca il deploy Vercel (sono canali separati). Se la CI fallisce,
> segnalalo all'utente e proponi un fix, ma non dare per scontato che il sito non sia stato pubblicato.

## 7. Nota post-rilascio

Se il rilascio ha aggiunto **nuovi form, endpoint, terze parti o servizi**, ricorda all'utente
di aggiornare la sezione "Quando aggiornare questo agente" dell'agente pertinente in
`.claude/agents/` (i doc agenti vanno tenuti allineati al codice — cfr. commit `c789247`).
