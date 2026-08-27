// domain/program.ts — koşu ömrü + program sürüm zinciri + öngörü doğrulama. Saf; import yok.
import type { AppState, Prescribed, Program, ProgramDay, Run } from './types';
import type { ISODate, ProgramId, RunId } from './ids';

/**
 * Yeni koşuyu aktive et: mevcut AKTİF koşuları (endedAt yok) kapat + yeni koşuyu ekle.
 * Tek-aktif-koşu değişmezini korur. sow (ilk koşu) VE startRun aynı yolu kullanır —
 * ekim koşusuna özel-durum kodu yok (devir maddesi).
 */
export function openRun(state: AppState, run: Run, closeDate: ISODate): AppState {
  const runs: Record<RunId, Run> = { ...state.runs };
  for (const r of Object.values(runs)) {
    if (r.endedAt === undefined) runs[r.id] = { ...r, endedAt: closeDate };
  }
  runs[run.id] = run;
  return { ...state, runs };
}

/** Program düzenleme = yeni sürüm (yeni id, aynı familyId, rev+1, userModified) — D15/D39. */
export function nextProgramVersion(base: Program, days: ProgramDay[], newId: ProgramId): Program {
  return { id: newId, familyId: base.familyId, rev: base.rev + 1, name: base.name, userModified: true, days };
}

export type PrescribedError = 'lo-gt-hi' | 'sets-lt-1' | 'rest-not-positive';

/** Öngörü doğrulaması (kod döner; Türkçe metin UI'da — S1 içtihadı). */
export function validatePrescribed(p: Prescribed): PrescribedError[] {
  const errs: PrescribedError[] = [];
  if (p.lo > p.hi) errs.push('lo-gt-hi');
  if (p.sets < 1) errs.push('sets-lt-1');
  if (p.rest <= 0) errs.push('rest-not-positive');
  return errs;
}

export interface ProgramIssue {
  dayId: string;
  slot: number;
  errors: PrescribedError[];
}

export function validateProgram(program: Program): ProgramIssue[] {
  const out: ProgramIssue[] = [];
  program.days.forEach((d) => {
    d.items.forEach((item, slot) => {
      const errors = validatePrescribed(item);
      if (errors.length > 0) out.push({ dayId: d.dayId, slot, errors });
    });
  });
  return out;
}
