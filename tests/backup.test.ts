import { describe, expect, it } from 'vitest';
import { importBackup } from '../src/app/backup';
import { sow } from '../src/app/store';
import { workoutModel } from '../src/app/selectors';
import { emptyState } from '../src/domain/state';
import { asExerciseId } from '../src/domain/ids';
import { isAppState } from '../src/domain/validate';
import { SEED } from '../src/content/seed';

const seeded = () => sow(emptyState({ now: 0, deviceId: 'd' }), SEED, { today: '2026-08-01', idgen: () => 'run_seed' });
const mkIdgen = () => {
  let n = 0;
  return () => `imp_${n++}`;
};

describe('importBackup — geri yükleme = merge (D27); tohum tek kaynak', () => {
  it('v1 yedeği SEED enjeksiyonuyla göç eder → ad SEED kimliğine çözülür (tek-kaynak kanıtı)', () => {
    const v1 = JSON.stringify({
      v: 1,
      week: 1,
      lastBackup: 5,
      logs: { 'w1|Pull': { date: '2026-07-01', ex: { 'Barbell Row': { sets: [[60, 8]], rir: '2', note: '' } } } },
      measures: [],
    });
    const res = importBackup(seeded(), v1, SEED, { now: 1000, today: '2026-08-01', idgen: mkIdgen() });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // "Barbell Row" adı SEED'in ex_barbell_row kimliğine çözüldü → enjeksiyon SEED'den
    const rec = Object.values(res.state.records).find((r) => r.exId === asExerciseId('ex_barbell_row'));
    expect(rec?.sets[0]).toEqual({ kg: 60, reps: 8 });
    expect(isAppState(res.state)).toBe(true);
  });

  it('ekilmiş durum × yedek: tohum kimlikleri iki tarafta da var → çift yok', () => {
    const backup = JSON.stringify(seeded());
    const res = importBackup(seeded(), backup, SEED, { now: 1000, today: '2026-08-01', idgen: mkIdgen() });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.state.catalog.exercises)).toHaveLength(22); // 44 değil
    expect(Object.keys(res.state.catalog.programs)).toHaveLength(1);
    expect(Object.keys(res.state.runs)).toHaveLength(1); // aynı run_seed kimliği → tek
  });

  it('F0.2 × oto-kapanış: yüklenen yedekteki geçmiş bitmemiş seans kapanır (D46)', () => {
    const v1 = JSON.stringify({
      v: 1,
      week: 1,
      lastBackup: 0,
      logs: { 'w1|Pull': { date: '2020-01-05', ex: { 'Barbell Row': { sets: [[60, 8]], rir: '2', note: '' } } } },
      measures: [],
    });
    const res = importBackup(emptyState({ now: 0, deviceId: 'x' }), v1, SEED, { now: 9999, today: '2026-08-01', idgen: mkIdgen() });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const sessions = Object.values(res.state.sessions);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.finishedAt).toBe(9999); // 2020 seansı diriltilmedi, kapandı
    // önerilen gün doğru: bitmiş Gün 1'in bir sonrası, "devam" değil
    expect(workoutModel(res.state, { today: '2026-08-01' }).day?.dayId).toBe('Gün 2');
  });

  it('v2 yedeği doğrulanır + merge', () => {
    const res = importBackup(emptyState({ now: 0, deviceId: 'a' }), JSON.stringify(seeded()), SEED, { now: 1, today: '2026-08-01', idgen: mkIdgen() });
    expect(res.ok).toBe(true);
  });

  it('bozuk JSON / tanınmayan biçim → hata', () => {
    expect(importBackup(seeded(), '{bozuk', SEED, { now: 1, today: '2026-08-01', idgen: mkIdgen() }).ok).toBe(false);
    expect(importBackup(seeded(), JSON.stringify({ foo: 1 }), SEED, { now: 1, today: '2026-08-01', idgen: mkIdgen() }).ok).toBe(false);
  });
});
