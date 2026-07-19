// Небольшой крутящийся индикатор. Внутри кнопок и рядом с текстом.
export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner-wrap">
      <span className="spinner" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}
