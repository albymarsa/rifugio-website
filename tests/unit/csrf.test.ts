import { describe, expect, it } from 'vitest';
import { checkCsrf } from '../../src/lib/csrf';

function makeRequest(headers: Record<string, string>): Request {
  return new Request('https://example.com/api/prenotazioni', {
    method: 'POST',
    headers,
  });
}

describe('checkCsrf', () => {
  it('rejects when origin is missing', () => {
    expect(checkCsrf(makeRequest({ host: 'rifugio.it' }))).toBe(false);
  });

  it('rejects when host is missing', () => {
    // Note: fetch API does not let us strip Host header from a Request, so we
    // pass a fake one with a stub. Use a manual object that mimics Request.
    const req = {
      headers: new Headers({ origin: 'https://rifugio.it' }),
    } as unknown as Request;
    // remove host explicitly
    (req.headers as Headers).delete('host');
    expect(checkCsrf(req)).toBe(false);
  });

  it('rejects when origin host differs from request host', () => {
    expect(
      checkCsrf(makeRequest({ origin: 'https://attacker.com', host: 'rifugio.it' }))
    ).toBe(false);
  });

  it('rejects malformed origin', () => {
    expect(checkCsrf(makeRequest({ origin: 'not-a-url', host: 'rifugio.it' }))).toBe(false);
  });

  it('accepts when origin host matches request host', () => {
    expect(
      checkCsrf(makeRequest({ origin: 'https://rifugio.it', host: 'rifugio.it' }))
    ).toBe(true);
  });

  it('rejects when ports differ', () => {
    expect(
      checkCsrf(makeRequest({ origin: 'https://rifugio.it:8080', host: 'rifugio.it' }))
    ).toBe(false);
  });
});
