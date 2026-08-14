// domain/session.ts — seans doğumu (D17) + döngü önerisi (D44). Saf; import yok.
import { parseSessionId, sessionId } from './ids';
import type { ISODate, ProgramId, RunId, SessionId } from './ids';
import type { Program, Session } from './types';

/** Seans sıralaması: tarihe, sonra gün-içi sıraya göre. Tek kaynak. */
export function compareSessions(a: SessionId, b: SessionId): number {
  const pa = parseSessionId(a);
  const pb = parseSessionId(b);
  return pa.date < pb.date ? -1 : pa.date > pb.date ? 1 : pa.seq - pb.seq;
}

/** Bir tarih için sonraki gün-içi sıra: #1 varsayılan, aynı güne telafi #2 … (D17). */
export function nextSeq(sessions: Record<SessionId, Session>, date: ISODate): number {
  let max = 0;
  for (const s of Object.values(sessions)) {
    if (s.date === date) max = Math.max(max, parseSessionId(s.id).seq);
  }
  return max + 1;
}

/**
 * Seans doğumu — tarih AÇILDIĞI ANDA sabitlenir (param olarak gelir), kayıt anında
 * "şimdi"den türetilmez (D17). Gece yarısı geçişi kayıtları bölmez.
 */
export function createSession(params: {
  date: ISODate;
  seq: number;
  runId: RunId;
  progId: ProgramId;
  dayId: string;
  week: number;
}): Session {
  const { date, seq, runId, progId, dayId, week } = params;
  return { id: sessionId(date, seq), date, runId, progId, dayId, week };
}

/**
 * Döngüden önerilen gün + hafta (D44): son seansın bir sonraki günü; devir başa
 * dönünce (son gün → ilk gün) hafta artar. Boşsa Gün 1 / hafta 1.
 * `sessions` çağıran tarafça ilgili koşuya filtrelenmiş gelir (domain saf kalır).
 */
export function suggestNextDay(
  program: Program,
  sessions: Session[],
): { dayId: string; dayIndex: number; week: number } {
  const days = program.days;
  if (days.length === 0) return { dayId: '', dayIndex: 0, week: 1 };
  if (sessions.length === 0) return { dayId: days[0]!.dayId, dayIndex: 0, week: 1 };

  const last = sessions.reduce((a, b) => (compareSessions(a.id, b.id) >= 0 ? a : b));
  const lastIdx = days.findIndex((d) => d.dayId === last.dayId);
  if (lastIdx < 0) return { dayId: days[0]!.dayId, dayIndex: 0, week: last.week };

  const nextIdx = (lastIdx + 1) % days.length;
  const week = last.week + (nextIdx === 0 ? 1 : 0);
  return { dayId: days[nextIdx]!.dayId, dayIndex: nextIdx, week };
}
