import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

/**
 * Crea un client Supabase autenticato a partire dai cookie della request.
 * Ritorna { supabase, user } o { error, status }.
 */
export async function getAuthenticatedClient(cookies: AstroCookies) {
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  if (!accessToken || !refreshToken) {
    return { error: 'Non autenticato', status: 401 } as const;
  }

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.user) {
    return { error: 'Sessione non valida', status: 401 } as const;
  }

  return { supabase, user: data.user } as const;
}

/** Risposta JSON di errore */
export function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Risposta JSON di successo */
export function jsonOk(data: Record<string, unknown> = { success: true }) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
