import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatEmailBody,
  parseRecipients,
  sanitizeSubject,
  sendBookingNotification,
  type BookingEmailPayload,
} from '../../src/lib/email';

const payload: BookingEmailPayload = {
  richiedente_nome: 'Mario Rossi',
  richiedente_email: 'mario@example.com',
  data_arrivo: '2026-08-10',
  data_partenza: '2026-08-14',
};

describe('formatEmailBody', () => {
  it('includes requester name and stay dates', () => {
    const body = formatEmailBody(payload);
    expect(body).toContain('Mario Rossi');
    expect(body).toContain('2026-08-10');
    expect(body).toContain('2026-08-14');
    expect(body).toContain('Stato iniziale: da_confermare');
  });

  it('does not leak contact details (data minimisation)', () => {
    const body = formatEmailBody(payload);
    expect(body).not.toContain('mario@example.com');
  });
});

describe('parseRecipients', () => {
  it('splits a comma-separated list and trims spaces', () => {
    expect(parseRecipients('uno@example.com, due@example.com')).toEqual([
      'uno@example.com',
      'due@example.com',
    ]);
  });

  it('keeps a single address unchanged', () => {
    expect(parseRecipients('solo@example.com')).toEqual(['solo@example.com']);
  });

  it('drops empty entries and malformed addresses', () => {
    expect(parseRecipients('uno@example.com,,  ,non-una-email')).toEqual(['uno@example.com']);
  });

  it('rejects addresses with a display name, which Resend would refuse', () => {
    expect(parseRecipients('Gestori <info@example.com>')).toEqual([]);
  });

  it('returns an empty list when nothing is usable', () => {
    expect(parseRecipients('   ')).toEqual([]);
  });
});

describe('sanitizeSubject', () => {
  it('strips newlines that could forge extra headers', () => {
    expect(sanitizeSubject('Mario\r\nBcc: altro@example.com')).toBe(
      'Mario Bcc: altro@example.com'
    );
  });

  it('truncates overly long names', () => {
    expect(sanitizeSubject('a'.repeat(200)).length).toBe(80);
  });
});

describe('sendBookingNotification', () => {
  const okResponse = () =>
    new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 });

  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('BOOKING_NOTIFY_FROM', 'mittente@example.com');
    vi.stubEnv('BOOKING_NOTIFY_TO', 'gestori@example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the payload Resend expects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendBookingNotification(payload);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');

    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['gestori@example.com']);
    expect(body.from).toBe('Rifugio Amici del Veglia <mittente@example.com>');
    // snake_case: la REST API di Resend ignorerebbe silenziosamente `replyTo`
    expect(body.reply_to).toBe('mario@example.com');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('omits reply_to when the requester email is malformed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await sendBookingNotification({ ...payload, richiedente_email: 'non-una-email' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_to).toBeUndefined();
  });

  it('reports the HTTP status when Resend refuses the send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: 'validation_error' }), { status: 422 })
      )
    );

    const result = await sendBookingNotification(payload);
    expect(result).toMatchObject({ ok: false, errorCode: 'HTTP_422' });
  });

  it('never throws when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(sendBookingNotification(payload)).resolves.toMatchObject({ ok: false });
  });

  it('never throws when the request times out', async () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));

    const result = await sendBookingNotification(payload);
    expect(result).toMatchObject({ ok: false, errorCode: 'TimeoutError' });
  });

  it('does not call Resend when the API key is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendBookingNotification(payload);
    expect(result).toMatchObject({ ok: false, errorCode: 'MISSING_ENV' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call Resend when the sender is missing', async () => {
    vi.stubEnv('BOOKING_NOTIFY_FROM', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendBookingNotification(payload);
    expect(result).toMatchObject({ ok: false, errorCode: 'MISSING_ENV' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call Resend when no recipient is valid', async () => {
    vi.stubEnv('BOOKING_NOTIFY_TO', 'non-una-email');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendBookingNotification(payload);
    expect(result).toMatchObject({ ok: false, errorCode: 'NO_RECIPIENTS' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
