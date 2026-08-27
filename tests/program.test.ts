import { describe, expect, it } from 'vitest';
import { emptyState } from '../src/domain/state';
import { sow } from '../src/app/store';
import { reduce } from '../src/app/actions';
import { nextProgramVersion, openRun, validatePrescribed, validateProgram } from '../src/domain/program';
import { activeRun, sessionSummary, substitutionOptions, workoutModel } from '../src/app/selectors';
import { createSession } from '../src/domain/session';
import { asExerciseId, asProgramId, asRunId } from '../src/domain/ids';
import type { Run } from '../src/domain/types';
import { SEED } from '../src/content/seed';

const rowId = asExerciseId('ex_barbell_row');
const seeded = () => sow(emptyState({ now: 0, deviceId: 'd' }), SEED, { today: '2026-08-01', idgen: () => 'run_1' });
const mkRun = (id: string, startDate: string): Run => ({
  id: asRunId(id),
  familyId: 'fam_main',
  currentProgId: asProgramId('prog_main_v1'),
  startDate,
});

describe('openRun — tek aktif koşu değişmezi (şart 2)', () => {
  it('yeni koşu mevcut aktifi kapatır; en fazla bir aktif', () => {
    const s1 = openRun(seeded(), mkRun('run_2', '2026-09-01'), '2026-09-01');
    expect(s1.runs[asRunId('run_1')]?.endedAt).toBe('2026-09-01');
    expect(s1.runs[asRunId('run_2')]?.endedAt).toBeUndefined();
    expect(Object.values(s1.runs).filter((r) => r.endedAt === undefined)).toHaveLength(1);
    expect(activeRun(s1)?.id).toBe(asRunId('run_2'));
  });
});

describe('ekim koşusu birinci sınıf (devir maddesi)', () => {
  it('openRun ile açılır (aktif) ve genel yolla kapatılabilir — özel-durum yok', () => {
    const s = seeded();
    expect(activeRun(s)?.endedAt).toBeUndefined();
    const s2 = reduce(s, { type: 'startRun', run: mkRun('run_x', '2026-10-01'), today: '2026-10-01', updatedAt: 1 });
    expect(s2.runs[asRunId('run_1')]?.endedAt).toBe('2026-10-01');
  });

  it('yeni koşu önerisi Gün 1 / hafta 1 (baştan)', () => {
    let s = seeded();
    const run = activeRun(s)!;
    const sess = createSession({ date: '2026-08-01', seq: 1, runId: run.id, progId: run.currentProgId, dayId: 'Gün 1', week: 1 });
    s = reduce(s, { type: 'setSet', at: { session: sess, slot: 0, exId: rowId, targetSets: 3 }, setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 1 });
    s = reduce(s, { type: 'startRun', run: mkRun('run_2', '2026-09-01'), today: '2026-09-01', updatedAt: 2 });
    const m = workoutModel(s, { today: '2026-09-01' });
    expect(m.run?.id).toBe(asRunId('run_2'));
    expect(m.suggestion).toMatchObject({ dayId: 'Gün 1', week: 1 });
  });
});

describe('program sürüm zinciri (D15, S5 kapı testi)', () => {
  it('koşu ortası düzenleme geçmiş seansın hedefini DEĞİŞTİRMEZ', () => {
    let s = seeded();
    const run = activeRun(s)!;
    const v1 = s.catalog.programs[run.currentProgId]!;
    const past = createSession({ date: '2026-08-01', seq: 1, runId: run.id, progId: v1.id, dayId: 'Gün 1', week: 1 });
    s = reduce(s, { type: 'setSet', at: { session: past, slot: 0, exId: rowId, targetSets: 3 }, setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 1 });

    const editedDays = v1.days.map((d, i) =>
      i === 0 ? { ...d, label: 'Pull-2', items: d.items.map((it, j) => (j === 0 ? { ...it, hi: 10 } : it)) } : d,
    );
    const v2 = nextProgramVersion(v1, editedDays, asProgramId('prog_main_v2'));
    s = reduce(s, { type: 'saveProgramVersion', program: v2, runId: run.id, updatedAt: 2 });

    expect(s.runs[run.id]?.currentProgId).toBe(asProgramId('prog_main_v2')); // işaretçi ilerledi
    expect(v2.rev).toBe(v1.rev + 1);
    expect(v2.userModified).toBe(true);

    // geçmiş seans hâlâ v1'de → hedef görünümü eski
    const pastProg = s.catalog.programs[s.sessions[past.id]!.progId]!;
    expect(pastProg.id).toBe(v1.id);
    expect(pastProg.days[0]?.label).toBe('Pull');
    expect(pastProg.days[0]?.items[0]?.hi).toBe(8);
    expect(sessionSummary(s, s.sessions[past.id]!).dayLabel).toBe('Pull'); // takvim özeti kanıtı
    expect(s.catalog.programs[asProgramId('prog_main_v2')]?.days[0]?.label).toBe('Pull-2');
  });
});

describe('öngörü doğrulaması (şart 4)', () => {
  it('lo>hi / sets<1 / rest<=0 → kod; geçerli → boş', () => {
    expect(validatePrescribed({ exId: rowId, sets: 3, lo: 8, hi: 6, rest: 90 })).toContain('lo-gt-hi');
    expect(validatePrescribed({ exId: rowId, sets: 0, lo: 6, hi: 8, rest: 90 })).toContain('sets-lt-1');
    expect(validatePrescribed({ exId: rowId, sets: 3, lo: 6, hi: 8, rest: 0 })).toContain('rest-not-positive');
    expect(validatePrescribed({ exId: rowId, sets: 3, lo: 6, hi: 8, rest: 90 })).toEqual([]);
  });

  it('validateProgram sorunu konumla döner', () => {
    const prog = seeded().catalog.programs[asProgramId('prog_main_v1')]!;
    const bad = {
      ...prog,
      days: prog.days.map((d, i) => (i === 0 ? { ...d, items: d.items.map((it, j) => (j === 0 ? { ...it, lo: 20 } : it)) } : d)),
    };
    expect(validateProgram(bad)[0]).toMatchObject({ dayId: 'Gün 1', slot: 0, errors: ['lo-gt-hi'] });
  });
});

describe('katalog (şart 3)', () => {
  it('archiveExercise arşivler + substitutionOptions dışlar; silinmez', () => {
    const s = reduce(seeded(), { type: 'archiveExercise', exId: asExerciseId('ex_lat_pulldown'), updatedAt: 1 });
    expect(s.catalog.exercises[asExerciseId('ex_lat_pulldown')]?.archived).toBe(true);
    expect(Object.keys(s.catalog.exercises)).toHaveLength(22);
    expect(substitutionOptions(s, rowId).some((e) => e.id === asExerciseId('ex_lat_pulldown'))).toBe(false);
  });
});
