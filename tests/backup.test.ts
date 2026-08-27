import { describe, expect, it } from 'vitest';
import { backupStatus, importBackup, toBackupState } from '../src/app/backup';
import { sow } from '../src/app/store';
import { reduce } from '../src/app/actions';
import { createSession } from '../src/domain/session';
import { workoutModel } from '../src/app/selectors';
import { emptyState } from '../src/domain/state';
import { asExerciseId } from '../src/domain/ids';
import type { AppState } from '../src/domain/types';
import { record, rkey } from './fixtures/build';
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

  it('merge istatistiği (focus 6): yeni kayıt=added; aynı yedek=değişiklik yok', () => {
    const base = seeded();
    const run = Object.values(base.runs)[0]!;
    const prog = base.catalog.programs[run.currentProgId]!;
    const sess = createSession({ date: '2026-07-20', seq: 1, runId: run.id, progId: prog.id, dayId: 'Gün 1', week: 1 });
    const withRec = reduce(base, {
      type: 'setSet',
      at: { session: sess, slot: 0, exId: asExerciseId('ex_barbell_row'), targetSets: 3 },
      setIdx: 0,
      patch: { kg: 60, reps: 8 },
      updatedAt: 1,
    });
    const backupJson = JSON.stringify(toBackupState(withRec));

    const r1 = importBackup(seeded(), backupJson, SEED, { now: 9999, today: '2026-08-01', idgen: mkIdgen() });
    if (!r1.ok) throw new Error('r1');
    expect(r1.stats.recordsAdded).toBe(1);

    const r2 = importBackup(withRec, backupJson, SEED, { now: 9999, today: '2026-08-01', idgen: mkIdgen() });
    if (!r2.ok) throw new Error('r2');
    expect(r2.stats).toMatchObject({ recordsAdded: 0, recordsUpdated: 0 });
  });

  it('bozuk JSON / tanınmayan biçim → hata', () => {
    expect(importBackup(seeded(), '{bozuk', SEED, { now: 1, today: '2026-08-01', idgen: mkIdgen() }).ok).toBe(false);
    expect(importBackup(seeded(), JSON.stringify({ foo: 1 }), SEED, { now: 1, today: '2026-08-01', idgen: mkIdgen() }).ok).toBe(false);
  });
});

describe('backupStatus — yedek yaşı + 21 gün eşiği (D29)', () => {
  const withRecord = (lastBackup: number): AppState => {
    const s = seeded();
    s.meta.lastBackup = lastBackup;
    s.records[rkey('2026-08-01', 1, 0)] = record('ex_barbell_row', [[60, 8]], 1000);
    return s;
  };
  const DAY = 86_400_000;

  it('kayıt yokken hatırlatmaz (boş uygulamayı rahatsız etmez)', () => {
    const s = seeded();
    s.meta.lastBackup = 0;
    const st = backupStatus(s, 100 * DAY);
    expect(st.hasData).toBe(false);
    expect(st.remind).toBe(false);
    expect(st.reason).toBe('never'); // gerekçe hesaplanır ama uyarı çıkmaz
  });

  it('kayıt var + hiç yedek yok → hatırlatır (reason: never, yaş null)', () => {
    const st = backupStatus(withRecord(0), 5 * DAY);
    expect(st.ageDays).toBeNull();
    expect(st.remind).toBe(true);
    expect(st.reason).toBe('never');
  });

  it('20 gün → hatırlatmaz; 21 gün → hatırlatır (eşik dahil)', () => {
    const now = 100 * DAY;
    const at20 = backupStatus(withRecord(now - 20 * DAY), now);
    expect(at20.ageDays).toBe(20);
    expect(at20.remind).toBe(false);
    expect(at20.reason).toBeNull();

    const at21 = backupStatus(withRecord(now - 21 * DAY), now);
    expect(at21.ageDays).toBe(21);
    expect(at21.remind).toBe(true);
    expect(at21.reason).toBe('stale');
  });

  it('yaş gün tabanına yuvarlanır; ileri tarihli yedek negatif yaş vermez', () => {
    const now = 100 * DAY;
    expect(backupStatus(withRecord(now - (2 * DAY + 3600_000)), now).ageDays).toBe(2);
    expect(backupStatus(withRecord(now + DAY), now).ageDays).toBe(0);
  });

  it('markBackup sonrası hatırlatma kapanır (aksiyon → yaş sıfır)', () => {
    const now = 100 * DAY;
    const stale = withRecord(now - 30 * DAY);
    expect(backupStatus(stale, now).remind).toBe(true);
    const after = reduce(stale, { type: 'markBackup', at: now });
    expect(backupStatus(after, now).remind).toBe(false);
    expect(backupStatus(after, now).ageDays).toBe(0);
  });
});
