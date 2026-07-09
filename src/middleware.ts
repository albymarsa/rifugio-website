import { defineMiddleware } from 'astro:middleware';
import { getAuthenticatedClient, setAuthCookies, clearAuthCookies } from './lib/auth';

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

  // Verifica la sessione dai cookie e crea il client autenticato
  const auth = await getAuthenticatedClient(context.cookies);

  if ('error' in auth) {
    clearAuthCookies(context.cookies);
    return context.redirect('/soci/login');
  }

  const { supabase, user, session } = auth;

  // Aggiorna i cookie se il token è stato rinnovato
  if (session) {
    setAuthCookies(context.cookies, session);
  }

  // Rendi utente e client autenticato disponibili alle pagine
  context.locals.user = user;
  context.locals.supabase = supabase;

  // Verifica che l'utente abbia un profilo completo (escluse API e pagina prenota)
  if (pathname.startsWith('/soci') && !pathname.startsWith('/soci/registrazione')) {
    const { data: profilo } = await supabase
      .from('profili')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profilo) {
      return context.redirect('/soci/registrazione?completa=1');
    }
  }

  // Per le pagine admin, verifica che l'utente sia un fondatore
  if (pathname === '/soci/admin' || pathname === '/soci/admin/' ||
      pathname === '/soci/prenotazioni' || pathname === '/soci/prenotazioni/') {
    const { data: socioData } = await supabase
      .from('soci')
      .select('tipo_socio')
      .eq('email', user.email)
      .eq('tipo_socio', 'fondatore')
      .single();

    if (!socioData) {
      return context.redirect('/soci/');
    }

    context.locals.isFounder = true;
  }

  return next();
});
