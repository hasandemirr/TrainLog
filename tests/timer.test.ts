import { describe, expect, it } from 'vitest';
import { reduce } from '../src/app/actions';
import { toBackupState } from '../src/app/backup';
import { merge } from '../src/domain/merge';
import { isAppState } from '../src/domain/validate';
import { emptyState } from '../src/domain/state';

const empty = () => emptyState({ now: 0, deviceId: 'd' });

describe('sayaç (D42/43, D8 istisnası)', () => {
  it('startTimer mutlak tEnd yazar; clearTimer siler', () => {
    let s = reduce(empty(), { type: 'startTimer', tEnd: 1000, label: 'Barbell Row', updatedAt: 5 });
    expect(s.timer).toEqual({ tEnd: 1000, label: 'Barbell Row' });
    s = reduce(s, { type: 'clearTimer', updatedAt: 6 });
    expect(s.timer).toBeUndefined();
  });

  it('sayaçlı durum geçerli v2 ve JSON round-trip (depodan geri döner, D42)', () => {
    const s = reduce(empty(), { type: 'startTimer', tEnd: 1000, label: 'x', updatedAt: 1 });
    expect(isAppState(s)).toBe(true);
    const back: unknown = JSON.parse(JSON.stringify(s));
    expect(isAppState(back)).toBe(true);
    expect((back as { timer: { tEnd: number } }).timer.tEnd).toBe(1000);
  });

  it('toBackupState sayacı soyar; orijinale dokunmaz', () => {
    const s = reduce(empty(), { type: 'startTimer', tEnd: 1000, label: 'x', updatedAt: 1 });
    expect(toBackupState(s).timer).toBeUndefined();
    expect(s.timer).toBeDefined();
  });

  it('merge: yerel sayaç kazanır (base korunur)', () => {
    const a = reduce(empty(), { type: 'startTimer', tEnd: 100, label: 'A', updatedAt: 1 });
    const b = reduce(emptyState({ now: 0, deviceId: 'e' }), { type: 'startTimer', tEnd: 200, label: 'B', updatedAt: 1 });
    expect(merge(a, b).timer).toEqual({ tEnd: 100, label: 'A' });
  });
});
