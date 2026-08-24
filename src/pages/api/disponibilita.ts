export const prerender = false;

import type { APIRoute } from 'astro';
import { createServiceClient } from '../../lib/supabase';
import { jsonError, jsonOk } from '../../lib/auth';
import { aggregateOccupancy, CAPACITA, STATI_BLOCCANTI } from '../../lib/booking';

/** GET: Restituisce l'occupazione aggregata per giorno di un dato mese (endpoint pubblico) */
export const GET: APIRoute = async ({ url }) => {
  try {
    // Validazione parametri
    const annoStr = url.searchParams.get('anno');
    const meseStr = url.searchParams.get('mese');

    if (!annoStr || !meseStr) {
      return jsonError('Parametri anno e mese obbligatori', 400);
    }

    const anno = parseInt(annoStr, 10);
    const mese = parseInt(meseStr, 10);

    if (isNaN(anno) || isNaN(mese) || mese < 1 || mese > 12 || anno < 2024 || anno > 2030) {
      return jsonError('Parametri anno o mese non validi', 400);
    }

    // Calcola limiti del mese (per il filtro SQL sui bordi)
    const monthStart = `${anno}-${String(mese).padStart(2, '0')}-01`;
    const nextMonth = mese === 12 ? `${anno + 1}-01-01` : `${anno}-${String(mese + 1).padStart(2, '0')}-01`;

    // Usa service role per bypassare RLS e vedere tutte le prenotazioni
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[API disponibilita] SUPABASE_SERVICE_ROLE_KEY mancante');
      return jsonError('Configurazione server incompleta', 500);
    }

    const adminClient = createServiceClient();

    // Trova le prenotazioni confermate che si sovrappongono al mese richiesto.
    // Le richieste ancora 'da_confermare' non occupano il calendario.
    const { data: bookings, error } = await adminClient
      .from('prenotazioni')
      .select('data_arrivo, data_partenza, num_persone')
      .in('stato', [...STATI_BLOCCANTI])
      .lt('data_arrivo', nextMonth)
      .gt('data_partenza', monthStart);

    if (error) {
      console.error('[API disponibilita] Errore query:', error.message);
      return jsonError('Errore nel caricamento dei dati', 500);
    }

    const occupazione = aggregateOccupancy(bookings || [], anno, mese);

    return jsonOk({ occupazione, capacita: CAPACITA });
  } catch {
    return jsonError('Errore interno', 500);
  }
};
