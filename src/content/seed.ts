// content/seed.ts — sürümlü tohum (D19, D39). TEK KAYNAK: hem ekim hem migrateV1
// enjeksiyonu bu nesneyi kullanır. Kaynak: antrenman_takip.xlsx → prototip PROGRAM
// (mimar onaylı, normatif). Adlar bayt-bayt korunur; kimlik kararlı slug, ad özellik
// (D14); günler "Gün N" + label (D44); sayılar olduğu gibi (52sn dahil, yuvarlanmaz).
import { asExerciseId, asProgramId } from '../domain/ids';
import type { ExerciseId } from '../domain/ids';
import type { Exercise, Prescribed, Program } from '../domain/types';
import type { SeedCatalog } from '../domain/migrate';

export const SEED_VERSION = 1;

const EXERCISES: Exercise[] = [
  // Gün 1 — Pull
  { id: asExerciseId('ex_barbell_row'), name: 'Barbell Row', kind: 'bar', zone: 'Sırt ortası (kalınlık)', inc: 2.5 },
  { id: asExerciseId('ex_lat_pulldown'), name: 'Lat Pulldown', kind: 'mac', zone: 'Kanat (genişlik)', inc: 2.5 },
  { id: asExerciseId('ex_single_arm_machine_row'), name: 'Single Arm Machine Row', kind: 'mac', zone: 'Sırt ortası, tek taraf', inc: 2.5 },
  { id: asExerciseId('ex_face_pull'), name: 'Face Pull', kind: 'mac', zone: 'Omuz arkası', inc: 2.5 },
  { id: asExerciseId('ex_incline_dumbbell_curl'), name: 'Incline Dumbbell Curl', kind: 'db', zone: 'Biceps, dış baş', inc: 2 },
  { id: asExerciseId('ex_cable_biceps_curl'), name: 'Cable Biceps Curl', kind: 'mac', zone: 'Biceps, genel', inc: 2.5 },
  // Gün 2 — Home 1
  { id: asExerciseId('ex_lateral_raise_db'), name: 'Lateral Raise (Dumbbell)', kind: 'db', zone: 'Omuz yanı', inc: 2 },
  { id: asExerciseId('ex_overhead_triceps_ext_db'), name: 'Overhead Triceps Ext. (DB)', kind: 'db', zone: 'Triceps, uzun baş', inc: 2 },
  { id: asExerciseId('ex_plank_hanging_leg_raise'), name: 'Plank / Hanging Leg Raise', kind: 'time', zone: 'Core', inc: 0 },
  // Gün 3 — Leg
  { id: asExerciseId('ex_hack_squat'), name: 'Hack Squat', kind: 'mac', zone: 'Ön bacak, kalça', inc: 2.5 },
  { id: asExerciseId('ex_standing_hip_thrust'), name: 'Standing Hip Thrust', kind: 'mac', zone: 'Kalça', inc: 2.5 },
  { id: asExerciseId('ex_leg_press'), name: 'Leg Press', kind: 'mac', zone: 'Ön bacak + kalça', inc: 5 },
  { id: asExerciseId('ex_seated_leg_curl'), name: 'Seated Leg Curl', kind: 'mac', zone: 'Bacak arkası', inc: 2.5 },
  { id: asExerciseId('ex_smith_calf_raise'), name: 'Smith Calf Raise', kind: 'bar', zone: 'Baldır', inc: 2.5 },
  // Gün 4 — Home 2
  { id: asExerciseId('ex_rear_delt_fly_db'), name: 'Rear Delt Fly (Dumbbell)', kind: 'db', zone: 'Omuz arkası', inc: 2 },
  { id: asExerciseId('ex_concentration_curl_db'), name: 'Concentration Curl (DB)', kind: 'db', zone: 'Biceps', inc: 2 },
  // Gün 5 — Push
  { id: asExerciseId('ex_incline_dumbbell_press'), name: 'Incline Dumbbell Press', kind: 'db', zone: 'Üst göğüs', inc: 2 },
  { id: asExerciseId('ex_shoulder_press_db'), name: 'Shoulder Press (Dumbbell)', kind: 'db', zone: 'Omuz ön', inc: 2 },
  { id: asExerciseId('ex_chest_press_dips'), name: 'Chest Press / Dips', kind: 'mac', zone: 'Göğüs geneli', inc: 2.5 },
  { id: asExerciseId('ex_pec_deck_fly'), name: 'Pec Deck Fly', kind: 'mac', zone: 'Göğüs, gerili pozisyon', inc: 2.5 },
  { id: asExerciseId('ex_lateral_raise_machine'), name: 'Lateral Raise (Machine)', kind: 'mac', zone: 'Omuz yanı', inc: 2.5 },
  { id: asExerciseId('ex_overhead_triceps_ext_cable'), name: 'Overhead Triceps Ext. (Cable)', kind: 'mac', zone: 'Triceps, uzun baş', inc: 2.5 },
];

/** Prescribed kurucu — rir yalnızca verilirse (time türünde yok, D: rir? opsiyonel). */
function pr(exId: string, sets: number, lo: number, hi: number, rest: number, rir?: [number, number]): Prescribed {
  const base: Prescribed = { exId: asExerciseId(exId), sets, lo, hi, rest };
  return rir ? { ...base, rir } : base;
}

const PROGRAM: Program = {
  id: asProgramId('prog_main_v1'),
  familyId: 'fam_main',
  rev: 1,
  name: 'Program',
  days: [
    {
      dayId: 'Gün 1',
      label: 'Pull',
      items: [
        pr('ex_barbell_row', 3, 6, 8, 150, [2, 3]),
        pr('ex_lat_pulldown', 3, 8, 12, 120, [1, 2]),
        pr('ex_single_arm_machine_row', 3, 10, 12, 90, [1, 2]),
        pr('ex_face_pull', 3, 15, 20, 60, [0, 1]),
        pr('ex_incline_dumbbell_curl', 3, 8, 12, 90, [0, 1]),
        pr('ex_cable_biceps_curl', 3, 10, 15, 75, [1, 2]),
      ],
    },
    {
      dayId: 'Gün 2',
      label: 'Home 1',
      items: [
        pr('ex_lateral_raise_db', 4, 15, 20, 52, [0, 1]),
        pr('ex_overhead_triceps_ext_db', 3, 10, 15, 60, [0, 1]),
        pr('ex_plank_hanging_leg_raise', 3, 30, 45, 45), // time: rir yok, lo/hi saniye
      ],
    },
    {
      dayId: 'Gün 3',
      label: 'Leg',
      items: [
        pr('ex_hack_squat', 3, 8, 12, 150, [2, 3]),
        pr('ex_standing_hip_thrust', 3, 10, 12, 120, [1, 2]),
        pr('ex_leg_press', 3, 12, 15, 90, [1, 2]),
        pr('ex_seated_leg_curl', 4, 10, 15, 90, [0, 1]),
        pr('ex_smith_calf_raise', 4, 12, 15, 60, [0, 1]),
      ],
    },
    {
      dayId: 'Gün 4',
      label: 'Home 2',
      items: [
        pr('ex_rear_delt_fly_db', 3, 15, 20, 52, [0, 1]),
        pr('ex_concentration_curl_db', 3, 10, 15, 60, [0, 1]),
      ],
    },
    {
      dayId: 'Gün 5',
      label: 'Push',
      items: [
        pr('ex_incline_dumbbell_press', 3, 6, 10, 150, [2, 3]),
        pr('ex_shoulder_press_db', 3, 8, 12, 120, [2, 3]),
        pr('ex_chest_press_dips', 3, 8, 12, 90, [1, 2]),
        pr('ex_pec_deck_fly', 3, 12, 15, 90, [0, 1]),
        pr('ex_lateral_raise_machine', 3, 12, 20, 60, [0, 1]),
        pr('ex_overhead_triceps_ext_cable', 3, 10, 12, 90, [0, 1]),
      ],
    },
  ],
};

const exercises: Record<ExerciseId, Exercise> = {};
for (const e of EXERCISES) exercises[e.id] = e;

/** Tek kaynak tohum kataloğu (ekim + migrateV1 enjeksiyonu aynı nesne). */
export const SEED: SeedCatalog = { exercises, program: PROGRAM };
