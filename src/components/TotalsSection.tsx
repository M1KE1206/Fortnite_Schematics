import { Check, X } from 'lucide-react';
import { RESOURCES } from '../data/costs';
import { totalCost } from '../lib/calculator';
import { useAppState } from '../state/AppStateContext';

const GROUP_LABELS: Record<string, string> = {
  evolution: 'Evolution materials',
  perk: 'Perk resources',
  element: 'Elemental resources',
};

export default function TotalsSection() {
  const { state } = useAppState();
  const totals = totalCost(state.schematics, state.costs);
  const groups = ['evolution', 'perk', 'element'] as const;

  if (state.schematics.length === 0) {
    return <p className="py-12 text-center text-zinc-500">Add schematics to see totals.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const rows = RESOURCES.filter((r) => r.group === g && (totals[r.key] ?? 0) > 0);
        if (rows.length === 0) return null;
        return (
          <div key={g}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">{GROUP_LABELS[g]}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-500">
                  <th className="py-1.5 font-medium">Resource</th>
                  <th className="py-1.5 text-right font-medium">Needed</th>
                  <th className="py-1.5 text-right font-medium">Have</th>
                  <th className="py-1.5 text-right font-medium">Missing</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const needed = totals[r.key] ?? 0;
                  const have = state.inventory[r.key] ?? 0;
                  const missing = Math.max(0, needed - have);
                  return (
                    <tr key={r.key} className="border-b border-zinc-800/50">
                      <td className="py-1.5">{r.label}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{needed.toLocaleString('en-US')}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-zinc-400">{have.toLocaleString('en-US')}</td>
                      <td className={`py-1.5 text-right font-mono tabular-nums ${missing > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {missing.toLocaleString('en-US')}
                      </td>
                      <td className="pl-2">
                        {missing > 0 ? <X size={14} className="text-red-400" /> : <Check size={14} className="text-green-400" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
