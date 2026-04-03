import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Pagine che richiedono autenticazione
  const isProtected = pathname.startsWith('/soci') || pathname === '/prenota' || pathname === '/prenota/';

  if (!isProtected) {
    return next();
  }

  // Login, registrazione e reset password sono accessibili a tutti
  if (pathname === '/soci/login' || pathname === '/soci/login/' ||
      pathname === '/soci/registrazione' || pathname === '/soci/registrazione/' ||
      pathname === '/soci/password-dimenticata' || pathname === '/soci/password-dimenticata/' ||
      pathname === '/soci/reset-password' || pathname === '/soci/reset-password/') {
    return next();
  }

  // Logout accessibile a tutti (cancella i cookie)
  if (pathname === '/soci/logout' || pathname === '/soci/logout/') {
    return next();
  }

  // Verifica token di autenticazione nei cookie
  const accessToken = context.cookies.get('sb-access-token')?.value;
  const refreshToken = context.cookies.get('sb-refresh-token')?.value;

  if (!accessToken || !refreshToken) {
    return context.redirect('/soci/login');
  }

  // Crea un client Supabase e verifica la sessione
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.user) {
    context.cookies.delete('sb-access-token', { path: '/' });
    context.cookies.delete('sb-refresh-token', { path: '/' });
    return context.redirect('/soci/login');
  }

  // Aggiorna i cookie se il token è stato rinnovato
  if (data.session) {
    context.cookies.set('sb-access-token', data.session.access_token, {
      path: '/',
      maxAge: 3600,
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    });
    context.cookies.set('sb-refresh-token', data.session.refresh_token, {
      path: '/',
      maxAge: 604800,
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    });
  }

  // Rendi l'utente disponibile alle pagine
  context.locals.user = data.user;

  // Per le pagine admin, verifica che l'utente sia un fondatore
  if (pathname === '/soci/admin' || pathname === '/soci/admin/' ||
      pathname === '/soci/prenotazioni' || pathname === '/soci/prenotazioni/') {
    const { data: socioData } = await supabase
      .from('soci')
      .select('tipo_socio')
      .eq('email', data.user.email)
      .eq('tipo_socio', 'fondatore')
      .single();

    if (!socioData) {
      return context.redirect('/soci/');
    }

    context.locals.isFounder = true;
  }

  return next();
});
