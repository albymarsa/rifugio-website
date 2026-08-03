/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  // Supabase
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

/**
 * Notifiche email via Resend. Dichiarate qui e NON in ImportMetaEnv di proposito:
 * `src/lib/email.ts` le legge solo da `process.env`, perché Vite sostituirebbe
 * `import.meta.env.NOME` staticamente e il segreto finirebbe nel bundle.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly RESEND_API_KEY?: string;
    /** Lista di indirizzi separati da virgola. */
    readonly BOOKING_NOTIFY_TO?: string;
    readonly BOOKING_NOTIFY_FROM?: string;
    /** '1' attiva il dry-run, solo in sviluppo. */
    readonly EMAIL_DRY_RUN?: string;
  }
}

declare namespace App {
  interface Locals {
    user?: import('@supabase/supabase-js').User;
    /** Client Supabase autenticato, impostato dal middleware sulle rotte protette */
    supabase?: import('@supabase/supabase-js').SupabaseClient;
    isFounder?: boolean;
  }
}
