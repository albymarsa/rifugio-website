export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'L\'email è obbligatoria' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );

    const origin = new URL(request.url).origin;
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/soci/reset-password`,
    });

    // Restituisce sempre successo per prevenire email enumeration
    return new Response(JSON.stringify({
      success: true,
      message: 'Se l\'email è registrata, riceverai un link per reimpostare la password.',
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
