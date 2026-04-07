import { describe, expect, it } from 'vitest';
import { validateMemberRequired, validateMemberFieldLengths } from '../../src/lib/member-validation';

describe('validateMemberRequired', () => {
  it('accetta tutti e tre i campi presenti', () => {
    const r = validateMemberRequired('Mario', 'Rossi', 'mario@example.com');
    expect(r.ok).toBe(true);
  });

  it('rifiuta nome mancante', () => {
    const r = validateMemberRequired(null, 'Rossi', 'mario@example.com');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();
  });

  it('rifiuta cognome mancante', () => {
    const r = validateMemberRequired('Mario', '', 'mario@example.com');
    expect(r.ok).toBe(false);
  });

  it('rifiuta email mancante', () => {
    const r = validateMemberRequired('Mario', 'Rossi', undefined);
    expect(r.ok).toBe(false);
  });
});

describe('validateMemberFieldLengths', () => {
  it('accetta dati validi', () => {
    const r = validateMemberFieldLengths({
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario@example.com',
      telefono: '3331234567',
      codice_fiscale: 'RSSMRA80A01H501Z',
    });
    expect(r.ok).toBe(true);
  });

  it('rifiuta nome > 100 caratteri', () => {
    const r = validateMemberFieldLengths({ nome: 'a'.repeat(101) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('nome');
  });

  it('rifiuta cognome > 100 caratteri', () => {
    const r = validateMemberFieldLengths({ cognome: 'b'.repeat(101) });
    expect(r.ok).toBe(false);
  });

  it('rifiuta email > 254 caratteri', () => {
    const r = validateMemberFieldLengths({ email: 'a'.repeat(250) + '@x.it' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('email');
  });

  it('rifiuta codice_fiscale > 16 caratteri', () => {
    const r = validateMemberFieldLengths({ codice_fiscale: 'A'.repeat(17) });
    expect(r.ok).toBe(false);
  });

  it('rifiuta numero_documento > 50 caratteri', () => {
    const r = validateMemberFieldLengths({ numero_documento: 'X'.repeat(51) });
    expect(r.ok).toBe(false);
  });

  it('ignora campi null o undefined', () => {
    const r = validateMemberFieldLengths({ telefono: null, luogo_nascita: undefined });
    expect(r.ok).toBe(true);
  });

  it('accetta esattamente al limite (codice_fiscale = 16)', () => {
    const r = validateMemberFieldLengths({ codice_fiscale: 'A'.repeat(16) });
    expect(r.ok).toBe(true);
  });
});
