import type { SessionSummary } from '../../app/selectors';
import { fmtNum, setsSummary } from '../format';

/** Seans özeti kartı — sessionSummary (D8/D46) türetmesini gösterir. Hem "Bitir"
 *  hem takvim gün-dokunuşu bunu kullanır (kopya özet mantığı yok). */
export function SummaryCard({ summary }: { summary: SessionSummary }) {
  return (
    <div class="card">
      <p class="view__hint">
        {summary.dayLabel} · {summary.session.date} · {summary.totalSets} set · hacim {fmtNum(summary.totalVolume)}
      </p>
      {summary.entries.map((e) => (
        <p key={e.exercise.id}>
          <strong>{e.exercise.name}</strong> — {setsSummary(e.record.sets)}
        </p>
      ))}
      {summary.entries.length === 0 && <p class="status">Bu seansta dolu kayıt yok.</p>}
    </div>
  );
}
