/**
 * Helper puri per la generazione del PDF delle schede soci.
 * Nessun import Astro / pdf-lib: solo trasformazione dati → righe etichetta/valore,
 * così la logica è testabile in isolamento (vedi tests/unit/socio-pdf.test.ts).
 */

export interface SocioRecord {
  numero_socio?: number | null;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
  telefono?: string | null;
  data_nascita?: string | null;
  luogo_nascita?: string | null;
  codice_fiscale?: string | null;
  indirizzo_residenza?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  tipo_socio?: string | null;
  statuto_accettato_il?: string | null;
  regolamento_accettato_il?: string | null;
  created_at?: string | null;
}

export interface SocioField {
  label: string;
  value: string;
}

const PLACEHOLDER = '—';

const TIPO_DOC_LABELS: Record<string, string> = {
  carta_identita: "Carta d'identita",
  patente: 'Patente',
  passaporto: 'Passaporto',
};

/** Formatta una data ISO in gg/mm/aaaa (it-IT); placeholder se assente/non valida. */
export function formatDateIt(value?: string | null): string {
  if (!value) return PLACEHOLDER;
  const d = new Date(value);
  if (isNaN(d.getTime())) return PLACEHOLDER;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Formatta una data/ora ISO in gg/mm/aaaa, hh:mm (it-IT); placeholder se assente/non valida. */
export function formatDateTimeIt(value?: string | null): string {
  if (!value) return PLACEHOLDER;
  const d = new Date(value);
  if (isNaN(d.getTime())) return PLACEHOLDER;
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function val(v?: string | null): string {
  return v && v.trim() !== '' ? v : PLACEHOLDER;
}

/**
 * Slug per nome file a partire da un'etichetta referente: "Rossi Mario" → "rossi-mario".
 * Normalizza gli accenti (à→a, è→e, ò→o) così non vengono persi nel nome file.
 * Ritorna 'referente' se l'etichetta non produce caratteri utili.
 */
export function slugifyReferente(label: string): string {
  return (
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'referente'
  );
}

/** Titolo della scheda: "N. 12 — Cognome Nome" (o senza numero se assente). */
export function buildSocioTitle(socio: SocioRecord): string {
  const nome = [socio.cognome, socio.nome].filter((p) => p && p.trim() !== '').join(' ').trim();
  const nomeLabel = nome !== '' ? nome : PLACEHOLDER;
  return socio.numero_socio != null ? `N. ${socio.numero_socio} — ${nomeLabel}` : nomeLabel;
}

/**
 * Righe etichetta/valore di una scheda socio, in ordine fisso e formattate.
 * I campi vuoti diventano "—".
 */
export function buildSocioFields(socio: SocioRecord): SocioField[] {
  const tipoDoc = socio.tipo_documento
    ? TIPO_DOC_LABELS[socio.tipo_documento] ?? socio.tipo_documento
    : '';
  const documento =
    tipoDoc || socio.numero_documento
      ? `${val(tipoDoc)} ${socio.numero_documento ? `n. ${socio.numero_documento}` : ''}`.trim()
      : PLACEHOLDER;

  return [
    { label: 'Email', value: val(socio.email) },
    { label: 'Telefono', value: val(socio.telefono) },
    { label: 'Codice fiscale', value: val(socio.codice_fiscale) },
    { label: 'Nascita', value: `${formatDateIt(socio.data_nascita)} — ${val(socio.luogo_nascita)}` },
    { label: 'Residenza', value: val(socio.indirizzo_residenza) },
    { label: 'Documento', value: documento },
    { label: 'Tipo socio', value: socio.tipo_socio === 'fondatore' ? 'Fondatore' : 'Ordinario' },
    { label: 'Accett. statuto', value: formatDateTimeIt(socio.statuto_accettato_il) },
    { label: 'Accett. regolamento', value: formatDateTimeIt(socio.regolamento_accettato_il) },
    { label: 'Iscritto il', value: formatDateIt(socio.created_at) },
  ];
}
