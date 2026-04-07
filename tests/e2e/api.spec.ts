import { expect, test } from '@playwright/test';

test.describe('/api/disponibilita', () => {
  test('returns occupancy map for current month', async ({ request }) => {
    const now = new Date();
    const res = await request.get(`/api/disponibilita?anno=${now.getFullYear()}&mese=${now.getMonth() + 1}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('occupazione');
    expect(body).toHaveProperty('capacita', 25);
    expect(typeof body.occupazione).toBe('object');
  });

  test('rejects missing parameters', async ({ request }) => {
    const res = await request.get('/api/disponibilita');
    expect(res.status()).toBe(400);
  });

  test('rejects out-of-range year', async ({ request }) => {
    const res = await request.get('/api/disponibilita?anno=1999&mese=1');
    expect(res.status()).toBe(400);
  });

  test('rejects invalid month', async ({ request }) => {
    const res = await request.get('/api/disponibilita?anno=2026&mese=13');
    expect(res.status()).toBe(400);
  });
});

test.describe('/api/prenotazioni CSRF & auth', () => {
  test('rejects request without origin header (CSRF)', async ({ request, baseURL }) => {
    const res = await request.post('/api/prenotazioni', {
      data: { data_arrivo: '2099-01-01', data_partenza: '2099-01-02' },
      headers: { host: new URL(baseURL!).host },
    });
    expect(res.status()).toBe(403);
  });

  test('rejects request with mismatched origin (CSRF)', async ({ request }) => {
    const res = await request.post('/api/prenotazioni', {
      data: { data_arrivo: '2099-01-01', data_partenza: '2099-01-02' },
      headers: { origin: 'https://attacker.example.com' },
    });
    expect(res.status()).toBe(403);
  });

  test('rejects authenticated-looking request without cookies (401)', async ({ request, baseURL }) => {
    const url = new URL(baseURL!);
    const res = await request.post('/api/prenotazioni', {
      data: { data_arrivo: '2099-01-01', data_partenza: '2099-01-02' },
      headers: { origin: url.origin },
    });
    // CSRF passes (origin matches), auth check fails
    expect(res.status()).toBe(401);
  });
});
