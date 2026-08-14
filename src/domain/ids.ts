// domain/ids.ts — markalı kimlik tipleri + kur/çöz (D14, D17, D18). Import yok (D7).
// Kimlik/zaman domain'e parametreyle enjekte edilir; burada saf yardımcılar.

export type ExerciseId = string & { readonly __brand: 'ex' };
export type ProgramId = string & { readonly __brand: 'prog' };
export type RunId = string & { readonly __brand: 'run' };

export type ISODate = string; // "2026-08-13", yerel gün
export type SessionId = `${ISODate}#${number}`; // D17: gün içi sıra
export type RecordKey = `${SessionId}|${number}`; // D18: slot indeksi

export const asExerciseId = (s: string): ExerciseId => s as ExerciseId;
export const asProgramId = (s: string): ProgramId => s as ProgramId;
export const asRunId = (s: string): RunId => s as RunId;

export const sessionId = (date: ISODate, seq: number): SessionId => `${date}#${seq}`;
export const recordKey = (sid: SessionId, slotIdx: number): RecordKey => `${sid}|${slotIdx}`;

export function parseSessionId(id: SessionId): { date: ISODate; seq: number } {
  const at = id.lastIndexOf('#');
  return { date: id.slice(0, at), seq: Number(id.slice(at + 1)) };
}

export function parseRecordKey(key: RecordKey): { sessionId: SessionId; slotIdx: number } {
  const at = key.lastIndexOf('|');
  return { sessionId: key.slice(0, at) as SessionId, slotIdx: Number(key.slice(at + 1)) };
}

/** Kimlik üreteci — enjekte edilir (domain crypto import etmez; test determinizmi). */
export type IdGen = () => string;
