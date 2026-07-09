export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) {
      return jsonError(auth.error, auth.status);
    }

    const { supabase, user } = auth;

    const { nome, cognome, telefono } = await request.json();

    if (!nome || !cognome) {
      return new Response(JSON.stringify({ error: 'Nome e cognome sono obbligatori' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase.from('profili').insert([{
      id: user.id,
      nome,
      cognome,
      email: user.email,
      telefono: telefono || null,
    }]);

    if (error) {
      console.error('[API profile] Errore insert:', error.message);
      return new Response(JSON.stringify({ error: 'Errore nel salvataggio del profilo' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
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
