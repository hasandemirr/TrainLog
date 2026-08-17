// app/selectors.ts — türetilmiş bellek indeksleri (D8). ASLA kalıcılaşmaz.
// Seçili gün/hafta UI durumudur, parametreyle gelir; AppState'e girmez.
import { compareSessions, createSession, nextSeq, suggestNextDay } from '../domain/session';
import { isDrop, progressionHint, setVolume } from '../domain/progression';
import type { Advice } from '../domain/progression';
import { parseRecordKey, recordKey } from '../domain/ids';
import type { ExerciseId, ISODate, RecordKey, SessionId } from '../domain/ids';
import type {
  AppState,
  ExRecord,
  Exercise,
  Prescribed,
  Program,
  ProgramDay,
  Run,
  Session,
} from '../domain/types';

function hasData(rec: ExRecord): boolean {
  return rec.sets.some((s) => s.kg !== null || s.reps !== null);
}

/** S2: tek koşu — en geç başlayanı aktif say. */
export function activeRun(state: AppState): Run | null {
  const runs = Object.values(state.runs);
  if (runs.length === 0) return null;
  return runs.reduce((a, b) => (a.startDate >= b.startDate ? a : b));
}

export function programOf(state: AppState, run: Run): Program | null {
  return state.catalog.programs[run.currentProgId] ?? null;
}

function runSessions(state: AppState, run: Run): Session[] {
  return Object.values(state.sessions).filter((s) => s.runId === run.id);
}

/** "Geçen seans": exId'nin `before`'dan önceki en son DOLU kaydı (D8 türetme). */
export function lastRecordForExercise(
  state: AppState,
  exId: ExerciseId,
  before?: SessionId,
): { record: ExRecord; session: Session } | null {
  let best: { record: ExRecord; session: Session } | null = null;
  for (const [k, rec] of Object.entries(state.records) as [RecordKey, ExRecord][]) {
    if (rec.exId !== exId || !hasData(rec)) continue;
    const session = state.sessions[parseRecordKey(k).sessionId];
    if (!session) continue;
    if (before !== undefined && compareSessions(session.id, before) >= 0) continue;
    if (!best || compareSessions(session.id, best.session.id) > 0) best = { record: rec, session };
  }
  return best;
}

export interface ExerciseCard {
  slot: number;
  exercise: Exercise;
  prescribed: Prescribed;
  current: ExRecord | null;
  last: { record: ExRecord; session: Session } | null;
  hint: Advice | null; // yalnızca güncel kayıt doluysa
  drop: boolean;
}

export function exerciseCard(
  state: AppState,
  session: Session,
  slot: number,
  prescribed: Prescribed,
): ExerciseCard | null {
  const exercise = state.catalog.exercises[prescribed.exId];
  if (!exercise) return null;
  const current = state.records[recordKey(session.id, slot)] ?? null;
  const last = lastRecordForExercise(state, prescribed.exId, session.id);
  const hint = current && hasData(current) ? progressionHint(prescribed, exercise, current) : null;
  const drop = current !== null && last !== null ? isDrop(current, last.record, exercise) : false;
  return { slot, exercise, prescribed, current, last, hint, drop };
}

/** Var olan bugünkü seansı bul; yoksa doğacak seansı (prospective) kur (D17). */
export function resolveSession(
  state: AppState,
  run: Run,
  program: Program,
  date: ISODate,
  dayId: string,
  week: number,
): Session {
  const existing = Object.values(state.sessions).find(
    (s) => s.runId === run.id && s.date === date && s.dayId === dayId,
  );
  if (existing) return existing;
  return createSession({ date, seq: nextSeq(state.sessions, date), runId: run.id, progId: program.id, dayId, week });
}

export interface SessionSummary {
  session: Session;
  dayLabel: string;
  entries: { exercise: Exercise; record: ExRecord; volume: number; filledSets: number }[];
  totalVolume: number;
  totalSets: number;
}

/** Seans özeti — TÜRETİLMİŞ görünüm (D8, D46), asla saklanmaz. */
export function sessionSummary(state: AppState, session: Session): SessionSummary {
  const program = state.catalog.programs[session.progId];
  const day = program?.days.find((d) => d.dayId === session.dayId);

  const rows = (Object.entries(state.records) as [RecordKey, ExRecord][])
    .filter(([k]) => parseRecordKey(k).sessionId === session.id)
    .sort((a, b) => parseRecordKey(a[0]).slotIdx - parseRecordKey(b[0]).slotIdx);

  const entries: SessionSummary['entries'] = [];
  let totalVolume = 0;
  let totalSets = 0;
  for (const [, rec] of rows) {
    const filledSets = rec.sets.filter((s) => s.reps !== null).length;
    if (filledSets === 0) continue; // boş kaydı atla
    const exercise = state.catalog.exercises[rec.exId];
    if (!exercise) continue;
    const volume = setVolume(rec.sets);
    entries.push({ exercise, record: rec, volume, filledSets });
    totalVolume += volume;
    totalSets += filledSets;
  }

  return { session, dayLabel: day?.label ?? session.dayId, entries, totalVolume, totalSets };
}

/** İkame adayları (D47): arşivlenmemiş hareketler, ÖNCE aynı bölge, sonra ada göre. */
export function substitutionOptions(state: AppState, currentExId: ExerciseId): Exercise[] {
  const zone = state.catalog.exercises[currentExId]?.zone;
  return Object.values(state.catalog.exercises)
    .filter((e) => e.archived !== true && e.id !== currentExId)
    .sort((a, b) => {
      const az = a.zone === zone ? 0 : 1;
      const bz = b.zone === zone ? 0 : 1;
      return az - bz || a.name.localeCompare(b.name, 'tr');
    });
}

export interface WorkoutModel {
  run: Run | null;
  program: Program | null;
  day: ProgramDay | null;
  session: Session | null;
  week: number;
  suggestion: { dayId: string; week: number };
  cards: ExerciseCard[];
}

const EMPTY: WorkoutModel = {
  run: null,
  program: null,
  day: null,
  session: null,
  week: 1,
  suggestion: { dayId: '', week: 1 },
  cards: [],
};

/** Antrenman ekranı modeli. selDayId/selWeek UI durumu (verilmezse öneri). */
export function workoutModel(
  state: AppState,
  ui: { today: ISODate; selDayId?: string; selWeek?: number },
): WorkoutModel {
  const run = activeRun(state);
  if (!run) return EMPTY;
  const program = programOf(state, run);
  if (!program) return { ...EMPTY, run };

  // Varsayılan gün: bugün açık (bitmemiş) bir seans varsa ONA devam et (reload'da
  // kaybolmasın); yoksa döngü önerisi (D44: son TAMAMLANAN günün bir sonrası).
  // Tamamlama/oto-kapanış S3 (D46); S2'de finishedAt hep boş → aynı gün devam eder.
  const sessions = runSessions(state, run);
  const todaySession = sessions.find((s) => s.date === ui.today && s.finishedAt === undefined);
  const next = suggestNextDay(program, sessions);
  const suggestion = todaySession ? { dayId: todaySession.dayId, week: todaySession.week } : { dayId: next.dayId, week: next.week };
  const dayId = ui.selDayId ?? suggestion.dayId;
  const week = ui.selWeek ?? suggestion.week;
  const day = program.days.find((d) => d.dayId === dayId) ?? null;
  if (!day) return { ...EMPTY, run, program, week, suggestion };

  const session = resolveSession(state, run, program, ui.today, dayId, week);
  const cards = day.items
    .map((pr, slot) => exerciseCard(state, session, slot, pr))
    .filter((c): c is ExerciseCard => c !== null);
  return { run, program, day, session, week, suggestion, cards };
}
