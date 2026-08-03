import { describe, expect, it } from 'vitest';
import { isClosedDate, validateBookingDates } from '../../src/lib/booking';

describe('validateBookingDates', () => {
  it('rejects missing fields', () => {
    expect(validateBookingDates(undefined, '2026-07-10').ok).toBe(false);
    expect(validateBookingDates('2026-07-10', undefined).ok).toBe(false);
  });

  it('rejects non-string fields', () => {
    expect(validateBookingDates(123 as unknown, '2026-07-10').ok).toBe(false);
  });

  it('rejects departure equal to arrival', () => {
    const r = validateBookingDates('2026-07-10', '2026-07-10');
    expect(r.ok).toBe(false);
  });

  it('rejects departure before arrival', () => {
    const r = validateBookingDates('2026-07-12', '2026-07-10');
    expect(r.ok).toBe(false);
  });

  it('rejects invalid date strings', () => {
    expect(validateBookingDates('not-a-date', '2026-07-10').ok).toBe(false);
    expect(validateBookingDates('2026-07-10', 'nope').ok).toBe(false);
  });

  it('rejects notes longer than 2000 chars', () => {
    const longNote = 'a'.repeat(2001);
    const r = validateBookingDates('2026-07-10', '2026-07-12', longNote);
    expect(r.ok).toBe(false);
  });

  it('accepts notes exactly 2000 chars', () => {
    const note = 'a'.repeat(2000);
    expect(validateBookingDates('2026-07-10', '2026-07-12', note).ok).toBe(true);
  });

  it('accepts a valid range', () => {
    expect(validateBookingDates('2026-07-10', '2026-07-12').ok).toBe(true);
  });

  it('accepts a valid range with no note', () => {
    expect(validateBookingDates('2026-07-10', '2026-07-11', null).ok).toBe(true);
  });

  it('rejects dates in the closed season (28 Sep-May)', () => {
    expect(validateBookingDates('2026-12-20', '2026-12-22').ok).toBe(false);
    expect(validateBookingDates('2026-03-10', '2026-03-12').ok).toBe(false);
    expect(validateBookingDates('2026-05-30', '2026-06-02').ok).toBe(false);
    expect(validateBookingDates('2026-09-28', '2026-09-30').ok).toBe(false);
    expect(validateBookingDates('2026-10-05', '2026-10-08').ok).toBe(false);
  });

  it('accepts a check-out on September 28 (last night Sep 27 still open)', () => {
    expect(validateBookingDates('2026-09-26', '2026-09-28').ok).toBe(true);
  });
});

describe('isClosedDate', () => {
  it('marks 28 September-May as closed', () => {
    expect(isClosedDate('2026-01-15')).toBe(true);
    expect(isClosedDate('2026-05-31')).toBe(true);
    expect(isClosedDate('2026-09-28')).toBe(true);
    expect(isClosedDate('2026-10-15')).toBe(true);
    expect(isClosedDate('2026-11-01')).toBe(true);
    expect(isClosedDate('2026-12-25')).toBe(true);
  });
  it('marks June-27 September as open', () => {
    expect(isClosedDate('2026-06-01')).toBe(false);
    expect(isClosedDate('2026-08-15')).toBe(false);
    expect(isClosedDate('2026-09-27')).toBe(false);
  });
});
