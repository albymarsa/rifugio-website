import { describe, expect, it } from 'vitest';
import { validateBookingDates } from '../../src/lib/booking';

describe('validateBookingDates', () => {
  it('rejects missing fields', () => {
    expect(validateBookingDates(undefined, '2026-05-10').ok).toBe(false);
    expect(validateBookingDates('2026-05-10', undefined).ok).toBe(false);
  });

  it('rejects non-string fields', () => {
    expect(validateBookingDates(123 as unknown, '2026-05-10').ok).toBe(false);
  });

  it('rejects departure equal to arrival', () => {
    const r = validateBookingDates('2026-05-10', '2026-05-10');
    expect(r.ok).toBe(false);
  });

  it('rejects departure before arrival', () => {
    const r = validateBookingDates('2026-05-12', '2026-05-10');
    expect(r.ok).toBe(false);
  });

  it('rejects invalid date strings', () => {
    expect(validateBookingDates('not-a-date', '2026-05-10').ok).toBe(false);
    expect(validateBookingDates('2026-05-10', 'nope').ok).toBe(false);
  });

  it('rejects notes longer than 2000 chars', () => {
    const longNote = 'a'.repeat(2001);
    const r = validateBookingDates('2026-05-10', '2026-05-12', longNote);
    expect(r.ok).toBe(false);
  });

  it('accepts notes exactly 2000 chars', () => {
    const note = 'a'.repeat(2000);
    expect(validateBookingDates('2026-05-10', '2026-05-12', note).ok).toBe(true);
  });

  it('accepts a valid range', () => {
    expect(validateBookingDates('2026-05-10', '2026-05-12').ok).toBe(true);
  });

  it('accepts a valid range with no note', () => {
    expect(validateBookingDates('2026-05-10', '2026-05-11', null).ok).toBe(true);
  });
});
