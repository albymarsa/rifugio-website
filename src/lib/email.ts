export interface BookingEmailPayload {
  richiedente_nome: string;
  richiedente_email: string;
  data_arrivo: string;     // YYYY-MM-DD
  data_partenza: string;   // YYYY-MM-DD
}

export interface EmailResult {
  ok: boolean;
  error?: string;
  errorCode?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_NOTIFY_TO = 'amicidelveglia@gmail.com';
const SEND_TIMEOUT_MS = 10_000;
/** Il nome finisce nell'oggetto: niente a capo (header injection) e lunghezza limitata. */
const MAX_NOME_LEN = 80;

/**
 * Legge una variabile d'ambiente trattando la stringa vuota come "non impostata":
 * su Vercel una variabile creata e lasciata vuota altrimenti oscurerebbe il default
 * e spegnerebbe le notifiche in silenzio.
 *
 * Si legge SOLO da `process.env`, mai da `import.meta.env`: Vite sostituisce
 * `import.meta.env.NOME` staticamente in fase di compilazione, e un segreto letto
 * per quella via finirebbe in chiaro dentro il bundle. In sviluppo il file .env
 * è caricato in `process.env` dallo script `dev` in package.json.
 */
function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : undefined;
}

/**
 * Invia notifica email ai gestori quando una nuova prenotazione viene creata.
 * Non lancia mai: in caso di errore ritorna { ok: false } e logga su console.
 *
 * Per minimizzare i dati trasmessi a Resend la mail contiene solo nome e date;
 * recapiti e note restano nell'area gestione. L'email del richiedente viaggia
 * comunque come `reply_to`, per permettere ai gestori di rispondere direttamente.
 */
export async function sendBookingNotification(
  payload: BookingEmailPayload
): Promise<EmailResult> {
  try {
    // Dry-run per sviluppo e test E2E. Vincolato alla modalità sviluppo di proposito:
    // in produzione nessuno deve poter spegnere le notifiche da una variabile.
    if (import.meta.env.DEV && env('EMAIL_DRY_RUN') === '1') {
      console.log('[EMAIL dry-run] Notifica prenotazione:\n' + formatEmailBody(payload));
      return { ok: true };
    }

    const apiKey = env('RESEND_API_KEY');
    if (!apiKey) {
      console.warn('[EMAIL] RESEND_API_KEY mancante. Notifica non inviata.');
      return { ok: false, error: 'resend_not_configured', errorCode: 'MISSING_ENV' };
    }

    // Nessun default: un mittente sbagliato recapiterebbe solo al titolare
    // dell'account Resend, risultato indistinguibile da un invio riuscito.
    const from = env('BOOKING_NOTIFY_FROM');
    if (!from) {
      console.warn('[EMAIL] BOOKING_NOTIFY_FROM mancante. Notifica non inviata.');
      return { ok: false, error: 'sender_not_configured', errorCode: 'MISSING_ENV' };
    }

    const to = parseRecipients(env('BOOKING_NOTIFY_TO') ?? DEFAULT_NOTIFY_TO);
    if (to.length === 0) {
      console.warn('[EMAIL] BOOKING_NOTIFY_TO non contiene indirizzi validi. Notifica non inviata.');
      return { ok: false, error: 'no_recipients', errorCode: 'NO_RECIPIENTS' };
    }

    const replyTo = EMAIL_REGEX.test(payload.richiedente_email)
      ? payload.richiedente_email
      : undefined;

    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Rifugio Amici del Veglia <${from}>`,
        to,
        subject: `Nuova richiesta di prenotazione: ${sanitizeSubject(payload.richiedente_nome)} (${payload.data_arrivo} → ${payload.data_partenza})`,
        text: formatEmailBody(payload),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      // Senza timeout una Resend che non risponde tiene appesa la richiesta del
      // socio fino al limite di durata della funzione, restituendogli un errore
      // su una prenotazione in realtà già salvata.
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Si logga solo lo stato e il codice d'errore di Resend, mai il corpo della
      // risposta: può contenere dati personali che resterebbero nei log per 30+
      // giorni (stessa ragione della rimozione dei log diagnostici in f145817).
      console.error(`[EMAIL] Resend ha rifiutato l'invio: HTTP ${response.status} (${await errorName(response)})`);
      return { ok: false, error: 'resend_error', errorCode: `HTTP_${response.status}` };
    }

    // L'id è l'unico appiglio per ritrovare il messaggio nel pannello Resend.
    const id = await messageId(response);
    console.log(`[EMAIL] Notifica inviata${id ? ` (id ${id})` : ''}`);
    return { ok: true };
  } catch (err) {
    // I fallimenti di fetch arrivano come TypeError con il dettaglio in `cause`,
    // non in `code`; un timeout arriva invece come TimeoutError.
    const errorCode =
      (err as { cause?: { code?: string } })?.cause?.code ??
      (err as { name?: string })?.name ??
      'UNKNOWN';
    console.error(`[EMAIL] Invio non riuscito: ${errorCode}`);
    return { ok: false, error: 'network_error', errorCode };
  }
}

/** Lista separata da virgole → array di indirizzi ripuliti, senza vuoti. */
export function parseRecipients(raw: string): string[] {
  return raw
    .split(',')
    .map((address) => address.trim())
    .filter((address) => EMAIL_REGEX.test(address));
}

/** Rimuove i caratteri di a capo e limita la lunghezza dell'oggetto. */
export function sanitizeSubject(value: string): string {
  return String(value).replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_NOME_LEN);
}

/** Estrae il solo campo `name` dall'errore Resend (es. "validation_error"). */
async function errorName(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { name?: string };
    return typeof body?.name === 'string' ? body.name : 'senza dettaglio';
  } catch {
    return 'senza dettaglio';
  }
}

/** Estrae l'id del messaggio dalla risposta di Resend, consumandone il corpo. */
async function messageId(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { id?: string };
    return typeof body?.id === 'string' ? body.id : undefined;
  } catch {
    return undefined;
  }
}

export function formatEmailBody(payload: BookingEmailPayload): string {
  return `È stata ricevuta una nuova richiesta di prenotazione sul sito Rifugio Rosmini.

Richiedente: ${payload.richiedente_nome}

Date soggiorno:
  Arrivo:   ${payload.data_arrivo}
  Partenza: ${payload.data_partenza}

Stato iniziale: da_confermare
Recapiti, note e gestione della richiesta sono nell'area gestione del sito.
`;
}
