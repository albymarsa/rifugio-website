import { createClient } from '@supabase/supabase-js';

/**
 * Factory centralizzate per i client Supabase: unico punto del codice
 * che legge le variabili d'ambiente e chiama createClient.
 */

/** Client anonimo (chiave pubblica). Creare un'istanza per richiesta, mai condividerla. */
export function createAnonClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Client service-role (solo server-side, bypassa RLS). */
export function createServiceClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
