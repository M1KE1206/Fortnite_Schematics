import { RESOURCES } from '../data/costs';
import type { ResourceTotals } from '../types';

export default function ResourceList({ totals }: { totals: ResourceTotals }) {
  const rows = RESOURCES.filter((r) => (totals[r.key] ?? 0) > 0);
  if (rows.length === 0) return <p className="text-sm text-zinc-500">Nothing needed.</p>;
  return (
    <ul className="space-y-0.5 text-sm">
      {rows.map((r) => (
        <li key={r.key} className="flex justify-between gap-6">
          <span className="text-zinc-400">{r.label}</span>
          <span className="font-mono tabular-nums">{(totals[r.key] ?? 0).toLocaleString('en-US')}</span>
        </li>
      ))}
    </ul>
  );
}
