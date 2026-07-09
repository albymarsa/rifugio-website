export const prerender = false;

import type { APIRoute } from 'astro';
import { getAuthenticatedClient, jsonError } from '../../lib/auth';
import { checkCsrf } from '../../lib/csrf';
import { validateBookingDates } from '../../lib/booking';
import { sendBookingNotification } from '../../lib/email';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    if (!checkCsrf(request)) {
      return new Response(JSON.stringify({ error: 'Richiesta non autorizzata' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verifica autenticazione
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) {
      return jsonError(auth.error, auth.status);
    }

    const { supabase, user } = auth;

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

    const validation = validateBookingDates(data_arrivo, data_partenza, note);
    if (!validation.ok) {
      return new Response(JSON.stringify({ error: validation.error }), {
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
      console.error('[API prenotazioni] Errore insert:', error.message);
      return new Response(JSON.stringify({ error: 'Errore nel salvataggio della prenotazione' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Notifica mail ai gestori. Il fallimento NON blocca la prenotazione.
    try {
      const mailResult = await sendBookingNotification({
        richiedente_nome: `${profilo.nome} ${profilo.cognome}`,
        richiedente_email: profilo.email,
        richiedente_telefono: profilo.telefono || null,
        data_arrivo,
        data_partenza,
        note: note || null,
      });
      if (!mailResult.ok) {
        console.error('[API prenotazioni] Invio mail fallito:', mailResult.errorCode ?? 'UNKNOWN');
      }
    } catch (mailErr) {
      console.error('[API prenotazioni] Eccezione invio mail (tipo):', mailErr instanceof Error ? mailErr.name : 'UNKNOWN');
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
