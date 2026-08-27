import { describe, expect, it } from 'vitest';
import { reduce } from '../src/app/actions';
import { merge } from '../src/domain/merge';
import { isAppState } from '../src/domain/validate';
import { emptyState } from '../src/domain/state';
import { toBackupState } from '../src/app/backup';
import type { AppState } from '../src/domain/types';

const base = (): AppState => emptyState({ now: 0, deviceId: 'd' });

describe('setProfile — asgari kişisel bilgiler (F4.5)', () => {
  it('yokken alan yazımı profili doğurur; şema v:2 kalır ve geçerli olur', () => {
    const s = reduce(base(), { type: 'setProfile', patch: { name: 'Metha' }, updatedAt: 10 });
    expect(s.profile).toEqual({ name: 'Metha', updatedAt: 10 });
    expect(s.v).toBe(2);
    expect(isAppState(s)).toBe(true);
    expect(s.meta.updatedAt).toBe(10);
  });

  it('yama diğer alanları korur', () => {
    let s = reduce(base(), { type: 'setProfile', patch: { name: 'Metha', heightCm: 181 }, updatedAt: 10 });
    s = reduce(s, { type: 'setProfile', patch: { birthYear: 1990 }, updatedAt: 20 });
    expect(s.profile).toEqual({ name: 'Metha', heightCm: 181, birthYear: 1990, updatedAt: 20 });
  });

  it('null alanı siler; son alan da silinince profil düşer', () => {
    let s = reduce(base(), { type: 'setProfile', patch: { name: 'Metha', heightCm: 181 }, updatedAt: 10 });
    s = reduce(s, { type: 'setProfile', patch: { heightCm: null }, updatedAt: 20 });
    expect(s.profile).toEqual({ name: 'Metha', updatedAt: 20 });
    s = reduce(s, { type: 'setProfile', patch: { name: null }, updatedAt: 30 });
    expect(s.profile).toBeUndefined();
    expect(isAppState(s)).toBe(true);
  });

  it('profilsiz eski veri geçerli kalır (salt-eklemeli alan, v:2)', () => {
    expect(isAppState(base())).toBe(true);
    expect(isAppState({ ...base(), profile: { updatedAt: 'dün' } })).toBe(false);
  });

  it('yedeğe girer (sayaçtan farklı olarak soyulmaz)', () => {
    const s = reduce(base(), { type: 'setProfile', patch: { name: 'Metha' }, updatedAt: 10 });
    expect(toBackupState(s).profile).toEqual({ name: 'Metha', updatedAt: 10 });
  });
});

describe('merge — profil son-yazan-kazanır (D27)', () => {
  const withProfile = (name: string, updatedAt: number): AppState => ({ ...base(), profile: { name, updatedAt } });

  it('yeni updatedAt kazanır, iki yönde de aynı sonuç', () => {
    const a = withProfile('eski', 10);
    const b = withProfile('yeni', 20);
    expect(merge(a, b).profile?.name).toBe('yeni');
    expect(merge(b, a).profile?.name).toBe('yeni');
  });

  it('tek tarafta varsa o taşınır (her iki yön)', () => {
    const a = base();
    const b = withProfile('yeni', 20);
    expect(merge(a, b).profile?.name).toBe('yeni');
    expect(merge(b, a).profile?.name).toBe('yeni');
    expect(merge(a, a).profile).toBeUndefined();
  });

  it('idempotent', () => {
    const a = withProfile('eski', 10);
    const b = withProfile('yeni', 20);
    const once = merge(a, b);
    expect(merge(once, b)).toEqual(once);
  });
});
