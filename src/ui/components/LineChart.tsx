// Bağımlılıksız çizgi grafik — elle SVG (chart kütüphanesi YASAK, bağımlılık sınırı).
// Erişilebilirlik: eğri yalnız görsel; çağıran altına metin liste koyar (aria-label + role).

interface Props {
  values: number[];
  ariaLabel: string;
  height?: number;
}

export function LineChart({ values, ariaLabel, height = 120 }: Props) {
  if (values.length === 0) return null;

  const w = 300;
  const h = height;
  const pad = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i / (n - 1)) * (w - 2 * pad));
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - 2 * pad);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  return (
    <svg class="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="var(--accent)" />
      ))}
    </svg>
  );
}
