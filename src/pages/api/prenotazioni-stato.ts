export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError, jsonOk } from '../../lib/auth';

/** PATCH: Aggiorna stato prenotazione (solo fondatori) */
export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

    const { supabase, user } = auth;

    // Verifica ruolo fondatore
    const { data: fondatore } = await supabase
      .from('soci')
      .select('tipo_socio')
      .eq('email', user.email)
      .eq('tipo_socio', 'fondatore')
      .single();

    if (!fondatore) {
      return jsonError('Non autorizzato', 403);
    }

    const { prenotazione_id, stato } = await request.json();

    if (!prenotazione_id || !stato) {
      return jsonError('Parametri mancanti', 400);
    }

    if (!['confermata', 'annullata', 'da_confermare'].includes(stato)) {
      return jsonError('Stato non valido', 400);
    }

    const { error } = await supabase
      .from('prenotazioni')
      .update({ stato })
      .eq('id', prenotazione_id);

    if (error) {
      console.error('[API prenotazioni-stato] Errore update:', error.message);
      return jsonError('Errore nell\'aggiornamento dello stato', 500);
    }

    return jsonOk();
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};

/** DELETE: Elimina definitivamente una prenotazione (solo fondatori) */
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

    const { supabase, user } = auth;

    // Verifica ruolo fondatore
    const { data: fondatore } = await supabase
      .from('soci')
      .select('tipo_socio')
      .eq('email', user.email)
      .eq('tipo_socio', 'fondatore')
      .single();

    if (!fondatore) {
      return jsonError('Non autorizzato', 403);
    }

    const { prenotazione_id } = await request.json();

    if (!prenotazione_id) {
      return jsonError('Parametri mancanti', 400);
    }

    // Elimina prima le associazioni soci-prenotazione (FK)
    const { error: errorSoci } = await supabase
      .from('prenotazioni_soci')
      .delete()
      .eq('prenotazione_id', prenotazione_id);

    if (errorSoci) {
      console.error('[API prenotazioni-stato] Errore delete soci:', errorSoci.message);
      return jsonError('Errore nell\'eliminazione dei partecipanti', 500);
    }

    // Elimina la prenotazione
    const { error } = await supabase
      .from('prenotazioni')
      .delete()
      .eq('id', prenotazione_id);

    if (error) {
      console.error('[API prenotazioni-stato] Errore delete:', error.message);
      return jsonError('Errore nell\'eliminazione della prenotazione', 500);
    }

    return jsonOk();
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};
