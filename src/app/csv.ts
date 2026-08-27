// app/csv.ts — CSV dışa aktarma (D28). SAF fonksiyon: durum → metin; DOM/dosya yok
// (dosyaya indirme adapters/backup.file.ts'te, jest-senkron zincirle).
//
// D28 kilitli kuralları:
//  - Yalnızca TEK YÖNLÜ dışa aktarma. CSV bir içe alma biçimi DEĞİLDİR; tam sadakatli
//    tek yedek biçimi JSON'dur (D27). Bu dosyanın karşılığı olan bir parse yoktur.
//  - Ayraç noktalı virgül + BOM (Excel tr: virgüllü ondalık ayracı bozmasın).
//  - Sütun düzeni prototipin "Kayıt" sayfasıdır (aşağıdaki CSV_HEADER, normatif sıra).
//  - 5'ten çok set CSV'ye sığmaz: ilk 5'i yazılır, kalanı NOT sütununda işaretlenir
//    (hacim yine TÜM setlerden hesaplanır — kırpma sayıyı bozmaz).
import { compareSessions } from '../domain/session';
import { setVolume } from '../domain/progression';
import { parseRecordKey } from '../domain/ids';
import type { RecordKey } from '../domain/ids';
import type { AppState, ExRecord, Prescribed, Session, SetEntry } from '../domain/types';

export const CSV_SEP = ';';
export const CSV_EOL = '\r\n';
export const CSV_BOM = '\uFEFF';
export const CSV_MAX_SETS = 5;

/** Prototip "Kayıt" sayfası sütun düzeni (normatif sıra). */
export const CSV_HEADER: string[] = [
  'Hafta',
  'Tarih',
  'Gün',
  '#',
  'Hareket',
  'Hedef Set',
  'Hedef Tekrar',
  'Hedef RIR',
  ...Array.from({ length: CSV_MAX_SETS }, (_, i) => [`S${i + 1} kg`, `S${i + 1} tkr`]).flat(),
  'Toplam Hacim',
  'Gerçek RIR',
  'Not',
];

/** Sayı → Türkçe gösterim (virgül, D22). Ayraç ';' olduğu için virgül güvenlidir. */
function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return String(n).replace('.', ',');
}

/** Alan kaçışı: ayraç/tırnak/satır sonu içeren değer tırnaklanır, tırnak ikilenir. */
export function escapeField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function hasContent(rec: ExRecord): boolean {
  return (
    rec.sets.some((s) => s.kg !== null || s.reps !== null) ||
    rec.rir !== undefined ||
    (rec.note !== undefined && rec.note.length > 0)
  );
}

/** Dolu setler (boş satırlar CSV'de yer kaplamasın). */
function filledSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => s.kg !== null || s.reps !== null);
}

function targetCells(p: Prescribed | null): [string, string, string] {
  if (!p) return ['', '', ''];
  return [String(p.sets), `${p.lo}-${p.hi}`, p.rir ? `${p.rir[0]}-${p.rir[1]}` : ''];
}

function rowFor(state: AppState, session: Session, slot: number, rec: ExRecord, dayLabel: string): string[] {
  const program = state.catalog.programs[session.progId]; // D15: seansın SOMUT sürümü
  const day = program?.days.find((d) => d.dayId === session.dayId);
  const item = day?.items[slot];
  // İkame edilmiş slotta program hedefi bu harekete ait değildir → hedef boş (D47).
  const prescribed = item && item.exId === rec.exId ? item : null;

  const shown = filledSets(rec.sets);
  const trimmed = shown.length - CSV_MAX_SETS;
  const cells: string[] = [];
  for (let i = 0; i < CSV_MAX_SETS; i++) {
    const s = shown[i];
    cells.push(num(s?.kg ?? null), num(s?.reps ?? null));
  }

  const mark = trimmed > 0 ? `+${trimmed} set CSV'ye sığmadı` : '';
  const note = [rec.note ?? '', mark].filter((x) => x.length > 0).join(' · ');

  return [
    String(session.week),
    session.date,
    dayLabel,
    String(slot + 1),
    state.catalog.exercises[rec.exId]?.name ?? rec.exId,
    ...targetCells(prescribed),
    ...cells,
    num(setVolume(rec.sets)), // TÜM setlerden — kırpma hacmi etkilemez
    num(rec.rir ?? null),
    note,
  ];
}

/** Durum → CSV metni (BOM + başlık + seans/slot sırasında satırlar). Saf. */
export function buildCsv(state: AppState): string {
  const bySession = new Map<string, { slot: number; rec: ExRecord }[]>();
  for (const [k, rec] of Object.entries(state.records) as [RecordKey, ExRecord][]) {
    if (!hasContent(rec)) continue;
    const { sessionId: sid, slotIdx } = parseRecordKey(k);
    const arr = bySession.get(sid);
    if (arr) arr.push({ slot: slotIdx, rec });
    else bySession.set(sid, [{ slot: slotIdx, rec }]);
  }

  const sessions = Object.values(state.sessions).sort((a, b) => compareSessions(a.id, b.id));
  const lines: string[] = [CSV_HEADER.join(CSV_SEP)];
  for (const session of sessions) {
    const rows = bySession.get(session.id);
    if (!rows) continue;
    const program = state.catalog.programs[session.progId];
    const day = program?.days.find((d) => d.dayId === session.dayId);
    const dayLabel = day?.label ?? session.dayId;
    for (const { slot, rec } of rows.sort((a, b) => a.slot - b.slot)) {
      lines.push(rowFor(state, session, slot, rec, dayLabel).map(escapeField).join(CSV_SEP));
    }
  }
  return CSV_BOM + lines.join(CSV_EOL) + CSV_EOL;
}
