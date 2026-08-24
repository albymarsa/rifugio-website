import { describe, expect, it } from 'vitest';
import { findBlockingOverlap, STATI_BLOCCANTI } from '../../src/lib/booking';

const confermata = {
  id: 'pren-1',
  data_arrivo: '2026-06-10',
  data_partenza: '2026-06-15',
  stato: 'confermata',
};

describe('STATI_BLOCCANTI', () => {
  it('blocca solo le prenotazioni confermate', () => {
    expect([...STATI_BLOCCANTI]).toEqual(['confermata']);
  });
});

describe('findBlockingOverlap', () => {
  it('returns null with no existing bookings', () => {
    expect(findBlockingOverlap([], '2026-06-10', '2026-06-12')).toBeNull();
  });

  it('blocks on an overlapping confirmed booking', () => {
    expect(findBlockingOverlap([confermata], '2026-06-11', '2026-06-13')).not.toBeNull();
  });

  it('blocks on a range that wraps a confirmed booking', () => {
    expect(findBlockingOverlap([confermata], '2026-06-08', '2026-06-20')).not.toBeNull();
  });

  it('blocks on partial overlap on the left', () => {
    expect(findBlockingOverlap([confermata], '2026-06-08', '2026-06-12')).not.toBeNull();
  });

  it('blocks on partial overlap on the right', () => {
    expect(findBlockingOverlap([confermata], '2026-06-13', '2026-06-18')).not.toBeNull();
  });

  it('does NOT block on a pending request: più soci possono chiedere le stesse date', () => {
    const daConfermare = { ...confermata, id: 'pren-2', stato: 'da_confermare' };
    expect(findBlockingOverlap([daConfermare], '2026-06-11', '2026-06-13')).toBeNull();
  });

  it('does NOT block on a cancelled booking', () => {
    const annullata = { ...confermata, id: 'pren-3', stato: 'annullata' };
    expect(findBlockingOverlap([annullata], '2026-06-11', '2026-06-13')).toBeNull();
  });

  it('does NOT block on an unknown state', () => {
    const strana = { ...confermata, id: 'pren-4', stato: 'bozza' };
    expect(findBlockingOverlap([strana], '2026-06-11', '2026-06-13')).toBeNull();
  });

  it('keeps checkout day exclusive: arrival on an existing departure is OK', () => {
    expect(findBlockingOverlap([confermata], '2026-06-15', '2026-06-18')).toBeNull();
  });

  it('keeps checkout day exclusive: departure on an existing arrival is OK', () => {
    expect(findBlockingOverlap([confermata], '2026-06-05', '2026-06-10')).toBeNull();
  });

  it('ignores non-overlapping confirmed bookings', () => {
    expect(findBlockingOverlap([confermata], '2026-07-01', '2026-07-05')).toBeNull();
  });

  it('excludeId: una prenotazione non blocca sé stessa in fase di conferma', () => {
    expect(
      findBlockingOverlap([confermata], confermata.data_arrivo, confermata.data_partenza, 'pren-1')
    ).toBeNull();
  });

  it('excludeId: blocca comunque su una diversa confermata sovrapposta', () => {
    const altra = { ...confermata, id: 'pren-9' };
    expect(
      findBlockingOverlap([confermata, altra], '2026-06-10', '2026-06-15', 'pren-1')
    ).toMatchObject({ id: 'pren-9' });
  });

  it('excludeId assente: considera anche le prenotazioni senza id', () => {
    const senzaId = { data_arrivo: '2026-06-10', data_partenza: '2026-06-15', stato: 'confermata' };
    expect(findBlockingOverlap([senzaId], '2026-06-11', '2026-06-13')).not.toBeNull();
  });

  it('riconferma di una annullata bloccata da una confermata sopraggiunta', () => {
    const daRiconfermare = { ...confermata, id: 'pren-5', stato: 'annullata' };
    const sopraggiunta = { ...confermata, id: 'pren-6' };
    expect(
      findBlockingOverlap(
        [daRiconfermare, sopraggiunta],
        daRiconfermare.data_arrivo,
        daRiconfermare.data_partenza,
        'pren-5'
      )
    ).toMatchObject({ id: 'pren-6' });
  });
});
