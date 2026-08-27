import { useState } from 'preact/hooks';
import type { AppState, Exercise } from '../../domain/types';
import type { Action, RecordAt } from '../../app/actions';
import { substitutionOptions } from '../../app/selectors';
import { NewExerciseForm } from './NewExerciseForm';

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
