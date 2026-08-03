import type { ValidationResult } from './booking';

const MAX_LENGTHS: Record<string, number> = {
  nome: 100,
  cognome: 100,
  email: 254,
  telefono: 20,
  luogo_nascita: 100,
  codice_fiscale: 16,
  indirizzo_residenza: 200,
  numero_documento: 50,
};

/** Una stringa di soli spazi vale come campo non compilato. */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

export function validateMemberRequired(
  nome: unknown,
  cognome: unknown,
  email: unknown
): ValidationResult {
  if (isBlank(nome) || isBlank(cognome) || isBlank(email)) {
    return { ok: false, error: 'Nome, cognome e email sono obbligatori' };
  }
  return { ok: true };
}

/** Valori ammessi per tipo_documento, allineati al CHECK sulla tabella soci. */
export const TIPI_DOCUMENTO = ['carta_identita', 'patente', 'passaporto'] as const;

/**
 * Documento di identità obbligatorio per i soci: serve a identificare chi pernotta
 * in rifugio. Non si applica ai profili utente, che non hanno questi campi.
 */
export function validateMemberDocument(data: Record<string, unknown>): ValidationResult {
  const tipo = data.tipo_documento;
  const numero = data.numero_documento;

  if (isBlank(tipo) || isBlank(numero)) {
    return { ok: false, error: 'Tipo e numero del documento sono obbligatori' };
  }
  if (typeof tipo !== 'string' || !TIPI_DOCUMENTO.includes(tipo as (typeof TIPI_DOCUMENTO)[number])) {
    return { ok: false, error: 'Tipo di documento non valido' };
  }
  if (typeof numero !== 'string') {
    return { ok: false, error: 'Numero documento non valido' };
  }
  return { ok: true };
}

/**
 * Caratteri che non devono comparire in un dato anagrafico:
 * - `\u0000-\u001F\u007F`: controlli ASCII, a capo e tabulazioni compresi
 * - `\u2028\u2029\u0085`: separatori di riga Unicode, che spezzano la cella in
 *   Excel esattamente come farebbe un a capo
 * - `\u200B-\u200D\uFEFF`: caratteri a larghezza zero, invisibili ma che rendono
 *   distinti due valori identici a vedersi. Il controllo di unicita' sull'email e' un
 *   confronto esatto, quindi si otterrebbero due schede per la stessa persona.
 * - `\u200E\u200F\u202A-\u202E\u2066-\u2069`: controlli di direzione del testo,
 *   che permettono di mostrare a schermo un cognome diverso da quello memorizzato
 */
const CONTROL_CHARS =
  /[\u0000-\u001F\u007F\u0085\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/;

/** Campi data accettati dal client: devono essere stringhe ISO `YYYY-MM-DD`. */
const DATE_FIELDS = ['data_nascita'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Verifica che i campi anagrafici valorizzati siano ben formati.
 * I valori finiscono in PDF, export e notifiche email: un non-stringa diventa
 * "[object Object]" e un a capo può spezzare righe e intestazioni a valle.
 * I valori assenti (null / undefined / '') sono ignorati: l'obbligatorietà è di
 * validateMemberRequired.
 *
 * Il perimetro è l'unione dei campi testuali (MAX_LENGTHS) e di quelli data, e va
 * tenuto allineato a EDITABLE_FIELDS in `src/pages/api/soci/index.ts`: un campo
 * accettato dal client ma assente qui arriverebbe al database senza controlli.
 */
export function validateMemberFieldFormat(
  data: Record<string, unknown>
): ValidationResult {
  for (const field of Object.keys(MAX_LENGTHS)) {
    const val = data[field];
    if (val === null || val === undefined || val === '') continue;
    if (typeof val !== 'string') {
      return { ok: false, error: `Campo ${field} non valido` };
    }
    if (CONTROL_CHARS.test(val)) {
      return { ok: false, error: `Campo ${field} contiene caratteri non ammessi` };
    }
  }

  // Senza questo controllo un valore non valido arriverebbe a Postgres, che lo
  // rifiuta con un 500 generico; e letterali come "today" o "infinity" sarebbero
  // invece accettati e salvati come date reali.
  for (const field of DATE_FIELDS) {
    const val = data[field];
    if (val === null || val === undefined || val === '') continue;
    if (typeof val !== 'string' || !ISO_DATE.test(val) || Number.isNaN(Date.parse(val))) {
      return { ok: false, error: `Campo ${field} non valido` };
    }
  }

  return { ok: true };
}

export function validateMemberFieldLengths(
  data: Record<string, unknown>
): ValidationResult {
  for (const [field, max] of Object.entries(MAX_LENGTHS)) {
    const val = data[field];
    if (val && typeof val === 'string' && val.length > max) {
      return { ok: false, error: `Campo ${field} troppo lungo (max ${max} caratteri)` };
    }
  }
  return { ok: true };
}

/**
 * Verifica l'accettazione obbligatoria di statuto e regolamento all'iscrizione socio.
 * Uguaglianza stretta a `true`: valori truthy ma non booleani (es. 'on', 1) sono rifiutati,
 * per blindare il contratto con il client che invia booleani.
 */
export function validateConsents(
  regolamentoConsent: unknown,
  statutoConsent: unknown
): ValidationResult {
  if (regolamentoConsent !== true || statutoConsent !== true) {
    return { ok: false, error: 'Accettazione di statuto e regolamento obbligatoria' };
  }
  return { ok: true };
}
