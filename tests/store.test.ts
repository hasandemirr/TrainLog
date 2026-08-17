import { describe, expect, it, vi } from 'vitest';
import { createStore, initState, sow } from '../src/app/store';
import { reduce } from '../src/app/actions';
import type { RecordAt } from '../src/app/actions';
import { emptyState } from '../src/domain/state';
import { createSession } from '../src/domain/session';
import { asExerciseId, asProgramId, asRunId, recordKey } from '../src/domain/ids';
import type { StoragePort } from '../src/app/ports';
import { isAppState } from '../src/domain/validate';
import { SEED } from '../src/content/seed';

function fakeStorage() {
  let raw: string | null = null;
  const port: StoragePort = {
    load: () => raw,
    save: (r) => {
      raw = r;
    },
    clear: () => {
      raw = null;
    },
  };
  return {
    port,
    get raw() {
      return raw;
    },
  };
}

const session = createSession({
  date: '2026-08-01',
  seq: 1,
  runId: asRunId('run_1'),
  progId: asProgramId('prog_main_v1'),
  dayId: 'Gün 1',
  week: 1,
});
const at = (slot: number): RecordAt => ({
  session,
  slot,
  exId: asExerciseId('ex_barbell_row'),
  targetSets: 3,
});
const empty = () => emptyState({ now: 0, deviceId: 'd' });
const key0 = recordKey(session.id, 0);

describe('reduce — kayıt döngüsü', () => {
  it('setSet seansı + kaydı doğurur (D17)', () => {
    const s = reduce(empty(), { type: 'setSet', at: at(0), setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 2000 });
    expect(s.sessions[session.id]).toEqual(session);
    expect(s.records[key0]).toEqual({
      exId: asExerciseId('ex_barbell_row'),
      sets: [{ kg: 60, reps: 8 }, { kg: null, reps: null }, { kg: null, reps: null }],
      updatedAt: 2000,
    });
    expect(s.meta.updatedAt).toBe(2000);
  });

  it('aynı sete kg sonra reps patch → ikisi de durur (canlı state, ezme yok)', () => {
    let s = reduce(empty(), { type: 'setSet', at: at(0), setIdx: 0, patch: { kg: 62.5 }, updatedAt: 1 });
    s = reduce(s, { type: 'setSet', at: at(0), setIdx: 0, patch: { reps: 8 }, updatedAt: 2 });
    expect(s.records[key0]?.sets[0]).toEqual({ kg: 62.5, reps: 8 });
  });

  it('D17: tarih açılışta sabit — sonraki aksiyon seansı değiştirmez', () => {
    let s = reduce(empty(), { type: 'setSet', at: at(0), setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 100 });
    s = reduce(s, { type: 'setSet', at: at(0), setIdx: 1, patch: { kg: 60, reps: 7 }, updatedAt: 999999 });
    expect(Object.keys(s.sessions)).toHaveLength(1);
    expect(s.sessions[session.id]?.date).toBe('2026-08-01');
  });

  it('addSet boş set ekler', () => {
    let s = reduce(empty(), { type: 'setSet', at: at(0), setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 1 });
    s = reduce(s, { type: 'addSet', at: at(0), updatedAt: 2 });
    expect(s.records[key0]?.sets).toHaveLength(4);
  });

  it('setRir set + temizle', () => {
    let s = reduce(empty(), { type: 'setRir', at: at(0), rir: 2, updatedAt: 1 });
    expect(s.records[key0]?.rir).toBe(2);
    s = reduce(s, { type: 'setRir', at: at(0), rir: null, updatedAt: 2 });
    expect(s.records[key0]?.rir).toBeUndefined();
  });

  it('setNote set + temizle', () => {
    let s = reduce(empty(), { type: 'setNote', at: at(0), note: 'iyi', updatedAt: 1 });
    expect(s.records[key0]?.note).toBe('iyi');
    s = reduce(s, { type: 'setNote', at: at(0), note: '', updatedAt: 2 });
    expect(s.records[key0]?.note).toBeUndefined();
  });

  it('takePrevious geçen setleri kopyalar', () => {
    const s = reduce(empty(), { type: 'takePrevious', at: at(0), sets: [{ kg: 62.5, reps: 8 }], updatedAt: 1 });
    expect(s.records[key0]?.sets).toEqual([{ kg: 62.5, reps: 8 }]);
  });
});

describe('store — D24 senkron persist', () => {
  it('dispatch anında persist + abone bildirimi', () => {
    const fs = fakeStorage();
    const store = createStore(empty(), fs.port);
    const seen = vi.fn();
    store.subscribe(seen);
    store.dispatch({ type: 'setSet', at: at(0), setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 5 });
    expect(fs.raw).not.toBeNull();
    expect(JSON.parse(fs.raw as string).records[key0].sets[0]).toEqual({ kg: 60, reps: 8 });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(store.getState().meta.updatedAt).toBe(5);
  });
});

describe('sow — tohum ekimi (D39)', () => {
  it('taze durumu eker: 22 hareket, program, 1 koşu', () => {
    const s = sow(empty(), SEED, { today: '2026-08-14', idgen: () => 'run_x' });
    expect(Object.keys(s.catalog.exercises)).toHaveLength(22);
    expect(s.catalog.programs[asProgramId('prog_main_v1')]).toBeDefined();
    const runs = Object.values(s.runs);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ familyId: 'fam_main', currentProgId: asProgramId('prog_main_v1'), startDate: '2026-08-14' });
  });

  it('iki kez ekim → tek koşu, çift hareket yok', () => {
    let s = sow(empty(), SEED, { today: '2026-08-14', idgen: () => 'run_x' });
    s = sow(s, SEED, { today: '2026-08-15', idgen: () => 'run_y' });
    expect(Object.keys(s.catalog.exercises)).toHaveLength(22);
    expect(Object.keys(s.runs)).toHaveLength(1);
  });

  it('userModified hareketi ezmez (D39)', () => {
    const rowId = asExerciseId('ex_barbell_row');
    let s = empty();
    s = {
      ...s,
      catalog: {
        ...s.catalog,
        exercises: { [rowId]: { id: rowId, name: 'Benim Adım', kind: 'bar', zone: 'z', inc: 2.5, userModified: true } },
      },
    };
    s = sow(s, SEED, { today: '2026-08-14', idgen: () => 'run_x' });
    expect(s.catalog.exercises[rowId]?.name).toBe('Benim Adım');
  });
});

describe('initState', () => {
  it('boş storage → ekilmiş geçerli v2 kalıcı', () => {
    const fs = fakeStorage();
    const s = initState(fs.port, SEED, { now: 1, today: '2026-08-14', deviceId: 'd', idgen: () => 'run_x' });
    expect(isAppState(s)).toBe(true);
    expect(Object.keys(s.catalog.exercises)).toHaveLength(22);
    expect(isAppState(JSON.parse(fs.raw as string))).toBe(true);
  });
});
