interface Props {
  onApply: () => void;
}

/** "Güncelleme hazır — Yenile" çubuğu (D41). Dokununca skipWaiting akışı. */
export function UpdateBar({ onApply }: Props) {
  return (
    <div class="updatebar" role="status">
      <span>Güncelleme hazır</span>
      <button type="button" onClick={onApply}>
        Yenile
      </button>
    </div>
  );
}
