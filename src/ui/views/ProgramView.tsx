import { useState } from 'preact/hooks';
import type { AppState, Program, ProgramDay } from '../../domain/types';
import type { Action } from '../../app/actions';
import type { RunId } from '../../domain/ids';
import { asProgramId, asRunId } from '../../domain/ids';
import { activeRun, programOf } from '../../app/selectors';
import { nextProgramVersion, validateProgram } from '../../domain/program';
import type { PrescribedError } from '../../domain/program';
import { NumInput } from '../components/NumInput';
import { NewExerciseForm } from '../components/NewExerciseForm';

interface Props {
  state: AppState;
  today: string;
  dispatch: (a: Action) => void;
  idgen: () => string;
}

const PRESC_ERR: Record<PrescribedError, string> = {
  'lo-gt-hi': 'alt > üst',
  'sets-lt-1': 'set ≥ 1',
  'rest-not-positive': 'dinlenme > 0',
};

type Mode = 'view' | 'edit' | 'catalog';

export function ProgramView({ state, today, dispatch, idgen }: Props) {
  const [mode, setMode] = useState<Mode>('view');
  const run = activeRun(state);
  const program = run ? programOf(state, run) : null;

  if (!run || !program) {
    return (
      <section class="view">
        <h1 class="view__title">Program</h1>
        <p class="view__hint">Etkin program yok.</p>
      </section>
    );
  }

  if (mode === 'edit') {
    return <EditProgram state={state} program={program} runId={run.id} dispatch={dispatch} onDone={() => setMode('view')} />;
  }
  if (mode === 'catalog') {
    return <Catalog state={state} dispatch={dispatch} onDone={() => setMode('view')} />;
  }

  const startNewRun = () => {
    dispatch({
      type: 'startRun',
      run: { id: asRunId(idgen()), familyId: program.familyId, currentProgId: program.id, startDate: today },
      today,
      updatedAt: Date.now(),
    });
  };
  const newProgram = () => {
    const fam = `fam_${idgen()}`;
    const prog: Program = {
      id: asProgramId(`${fam}_r1`),
      familyId: fam,
      rev: 1,
      name: `${program.name} (kopya)`,
      userModified: true,
      days: JSON.parse(JSON.stringify(program.days)) as ProgramDay[],
    };
    dispatch({
      type: 'startRun',
      program: prog,
      run: { id: asRunId(idgen()), familyId: fam, currentProgId: prog.id, startDate: today },
      today,
      updatedAt: Date.now(),
    });
  };

  return (
    <section class="view">
      <h1 class="view__title">Program</h1>
      <p class="view__hint">
        {program.name} · sürüm {program.rev}
      </p>
      {program.days.map((d) => (
        <div key={d.dayId} class="card">
          <div class="exercise__head">
            <strong>{d.dayId}</strong>
            <span class="status">{d.label}</span>
          </div>
          {d.items.map((it, i) => {
            const ex = state.catalog.exercises[it.exId];
            return (
              <p key={i} class="status">
                {ex?.name ?? it.exId} — {it.sets}×{it.lo}-{it.hi}
                {ex?.kind === 'time' ? ' sn' : ''}
                {it.rir ? ` · RIR ${it.rir[0]}-${it.rir[1]}` : ''} · {it.rest} sn
              </p>
            );
          })}
        </div>
      ))}
      <div class="exercise__actions">
        <button type="button" class="btn" onClick={() => setMode('edit')}>
          Düzenle
        </button>
        <button type="button" class="link" onClick={() => setMode('catalog')}>
          Katalog
        </button>
        <button type="button" class="link" onClick={startNewRun}>
          Yeni koşu
        </button>
        <button type="button" class="link" onClick={newProgram}>
          Yeni program
        </button>
      </div>
    </section>
  );
}

function EditProgram({
  state,
  program,
  runId,
  dispatch,
  onDone,
}: {
  state: AppState;
  program: Program;
  runId: RunId;
  dispatch: (a: Action) => void;
  onDone: () => void;
}) {
  const [days, setDays] = useState<ProgramDay[]>(() => JSON.parse(JSON.stringify(program.days)) as ProgramDay[]);
  const issues = validateProgram({ ...program, days });
  const errAt = (dayId: string, slot: number) => issues.find((x) => x.dayId === dayId && x.slot === slot)?.errors ?? [];
  const setField = (di: number, si: number, patch: Partial<{ sets: number; lo: number; hi: number; rest: number }>) =>
    setDays((ds) => ds.map((d, i) => (i === di ? { ...d, items: d.items.map((it, j) => (j === si ? { ...it, ...patch } : it)) } : d)));

  const save = () => {
    if (issues.length > 0) return;
    const newId = asProgramId(`${program.familyId}_r${program.rev + 1}`);
    dispatch({ type: 'saveProgramVersion', program: nextProgramVersion(program, days, newId), runId, updatedAt: Date.now() });
    onDone();
  };

  return (
    <section class="view">
      <h1 class="view__title">Program düzenle</h1>
      <p class="view__hint">Kaydet → yeni sürüm (v{program.rev + 1}); geçmiş seanslar eski sürümde kalır (D15).</p>
      {days.map((d, di) => (
        <div key={d.dayId} class="card">
          <div class="exercise__head">
            <strong>{d.dayId}</strong>
            <span class="status">{d.label}</span>
          </div>
          {d.items.map((it, si) => {
            const ex = state.catalog.exercises[it.exId];
            const errs = errAt(d.dayId, si);
            return (
              <div key={si} class="editrow">
                <span>{ex?.name ?? it.exId}</span>
                <div class="editfields">
                  <label>set <NumInput value={it.sets} inputMode="numeric" ariaLabel="set" onCommit={(v) => setField(di, si, { sets: v ?? 0 })} /></label>
                  <label>alt <NumInput value={it.lo} inputMode="numeric" ariaLabel="alt" onCommit={(v) => setField(di, si, { lo: v ?? 0 })} /></label>
                  <label>üst <NumInput value={it.hi} inputMode="numeric" ariaLabel="üst" onCommit={(v) => setField(di, si, { hi: v ?? 0 })} /></label>
                  <label>dinl. <NumInput value={it.rest} inputMode="numeric" ariaLabel="dinlenme" onCommit={(v) => setField(di, si, { rest: v ?? 0 })} /></label>
                </div>
                {errs.length > 0 && <p class="warn">{errs.map((e) => PRESC_ERR[e]).join(', ')}</p>}
              </div>
            );
          })}
        </div>
      ))}
      <div class="exercise__actions">
        <button type="button" class="btn" disabled={issues.length > 0} onClick={save}>
          Kaydet (yeni sürüm)
        </button>
        <button type="button" class="link" onClick={onDone}>
          İptal
        </button>
      </div>
    </section>
  );
}

function Catalog({ state, dispatch, onDone }: { state: AppState; dispatch: (a: Action) => void; onDone: () => void }) {
  const [creating, setCreating] = useState(false);
  const exercises = Object.values(state.catalog.exercises).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  return (
    <section class="view">
      <h1 class="view__title">Katalog</h1>
      <p class="view__hint">Silme yok — arşivlenen hareket geçmişte yaşar, yeni sürümlere eklenmez.</p>
      {exercises.map((ex) => (
        <div key={ex.id} class="card">
          <div class="exercise__head">
            <strong>
              {ex.name}
              {ex.archived ? ' · arşiv' : ''}
            </strong>
            <span class="status">{ex.zone}</span>
          </div>
          {ex.archived !== true && (
            <button type="button" class="link" onClick={() => dispatch({ type: 'archiveExercise', exId: ex.id, updatedAt: Date.now() })}>
              Arşivle
            </button>
          )}
        </div>
      ))}

      {creating ? (
        <NewExerciseForm
          state={state}
          onCreate={(ex) => {
            dispatch({ type: 'addExercise', exercise: ex, updatedAt: Date.now() });
            setCreating(false);
          }}
        />
      ) : (
        <button type="button" class="link" onClick={() => setCreating(true)}>
          + Yeni hareket
        </button>
      )}
      <div class="exercise__actions">
        <button type="button" class="link" onClick={onDone}>
          Kapat
        </button>
      </div>
    </section>
  );
}
