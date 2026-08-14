// domain/validate.ts — elle yazılmış çalışma zamanı doğrulaması (D21; Zod yok).
// Güvenilmeyen sınır: içe alma (ileride) + açılışta yük geçerliliği. Saf; import yok.
import type {
  AppState,
  ExRecord,
  Exercise,
  ExerciseKind,
  Meta,
  Prescribed,
  Program,
  ProgramDay,
  Run,
  Session,
  SetEntry,
} from './types';

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function isRecordMap<T>(x: unknown, val: (v: unknown) => v is T): x is Record<string, T> {
  return isObj(x) && Object.values(x).every(val);
}

function isExerciseKind(x: unknown): x is ExerciseKind {
  return x === 'bar' || x === 'db' || x === 'mac' || x === 'time';
}

function isExercise(x: unknown): x is Exercise {
  if (!isObj(x)) return false;
  if (!isStr(x.id) || !isStr(x.name) || !isExerciseKind(x.kind) || !isStr(x.zone) || !isNum(x.inc)) {
    return false;
  }
  if (x.media !== undefined && !isStr(x.media)) return false;
  if (x.archived !== undefined && x.archived !== true) return false;
  if (x.userModified !== undefined && x.userModified !== true) return false;
  return true;
}

function isSetEntry(x: unknown): x is SetEntry {
  if (!isObj(x)) return false;
  return (x.kg === null || isNum(x.kg)) && (x.reps === null || isNum(x.reps));
}

function isExRecord(x: unknown): x is ExRecord {
  if (!isObj(x)) return false;
  if (!isStr(x.exId)) return false;
  if (!Array.isArray(x.sets) || !x.sets.every(isSetEntry)) return false;
  if (x.rir !== undefined && !isNum(x.rir)) return false;
  if (x.note !== undefined && !isStr(x.note)) return false;
  return isNum(x.updatedAt);
}

function isPrescribed(x: unknown): x is Prescribed {
  if (!isObj(x)) return false;
  if (!isStr(x.exId) || !isNum(x.sets) || !isNum(x.lo) || !isNum(x.hi) || !isNum(x.rest)) return false;
  if (x.rir !== undefined) {
    if (!Array.isArray(x.rir) || x.rir.length !== 2 || !isNum(x.rir[0]) || !isNum(x.rir[1])) return false;
  }
  return true;
}

function isProgramDay(x: unknown): x is ProgramDay {
  if (!isObj(x)) return false;
  if (!isStr(x.dayId)) return false;
  if (x.label !== undefined && !isStr(x.label)) return false;
  return Array.isArray(x.items) && x.items.every(isPrescribed);
}

function isProgram(x: unknown): x is Program {
  if (!isObj(x)) return false;
  if (!isStr(x.id) || !isStr(x.familyId) || !isNum(x.rev) || !isStr(x.name)) return false;
  if (x.userModified !== undefined && x.userModified !== true) return false;
  return Array.isArray(x.days) && x.days.every(isProgramDay);
}

function isRun(x: unknown): x is Run {
  return (
    isObj(x) && isStr(x.id) && isStr(x.familyId) && isStr(x.currentProgId) && isStr(x.startDate)
  );
}

function isSession(x: unknown): x is Session {
  if (!isObj(x)) return false;
  if (!isStr(x.id) || !isStr(x.date) || !isStr(x.runId) || !isStr(x.progId) || !isStr(x.dayId)) {
    return false;
  }
  if (!isNum(x.week)) return false;
  if (x.finishedAt !== undefined && !isNum(x.finishedAt)) return false;
  return true;
}

function isMeta(x: unknown): x is Meta {
  return (
    isObj(x) && isStr(x.deviceId) && isNum(x.rev) && isNum(x.updatedAt) && isNum(x.lastBackup)
  );
}

function isMeasureRow(x: unknown): x is Record<string, number | string> {
  return isObj(x) && Object.values(x).every((v) => v === undefined || isNum(v) || isStr(v));
}

/** Bilinmeyen bir değerin geçerli v2 AppState olup olmadığını söyler (D21). */
export function isAppState(x: unknown): x is AppState {
  if (!isObj(x)) return false;
  if (x.v !== 2) return false;
  if (!isMeta(x.meta)) return false;
  if (!isObj(x.catalog)) return false;
  if (!isRecordMap(x.catalog.exercises, isExercise)) return false;
  if (!isRecordMap(x.catalog.programs, isProgram)) return false;
  if (!isRecordMap(x.runs, isRun)) return false;
  if (!isRecordMap(x.sessions, isSession)) return false;
  if (!isRecordMap(x.records, isExRecord)) return false;
  if (!isRecordMap(x.measures, isMeasureRow)) return false;
  if (x.timer !== undefined) {
    if (!isObj(x.timer) || !isNum(x.timer.tEnd) || !isStr(x.timer.label)) return false;
  }
  return true;
}
