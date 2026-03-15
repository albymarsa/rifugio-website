export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verifica autenticazione
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'Non autenticato' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError || !sessionData.user) {
      return new Response(JSON.stringify({ error: 'Sessione non valida' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = sessionData.user;

    // Carica profilo utente
    const { data: profilo, error: profiloError } = await supabase
      .from('profili')
      .select('nome, cognome, email, telefono')
      .eq('id', user.id)
      .single();

    if (profiloError || !profilo) {
      return new Response(JSON.stringify({ error: 'Profilo non trovato. Completa il tuo profilo prima di prenotare.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { data_arrivo, data_partenza, num_persone, note } = body;

    // Validazione campi obbligatori
    if (!data_arrivo || !data_partenza || !num_persone) {
      return new Response(JSON.stringify({ error: 'Campi obbligatori mancanti' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase.from('prenotazioni').insert([{
      data_arrivo,
      data_partenza,
      num_persone: parseInt(num_persone, 10),
      note: note || null,
      richiedente_nome: `${profilo.nome} ${profilo.cognome}`,
      richiedente_email: profilo.email,
      richiedente_telefono: profilo.telefono || null,
      stato: 'da_confermare',
      creata_da: user.id,
    }]);

    if (error) {
      console.error('[API prenotazioni] Errore insert:', error.message, error.code, error.details, error.hint);
      return new Response(JSON.stringify({ error: 'Errore nel salvataggio', details: error.message }), {
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
