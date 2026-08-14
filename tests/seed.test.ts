import { describe, expect, it } from 'vitest';
import { SEED, SEED_VERSION } from '../src/content/seed';
import { asExerciseId } from '../src/domain/ids';

describe('seed (normatif içerik)', () => {
  it('22 hareket, 5 gün — içerik değişirse bu test BİLİNÇLİ güncellenir', () => {
    expect(Object.keys(SEED.exercises).length).toBe(22);
    expect(SEED.program.days.length).toBe(5);
  });

  it('seedVersion 1 (D39)', () => {
    expect(SEED_VERSION).toBe(1);
  });

  it('hiçbir girdide userModified yok (D39)', () => {
    for (const e of Object.values(SEED.exercises)) expect(e.userModified).toBeUndefined();
    expect(SEED.program.userModified).toBeUndefined();
  });

  it('kimlik kararlı slug, ad özellik (D14) — ad bayt-bayt korunur', () => {
    const row = SEED.exercises[asExerciseId('ex_barbell_row')];
    expect(row?.name).toBe('Barbell Row');
    const names = Object.values(SEED.exercises).map((e) => e.name);
    // kısaltmalar ve eğik çizgiler "düzeltilmez"
    expect(names).toContain('Overhead Triceps Ext. (DB)');
    expect(names).toContain('Overhead Triceps Ext. (Cable)');
    expect(names).toContain('Plank / Hanging Leg Raise');
    expect(names).toContain('Chest Press / Dips');
  });

  it('günler "Gün N" + label; hafta günü adı yok (D44)', () => {
    expect(SEED.program.days.map((d) => d.dayId)).toEqual(['Gün 1', 'Gün 2', 'Gün 3', 'Gün 4', 'Gün 5']);
    expect(SEED.program.days.map((d) => d.label)).toEqual(['Pull', 'Home 1', 'Leg', 'Home 2', 'Push']);
  });

  it('time türü: rir yok, inc 0, lo/hi saniye', () => {
    const plank = SEED.exercises[asExerciseId('ex_plank_hanging_leg_raise')];
    expect(plank?.kind).toBe('time');
    expect(plank?.inc).toBe(0);
    const item = SEED.program.days[1]?.items.find((i) => i.exId === asExerciseId('ex_plank_hanging_leg_raise'));
    expect(item?.rir).toBeUndefined();
    expect([item?.lo, item?.hi]).toEqual([30, 45]);
  });

  it('sayılar olduğu gibi — 52sn dinlenmeler yuvarlanmaz', () => {
    const home1 = SEED.program.days[1];
    const lateral = home1?.items.find((i) => i.exId === asExerciseId('ex_lateral_raise_db'));
    expect(lateral?.rest).toBe(52);
  });

  it('her prescribed exId kataloğa çözülür', () => {
    for (const day of SEED.program.days) {
      for (const item of day.items) {
        expect(SEED.exercises[item.exId]).toBeDefined();
      }
    }
  });
});
