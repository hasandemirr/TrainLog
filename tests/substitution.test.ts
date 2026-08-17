import { describe, expect, it } from 'vitest';
import { asExerciseId, makeExerciseId, recordKey } from '../src/domain/ids';
import { reduce } from '../src/app/actions';
import { activeRun, substitutionOptions } from '../src/app/selectors';
import { emptyState } from '../src/domain/state';
import { sow } from '../src/app/store';
import { createSession } from '../src/domain/session';
import type { Exercise } from '../src/domain/types';
import { SEED } from '../src/content/seed';

const seeded = () => sow(emptyState({ now: 0, deviceId: 'd' }), SEED, { today: '2026-08-01', idgen: () => 'run_seed' });

describe('makeExerciseId — slug + çakışma (D14, D47 köşe)', () => {
  it('temiz ad → ex_slug', () => {
    expect(makeExerciseId('Yeni Hareket', [])).toBe(asExerciseId('ex_yeni_hareket'));
  });

  it('Türkçe karakter translit', () => {
    expect(makeExerciseId('Göğüs Sıkıştırma', [])).toBe(asExerciseId('ex_gogus_sikistirma'));
  });

  it('çakışma → sonek (kullanıcı ikinci "Barbell Row" yaratırsa)', () => {
    const existing = Object.keys(SEED.exercises); // ex_barbell_row mevcut
    expect(makeExerciseId('Barbell Row', existing)).toBe(asExerciseId('ex_barbell_row_2'));
    expect(makeExerciseId('Barbell Row', [...existing, 'ex_barbell_row_2'])).toBe(asExerciseId('ex_barbell_row_3'));
  });
});

describe('ikame (D47)', () => {
  it('substitute: kayıttaki exId değişir; program sürümüne DOKUNULMAZ', () => {
    let s = seeded();
    const run = activeRun(s)!;
    const prog = s.catalog.programs[run.currentProgId]!;
    const sess = createSession({ date: '2026-08-01', seq: 1, runId: run.id, progId: prog.id, dayId: 'Gün 1', week: 1 });
    const at = { session: sess, slot: 0, exId: asExerciseId('ex_barbell_row'), targetSets: 3 };
    s = reduce(s, { type: 'setSet', at, setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 1 });
    s = reduce(s, { type: 'substitute', at, newExId: asExerciseId('ex_lat_pulldown'), updatedAt: 2 });

    const key = recordKey(sess.id, 0);
    expect(s.records[key]?.exId).toBe(asExerciseId('ex_lat_pulldown')); // kayıt ikame edildi
    expect(s.records[key]?.sets).toHaveLength(3); // taze
    // program hâlâ orijinal (rev + ilk slot exId)
    expect(s.catalog.programs[prog.id]?.rev).toBe(prog.rev);
    expect(s.catalog.programs[prog.id]?.days[0]?.items[0]?.exId).toBe(asExerciseId('ex_barbell_row'));
  });

  it('addExercise: kataloğa userModified olarak ekler', () => {
    let s = seeded();
    const ex: Exercise = {
      id: makeExerciseId('Benim Hareketim', Object.keys(s.catalog.exercises)),
      name: 'Benim Hareketim',
      kind: 'mac',
      zone: 'Test',
      inc: 2.5,
      userModified: true,
    };
    s = reduce(s, { type: 'addExercise', exercise: ex, updatedAt: 1 });
    expect(Object.keys(s.catalog.exercises)).toHaveLength(23);
    expect(s.catalog.exercises[ex.id]?.userModified).toBe(true);
  });

  it('substitutionOptions: aynı bölge önce, kendisi + arşivli hariç', () => {
    let s = seeded();
    const sameZone: Exercise = { id: asExerciseId('ex_same'), name: 'Aynı Bölge', kind: 'bar', zone: 'Sırt ortası (kalınlık)', inc: 2.5 };
    const archived: Exercise = { id: asExerciseId('ex_arch'), name: 'Arşiv', kind: 'bar', zone: 'X', inc: 2.5, archived: true };
    s = reduce(s, { type: 'addExercise', exercise: sameZone, updatedAt: 1 });
    s = reduce(s, { type: 'addExercise', exercise: archived, updatedAt: 2 });

    const opts = substitutionOptions(s, asExerciseId('ex_barbell_row'));
    expect(opts[0]?.id).toBe(asExerciseId('ex_same')); // aynı bölge en üstte
    expect(opts.some((e) => e.id === asExerciseId('ex_barbell_row'))).toBe(false); // kendisi yok
    expect(opts.some((e) => e.id === asExerciseId('ex_arch'))).toBe(false); // arşivli yok
  });
});
