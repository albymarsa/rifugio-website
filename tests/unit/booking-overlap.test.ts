import { describe, expect, it } from 'vitest';
import { findOverlap } from '../../src/lib/booking';

const existing = [
  { data_arrivo: '2026-06-10', data_partenza: '2026-06-15' },
];

describe('findOverlap', () => {
  it('returns null with no existing bookings', () => {
    expect(findOverlap([], '2026-06-10', '2026-06-12')).toBeNull();
  });

  it('detects identical range as overlap', () => {
    expect(findOverlap(existing, '2026-06-10', '2026-06-15')).not.toBeNull();
  });

  it('detects fully contained range as overlap', () => {
    expect(findOverlap(existing, '2026-06-11', '2026-06-13')).not.toBeNull();
  });

  it('detects range that wraps existing as overlap', () => {
    expect(findOverlap(existing, '2026-06-08', '2026-06-20')).not.toBeNull();
  });

  it('detects partial overlap on left', () => {
    expect(findOverlap(existing, '2026-06-08', '2026-06-12')).not.toBeNull();
  });

  it('detects partial overlap on right', () => {
    expect(findOverlap(existing, '2026-06-13', '2026-06-18')).not.toBeNull();
  });

  it('treats checkout day as exclusive: new arrival on existing departure is OK', () => {
    expect(findOverlap(existing, '2026-06-15', '2026-06-18')).toBeNull();
  });

  it('treats checkout day as exclusive: new departure on existing arrival is OK', () => {
    expect(findOverlap(existing, '2026-06-05', '2026-06-10')).toBeNull();
  });

  it('returns null when ranges do not touch', () => {
    expect(findOverlap(existing, '2026-07-01', '2026-07-05')).toBeNull();
  });
});
