import { useState } from 'preact/hooks';
import type { AppState, Exercise, ExerciseKind } from '../../domain/types';
import type { Action, RecordAt } from '../../app/actions';
import { substitutionOptions } from '../../app/selectors';
import { makeExerciseId } from '../../domain/ids';
import { parseNum } from '../format';

const KINDS: { value: ExerciseKind; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'db', label: 'Dambıl' },
  { value: 'mac', label: 'Makine' },
  { value: 'time', label: 'Süre' },
];

/** İkame paneli (D47): önce aynı bölge katalog listesi, en altta yerinde yeni hareket. */
export function SubstituteSheet({
  state,
  at,
  dispatch,
  onClose,
}: {
  state: AppState;
  at: RecordAt;
  dispatch: (a: Action) => void;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const options = substitutionOptions(state, at.exId);

  const substitute = (newExId: Exercise['id']) => {
    dispatch({ type: 'substitute', at, newExId, updatedAt: Date.now() });
    onClose();
  };

  return (
    <div class="sheet">
      <p class="view__hint">İkame — yalnız bu seans (program değişmez)</p>
      {options.map((e) => (
        <button key={e.id} type="button" class="sheet__opt" onClick={() => substitute(e.id)}>
          <span>{e.name}</span>
          <span class="status">{e.zone}</span>
        </button>
      ))}

      {creating ? (
        <NewExerciseForm
          state={state}
          onCreate={(ex) => {
            dispatch({ type: 'addExercise', exercise: ex, updatedAt: Date.now() });
            substitute(ex.id);
          }}
        />
      ) : (
        <button type="button" class="link" onClick={() => setCreating(true)}>
          + Yerinde yeni hareket
        </button>
      )}
      <button type="button" class="link" onClick={onClose}>
        Kapat
      </button>
    </div>
  );
}

function NewExerciseForm({ state, onCreate }: { state: AppState; onCreate: (ex: Exercise) => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ExerciseKind>('mac');
  const [zone, setZone] = useState('');
  const [inc, setInc] = useState('2,5');

  const create = () => {
    if (!name.trim()) return;
    const id = makeExerciseId(name, Object.keys(state.catalog.exercises)); // slug + çakışma koruması
    onCreate({ id, name: name.trim(), kind, zone: zone.trim(), inc: parseNum(inc) ?? 2.5, userModified: true });
  };

  return (
    <div class="newex">
      <input class="note" placeholder="Ad" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
      <select
        class="note"
        value={kind}
        onChange={(e) => setKind((e.currentTarget as HTMLSelectElement).value as ExerciseKind)}
      >
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      <input class="note" placeholder="Bölge" value={zone} onInput={(e) => setZone((e.currentTarget as HTMLInputElement).value)} />
      <input class="num" inputMode="decimal" placeholder="Artış" value={inc} onInput={(e) => setInc((e.currentTarget as HTMLInputElement).value)} />
      <button type="button" class="btn" onClick={create}>
        Ekle ve ikame et
      </button>
    </div>
  );
}
