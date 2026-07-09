import { describe, it, expect } from 'vitest';
import { setAuthCookies, clearAuthCookies } from '../../src/lib/auth';
import type { AstroCookies } from 'astro';

/** Fake AstroCookies che registra le chiamate a set/delete */
function createFakeCookies() {
  const setCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const deleteCalls: Array<{ name: string; options: Record<string, unknown> }> = [];
  const cookies = {
    set: (name: string, value: string, options: Record<string, unknown>) => {
      setCalls.push({ name, value, options });
    },
    delete: (name: string, options: Record<string, unknown>) => {
      deleteCalls.push({ name, options });
    },
  } as unknown as AstroCookies;
  return { cookies, setCalls, deleteCalls };
}

const session = { access_token: 'access-abc', refresh_token: 'refresh-xyz' };

describe('setAuthCookies', () => {
  it('imposta entrambi i cookie con i valori della sessione', () => {
    const { cookies, setCalls } = createFakeCookies();
    setAuthCookies(cookies, session);

    expect(setCalls).toHaveLength(2);
    expect(setCalls[0]).toMatchObject({ name: 'sb-access-token', value: 'access-abc' });
    expect(setCalls[1]).toMatchObject({ name: 'sb-refresh-token', value: 'refresh-xyz' });
  });

  it('applica gli attributi di sicurezza a entrambi i cookie', () => {
    const { cookies, setCalls } = createFakeCookies();
    setAuthCookies(cookies, session);

    for (const call of setCalls) {
      expect(call.options).toMatchObject({
        path: '/',
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
      });
    }
  });

  it('imposta maxAge 1h per access token e 7gg per refresh token', () => {
    const { cookies, setCalls } = createFakeCookies();
    setAuthCookies(cookies, session);

    expect(setCalls[0].options.maxAge).toBe(3600);
    expect(setCalls[1].options.maxAge).toBe(604800);
  });
});

describe('clearAuthCookies', () => {
  it('cancella entrambi i cookie con path /', () => {
    const { cookies, deleteCalls } = createFakeCookies();
    clearAuthCookies(cookies);

    expect(deleteCalls).toHaveLength(2);
    expect(deleteCalls[0]).toEqual({ name: 'sb-access-token', options: { path: '/' } });
    expect(deleteCalls[1]).toEqual({ name: 'sb-refresh-token', options: { path: '/' } });
  });
});
