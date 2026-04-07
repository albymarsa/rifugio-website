import { describe, expect, it } from 'vitest';
import { aggregateOccupancy } from '../../src/lib/booking';

describe('aggregateOccupancy', () => {
  it('returns empty map when no bookings', () => {
    expect(aggregateOccupancy([], 2026, 5)).toEqual({});
  });

  it('saturates every day for a booking covering the whole month', () => {
    const occ = aggregateOccupancy(
      [{ data_arrivo: '2026-05-01', data_partenza: '2026-06-01', num_persone: 25 }],
      2026,
      5
    );
    expect(Object.keys(occ).length).toBe(31);
    expect(occ['2026-05-01']).toBe(25);
    expect(occ['2026-05-31']).toBe(25);
    expect(occ['2026-06-01']).toBeUndefined();
  });

  it('checkout day is exclusive', () => {
    const occ = aggregateOccupancy(
      [{ data_arrivo: '2026-05-10', data_partenza: '2026-05-12', num_persone: 25 }],
      2026,
      5
    );
    expect(occ['2026-05-10']).toBe(25);
    expect(occ['2026-05-11']).toBe(25);
    expect(occ['2026-05-12']).toBeUndefined();
  });

  it('counts only days within requested month for cross-month booking', () => {
    const occ = aggregateOccupancy(
      [{ data_arrivo: '2026-05-30', data_partenza: '2026-06-03', num_persone: 25 }],
      2026,
      6
    );
    expect(occ['2026-05-30']).toBeUndefined();
    expect(occ['2026-05-31']).toBeUndefined();
    expect(occ['2026-06-01']).toBe(25);
    expect(occ['2026-06-02']).toBe(25);
    expect(occ['2026-06-03']).toBeUndefined();
  });

  it('handles december → january rollover', () => {
    const occ = aggregateOccupancy(
      [{ data_arrivo: '2026-12-30', data_partenza: '2027-01-02', num_persone: 25 }],
      2026,
      12
    );
    expect(occ['2026-12-30']).toBe(25);
    expect(occ['2026-12-31']).toBe(25);
    expect(occ['2027-01-01']).toBeUndefined();
  });

  it('handles february in a leap year (2028)', () => {
    const occ = aggregateOccupancy(
      [{ data_arrivo: '2028-02-01', data_partenza: '2028-03-01', num_persone: 25 }],
      2028,
      2
    );
    expect(Object.keys(occ).length).toBe(29);
    expect(occ['2028-02-29']).toBe(25);
  });

  it('handles february in a non-leap year (2026)', () => {
    const occ = aggregateOccupancy(
      [{ data_arrivo: '2026-02-01', data_partenza: '2026-03-01', num_persone: 25 }],
      2026,
      2
    );
    expect(Object.keys(occ).length).toBe(28);
    expect(occ['2026-02-28']).toBe(25);
    expect(occ['2026-02-29']).toBeUndefined();
  });

  it('sums multiple overlapping bookings', () => {
    const occ = aggregateOccupancy(
      [
        { data_arrivo: '2026-05-10', data_partenza: '2026-05-12', num_persone: 10 },
        { data_arrivo: '2026-05-11', data_partenza: '2026-05-13', num_persone: 5 },
      ],
      2026,
      5
    );
    expect(occ['2026-05-10']).toBe(10);
    expect(occ['2026-05-11']).toBe(15);
    expect(occ['2026-05-12']).toBe(5);
  });
});
