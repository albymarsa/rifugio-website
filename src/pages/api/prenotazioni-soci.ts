export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError, jsonOk } from '../../lib/auth';

/** POST: Aggiungi partecipante a prenotazione */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

    const { supabase, user } = auth;
    const { prenotazione_id, socio_id } = await request.json();

    if (!prenotazione_id || !socio_id) {
      return jsonError('Parametri mancanti', 400);
    }

    const { error } = await supabase.from('prenotazioni_soci').insert([{
      prenotazione_id,
      socio_id,
      aggiunto_da: user.id,
    }]);

    if (error) {
      console.error('[API prenotazioni-soci] Errore insert:', error.message);
      return jsonError('Errore nell\'aggiunta del partecipante', 500);
    }

    return jsonOk();
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};

/** DELETE: Rimuovi partecipante da prenotazione */
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

    const { supabase } = auth;
    const { prenotazione_id, socio_id } = await request.json();

    if (!prenotazione_id || !socio_id) {
      return jsonError('Parametri mancanti', 400);
    }

    const { error } = await supabase
      .from('prenotazioni_soci')
      .delete()
      .eq('prenotazione_id', prenotazione_id)
      .eq('socio_id', socio_id);

    if (error) {
      console.error('[API prenotazioni-soci] Errore delete:', error.message);
      return jsonError('Errore nella rimozione del partecipante', 500);
    }

    return jsonOk();
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};
