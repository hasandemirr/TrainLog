import { describe, expect, it } from 'vitest';
import { createSession, nextSeq, suggestNextDay } from '../src/domain/session';
import { asProgramId, asRunId, sessionId } from '../src/domain/ids';
import type { Session } from '../src/domain/types';
import { SEED } from '../src/content/seed';

const runId = asRunId('run_1');
const progId = asProgramId('prog_main_v1');
const mk = (date: string, seq: number, dayId: string, week: number): Session =>
  createSession({ date, seq, runId, progId, dayId, week });

describe('nextSeq (D17)', () => {
  it('boşta 1; aynı tarihte telafi 2; başka tarih 1', () => {
    const s1 = mk('2026-08-01', 1, 'Gün 1', 1);
    const sessions = { [s1.id]: s1 };
    expect(nextSeq({}, '2026-08-01')).toBe(1);
    expect(nextSeq(sessions, '2026-08-01')).toBe(2);
    expect(nextSeq(sessions, '2026-08-02')).toBe(1);
  });
});

describe('createSession (D17)', () => {
  it('tarih param olarak sabit; id = tarih#sıra', () => {
    const s = mk('2026-08-01', 1, 'Gün 3', 2);
    expect(s.date).toBe('2026-08-01');
    expect(s.id).toBe(sessionId('2026-08-01', 1));
    expect(s).toMatchObject({ dayId: 'Gün 3', week: 2, runId, progId });
  });
});

describe('suggestNextDay (D44)', () => {
  it('seans yoksa Gün 1 / hafta 1', () => {
    expect(suggestNextDay(SEED.program, [])).toMatchObject({ dayId: 'Gün 1', week: 1 });
  });
  it('son Gün 1 → Gün 2, aynı hafta', () => {
    expect(suggestNextDay(SEED.program, [mk('2026-08-01', 1, 'Gün 1', 1)])).toMatchObject({ dayId: 'Gün 2', week: 1 });
  });
  it('son Gün 5 → Gün 1, hafta +1 (devir)', () => {
    expect(suggestNextDay(SEED.program, [mk('2026-08-05', 1, 'Gün 5', 1)])).toMatchObject({ dayId: 'Gün 1', week: 2 });
  });
  it('en son seansı baz alır (tarih/sıra)', () => {
    const ss = [
      mk('2026-08-01', 1, 'Gün 1', 1),
      mk('2026-08-03', 1, 'Gün 3', 1),
      mk('2026-08-02', 1, 'Gün 2', 1),
    ];
    expect(suggestNextDay(SEED.program, ss)).toMatchObject({ dayId: 'Gün 4', week: 1 });
  });
  it('bilinmeyen gün → Gün 1, hafta korunur', () => {
    expect(suggestNextDay(SEED.program, [mk('2026-08-01', 1, 'Gün X', 3)])).toMatchObject({ dayId: 'Gün 1', week: 3 });
  });
});
