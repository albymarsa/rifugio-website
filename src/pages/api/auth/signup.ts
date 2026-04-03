export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password, nome, cognome, telefono } = await request.json();

    if (!email || !password || !nome || !cognome) {
      return new Response(JSON.stringify({ error: 'Email, password, nome e cognome sono obbligatori' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );

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

      cookies.set('sb-access-token', data.session.access_token, {
        path: '/',
        maxAge: 3600,
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
      });
      cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        maxAge: 604800,
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
      });

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
