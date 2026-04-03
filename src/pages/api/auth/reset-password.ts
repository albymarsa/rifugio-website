export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { access_token, refresh_token, password } = await request.json();

    if (!access_token || !refresh_token || !password) {
      return new Response(JSON.stringify({ error: 'Dati mancanti' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'La password deve avere almeno 6 caratteri' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );

    // Ripristina la sessione dai token ricevuti dal link di reset
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError) {
      return new Response(JSON.stringify({
        error: 'Il link è scaduto o non valido. Richiedi un nuovo link.',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Aggiorna la password
    const { data, error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      return new Response(JSON.stringify({
        error: 'Errore nell\'aggiornamento della password. Riprova.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Setta i cookie di sessione (l'utente risulta loggato)
    if (data.user) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        cookies.set('sb-access-token', sessionData.session.access_token, {
          path: '/',
          maxAge: 3600,
          sameSite: 'lax',
          secure: true,
          httpOnly: true,
        });
        cookies.set('sb-refresh-token', sessionData.session.refresh_token, {
          path: '/',
          maxAge: 604800,
          sameSite: 'lax',
          secure: true,
          httpOnly: true,
        });
      }
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
