export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError, jsonOk } from '../../../lib/auth';
import { validateMemberRequired, validateMemberFieldLengths } from '../../../lib/member-validation';

/** DELETE: Elimina un socio ordinario (solo fondatori) */
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

    const { supabase, user } = auth;
    const { socio_id } = await request.json();

    if (!socio_id) {
      return jsonError('Parametro socio_id mancante', 400);
    }

    // Verifica che l'utente sia un fondatore
    const { data: fondatore } = await supabase
      .from('soci')
      .select('tipo_socio')
      .eq('email', user.email)
      .eq('tipo_socio', 'fondatore')
      .single();

    if (!fondatore) {
      return jsonError('Non autorizzato', 403);
    }

    // Verifica che il socio da eliminare sia ordinario
    const { data: socio } = await supabase
      .from('soci')
      .select('tipo_socio')
      .eq('id', socio_id)
      .single();

    if (!socio) {
      return jsonError('Socio non trovato', 404);
    }

    if (socio.tipo_socio === 'fondatore') {
      return jsonError('Non è possibile eliminare un fondatore', 403);
    }

    const { error } = await supabase
      .from('soci')
      .delete()
      .eq('id', socio_id);

    if (error) {
      console.error('[API soci] Errore delete:', error.message);
      return jsonError('Errore nell\'eliminazione del socio', 500);
    }

    return jsonOk();
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

    const { supabase, user } = auth;
    const body = await request.json();

    const memberData = {
      nome: body.nome,
      cognome: body.cognome,
      email: body.email,
      telefono: body.telefono || null,
      data_nascita: body.data_nascita || null,
      luogo_nascita: body.luogo_nascita || null,
      codice_fiscale: body.codice_fiscale || null,
      indirizzo_residenza: body.indirizzo_residenza || null,
      tipo_documento: body.tipo_documento || null,
      numero_documento: body.numero_documento || null,
      registrato_da: user.id,
      tipo_socio: 'ordinario',
    };

    const requiredCheck = validateMemberRequired(memberData.nome, memberData.cognome, memberData.email);
    if (!requiredCheck.ok) return jsonError(requiredCheck.error, 400);

    const lengthCheck = validateMemberFieldLengths(memberData);
    if (!lengthCheck.ok) return jsonError(lengthCheck.error, 400);

    const { error } = await supabase.from('soci').insert([memberData]);

    if (error) {
      console.error('[API soci] Errore insert:', error.message);
      return jsonError('Errore nel salvataggio del socio', 500);
    }

    return jsonOk();
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};
