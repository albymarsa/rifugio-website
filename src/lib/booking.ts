/**
 * Logica pura della prenotazione, estratta dagli handler API per essere
 * testabile senza database. Nessun cambio di comportamento rispetto a
 * src/pages/api/prenotazioni.ts e src/pages/api/disponibilita.ts.
 */

export const CAPACITA = 25;

/**
 * Il rifugio è aperto solo da giugno a ottobre inclusi.
 * Ritorna true per i giorni in cui la struttura è chiusa (novembre–maggio).
 */
export function isClosedDate(dateStr: string): boolean {
  const month = Number(dateStr.slice(5, 7));
  return month < 6 || month > 10;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Valida i campi data_arrivo / data_partenza / note di una richiesta di prenotazione. */
export function validateBookingDates(
  data_arrivo: unknown,
  data_partenza: unknown,
  note?: unknown
): ValidationResult {
  if (!data_arrivo || !data_partenza) {
    return { ok: false, error: 'Campi obbligatori mancanti' };
  }
  if (typeof data_arrivo !== 'string' || typeof data_partenza !== 'string') {
    return { ok: false, error: 'Campi obbligatori mancanti' };
  }
  const arrivo = new Date(data_arrivo);
  const partenza = new Date(data_partenza);
  if (isNaN(arrivo.getTime()) || isNaN(partenza.getTime()) || partenza <= arrivo) {
    return {
      ok: false,
      error: "Date non valide: la partenza deve essere successiva all'arrivo",
    };
  }
  if (note != null && typeof note === 'string' && note.length > 2000) {
    return { ok: false, error: 'Note troppo lunghe (max 2000 caratteri)' };
  }
  // Stagione: il rifugio è aperto solo giugno–ottobre. La data di partenza
  // è esclusiva (check-out), quindi il vincolo è sull'ultima notte = partenza - 1 giorno.
  const ultimaNotte = prevDay(data_partenza);
  if (isClosedDate(data_arrivo) || isClosedDate(ultimaNotte)) {
    return {
      ok: false,
      error: 'Il rifugio è chiuso da novembre a maggio. Seleziona date tra giugno e ottobre.',
    };
  }
  return { ok: true };
}

/** Decrementa una data YYYY-MM-DD di un giorno. */
function prevDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
}

export type ExistingBooking = {
  data_arrivo: string;
  data_partenza: string;
};

/**
 * Cerca una prenotazione esistente che si sovrappone all'intervallo richiesto.
 * Usa la stessa logica della query Supabase: overlap se
 *   existing.data_arrivo < richiesta.data_partenza AND
 *   existing.data_partenza > richiesta.data_arrivo
 * (giorno di check-out esclusivo).
 */
export function findOverlap(
  existing: ExistingBooking[],
  data_arrivo: string,
  data_partenza: string
): ExistingBooking | null {
  for (const b of existing) {
    if (b.data_arrivo < data_partenza && b.data_partenza > data_arrivo) {
      return b;
    }
  }
  return null;
}

/** Incrementa una data YYYY-MM-DD di un giorno usando manipolazione stringa. */
function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export type OccupancyBooking = {
  data_arrivo: string;
  data_partenza: string;
  num_persone: number;
};

/**
 * Aggrega l'occupazione giornaliera per il mese richiesto.
 * Ritorna una mappa { 'YYYY-MM-DD': numero_persone_occupate }.
 */
export function aggregateOccupancy(
  bookings: OccupancyBooking[],
  anno: number,
  mese: number
): Record<string, number> {
  const monthStart = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const nextMonthStart =
    mese === 12
      ? `${anno + 1}-01-01`
      : `${anno}-${String(mese + 1).padStart(2, '0')}-01`;

  const occupazione: Record<string, number> = {};
  for (const booking of bookings) {
    let current = booking.data_arrivo;
    while (current < booking.data_partenza) {
      if (current >= monthStart && current < nextMonthStart) {
        occupazione[current] = (occupazione[current] || 0) + booking.num_persone;
      }
      current = nextDay(current);
    }
  }
  return occupazione;
}
