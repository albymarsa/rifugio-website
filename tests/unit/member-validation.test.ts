import { describe, expect, it } from 'vitest';
import { validateMemberRequired, validateMemberFieldFormat, validateMemberFieldLengths, validateMemberDocument, validateConsents, TIPI_DOCUMENTO } from '../../src/lib/member-validation';

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

  it('rifiuta campi di soli spazi, che a video sembrano compilati', () => {
    expect(validateMemberRequired('   ', 'Rossi', 'mario@example.com').ok).toBe(false);
    expect(validateMemberRequired('Mario', '\t', 'mario@example.com').ok).toBe(false);
  });
});

describe('validateMemberFieldFormat', () => {
  it('accetta dati validi', () => {
    const r = validateMemberFieldFormat({
      nome: 'Maria Grazia',
      cognome: "D'Angelo",
      email: 'maria@example.com',
      telefono: '+39 333 1234567',
    });
    expect(r.ok).toBe(true);
  });

  it('rifiuta un valore non stringa (oggetto)', () => {
    const r = validateMemberFieldFormat({ nome: { toString: () => 'Mario' }, cognome: 'Rossi' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('nome');
  });

  it('rifiuta un valore numerico', () => {
    const r = validateMemberFieldFormat({ telefono: 3331234567 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('telefono');
  });

  it('rifiuta un array', () => {
    const r = validateMemberFieldFormat({ cognome: ['Rossi', 'Bianchi'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('cognome');
  });

  it('rifiuta a capo nel valore', () => {
    const r = validateMemberFieldFormat({ nome: 'Mario\nBcc: altro@example.com' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('nome');
  });

  it('rifiuta ritorno a capo, tabulazione e caratteri di controllo', () => {
    expect(validateMemberFieldFormat({ cognome: 'Rossi\rX' }).ok).toBe(false);
    expect(validateMemberFieldFormat({ cognome: 'Rossi\tX' }).ok).toBe(false);
    expect(validateMemberFieldFormat({ cognome: 'Rossi\u0000X' }).ok).toBe(false);
    expect(validateMemberFieldFormat({ cognome: 'Rossi\u007FX' }).ok).toBe(false);
  });

  it('ignora campi null, undefined o stringa vuota', () => {
    const r = validateMemberFieldFormat({ telefono: null, luogo_nascita: undefined, nome: '' });
    expect(r.ok).toBe(true);
  });

  it('rifiuta separatori di riga Unicode, che spezzano la cella in Excel', () => {
    expect(validateMemberFieldFormat({ nome: 'Mario\u2028Rossi' }).ok).toBe(false);
    expect(validateMemberFieldFormat({ nome: 'Mario\u2029Rossi' }).ok).toBe(false);
    expect(validateMemberFieldFormat({ nome: 'Mario\u0085Rossi' }).ok).toBe(false);
  });

  it('rifiuta caratteri a larghezza zero, che creerebbero due schede identiche a vedersi', () => {
    expect(validateMemberFieldFormat({ email: 'mario@example.com\u200B' }).ok).toBe(false);
    expect(validateMemberFieldFormat({ email: 'mario@example.com\uFEFF' }).ok).toBe(false);
  });

  it('rifiuta i controlli di direzione del testo, che mascherano il valore reale', () => {
    expect(validateMemberFieldFormat({ cognome: 'Rossi\u202Eidraig' }).ok).toBe(false);
    expect(validateMemberFieldFormat({ cognome: 'Rossi\u2066X' }).ok).toBe(false);
  });

  it('accetta una data di nascita in formato ISO', () => {
    expect(validateMemberFieldFormat({ data_nascita: '1980-12-31' }).ok).toBe(true);
  });

  it('rifiuta date non ISO e letterali che Postgres accetterebbe come date reali', () => {
    for (const v of ['31/12/1980', 'today', 'infinity', 'now', '1980-13-45']) {
      const r = validateMemberFieldFormat({ data_nascita: v });
      expect(r.ok, `atteso rifiuto per ${v}`).toBe(false);
    }
  });

  it('rifiuta una data non stringa invece di lasciarla fallire a database', () => {
    expect(validateMemberFieldFormat({ data_nascita: { a: 1 } }).ok).toBe(false);
  });

  it('ignora campi non anagrafici', () => {
    const r = validateMemberFieldFormat({ registrato_da: { id: 1 }, nome: 'Mario' });
    expect(r.ok).toBe(true);
  });
});

describe('validateMemberDocument', () => {
  it('accetta i tre tipi di documento ammessi', () => {
    for (const tipo of ['carta_identita', 'patente', 'passaporto']) {
      const r = validateMemberDocument({ tipo_documento: tipo, numero_documento: 'AB1234567' });
      expect(r.ok).toBe(true);
    }
  });

  it('rifiuta tipo documento mancante', () => {
    const r = validateMemberDocument({ numero_documento: 'AB1234567' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('obbligatori');
  });

  it('rifiuta numero documento mancante', () => {
    const r = validateMemberDocument({ tipo_documento: 'patente' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('obbligatori');
  });

  it('rifiuta valori null, come li invia il form quando lasciato vuoto', () => {
    const r = validateMemberDocument({ tipo_documento: null, numero_documento: null });
    expect(r.ok).toBe(false);
  });

  it('rifiuta un numero fatto di soli spazi', () => {
    const r = validateMemberDocument({ tipo_documento: 'patente', numero_documento: '   ' });
    expect(r.ok).toBe(false);
  });

  it('rifiuta un tipo di documento fuori elenco', () => {
    const r = validateMemberDocument({ tipo_documento: 'tessera_sanitaria', numero_documento: 'X1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('non valido');
  });

  it('rifiuta un tipo non stringa', () => {
    const r = validateMemberDocument({ tipo_documento: { v: 'patente' }, numero_documento: 'X1' });
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

describe('validateConsents', () => {
  it('accetta entrambi i consensi true', () => {
    const r = validateConsents(true, true);
    expect(r.ok).toBe(true);
  });

  it('rifiuta regolamento mancante (false)', () => {
    const r = validateConsents(false, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();
  });

  it('rifiuta statuto mancante (false)', () => {
    const r = validateConsents(true, false);
    expect(r.ok).toBe(false);
  });

  it('rifiuta entrambi false', () => {
    const r = validateConsents(false, false);
    expect(r.ok).toBe(false);
  });

  it('rifiuta valori truthy non booleani (uguaglianza stretta)', () => {
    expect(validateConsents('on', 'on').ok).toBe(false);
    expect(validateConsents(1, 1).ok).toBe(false);
  });

  it('rifiuta undefined / null', () => {
    expect(validateConsents(undefined, undefined).ok).toBe(false);
    expect(validateConsents(null, null).ok).toBe(false);
  });
});

describe('TIPI_DOCUMENTO', () => {
  // Duplicato in altri due punti: il CHECK sulla tabella soci (vedi README) e le
  // <option> di src/components/soci/MemberForm.astro. Se cambi qui, cambia anche li'.
  it('elenca esattamente i tre tipi previsti', () => {
    expect(TIPI_DOCUMENTO).toEqual(['carta_identita', 'patente', 'passaporto']);
  });
});
