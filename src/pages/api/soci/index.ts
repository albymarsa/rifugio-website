export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError, jsonOk } from '../../../lib/auth';
import { validateMemberRequired, validateMemberFieldLengths } from '../../../lib/member-validation';

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
