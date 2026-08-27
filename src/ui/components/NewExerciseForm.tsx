import { useState } from 'preact/hooks';
import type { AppState, Exercise, ExerciseKind } from '../../domain/types';
import { makeExerciseId } from '../../domain/ids';
import { parseNum } from '../format';

const KINDS: { value: ExerciseKind; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'db', label: 'Dambıl' },
  { value: 'mac', label: 'Makine' },
  { value: 'time', label: 'Süre' },
];

/** Yerinde yeni hareket (D47): 4 alan; kimlik slug-çakışma korumalı, userModified. */
export function NewExerciseForm({ state, onCreate }: { state: AppState; onCreate: (ex: Exercise) => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ExerciseKind>('mac');
  const [zone, setZone] = useState('');
  const [inc, setInc] = useState('2,5');

  const create = () => {
    if (!name.trim()) return;
    const id = makeExerciseId(name, Object.keys(state.catalog.exercises));
    onCreate({ id, name: name.trim(), kind, zone: zone.trim(), inc: parseNum(inc) ?? 2.5, userModified: true });
  };

  return (
    <div class="newex">
      <input class="note" placeholder="Ad" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
      <select class="note" value={kind} onChange={(e) => setKind((e.currentTarget as HTMLSelectElement).value as ExerciseKind)}>
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      <input class="note" placeholder="Bölge" value={zone} onInput={(e) => setZone((e.currentTarget as HTMLInputElement).value)} />
      <input class="num" inputMode="decimal" placeholder="Artış" value={inc} onInput={(e) => setInc((e.currentTarget as HTMLInputElement).value)} />
      <button type="button" class="btn" onClick={create}>
        Ekle
      </button>
    </div>
  );
}
