import { describe, expect, it } from 'vitest';
import { isAppState } from '../src/domain/validate';
import { emptyState } from '../src/domain/state';

const base = emptyState({ now: 1000, deviceId: 'dev-1' });

describe('isAppState', () => {
  it('boş-geçerli v2 durumu kabul eder', () => {
    expect(isAppState(base)).toBe(true);
  });

  it('iskelet {count} blob’unu reddeder (v alanı yok)', () => {
    expect(isAppState({ count: 5 })).toBe(false);
  });

  it('v !== 2 reddeder', () => {
    expect(isAppState({ ...base, v: 1 })).toBe(false);
  });

  it('bozuk meta reddeder', () => {
    expect(isAppState({ ...base, meta: { deviceId: 'x' } })).toBe(false);
  });

  it('geçerli dolu durumu kabul eder', () => {
    const populated = {
      ...base,
      catalog: {
        exercises: { e1: { id: 'e1', name: 'X', kind: 'bar', zone: 'z', inc: 2.5 } },
        programs: {},
      },
      records: { 'd#1|0': { exId: 'e1', sets: [{ kg: 60, reps: 8 }], updatedAt: 5 } },
    };
    expect(isAppState(populated)).toBe(true);
  });

  it('bozuk kayıt (updatedAt yok) reddeder', () => {
    expect(isAppState({ ...base, records: { 'd#1|0': { exId: 'e1', sets: [] } } })).toBe(false);
  });

  it('geçersiz set türü reddeder', () => {
    const bad = { ...base, records: { 'd#1|0': { exId: 'e1', sets: [{ kg: 'x', reps: 8 }], updatedAt: 1 } } };
    expect(isAppState(bad)).toBe(false);
  });

  it('null / ilkel değer reddeder', () => {
    expect(isAppState(null)).toBe(false);
    expect(isAppState('x')).toBe(false);
    expect(isAppState(42)).toBe(false);
  });
});
