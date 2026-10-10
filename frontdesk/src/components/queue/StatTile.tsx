// A printed-form figure: micro label over a big condensed number
export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3">
      <div className="micro-label">{label}</div>
      <div className="mt-1 font-heading text-3xl font-bold leading-none tabular-nums text-ink sm:text-4xl">{value}</div>
    </div>
  );
}
