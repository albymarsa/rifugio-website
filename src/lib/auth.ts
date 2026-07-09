import type { AstroCookies } from 'astro';
import type { Session } from '@supabase/supabase-js';
import { createAnonClient } from './supabase';

const ACCESS_TOKEN_COOKIE = 'sb-access-token';
const REFRESH_TOKEN_COOKIE = 'sb-refresh-token';

const COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax',
  secure: true,
  httpOnly: true,
} as const;

const ACCESS_TOKEN_MAX_AGE = 3600;      // 1 ora
const REFRESH_TOKEN_MAX_AGE = 604800;   // 7 giorni

/**
 * Crea un client Supabase autenticato a partire dai cookie della request.
 * Ritorna { supabase, user, session } o { error, status }.
 */
export async function getAuthenticatedClient(cookies: AstroCookies) {
  const accessToken = cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken || !refreshToken) {
    return { error: 'Non autenticato', status: 401 } as const;
  }

  const supabase = createAnonClient();

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.user) {
    return { error: 'Sessione non valida', status: 401 } as const;
  }

  return { supabase, user: data.user, session: data.session } as const;
}

/** Imposta i cookie di sessione (access 1h, refresh 7gg, httpOnly/secure/lax). */
export function setAuthCookies(
  cookies: AstroCookies,
  session: Pick<Session, 'access_token' | 'refresh_token'>
) {
  cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/** Cancella i cookie di sessione. */
export function clearAuthCookies(cookies: AstroCookies) {
  cookies.delete(ACCESS_TOKEN_COOKIE, { path: '/' });
  cookies.delete(REFRESH_TOKEN_COOKIE, { path: '/' });
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
