import { useState } from 'preact/hooks';
import type { AppState } from '../../domain/types';
import type { Action } from '../../app/actions';
import type { ExerciseId } from '../../domain/ids';
import {
  exerciseSeries,
  generalStats,
  measureFields,
  measureSeries,
  sessionSummary,
  sessionsByDate,
  trackedExercises,
} from '../../app/selectors';
import { LineChart } from '../components/LineChart';
import { SummaryCard } from '../components/SummaryCard';
import { NumInput } from '../components/NumInput';
import { fmtNum, setsSummary } from '../format';

interface Props {
  state: AppState;
  today: string;
  dispatch: (a: Action) => void;
}
type Seg = 'exercise' | 'calendar' | 'measure';

export function ProgressView({ state, today, dispatch }: Props) {
  const [seg, setSeg] = useState<Seg>('exercise');
  const stats = generalStats(state);

  return (
    <section class="view">
      <h1 class="view__title">İlerleme</h1>
      <div class="card">
        <p class="status">
          {stats.sessions} seans · {stats.records} kayıt · toplam hacim {fmtNum(stats.totalVolume)} · {stats.exercisesTracked} hareket
        </p>
      </div>

      <div class="segnav" role="tablist">
        {(['exercise', 'calendar', 'measure'] as Seg[]).map((sgm) => (
          <button key={sgm} type="button" class={'seg' + (seg === sgm ? ' seg--active' : '')} onClick={() => setSeg(sgm)}>
            {sgm === 'exercise' ? 'Hareket' : sgm === 'calendar' ? 'Takvim' : 'Ölçüm'}
          </button>
        ))}
      </div>

      {seg === 'exercise' && <ExerciseProgress state={state} />}
      {seg === 'calendar' && <CalendarSection state={state} today={today} />}
      {seg === 'measure' && <MeasureSection state={state} today={today} dispatch={dispatch} />}
    </section>
  );
}

function ExerciseProgress({ state }: { state: AppState }) {
  const tracked = trackedExercises(state);
  const [exId, setExId] = useState<ExerciseId | ''>('');
  const [metric, setMetric] = useState<'kg' | 'volume'>('kg');
  if (tracked.length === 0) {
    return <p class="view__hint">Henüz kayıt yok. Bir antrenman gir, ilerlemen burada belirsin.</p>;
  }
  const selected = (exId || tracked[0]!.id) as ExerciseId;
  const series = exerciseSeries(state, selected);
  const pts = metric === 'kg' ? series.filter((p) => p.topKg !== null) : series;
  const values = pts.map((p) => (metric === 'kg' ? (p.topKg as number) : p.volume));

  return (
    <div>
      <select class="note" value={selected} onChange={(e) => setExId((e.currentTarget as HTMLSelectElement).value as ExerciseId)}>
        {tracked.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>
      <div class="segnav">
        <button type="button" class={'seg' + (metric === 'kg' ? ' seg--active' : '')} onClick={() => setMetric('kg')}>
          kg
        </button>
        <button type="button" class={'seg' + (metric === 'volume' ? ' seg--active' : '')} onClick={() => setMetric('volume')}>
          hacim
        </button>
      </div>
      {values.length > 0 ? (
        <LineChart values={values} ariaLabel={`${metric === 'kg' ? 'kg' : 'hacim'} eğrisi`} />
      ) : (
        <p class="view__hint">Bu metrik için veri yok.</p>
      )}
      <ul class="serieslist">
        {series
          .slice()
          .reverse()
          .map((p) => (
            <li key={p.sessionId}>
              {p.date} · {setsSummary(p.record.sets)} · hacim {fmtNum(p.volume)}
            </li>
          ))}
      </ul>
    </div>
  );
}

function CalendarSection({ state, today }: { state: AppState; today: string }) {
  const parts = today.split('-').map(Number);
  const [ym, setYm] = useState({ y: parts[0] ?? 2026, m: parts[1] ?? 1 });
  const [selDate, setSelDate] = useState<string | null>(null);
  const byDate = sessionsByDate(state);

  const pad = (n: number) => String(n).padStart(2, '0');
  const firstDow = (new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay() + 6) % 7; // Pazartesi = 0
  const days = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${ym.y}-${pad(ym.m)}-${pad(d)}`);

  const shift = (delta: number) => {
    const idx = ym.m - 1 + delta;
    setSelDate(null);
    setYm({ y: ym.y + Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 + 1 });
  };
  const selSessions = selDate ? byDate[selDate] ?? [] : [];

  return (
    <div>
      <div class="calnav">
        <button type="button" class="link" aria-label="Önceki ay" onClick={() => shift(-1)}>
          ‹
        </button>
        <span>
          {ym.y}-{pad(ym.m)}
        </span>
        <button type="button" class="link" aria-label="Sonraki ay" onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div class="calgrid">
        {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((hd) => (
          <span key={hd} class="calhead">
            {hd}
          </span>
        ))}
        {cells.map((date, i) =>
          date === null ? (
            <span key={`e${i}`} class="calcell calcell--empty" />
          ) : (
            <button
              key={date}
              type="button"
              class={'calcell' + (byDate[date] ? ' calcell--has' : '') + (date === selDate ? ' calcell--sel' : '')}
              onClick={() => setSelDate(date)}
            >
              {Number(date.slice(-2))}
            </button>
          ),
        )}
      </div>
      {selSessions.map((s) => (
        <SummaryCard key={s.id} summary={sessionSummary(state, s)} />
      ))}
      {selDate !== null && selSessions.length === 0 && <p class="view__hint">Bu günde seans yok.</p>}
    </div>
  );
}

const MEASURE_FIELDS: { key: string; label: string }[] = [
  { key: 'kilo', label: 'Kilo' },
  { key: 'bel', label: 'Bel' },
  { key: 'gogus', label: 'Göğüs' },
  { key: 'omuz', label: 'Omuz' },
  { key: 'kol', label: 'Kol' },
  { key: 'uyluk', label: 'Uyluk' },
];

function MeasureSection({ state, today, dispatch }: { state: AppState; today: string; dispatch: (a: Action) => void }) {
  const [date, setDate] = useState(today);
  const row = state.measures[date] ?? {};
  const fields = measureFields(state);

  return (
    <div>
      <label class="status">
        Tarih{' '}
        <input class="note" type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <div class="measform">
        {MEASURE_FIELDS.map((f) => (
          <label key={f.key} class="measrow">
            <span>{f.label}</span>
            <NumInput
              value={typeof row[f.key] === 'number' ? (row[f.key] as number) : null}
              placeholder="—"
              inputMode="decimal"
              ariaLabel={f.label}
              onCommit={(v) => dispatch({ type: 'setMeasure', date, field: f.key, value: v, updatedAt: Date.now() })}
            />
          </label>
        ))}
      </div>

      {fields.length === 0 && <p class="view__hint">Henüz ölçüm yok. Yukarıdan gir.</p>}
      {fields.map((f) => {
        const s = measureSeries(state, f);
        const label = MEASURE_FIELDS.find((x) => x.key === f)?.label ?? f;
        return (
          <div key={f} class="card">
            <p class="view__hint">{label} — eğilim</p>
            <LineChart values={s.map((p) => p.value)} ariaLabel={`${label} eğilimi`} />
            <ul class="serieslist">
              {s
                .slice()
                .reverse()
                .map((p) => (
                  <li key={p.date}>
                    {p.date} · {fmtNum(p.value)}
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
