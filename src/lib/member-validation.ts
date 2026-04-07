import type { ValidationResult } from './booking';

const MAX_LENGTHS: Record<string, number> = {
  nome: 100,
  cognome: 100,
  email: 254,
  telefono: 20,
  luogo_nascita: 100,
  codice_fiscale: 16,
  indirizzo_residenza: 200,
  numero_documento: 50,
};

export function validateMemberRequired(
  nome: unknown,
  cognome: unknown,
  email: unknown
): ValidationResult {
  if (!nome || !cognome || !email) {
    return { ok: false, error: 'Nome, cognome e email sono obbligatori' };
  }
  return { ok: true };
}

export function validateMemberFieldLengths(
  data: Record<string, unknown>
): ValidationResult {
  for (const [field, max] of Object.entries(MAX_LENGTHS)) {
    const val = data[field];
    if (val && typeof val === 'string' && val.length > max) {
      return { ok: false, error: `Campo ${field} troppo lungo (max ${max} caratteri)` };
    }
  }
  return { ok: true };
}
