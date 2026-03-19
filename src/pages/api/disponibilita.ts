export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedClient, jsonError, jsonOk } from '../../lib/auth';

const CAPACITA = 25;

/** GET: Restituisce l'occupazione aggregata per giorno di un dato mese */
export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

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

    // Calcola limiti del mese
    const monthStart = `${anno}-${String(mese).padStart(2, '0')}-01`;
    const nextMonth = mese === 12 ? `${anno + 1}-01-01` : `${anno}-${String(mese + 1).padStart(2, '0')}-01`;

    // Usa service role per bypassare RLS e vedere tutte le prenotazioni
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[API disponibilita] SUPABASE_SERVICE_ROLE_KEY mancante');
      return jsonError('Configurazione server incompleta', 500);
    }

    const adminClient = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      serviceRoleKey
    );

    // Trova prenotazioni che si sovrappongono al mese richiesto
    const { data: bookings, error } = await adminClient
      .from('prenotazioni')
      .select('data_arrivo, data_partenza, num_persone')
      .in('stato', ['confermata', 'da_confermare'])
      .lt('data_arrivo', nextMonth)
      .gt('data_partenza', monthStart);

    if (error) {
      console.error('[API disponibilita] Errore query:', error.message);
      return jsonError('Errore nel caricamento dei dati', 500);
    }

    console.log('[API disponibilita] Bookings trovate:', bookings?.length, 'per', monthStart, '-', nextMonth);
    if (bookings && bookings.length > 0) {
      console.log('[API disponibilita] Prima booking:', JSON.stringify(bookings[0]));
    }

    // Aggrega occupazione per giorno
    const occupazione: Record<string, number> = {};

    for (const booking of bookings || []) {
      // Itera da data_arrivo a data_partenza (escluso ultimo giorno)
      let current = booking.data_arrivo;
      while (current < booking.data_partenza) {
        // Conta solo i giorni dentro il mese richiesto
        if (current >= monthStart && current < nextMonth) {
          occupazione[current] = (occupazione[current] || 0) + booking.num_persone;
        }
        // Incrementa di un giorno usando manipolazione stringa
        const [y, m, d] = current.split('-').map(Number);
        const next = new Date(y, m - 1, d + 1);
        current = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      }
    }

    return jsonOk({ occupazione, capacita: CAPACITA });
  } catch {
    return jsonError('Errore interno', 500);
  }
};
