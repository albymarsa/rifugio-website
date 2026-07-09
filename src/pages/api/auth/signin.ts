export const prerender = false;

import type { APIRoute } from 'astro';
import { createAnonClient } from '../../../lib/supabase';
import { setAuthCookies } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e password sono obbligatori' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createAnonClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const message = error.message === 'Invalid login credentials'
        ? 'Email o password non corretti.'
        : 'Errore durante l\'accesso. Riprova.';
      return new Response(JSON.stringify({ error: message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (data.session) {
      setAuthCookies(cookies, data.session);
    }

    return new Response(JSON.stringify({ success: true }), {
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
