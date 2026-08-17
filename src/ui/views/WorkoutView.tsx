import { useState } from 'preact/hooks';
import type { AppState, ExRecord, Session, SetEntry } from '../../domain/types';
import { sessionSummary, workoutModel } from '../../app/selectors';
import type { ExerciseCard } from '../../app/selectors';
import type { Action } from '../../app/actions';
import type { Advice, HoldReason } from '../../domain/progression';
import type { SessionId } from '../../domain/ids';
import { NumInput } from '../components/NumInput';
import { SubstituteSheet } from '../components/SubstituteSheet';
import { fmtNum } from '../format';

interface Props {
  state: AppState;
  today: string;
  dispatch: (action: Action) => void;
}

const HOLD_TEXT: Record<HoldReason, string> = {
  'sets-incomplete': 'Beklet: setleri tamamla',
  'reps-below-top': 'Beklet: üst tekrara ulaş',
  'rir-not-maintained': 'Beklet: RIR korunamadı',
  'db-step-too-big': 'Beklet: kademe büyük, tekrar biriktir',
};

function hintText(a: Advice): string {
  if (a.kind === 'increase') return a.unit === 'kg' ? `Artır: +${fmtNum(a.amount)} kg` : `Artır: +${a.amount} sn`;
  return HOLD_TEXT[a.reason];
}

function summarize(rec: ExRecord): string {
  const parts = rec.sets
    .filter((s) => s.reps !== null)
    .map((s) => (s.kg !== null ? `${fmtNum(s.kg)}×${s.reps}` : `${s.reps} sn`));
  return parts.length > 0 ? parts.join(', ') : '—';
}

export function WorkoutView({ state, today, dispatch }: Props) {
  const [selDayId, setSelDayId] = useState<string | undefined>(undefined);
  const [summaryId, setSummaryId] = useState<SessionId | null>(null);
  const model = workoutModel(state, { today, selDayId });

  const summarySession = summaryId ? state.sessions[summaryId] : undefined;
  if (summarySession) {
    const sum = sessionSummary(state, summarySession);
    return (
      <section class="view">
        <h1 class="view__title">Seans özeti</h1>
        <div class="card">
          <p class="view__hint">
            {sum.dayLabel} · {sum.totalSets} set · toplam hacim {fmtNum(sum.totalVolume)}
          </p>
          {sum.entries.map((e) => (
            <p key={e.exercise.id}>
              <strong>{e.exercise.name}</strong> — {summarize(e.record)}
            </p>
          ))}
        </div>
        <button type="button" class="btn" onClick={() => setSummaryId(null)}>
          Tamam
        </button>
      </section>
    );
  }

  if (!model.program || !model.day || !model.session) {
    return (
      <section class="view">
        <h1 class="view__title">Antrenman</h1>
        <p class="view__hint">Program yükleniyor…</p>
      </section>
    );
  }

  const { program, day, session, week } = model;
  const born = state.sessions[session.id] !== undefined;

  return (
    <section class="view">
      <h1 class="view__title">Antrenman</h1>

      <div class="dayswitch" role="group" aria-label="Gün seçimi">
        {program.days.map((d) => (
          <button
            key={d.dayId}
            type="button"
            class={'chip' + (d.dayId === day.dayId ? ' chip--active' : '')}
            aria-current={d.dayId === day.dayId ? 'true' : undefined}
            onClick={() => setSelDayId(d.dayId)}
          >
            {d.label ?? d.dayId}
          </button>
        ))}
      </div>
      <p class="view__hint">
        {day.dayId} · {day.label} · Hafta {week}
        {selDayId === undefined ? ' (önerilen)' : ''}
      </p>

      {model.cards.map((card) => (
        <ExerciseCardView key={card.slot} state={state} card={card} session={session} dispatch={dispatch} />
      ))}

      {born && (
        <button
          type="button"
          class="btn"
          onClick={() => {
            setSummaryId(session.id);
            dispatch({ type: 'finish', sessionId: session.id, finishedAt: Date.now() });
          }}
        >
          Bitir
        </button>
      )}
    </section>
  );
}

function ExerciseCardView({
  state,
  card,
  session,
  dispatch,
}: {
  state: AppState;
  card: ExerciseCard;
  session: Session;
  dispatch: (action: Action) => void;
}) {
  const { exercise, prescribed, current, last, hint, drop } = card;
  const [sheet, setSheet] = useState(false);
  const isTime = exercise.kind === 'time';
  const at = { session, slot: card.slot, exId: exercise.id, targetSets: prescribed.sets };
  const sets: SetEntry[] = current?.sets ?? Array.from({ length: prescribed.sets }, () => ({ kg: null, reps: null }));

  const commitSet = (setIdx: number, patch: Partial<SetEntry>) =>
    dispatch({ type: 'setSet', at, setIdx, patch, updatedAt: Date.now() });

  return (
    <div class="card exercise">
      <div class="exercise__head">
        <strong>{exercise.name}</strong>
        <span class="status">{exercise.zone}</span>
      </div>

      <p class="status">
        Hedef: {prescribed.sets}×{prescribed.lo}-{prescribed.hi}
        {isTime ? ' sn' : ''}
        {prescribed.rir ? ` · RIR ${prescribed.rir[0]}-${prescribed.rir[1]}` : ''} · {prescribed.rest} sn dinlenme
      </p>

      {last ? (
        <p class="status">
          Geçen: {summarize(last.record)}{' '}
          <button type="button" class="link" onClick={() => dispatch({ type: 'takePrevious', at, sets: last.record.sets, updatedAt: Date.now() })}>
            geçeni al
          </button>
        </p>
      ) : (
        <p class="status">Geçen seans yok</p>
      )}

      {sets.map((s, i) => (
        <div class="setrow" key={i}>
          <span class="setrow__n">{i + 1}</span>
          {!isTime && (
            <NumInput value={s.kg} placeholder="kg" inputMode="decimal" ariaLabel={`${i + 1}. set kg`} onCommit={(kg) => commitSet(i, { kg })} />
          )}
          <NumInput value={s.reps} placeholder={isTime ? 'sn' : 'tekrar'} inputMode="numeric" ariaLabel={`${i + 1}. set ${isTime ? 'saniye' : 'tekrar'}`} onCommit={(reps) => commitSet(i, { reps })} />
        </div>
      ))}

      <div class="exercise__actions">
        <button type="button" class="link" onClick={() => dispatch({ type: 'addSet', at, updatedAt: Date.now() })}>
          + set
        </button>
        <button
          type="button"
          class="link"
          onClick={() => dispatch({ type: 'startTimer', tEnd: Date.now() + prescribed.rest * 1000, label: exercise.name, updatedAt: Date.now() })}
        >
          Dinlen ({prescribed.rest} sn)
        </button>
        <button type="button" class="link" onClick={() => setSheet((v) => !v)}>
          İkame
        </button>
      </div>

      <div class="exercise__meta">
        {!isTime && (
          <NumInput value={current?.rir ?? null} placeholder="RIR" inputMode="decimal" ariaLabel="RIR" onCommit={(rir) => dispatch({ type: 'setRir', at, rir, updatedAt: Date.now() })} />
        )}
        <input class="note" type="text" placeholder="not" aria-label="not" value={current?.note ?? ''} onInput={(e) => dispatch({ type: 'setNote', at, note: (e.currentTarget as HTMLInputElement).value, updatedAt: Date.now() })} />
      </div>

      {hint && <p class={'hint hint--' + hint.kind}>{hintText(hint)}</p>}
      {drop && <p class="warn">Düşüş: geçen seansın altında</p>}

      {sheet && <SubstituteSheet state={state} at={at} dispatch={dispatch} onClose={() => setSheet(false)} />}
    </div>
  );
}
