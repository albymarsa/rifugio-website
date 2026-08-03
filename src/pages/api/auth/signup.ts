export const prerender = false;

import type { APIRoute } from 'astro';
import { createAnonClient } from '../../../lib/supabase';
import { jsonError, setAuthCookies } from '../../../lib/auth';
import { validateMemberFieldFormat, validateMemberFieldLengths } from '../../../lib/member-validation';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password, nome, cognome, telefono } = await request.json();

    if (!email || !password || !nome || !cognome) {
      return new Response(JSON.stringify({ error: 'Email, password, nome e cognome sono obbligatori' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Questo è il vero punto d'ingresso dei dati di profilo (l'unico chiamato dal
    // sito) ed è pubblico: valida prima di creare l'utente su Supabase, per non
    // lasciare account orfani. I valori finiscono in PDF, export XLSX e notifiche.
    const profileData = { nome, cognome, email, telefono };

    const formatCheck = validateMemberFieldFormat(profileData);
    if (!formatCheck.ok) return jsonError(formatCheck.error, 400);

    const lengthCheck = validateMemberFieldLengths(profileData);
    if (!lengthCheck.ok) return jsonError(lengthCheck.error, 400);

    const supabase = createAnonClient();

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      const message = error.message === 'User already registered'
        ? 'Questo indirizzo email è già registrato. Prova ad accedere.'
        : 'Errore nella registrazione. Riprova.';
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Supabase restituisce user con identities vuote se l'email e' gia' registrata
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return new Response(JSON.stringify({
        error: 'Questo indirizzo email è già registrato. Prova ad accedere.',
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (data.session) {
      // Crea il profilo
      const { error: profileError } = await supabase.from('profili').insert([{
        id: data.user!.id,
        nome,
        cognome,
        email,
        telefono: telefono || null,
      }]);

      if (profileError) {
        console.error('[API signup] Errore creazione profilo:', profileError.message);
        // L'account è stato creato ma il profilo no — non blocchiamo,
        // il middleware reindirizzerà a completare il profilo
      }

      setAuthCookies(cookies, data.session);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Se la conferma email e' attiva, non c'e' sessione
    return new Response(JSON.stringify({
      success: true,
      needsEmailConfirm: true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
