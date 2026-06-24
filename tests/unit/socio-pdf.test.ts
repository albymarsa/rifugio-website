import { describe, expect, it } from 'vitest';
import {
  buildSocioFields,
  buildSocioTitle,
  formatDateIt,
  formatDateTimeIt,
  type SocioRecord,
} from '../../src/lib/socio-pdf';

const fullSocio: SocioRecord = {
  numero_socio: 12,
  nome: 'Mario',
  cognome: 'Rossi',
  email: 'mario@example.com',
  telefono: '3331234567',
  data_nascita: '1980-01-15',
  luogo_nascita: 'Milano',
  codice_fiscale: 'RSSMRA80A15F205X',
  indirizzo_residenza: 'Via Roma 1, Milano',
  tipo_documento: 'carta_identita',
  numero_documento: 'AB1234567',
  tipo_socio: 'ordinario',
  statuto_accettato_il: '2026-06-24T10:30:00.000Z',
  regolamento_accettato_il: '2026-06-24T10:30:00.000Z',
  created_at: '2026-06-24T10:30:00.000Z',
};

describe('formatDateIt', () => {
  it('formatta una data valida in gg/mm/aaaa', () => {
    expect(formatDateIt('1980-01-15')).toBe('15/01/1980');
  });

  it('placeholder per data assente o non valida', () => {
    expect(formatDateIt(null)).toBe('—');
    expect(formatDateIt(undefined)).toBe('—');
    expect(formatDateIt('non-una-data')).toBe('—');
  });
});

describe('formatDateTimeIt', () => {
  it('include ora e minuti per una data valida', () => {
    const r = formatDateTimeIt('2026-06-24T10:30:00.000Z');
    expect(r).toMatch(/24\/06\/2026/);
    expect(r).toMatch(/\d{2}:\d{2}/);
  });

  it('placeholder per valore assente', () => {
    expect(formatDateTimeIt(null)).toBe('—');
  });
});

describe('buildSocioTitle', () => {
  it('include numero socio e cognome nome', () => {
    expect(buildSocioTitle(fullSocio)).toBe('N. 12 — Rossi Mario');
  });

  it('omette il numero se assente', () => {
    expect(buildSocioTitle({ ...fullSocio, numero_socio: null })).toBe('Rossi Mario');
  });

  it('placeholder se manca del tutto il nome', () => {
    expect(buildSocioTitle({ numero_socio: 5 })).toBe('N. 5 — —');
  });
});

describe('buildSocioFields', () => {
  it('restituisce le righe in ordine fisso', () => {
    const labels = buildSocioFields(fullSocio).map((f) => f.label);
    expect(labels).toEqual([
      'Email',
      'Telefono',
      'Codice fiscale',
      'Nascita',
      'Residenza',
      'Documento',
      'Tipo socio',
      'Accett. statuto',
      'Accett. regolamento',
      'Iscritto il',
    ]);
  });

  it('mappa i valori del socio completo', () => {
    const fields = buildSocioFields(fullSocio);
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f.value]));
    expect(byLabel['Email']).toBe('mario@example.com');
    expect(byLabel['Codice fiscale']).toBe('RSSMRA80A15F205X');
    expect(byLabel['Nascita']).toBe('15/01/1980 — Milano');
    expect(byLabel['Documento']).toBe("Carta d'identita n. AB1234567");
    expect(byLabel['Tipo socio']).toBe('Ordinario');
  });

  it('usa placeholder per i campi vuoti', () => {
    const minimal: SocioRecord = { numero_socio: 1, nome: 'Ada', cognome: 'Bianchi' };
    const byLabel = Object.fromEntries(buildSocioFields(minimal).map((f) => [f.label, f.value]));
    expect(byLabel['Email']).toBe('—');
    expect(byLabel['Codice fiscale']).toBe('—');
    expect(byLabel['Residenza']).toBe('—');
    expect(byLabel['Documento']).toBe('—');
    expect(byLabel['Nascita']).toBe('— — —');
    expect(byLabel['Accett. statuto']).toBe('—');
  });

  it('riconosce il socio fondatore', () => {
    const byLabel = Object.fromEntries(
      buildSocioFields({ ...fullSocio, tipo_socio: 'fondatore' }).map((f) => [f.label, f.value])
    );
    expect(byLabel['Tipo socio']).toBe('Fondatore');
  });

  const docByLabel = (s: SocioRecord) =>
    Object.fromEntries(buildSocioFields(s).map((f) => [f.label, f.value]))['Documento'];

  it('mappa patente e passaporto', () => {
    expect(docByLabel({ ...fullSocio, tipo_documento: 'patente' })).toBe('Patente n. AB1234567');
    expect(docByLabel({ ...fullSocio, tipo_documento: 'passaporto' })).toBe('Passaporto n. AB1234567');
  });

  it('usa il valore raw per un tipo documento sconosciuto', () => {
    expect(docByLabel({ ...fullSocio, tipo_documento: 'altro_doc' })).toBe('altro_doc n. AB1234567');
  });

  it('gestisce solo numero documento senza tipo', () => {
    expect(docByLabel({ ...fullSocio, tipo_documento: null })).toBe('— n. AB1234567');
  });

  it('gestisce solo tipo documento senza numero', () => {
    expect(docByLabel({ ...fullSocio, numero_documento: null })).toBe("Carta d'identita");
  });
});
