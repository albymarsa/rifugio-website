export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError } from '../../lib/auth';

/** GET: Restituisce i partecipanti di una prenotazione (solo fondatori) */
export const GET: APIRoute = async ({ cookies, url }) => {
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

    const prenId = url.searchParams.get('prenotazione_id');
    if (!prenId) {
      return jsonError('Parametro prenotazione_id mancante', 400);
    }

    // Carica associazioni
    const { data: associazioni } = await supabase
      .from('prenotazioni_soci')
      .select('socio_id')
      .eq('prenotazione_id', prenId);

    if (!associazioni || associazioni.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const socioIds = associazioni.map((a: any) => a.socio_id);

    const { data: soci } = await supabase
      .from('soci')
      .select('id, nome, cognome, email, telefono')
      .in('id', socioIds);

    return new Response(JSON.stringify(soci || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};
