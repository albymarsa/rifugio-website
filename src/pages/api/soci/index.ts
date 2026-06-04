export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError, jsonOk } from '../../../lib/auth';
import { validateMemberRequired, validateMemberFieldLengths } from '../../../lib/member-validation';
import { canEditMember } from '../../../lib/member-ownership';
import { checkCsrf } from '../../../lib/csrf';

/** Campi anagrafici modificabili: whitelist per impedire l'override di id/registrato_da/tipo_socio. */
const EDITABLE_FIELDS = [
  'nome',
  'cognome',
  'email',
  'telefono',
  'data_nascita',
  'luogo_nascita',
  'codice_fiscale',
  'indirizzo_residenza',
  'tipo_documento',
  'numero_documento',
] as const;

/** DELETE: Elimina un socio ordinario (solo fondatori) */
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    if (!checkCsrf(request)) return jsonError('Richiesta non autorizzata', 403);

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
    if (!checkCsrf(request)) return jsonError('Richiesta non autorizzata', 403);

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

/** PUT: Modifica i dati di un socio registrato dall'utente (referente del gruppo) */
export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    if (!checkCsrf(request)) return jsonError('Richiesta non autorizzata', 403);

    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

    const { supabase, user } = auth;
    const body = await request.json();
    const socioId = body.id;

    if (!socioId) {
      return jsonError('Parametro id mancante', 400);
    }

    // Carica il socio per verificare proprietà e calcolare i campi modificati
    const { data: target } = await supabase
      .from('soci')
      .select('*')
      .eq('id', socioId)
      .single();

    if (!target) {
      return jsonError('Socio non trovato', 404);
    }

    const authz = canEditMember(target, user.id);
    if (!authz.ok) return jsonError(authz.error, 403);

    // Whitelist: ignora id/registrato_da/tipo_socio e ogni altro campo dal body
    const updateData: Record<string, string | null> = {};
    for (const field of EDITABLE_FIELDS) {
      const val = body[field];
      updateData[field] = val === '' || val === undefined ? null : val;
    }

    const requiredCheck = validateMemberRequired(updateData.nome, updateData.cognome, updateData.email);
    if (!requiredCheck.ok) return jsonError(requiredCheck.error, 400);

    const lengthCheck = validateMemberFieldLengths(updateData);
    if (!lengthCheck.ok) return jsonError(lengthCheck.error, 400);

    // Guard unicità email: se cambiata, non deve già appartenere a un altro socio.
    // Nota: con RLS il client autenticato vede solo i soci del proprio gruppo,
    // quindi il controllo copre i duplicati intra-gruppo (vedi unique index a DB).
    if (updateData.email && updateData.email !== target.email) {
      const { data: dup } = await supabase
        .from('soci')
        .select('id')
        .eq('email', updateData.email)
        .neq('id', socioId)
        .limit(1);
      if (dup && dup.length > 0) {
        return jsonError('Email già associata a un altro socio', 409);
      }
    }

    const { error } = await supabase
      .from('soci')
      .update(updateData)
      .eq('id', socioId);

    if (error) {
      console.error('[API soci] Errore update:', error.message);
      return jsonError('Errore nella modifica del socio', 500);
    }

    // Audit: traccia chi/quando/quale socio/quali campi (nomi, non valori)
    const changedFields = EDITABLE_FIELDS.filter(
      (f) => (target[f] ?? null) !== updateData[f]
    );
    console.info('[AUDIT soci.update]', JSON.stringify({
      by: user.id,
      socio_id: socioId,
      fields: changedFields,
      at: new Date().toISOString(),
    }));

    return jsonOk();
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};
