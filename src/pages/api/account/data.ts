export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError } from '../../../lib/auth';

/** GET: Scarica tutti i dati personali dell'utente (portabilità GDPR Art. 20) */
export const GET: APIRoute = async ({ cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

    const { supabase, user } = auth;

    // Carica profilo
    const { data: profilo } = await supabase
      .from('profili')
      .select('*')
      .eq('id', user.id)
      .single();

    // Carica soci registrati dall'utente
    const { data: soci } = await supabase
      .from('soci')
      .select('*')
      .eq('registrato_da', user.id);

    // Carica prenotazioni create dall'utente
    const { data: prenotazioni } = await supabase
      .from('prenotazioni')
      .select('*')
      .eq('creata_da', user.id);

    // Carica associazioni prenotazioni-soci
    const socioIds = (soci || []).map((s: any) => s.id);
    let partecipazioni: any[] = [];
    if (socioIds.length > 0) {
      const { data } = await supabase
        .from('prenotazioni_soci')
        .select('*')
        .in('socio_id', socioIds);
      partecipazioni = data || [];
    }

    const exportData = {
      esportato_il: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        creato_il: user.created_at,
      },
      profilo: profilo || null,
      soci: soci || [],
      prenotazioni: prenotazioni || [],
      partecipazioni,
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="i-miei-dati.json"',
      },
    });
  } catch {
    return jsonError('Errore nel recupero dei dati', 500);
  }
};
