import nodemailer from 'nodemailer';

export interface BookingEmailPayload {
  richiedente_nome: string;
  richiedente_email: string;
  richiedente_telefono: string | null;
  data_arrivo: string;     // YYYY-MM-DD
  data_partenza: string;   // YYYY-MM-DD
  note: string | null;
}

export interface EmailResult {
  ok: boolean;
  error?: string;
  errorCode?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invia notifica email ai gestori quando una nuova prenotazione viene creata.
 * Non lancia mai: in caso di errore ritorna { ok: false } e logga su console.
 */
export async function sendBookingNotification(
  payload: BookingEmailPayload
): Promise<EmailResult> {
  try {
    // Dry-run: utile in dev e per test E2E senza credenziali SMTP reali
    if (import.meta.env.EMAIL_DRY_RUN === '1') {
      console.log('[EMAIL dry-run] Notifica prenotazione:\n' + formatEmailBody(payload));
      return { ok: true };
    }

    const smtpHost = import.meta.env.SMTP_HOST;
    const smtpPort = Number(import.meta.env.SMTP_PORT ?? '465');
    const smtpUser = import.meta.env.SMTP_USER;
    const smtpPass = import.meta.env.SMTP_PASS;
    const notifyTo = import.meta.env.BOOKING_NOTIFY_TO ?? 'amicidelveglia@gmail.com';

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('[EMAIL] Variabili SMTP mancanti (SMTP_HOST, SMTP_USER, SMTP_PASS). Notifica non inviata.');
      return { ok: false, error: 'smtp_not_configured', errorCode: 'MISSING_ENV' };
    }

    // Diagnostica temporanea: verifica lunghezze per individuare whitespace invisibile
    console.log('[EMAIL DEBUG] host=%s port=%d user.len=%d pass.len=%d', smtpHost, smtpPort, smtpUser.length, smtpPass.length);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });

    const replyTo = EMAIL_REGEX.test(payload.richiedente_email)
      ? payload.richiedente_email
      : undefined;

    await transporter.sendMail({
      from: `"Rifugio Amici del Veglia" <${smtpUser}>`,
      to: notifyTo,
      replyTo,
      subject: `Nuova richiesta di prenotazione: ${payload.richiedente_nome} (${payload.data_arrivo} → ${payload.data_partenza})`,
      text: formatEmailBody(payload),
    });

    return { ok: true };
  } catch (err) {
    const errorCode = (err as { code?: string })?.code ?? 'UNKNOWN';
    // Diagnostica temporanea: logga il messaggio completo di Aruba per capire la causa di EAUTH
    const errorMsg = (err as { message?: string })?.message ?? String(err);
    const errorResponse = (err as { response?: string })?.response ?? '';
    console.error('[EMAIL DEBUG] code=%s msg=%s response=%s', errorCode, errorMsg, errorResponse);
    return { ok: false, error: 'smtp_error', errorCode };
  }
}

function formatEmailBody(payload: BookingEmailPayload): string {
  return `È stata ricevuta una nuova richiesta di prenotazione sul sito Rifugio Rosmini.

Richiedente: ${payload.richiedente_nome}
Email:       ${payload.richiedente_email}
Telefono:    ${payload.richiedente_telefono ?? 'non fornito'}

Date soggiorno:
  Arrivo:   ${payload.data_arrivo}
  Partenza: ${payload.data_partenza}

Note:
${payload.note ?? '(nessuna nota)'}

Stato iniziale: da_confermare
Accedi all'area gestione per confermare o rifiutare la richiesta.
`;
}
