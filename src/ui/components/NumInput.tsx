import { useEffect, useState } from 'preact/hooks';
import { fmtNum, parseNum } from '../format';

interface Props {
  value: number | null;
  onCommit: (n: number | null) => void;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric';
  ariaLabel?: string;
}

/**
 * Tamponlu sayısal giriş: her tuşta ham metni tutar + parse edip commit eder (D24),
 * ama dıştan gelen değişikliği (ör. "geçeni al") de yansıtır — yazarken kavga etmez.
 */
export function NumInput({ value, onCommit, placeholder, inputMode = 'decimal', ariaLabel }: Props) {
  const [raw, setRaw] = useState(() => fmtNum(value));

  useEffect(() => {
    // Dıştan değer değişip mevcut ham metnin karşılığından farklıysa senkronla.
    if (parseNum(raw) !== value) setRaw(fmtNum(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      class="num"
      type="text"
      inputMode={inputMode}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      value={raw}
      onInput={(e) => {
        const v = (e.currentTarget as HTMLInputElement).value;
        setRaw(v);
        onCommit(parseNum(v));
      }}
    />
  );
}
