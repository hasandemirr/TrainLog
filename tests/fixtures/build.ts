// Sentetik test kurucuları (D49). Domain'i test için tipli şekilde besler.
import { asExerciseId, recordKey, sessionId } from '../../src/domain/ids';
import type { RecordKey } from '../../src/domain/ids';
import { emptyState } from '../../src/domain/state';
import type { AppState, ExRecord, Exercise, SetEntry } from '../../src/domain/types';

export function exercise(id: string, over: Partial<Omit<Exercise, 'id'>> = {}): Exercise {
  return { id: asExerciseId(id), name: id, kind: 'bar', zone: 'z', inc: 2.5, ...over };
}

export function sets(pairs: ReadonlyArray<readonly [number | null, number | null]>): SetEntry[] {
  return pairs.map(([kg, reps]) => ({ kg, reps }));
}

export function record(
  exid: string,
  entries: ReadonlyArray<readonly [number | null, number | null]>,
  updatedAt: number,
  over: Partial<ExRecord> = {},
): ExRecord {
  return { exId: asExerciseId(exid), sets: sets(entries), updatedAt, ...over };
}

export const rkey = (date: string, seq: number, slot: number): RecordKey =>
  recordKey(sessionId(date, seq), slot);

export function makeState(parts: {
  deviceId?: string;
  now?: number;
  rev?: number;
  updatedAt?: number;
  lastBackup?: number;
  exercises?: Exercise[];
  records?: Record<RecordKey, ExRecord>;
}): AppState {
  const s = emptyState({ now: parts.now ?? 0, deviceId: parts.deviceId ?? 'dev' });
  if (parts.rev !== undefined) s.meta.rev = parts.rev;
  if (parts.updatedAt !== undefined) s.meta.updatedAt = parts.updatedAt;
  if (parts.lastBackup !== undefined) s.meta.lastBackup = parts.lastBackup;
  for (const e of parts.exercises ?? []) s.catalog.exercises[e.id] = e;
  Object.assign(s.records, parts.records ?? {});
  return s;
}
