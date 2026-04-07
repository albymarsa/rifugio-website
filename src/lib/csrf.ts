/**
 * Verifica CSRF: l'header Origin deve essere presente e il suo host
 * deve corrispondere all'header Host della richiesta.
 *
 * Estratto da src/pages/api/prenotazioni.ts (commit 0cbb214) per essere
 * testabile in isolamento.
 */
export function checkCsrf(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
