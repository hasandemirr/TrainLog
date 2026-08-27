import { describe, expect, it } from 'vitest';
import { CSV_BOM, CSV_HEADER, CSV_MAX_SETS, buildCsv, escapeField } from '../src/app/csv';
import { sow } from '../src/app/store';
import { reduce } from '../src/app/actions';
import { emptyState } from '../src/domain/state';
import { asProgramId, recordKey, sessionId } from '../src/domain/ids';
import type { RecordKey } from '../src/domain/ids';
import { nextProgramVersion } from '../src/domain/program';
import type { AppState, ExRecord, Session } from '../src/domain/types';
import { record } from './fixtures/build';
import { SEED } from '../src/content/seed';

const seeded = (): AppState =>
  sow(emptyState({ now: 0, deviceId: 'd' }), SEED, { today: '2026-08-01', idgen: () => 'run_seed' });

/** Seans + slot kayıtları — sentetik (D49). */
function withSession(
  state: AppState,
  parts: { date?: string; week?: number; dayId?: string; records?: Record<number, ExRecord> } = {},
): AppState {
  const date = parts.date ?? '2026-08-03';
  const sid = sessionId(date, 1);
  const run = Object.values(state.runs)[0]!;
  const session: Session = {
    id: sid,
    date,
    runId: run.id,
    progId: run.currentProgId,
    dayId: parts.dayId ?? 'Gün 1',
    week: parts.week ?? 1,
  };
  const next: AppState = { ...state, sessions: { ...state.sessions, [sid]: session }, records: { ...state.records } };
  for (const [slot, rec] of Object.entries(parts.records ?? {})) {
    next.records[recordKey(sid, Number(slot)) as RecordKey] = rec;
  }
  return next;
}

const lines = (csv: string) => csv.replace(CSV_BOM, '').trimEnd().split('\r\n');
const cells = (line: string) => line.split(';');

describe('buildCsv — D28: noktalı virgül + BOM + prototip Kayıt düzeni', () => {
  it('BOM ile başlar, satırlar CRLF, başlık normatif sırada', () => {
    const csv = buildCsv(seeded());
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain('\r\n');
    expect(lines(csv)[0]).toBe(
      'Hafta;Tarih;Gün;#;Hareket;Hedef Set;Hedef Tekrar;Hedef RIR;' +
        'S1 kg;S1 tkr;S2 kg;S2 tkr;S3 kg;S3 tkr;S4 kg;S4 tkr;S5 kg;S5 tkr;' +
        'Toplam Hacim;Gerçek RIR;Not',
    );
    expect(CSV_HEADER.length).toBe(8 + CSV_MAX_SETS * 2 + 3);
  });

  it('veri yokken yalnızca başlık satırı üretir', () => {
    expect(lines(buildCsv(seeded())).length).toBe(1);
  });

  it('kayıt satırı: hafta/tarih/gün/#/ad + hedefler + setler + hacim + RIR + not', () => {
    const state = withSession(seeded(), {
      week: 3,
      records: {
        0: record(
          'ex_barbell_row',
          [
            [60, 8],
            [62.5, 7],
          ],
          100,
          { rir: 2, note: 'sağ omuz' },
        ),
      },
    });
    const row = cells(lines(buildCsv(state))[1]!);
    expect(row.slice(0, 8)).toEqual(['3', '2026-08-03', 'Pull', '1', 'Barbell Row', '3', '6-8', '2-3']);
    expect(row.slice(8, 18)).toEqual(['60', '8', '62,5', '7', '', '', '', '', '', '']);
    expect(row.slice(18)).toEqual(['917,5', '2', 'sağ omuz']); // 60×8 + 62,5×7
  });

  it("5'ten çok set kırpılır ve NOT sütununda işaretlenir; hacim TÜM setlerden", () => {
    const seven = record(
      'ex_barbell_row',
      [
        [50, 10],
        [50, 10],
        [50, 10],
        [50, 10],
        [50, 10],
        [50, 10],
        [50, 10],
      ],
      100,
      { note: 'uzun' },
    );
    const row = cells(lines(buildCsv(withSession(seeded(), { records: { 0: seven } })))[1]!);
    expect(row.slice(8, 18)).toEqual(['50', '10', '50', '10', '50', '10', '50', '10', '50', '10']);
    expect(row[18]).toBe('3500'); // 7 × 500 — kırpma hacmi bozmaz
    expect(row[20]).toContain('+2 set');
    expect(row[20]).toContain('uzun'); // kullanıcının notu korunur
  });

  it('ayraç/tırnak/satır sonu içeren alan kaçışlanır', () => {
    expect(escapeField('a;b')).toBe('"a;b"');
    expect(escapeField('di"yor')).toBe('"di""yor"');
    expect(escapeField('düz')).toBe('düz');
    const state = withSession(seeded(), {
      records: { 0: record('ex_barbell_row', [[60, 8]], 100, { note: 'set 1; ağır' }) },
    });
    const line = lines(buildCsv(state))[1]!;
    expect(line.endsWith('"set 1; ağır"')).toBe(true);
  });

  it('hedef sütunları seansın SOMUT program sürümünden gelir (D15)', () => {
    const base = seeded();
    const prog = Object.values(base.catalog.programs)[0]!;
    const run = Object.values(base.runs)[0]!;
    const withOld = withSession(base, { records: { 0: record('ex_barbell_row', [[60, 8]], 100) } });
    // Koşu ortası düzenleme: yeni sürümde hedef 6-8 → 10-12
    const days = JSON.parse(JSON.stringify(prog.days)) as typeof prog.days;
    days[0]!.items[0] = { ...days[0]!.items[0]!, lo: 10, hi: 12 };
    const edited = reduce(withOld, {
      type: 'saveProgramVersion',
      program: nextProgramVersion(prog, days, asProgramId(`${prog.familyId}_r2`)),
      runId: run.id,
      updatedAt: 200,
    });
    expect(cells(lines(buildCsv(edited))[1]!)[6]).toBe('6-8'); // geçmiş seans eski hedefi taşır
  });

  it('ikame edilmiş slotta hedef sütunları boş kalır (D47)', () => {
    const state = withSession(seeded(), { records: { 0: record('ex_lat_pulldown', [[40, 10]], 100) } });
    const row = cells(lines(buildCsv(state))[1]!);
    expect(row[4]).toBe('Lat Pulldown');
    expect(row.slice(5, 8)).toEqual(['', '', '']);
  });

  it('boş kayıt satır üretmez; slot sırası korunur', () => {
    const state = withSession(seeded(), {
      records: {
        0: record('ex_barbell_row', [[null, null]], 100), // tamamen boş → atlanır
        2: record('ex_single_arm_machine_row', [[30, 12]], 100),
        1: record('ex_lat_pulldown', [[40, 10]], 100),
      },
    });
    const rows = lines(buildCsv(state)).slice(1);
    expect(rows.length).toBe(2);
    expect(cells(rows[0]!)[3]).toBe('2'); // slot 1 → "#2"
    expect(cells(rows[1]!)[3]).toBe('3');
  });

  it('seanslar tarihe göre sıralanır', () => {
    let s = withSession(seeded(), { date: '2026-08-05', records: { 0: record('ex_barbell_row', [[65, 8]], 100) } });
    s = withSession(s, { date: '2026-08-03', records: { 0: record('ex_barbell_row', [[60, 8]], 100) } });
    const dates = lines(buildCsv(s))
      .slice(1)
      .map((l) => cells(l)[1]);
    expect(dates).toEqual(['2026-08-03', '2026-08-05']);
  });

  it('time türü hareket: kg boş, tkr saniye, hacim 0', () => {
    const state = withSession(seeded(), {
      dayId: 'Gün 2',
      records: { 2: record('ex_plank_hanging_leg_raise', [[null, 45]], 100) },
    });
    const row = cells(lines(buildCsv(state))[1]!);
    expect(row[2]).toBe('Home 1');
    expect(row[4]).toBe('Plank / Hanging Leg Raise');
    expect(row.slice(8, 10)).toEqual(['', '45']);
    expect(row[18]).toBe('0');
  });
});
