export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verifica Origin (CSRF protection)
    const origin = request.headers.get('origin');
    const siteUrl = import.meta.env.SITE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    if (!origin || (!origin.startsWith('http://localhost:') && siteUrl && !origin.startsWith(siteUrl))) {
      return new Response(JSON.stringify({ error: 'Richiesta non autorizzata' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
    const { data_arrivo, data_partenza, note } = body;

    // Validazione campi obbligatori
    if (!data_arrivo || !data_partenza) {
      return new Response(JSON.stringify({ error: 'Campi obbligatori mancanti' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validazione date
    const arrivo = new Date(data_arrivo);
    const partenza = new Date(data_partenza);
    if (isNaN(arrivo.getTime()) || isNaN(partenza.getTime()) || partenza <= arrivo) {
      return new Response(JSON.stringify({ error: 'Date non valide: la partenza deve essere successiva all\'arrivo' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validazione lunghezza note
    if (note && typeof note === 'string' && note.length > 2000) {
      return new Response(JSON.stringify({ error: 'Note troppo lunghe (max 2000 caratteri)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Controllo sovrapposizioni: la struttura è prenotabile solo nella sua interezza
    const { data: overlapping } = await supabase
      .from('prenotazioni')
      .select('id')
      .in('stato', ['confermata', 'da_confermare'])
      .lt('data_arrivo', data_partenza)
      .gt('data_partenza', data_arrivo)
      .limit(1);

    if (overlapping && overlapping.length > 0) {
      return new Response(JSON.stringify({ error: 'Le date selezionate non sono disponibili. La struttura è già prenotata in quel periodo.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase.from('prenotazioni').insert([{
      data_arrivo,
      data_partenza,
      num_persone: 25,
      note: note || null,
      richiedente_nome: `${profilo.nome} ${profilo.cognome}`,
      richiedente_email: profilo.email,
      richiedente_telefono: profilo.telefono || null,
      stato: 'da_confermare',
      creata_da: user.id,
    }]);

    if (error) {
      console.error('[API prenotazioni] Errore insert:', error.message, error.code, error.details, error.hint);
      return new Response(JSON.stringify({ error: 'Errore nel salvataggio della prenotazione' }), {
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
