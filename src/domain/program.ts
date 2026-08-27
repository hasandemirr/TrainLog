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

export type PrescribedError =
  | 'lo-gt-hi'
  | 'sets-lt-1'
  | 'rest-not-positive'
  | 'rir-incomplete'
  | 'rir-lo-gt-hi'
  | 'rir-negative';

/**
 * RIR girişi doğrulaması (F3.2) — düzenleme formu iki ayrı alan tutar, bu yüzden
 * YARIM giriş de temsil edilebilir; kod döner, Türkçe metin UI'da (S1 içtihadı).
 * İkisi de boş → RIR yok (geçerli).
 */
export function validateRirInput(lo: number | null, hi: number | null): PrescribedError[] {
  if (lo === null && hi === null) return [];
  if (lo === null || hi === null) return ['rir-incomplete'];
  const errs: PrescribedError[] = [];
  if (lo < 0 || hi < 0) errs.push('rir-negative');
  if (lo > hi) errs.push('rir-lo-gt-hi');
  return errs;
}

/** Öngörü doğrulaması (kod döner; Türkçe metin UI'da — S1 içtihadı). */
export function validatePrescribed(p: Prescribed): PrescribedError[] {
  const errs: PrescribedError[] = [];
  if (p.lo > p.hi) errs.push('lo-gt-hi');
  if (p.sets < 1) errs.push('sets-lt-1');
  if (p.rest <= 0) errs.push('rest-not-positive');
  if (p.rir) errs.push(...validateRirInput(p.rir[0], p.rir[1]));
  return errs;
}

// ── Gün içeriği düzenleme (F3.2) — hepsi SAF ve değişmez; sonuç yeni bir
// ProgramDay[] olur ve HER ZAMAN mevcut "düzenle → yeni sürüm" yolundan geçer
// (nextProgramVersion + saveProgramVersion). Geçmiş seanslar kendi sürümlerine
// bağlı kaldığı için yuva ekleme/çıkarma/sıralama geçmişi ETKİLEMEZ (D15).

/**
 * Gün-benzeri kap: `ProgramDay` bunun `T = Prescribed` hâlidir. Genel tutulmasının
 * nedeni, düzenleme formunun taslak öğeleri (yarım girilmiş RIR alanları) için de
 * AYNI saf sıralama/ekleme/çıkarma mantığını kullanmasıdır — UI'da kopya mantık yok.
 */
export interface ItemsDay<T> {
  dayId: string;
  label?: string;
  items: T[];
}

function mapDay<T>(days: ItemsDay<T>[], dayId: string, fn: (items: T[]) => T[]): ItemsDay<T>[] {
  return days.map((d) => (d.dayId === dayId ? { ...d, items: fn(d.items) } : d));
}

/** Yuvaya katalogdan hareket ekle (sona). Arşivli süzmesi çağıranındır (UI). */
export function addDayItem<T>(days: ItemsDay<T>[], dayId: string, item: T): ItemsDay<T>[] {
  return mapDay(days, dayId, (items) => [...items, item]);
}

/** Yuvayı çıkar (aralık dışı → değişiklik yok). */
export function removeDayItem<T>(days: ItemsDay<T>[], dayId: string, slot: number): ItemsDay<T>[] {
  return mapDay(days, dayId, (items) => (slot < 0 || slot >= items.length ? items : items.filter((_, i) => i !== slot)));
}

/** Yuvayı bir sıra yukarı/aşağı taşı (uçlarda değişiklik yok). */
export function moveDayItem<T>(days: ItemsDay<T>[], dayId: string, slot: number, dir: -1 | 1): ItemsDay<T>[] {
  return mapDay(days, dayId, (items) => {
    const to = slot + dir;
    if (slot < 0 || slot >= items.length || to < 0 || to >= items.length) return items;
    const next = items.slice();
    const a = next[slot] as T;
    next[slot] = next[to] as T;
    next[to] = a;
    return next;
  });
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
