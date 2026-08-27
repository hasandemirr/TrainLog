import { useState } from 'preact/hooks';
import type { AppState, Prescribed, Program, ProgramDay } from '../../domain/types';
import type { Action } from '../../app/actions';
import type { ExerciseId, RunId } from '../../domain/ids';
import { asExerciseId, asProgramId, asRunId } from '../../domain/ids';
import { activeExercises, activeRun, programOf } from '../../app/selectors';
import {
  addDayItem,
  moveDayItem,
  nextProgramVersion,
  removeDayItem,
  validatePrescribed,
  validateRirInput,
} from '../../domain/program';
import type { ItemsDay, PrescribedError } from '../../domain/program';
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
  'rir-incomplete': 'RIR: iki alan da dolmalı',
  'rir-lo-gt-hi': 'RIR alt > üst',
  'rir-negative': 'RIR negatif olamaz',
};

/** Yeni yuvanın varsayılanları (kullanıcı hemen düzenler; hepsi geçerli). */
const NEW_ITEM = { sets: 3, lo: 8, hi: 12, rest: 90 };

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

// ── Düzenleme (F3.2) ───────────────────────────────────────────────────────
// Taslak öğe = Prescribed'ın RIR'i AYRIK iki alan olarak tutulan hâli: form
// "yarım girilmiş RIR"ı temsil edebilmeli (domain tipi edemez). Kaydederken
// yalnızca iki alan da doluysa rir yazılır. Ekleme/çıkarma/sıralama domain'in
// saf yardımcılarıyla yapılır (UI'da kopya mantık yok); kaydet yolu değişmedi:
// nextProgramVersion → saveProgramVersion (D15).
interface Draft {
  exId: ExerciseId;
  sets: number;
  lo: number;
  hi: number;
  rest: number;
  rirLo: number | null;
  rirHi: number | null;
}

const toDraft = (it: Prescribed): Draft => ({
  exId: it.exId,
  sets: it.sets,
  lo: it.lo,
  hi: it.hi,
  rest: it.rest,
  rirLo: it.rir ? it.rir[0] : null,
  rirHi: it.rir ? it.rir[1] : null,
});

const toPrescribed = (d: Draft): Prescribed => {
  const base: Prescribed = { exId: d.exId, sets: d.sets, lo: d.lo, hi: d.hi, rest: d.rest };
  return d.rirLo !== null && d.rirHi !== null ? { ...base, rir: [d.rirLo, d.rirHi] } : base;
};

const draftErrors = (d: Draft): PrescribedError[] => [
  ...validatePrescribed(toPrescribed(d)).filter((e) => !e.startsWith('rir-')),
  ...validateRirInput(d.rirLo, d.rirHi),
];

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
  const [days, setDays] = useState<ItemsDay<Draft>[]>(() =>
    program.days.map((d) => ({ ...d, items: d.items.map(toDraft) })),
  );
  const [pick, setPick] = useState<Record<string, string>>({});
  const options = activeExercises(state);

  const issues = days.flatMap((d) => d.items.map((it, slot) => ({ dayId: d.dayId, slot, errors: draftErrors(it) })));
  const blocked = issues.some((x) => x.errors.length > 0);
  const errAt = (dayId: string, slot: number) => issues.find((x) => x.dayId === dayId && x.slot === slot)?.errors ?? [];

  const setField = (di: number, si: number, patch: Partial<Draft>) =>
    setDays((ds) => ds.map((d, i) => (i === di ? { ...d, items: d.items.map((it, j) => (j === si ? { ...it, ...patch } : it)) } : d)));

  const addItem = (dayId: string) => {
    const exId = pick[dayId] ?? options[0]?.id;
    if (exId === undefined) return;
    setDays((ds) => addDayItem(ds, dayId, { exId: asExerciseId(exId), ...NEW_ITEM, rirLo: null, rirHi: null }));
  };

  const save = () => {
    if (blocked) return;
    const newDays: ProgramDay[] = days.map((d) => {
      const day: ProgramDay = { dayId: d.dayId, items: d.items.map(toPrescribed) };
      return d.label === undefined ? day : { ...day, label: d.label };
    });
    const newId = asProgramId(`${program.familyId}_r${program.rev + 1}`);
    dispatch({ type: 'saveProgramVersion', program: nextProgramVersion(program, newDays, newId), runId, updatedAt: Date.now() });
    onDone();
  };

  return (
    <section class="view">
      <h1 class="view__title">Program düzenle</h1>
      <p class="view__hint">
        Kaydet → yeni sürüm (v{program.rev + 1}); geçmiş seanslar eski sürümde kalır (D15).
        Yuva ekleme/çıkarma ve sıralama da bu sürümle birlikte kaydedilir.
      </p>
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
              <div key={`${d.dayId}#${si}#${it.exId}`} class="editrow">
                <div class="editrow__head">
                  <span>
                    {si + 1}. {ex?.name ?? it.exId}
                  </span>
                  <span class="editrow__ops">
                    <button
                      type="button"
                      class="link"
                      aria-label={`${d.dayId} ${si + 1}. yuvayı yukarı taşı`}
                      disabled={si === 0}
                      onClick={() => setDays((ds) => moveDayItem(ds, d.dayId, si, -1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      class="link"
                      aria-label={`${d.dayId} ${si + 1}. yuvayı aşağı taşı`}
                      disabled={si === d.items.length - 1}
                      onClick={() => setDays((ds) => moveDayItem(ds, d.dayId, si, 1))}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      class="link danger__link"
                      aria-label={`${d.dayId} ${si + 1}. yuvayı çıkar`}
                      onClick={() => setDays((ds) => removeDayItem(ds, d.dayId, si))}
                    >
                      Çıkar
                    </button>
                  </span>
                </div>
                <div class="editfields">
                  <label>
                    set <NumInput value={it.sets} inputMode="numeric" ariaLabel={`${d.dayId} ${si + 1}. yuva set`} onCommit={(v) => setField(di, si, { sets: v ?? 0 })} />
                  </label>
                  <label>
                    alt <NumInput value={it.lo} inputMode="numeric" ariaLabel={`${d.dayId} ${si + 1}. yuva alt`} onCommit={(v) => setField(di, si, { lo: v ?? 0 })} />
                  </label>
                  <label>
                    üst <NumInput value={it.hi} inputMode="numeric" ariaLabel={`${d.dayId} ${si + 1}. yuva üst`} onCommit={(v) => setField(di, si, { hi: v ?? 0 })} />
                  </label>
                  <label>
                    dinl. <NumInput value={it.rest} inputMode="numeric" ariaLabel={`${d.dayId} ${si + 1}. yuva dinlenme`} onCommit={(v) => setField(di, si, { rest: v ?? 0 })} />
                  </label>
                  <label>
                    RIR alt <NumInput value={it.rirLo} placeholder="—" inputMode="decimal" ariaLabel={`${d.dayId} ${si + 1}. yuva RIR alt`} onCommit={(v) => setField(di, si, { rirLo: v })} />
                  </label>
                  <label>
                    RIR üst <NumInput value={it.rirHi} placeholder="—" inputMode="decimal" ariaLabel={`${d.dayId} ${si + 1}. yuva RIR üst`} onCommit={(v) => setField(di, si, { rirHi: v })} />
                  </label>
                </div>
                {errs.length > 0 && <p class="warn">{errs.map((e) => PRESC_ERR[e]).join(', ')}</p>}
              </div>
            );
          })}

          <div class="editrow editadd">
            <label class="measrow">
              <span>Hareket ekle</span>
              <select
                class="note"
                aria-label={`${d.dayId} için hareket`}
                value={pick[d.dayId] ?? options[0]?.id ?? ''}
                onChange={(e) => {
                  const v = (e.currentTarget as HTMLSelectElement).value;
                  setPick((p) => ({ ...p, [d.dayId]: v }));
                }}
              >
                {options.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" class="link" aria-label={`${d.dayId} yuvasına ekle`} onClick={() => addItem(d.dayId)}>
              + Yuvaya ekle
            </button>
          </div>
          {d.items.length === 0 && <p class="status">Bu günde yuva yok.</p>}
        </div>
      ))}
      <div class="exercise__actions">
        <button type="button" class="btn" disabled={blocked} onClick={save}>
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
