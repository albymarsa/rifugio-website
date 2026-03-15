export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedClient, jsonError, jsonOk } from '../../../lib/auth';

/** DELETE: Elimina account utente e tutti i dati associati (GDPR Art. 17) */
export const DELETE: APIRoute = async ({ cookies }) => {
  try {
    const auth = await getAuthenticatedClient(cookies);
    if ('error' in auth) return jsonError(auth.error, auth.status);

    const { user } = auth;

    // Usa il service role per eliminare l'utente auth
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[API account/delete] SUPABASE_SERVICE_ROLE_KEY mancante');
      return jsonError('Configurazione server incompleta', 500);
    }

    const adminClient = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      serviceRoleKey
    );

    // 1. Elimina i soci registrati dall'utente
    //    (le associazioni prenotazioni_soci vengono eliminate via ON DELETE CASCADE sulla FK)
    await adminClient
      .from('soci')
      .delete()
      .eq('registrato_da', user.id);

    // 2. Elimina le prenotazioni create dall'utente
    await adminClient
      .from('prenotazioni')
      .delete()
      .eq('creata_da', user.id);

    // 3. Elimina il profilo (ha ON DELETE CASCADE su auth.users, ma lo facciamo esplicitamente)
    await adminClient
      .from('profili')
      .delete()
      .eq('id', user.id);

    // 4. Elimina l'utente auth (questo elimina anche il profilo via CASCADE)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[API account/delete] Errore eliminazione utente:', deleteError.message);
      return jsonError('Errore nell\'eliminazione dell\'account', 500);
    }

    // 5. Pulisci i cookie di sessione
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });

    return jsonOk({ success: true, message: 'Account eliminato con successo' });
  } catch {
    return jsonError('Errore nell\'eliminazione dell\'account', 500);
  }
};
