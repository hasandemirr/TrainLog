import { describe, expect, it } from 'vitest';
import { emptyState } from '../src/domain/state';
import { sow } from '../src/app/store';
import { reduce } from '../src/app/actions';
import {
  addDayItem,
  moveDayItem,
  nextProgramVersion,
  openRun,
  removeDayItem,
  validatePrescribed,
  validateProgram,
  validateRirInput,
} from '../src/domain/program';
import { activeExercises, activeRun, sessionSummary, substitutionOptions, workoutModel } from '../src/app/selectors';
import type { Prescribed, ProgramDay } from '../src/domain/types';
import { createSession } from '../src/domain/session';
import { asExerciseId, asProgramId, asRunId } from '../src/domain/ids';
import type { Run } from '../src/domain/types';
import { SEED } from '../src/content/seed';

const rowId = asExerciseId('ex_barbell_row');
const pr = (id: string): Prescribed => ({ exId: asExerciseId(id), sets: 3, lo: 6, hi: 8, rest: 90 });
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

// ── F3.2: gün içeriği düzenleme (RIR, ekle/çıkar/sırala) ────────────────────

describe('RIR doğrulaması (kod → Türkçe deseni, F3.2)', () => {
  it('iki alan da boş → RIR yok (geçerli)', () => {
    expect(validateRirInput(null, null)).toEqual([]);
  });

  it('yarım giriş → rir-incomplete', () => {
    expect(validateRirInput(2, null)).toEqual(['rir-incomplete']);
    expect(validateRirInput(null, 3)).toEqual(['rir-incomplete']);
  });

  it('alt > üst → rir-lo-gt-hi; negatif → rir-negative', () => {
    expect(validateRirInput(3, 2)).toContain('rir-lo-gt-hi');
    expect(validateRirInput(-1, 2)).toContain('rir-negative');
    expect(validateRirInput(1, 2)).toEqual([]);
  });

  it('validatePrescribed rir alanını da denetler', () => {
    expect(validatePrescribed({ exId: rowId, sets: 3, lo: 6, hi: 8, rest: 90, rir: [3, 1] })).toContain('rir-lo-gt-hi');
    expect(validatePrescribed({ exId: rowId, sets: 3, lo: 6, hi: 8, rest: 90, rir: [1, 3] })).toEqual([]);
  });
});

describe('gün içeriği yardımcıları — saf ve değişmez (F3.2)', () => {
  const days = (): ProgramDay[] => [
    { dayId: 'Gün 1', label: 'Pull', items: [pr('a'), pr('b'), pr('c')] },
    { dayId: 'Gün 2', items: [pr('d')] },
  ];

  it('addDayItem sona ekler, yalnız hedef günü değiştirir, girdiyi mutasyona uğratmaz', () => {
    const before = days();
    const after = addDayItem(before, 'Gün 1', pr('z'));
    expect(after[0]?.items.map((i) => i.exId)).toEqual(['a', 'b', 'c', 'z']);
    expect(after[1]).toBe(before[1]); // dokunulmayan gün aynı referans
    expect(before[0]?.items).toHaveLength(3); // girdi bozulmadı
    expect(after[0]?.label).toBe('Pull'); // etiket korunur
  });

  it('removeDayItem yuvayı çıkarır; aralık dışı no-op', () => {
    expect(removeDayItem(days(), 'Gün 1', 1)[0]?.items.map((i) => i.exId)).toEqual(['a', 'c']);
    expect(removeDayItem(days(), 'Gün 1', 9)[0]?.items.map((i) => i.exId)).toEqual(['a', 'b', 'c']);
    expect(removeDayItem(days(), 'Yok', 0)).toEqual(days());
  });

  it('moveDayItem komşuyla yer değiştirir; uçlarda no-op', () => {
    expect(moveDayItem(days(), 'Gün 1', 2, -1)[0]?.items.map((i) => i.exId)).toEqual(['a', 'c', 'b']);
    expect(moveDayItem(days(), 'Gün 1', 0, 1)[0]?.items.map((i) => i.exId)).toEqual(['b', 'a', 'c']);
    expect(moveDayItem(days(), 'Gün 1', 0, -1)[0]?.items.map((i) => i.exId)).toEqual(['a', 'b', 'c']);
    expect(moveDayItem(days(), 'Gün 1', 2, 1)[0]?.items.map((i) => i.exId)).toEqual(['a', 'b', 'c']);
  });

  it('yuvaya eklenecek liste arşivliyi dışlar (activeExercises)', () => {
    const s = reduce(seeded(), { type: 'archiveExercise', exId: asExerciseId('ex_lat_pulldown'), updatedAt: 1 });
    const opts = activeExercises(s);
    expect(opts.some((e) => e.id === asExerciseId('ex_lat_pulldown'))).toBe(false);
    expect(opts).toHaveLength(21);
  });
});

describe('S5+S6 kapı testi — RIR/ekleme/çıkarma/sıralama geçmişi DEĞİŞTİRMEZ (D15, F3.2)', () => {
  it('dört düzenleme tipi birden: geçmiş seans eski sürümde, yeni seans yeni sürümde', () => {
    let s = seeded();
    const run = activeRun(s)!;
    const v1 = s.catalog.programs[run.currentProgId]!;
    const past = createSession({ date: '2026-08-01', seq: 1, runId: run.id, progId: v1.id, dayId: 'Gün 1', week: 1 });
    // Gün 1'in ilk iki yuvasına kayıt (slot 0: Barbell Row, slot 1: Lat Pulldown)
    s = reduce(s, { type: 'setSet', at: { session: past, slot: 0, exId: rowId, targetSets: 3 }, setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 1 });
    s = reduce(s, {
      type: 'setSet',
      at: { session: past, slot: 1, exId: asExerciseId('ex_lat_pulldown'), targetSets: 3 },
      setIdx: 0,
      patch: { kg: 40, reps: 10 },
      updatedAt: 1,
    });

    const v1Day1 = v1.days[0]!;
    expect(v1Day1.items[0]?.rir).toEqual([2, 3]);
    const v1Order = v1Day1.items.map((i) => i.exId);

    // Dört düzenleme: RIR değiştir → 2. yuvayı çıkar → kalan 2. yuvayı başa al → yeni yuva ekle
    let days: ProgramDay[] = v1.days.map((d) => ({ ...d, items: d.items.slice() }));
    days = days.map((d, i) =>
      i === 0 ? { ...d, items: d.items.map((it, j) => (j === 0 ? { ...it, rir: [1, 2] as [number, number] } : it)) } : d,
    ) as ProgramDay[];
    days = removeDayItem(days, 'Gün 1', 1) as ProgramDay[];
    days = moveDayItem(days, 'Gün 1', 1, -1) as ProgramDay[];
    days = addDayItem(days, 'Gün 1', { exId: asExerciseId('ex_face_pull'), sets: 3, lo: 8, hi: 12, rest: 90 }) as ProgramDay[];

    const v2 = nextProgramVersion(v1, days, asProgramId('prog_main_v2'));
    expect(validateProgram(v2)).toEqual([]); // düzenleme geçerli program üretti
    s = reduce(s, { type: 'saveProgramVersion', program: v2, runId: run.id, updatedAt: 2 });

    // 1) Geçmiş seans: sürüm, sıra, RIR, yuva sayısı — hiçbiri değişmedi
    const pastProg = s.catalog.programs[s.sessions[past.id]!.progId]!;
    expect(pastProg.id).toBe(v1.id);
    expect(pastProg.days[0]?.items.map((i) => i.exId)).toEqual(v1Order);
    expect(pastProg.days[0]?.items[0]?.rir).toEqual([2, 3]);
    expect(pastProg.days[0]?.items[1]?.exId).toBe(asExerciseId('ex_lat_pulldown')); // çıkarılan yuva geçmişte duruyor

    // 2) Geçmiş seansın özeti: iki kayıt, hareket sırası korunuyor
    const sum = sessionSummary(s, s.sessions[past.id]!);
    expect(sum.entries.map((e) => e.exercise.id)).toEqual([rowId, asExerciseId('ex_lat_pulldown')]);
    expect(sum.dayLabel).toBe('Pull');

    // 3) Yeni sürüm: RIR yeni, çıkarılan yok, sıra değişti, yeni yuva sonda
    const d1 = s.catalog.programs[asProgramId('prog_main_v2')]!.days[0]!;
    expect(d1.items[0]?.exId).toBe(asExerciseId('ex_single_arm_machine_row')); // yukarı taşındı
    expect(d1.items.some((i) => i.exId === asExerciseId('ex_lat_pulldown'))).toBe(false);
    expect(d1.items.find((i) => i.exId === rowId)?.rir).toEqual([1, 2]);
    expect(d1.items[d1.items.length - 1]?.exId).toBe(asExerciseId('ex_face_pull'));

    // 4) YENİ seans yeni sürümü görür (düzenleme ileri doğru geçerli)
    const m = workoutModel(s, { today: '2026-08-03', selDayId: 'Gün 1' });
    expect(m.program?.id).toBe(asProgramId('prog_main_v2'));
    expect(m.cards[0]?.exercise.id).toBe(asExerciseId('ex_single_arm_machine_row'));
    expect(m.cards.some((c) => c.exercise.id === asExerciseId('ex_lat_pulldown'))).toBe(false);
  });
});
