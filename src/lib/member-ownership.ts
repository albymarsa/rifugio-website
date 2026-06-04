import type { ValidationResult } from './booking';

/**
 * Verifica se un utente può modificare un dato socio.
 * Autorizzato solo il referente che lo ha registrato (`registrato_da === userId`)
 * e mai per i soci fondatori. La verifica di esistenza del socio (404) resta a
 * carico del chiamante: qui si assume `target` già caricato dal DB.
 */
export function canEditMember(
  target: { registrato_da: string | null; tipo_socio: string | null },
  userId: string | null | undefined
): ValidationResult {
  if (!userId) {
    return { ok: false, error: 'Non autorizzato' };
  }
  if (target.tipo_socio === 'fondatore') {
    return { ok: false, error: 'Non è possibile modificare un socio fondatore' };
  }
  if (!target.registrato_da || target.registrato_da !== userId) {
    return { ok: false, error: 'Non autorizzato' };
  }
  return { ok: true };
}
