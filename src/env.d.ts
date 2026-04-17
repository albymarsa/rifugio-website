/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  // Supabase
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  // SMTP (server-only)
  readonly SMTP_HOST: string;
  readonly SMTP_PORT: string;
  readonly SMTP_USER: string;
  readonly SMTP_PASS: string;
  readonly BOOKING_NOTIFY_TO: string;
  readonly EMAIL_DRY_RUN: string | undefined;
}

declare namespace App {
  interface Locals {
    user?: import('@supabase/supabase-js').User;
    isFounder?: boolean;
  }
}
