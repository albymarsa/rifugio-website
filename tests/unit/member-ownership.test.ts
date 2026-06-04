import { describe, expect, it } from 'vitest';
import { canEditMember } from '../../src/lib/member-ownership';

const userId = 'user-123';

describe('canEditMember', () => {
  it('autorizza il referente che ha registrato un socio ordinario', () => {
    const r = canEditMember({ registrato_da: userId, tipo_socio: 'ordinario' }, userId);
    expect(r.ok).toBe(true);
  });

  it('rifiuta se il socio è stato registrato da un altro utente', () => {
    const r = canEditMember({ registrato_da: 'altro-utente', tipo_socio: 'ordinario' }, userId);
    expect(r.ok).toBe(false);
  });

  it('rifiuta la modifica di un fondatore anche se proprietario', () => {
    const r = canEditMember({ registrato_da: userId, tipo_socio: 'fondatore' }, userId);
    expect(r.ok).toBe(false);
  });

  it('rifiuta se registrato_da è null', () => {
    const r = canEditMember({ registrato_da: null, tipo_socio: 'ordinario' }, userId);
    expect(r.ok).toBe(false);
  });

  it('rifiuta se userId è mancante (nessun bypass)', () => {
    const r = canEditMember({ registrato_da: userId, tipo_socio: 'ordinario' }, '');
    expect(r.ok).toBe(false);
  });

  it('rifiuta se userId è undefined', () => {
    const r = canEditMember({ registrato_da: userId, tipo_socio: 'ordinario' }, undefined);
    expect(r.ok).toBe(false);
  });
});
