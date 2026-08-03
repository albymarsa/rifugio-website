export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError, jsonOk } from '../../../lib/auth';
import { checkCsrf } from '../../../lib/csrf';
import {
  validateMemberRequired,
  validateMemberFieldFormat,
  validateMemberFieldLengths,
} from '../../../lib/member-validation';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Allineato a /api/soci: senza questo, un form ostile su un altro sito poteva
    // creare il profilo dell'utente loggato con dati a scelta dell'attaccante.
    if (!checkCsrf(request)) {
      return jsonError('Richiesta non autorizzata', 403);
    }

    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) {
      return jsonError(auth.error, auth.status);
    }

    const { supabase, user } = auth;

    const { nome, cognome, telefono } = await request.json();

    // Stessa validazione della gestione soci: i valori finiscono in PDF, export
    // e notifiche email. L'email non arriva dal client ma dalla sessione, quindi
    // l'unico caso possibile qui è nome/cognome mancante: messaggio specifico
    // per non citare un campo che l'utente non compila.
    const requiredCheck = validateMemberRequired(nome, cognome, user.email);
    if (!requiredCheck.ok) return jsonError('Nome e cognome sono obbligatori', 400);

    const profileData = { nome, cognome, telefono };

    const formatCheck = validateMemberFieldFormat(profileData);
    if (!formatCheck.ok) return jsonError(formatCheck.error, 400);

    const lengthCheck = validateMemberFieldLengths(profileData);
    if (!lengthCheck.ok) return jsonError(lengthCheck.error, 400);

    const { error } = await supabase.from('profili').insert([{
      id: user.id,
      nome,
      cognome,
      email: user.email,
      telefono: telefono || null,
    }]);

    if (error) {
      console.error('[API profile] Errore insert:', error.message);
      return jsonError('Errore nel salvataggio del profilo', 500);
    }

    return jsonOk();
  } catch {
    return jsonError('Richiesta non valida', 400);
  }
};
