export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError } from '../../../lib/auth';

/** GET: Restituisce i dati dei soci per l'export Excel (solo fondatori) */
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

    const year = url.searchParams.get('year');

    const { data: soci, error } = await supabase
      .from('soci')
      .select('*')
      .order('cognome');

    if (error) {
      console.error('[API soci/export] Errore query:', error.message);
      return jsonError('Errore nel caricamento dei dati', 500);
    }

    const filtered = year
      ? (soci || []).filter((s: any) => new Date(s.created_at).getFullYear() === parseInt(year))
      : soci || [];

    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};
