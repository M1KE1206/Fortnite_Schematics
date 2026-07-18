import { useRef } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { DEFAULT_COSTS, RESOURCES } from '../data/costs';
import { exportJson, importJson } from '../lib/storage';
import { useAppState } from '../state/AppStateContext';
import { RARITY_LABELS, RARITIES } from '../types';
import EpicSyncSection from './EpicSyncSection';

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-400">{label}</span>
      <input
        type="number" min={0}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        onBlur={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right font-mono"
      />
    </label>
  );
}

export default function InventorySection() {
  const { state, update } = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);

  function doExport() {
    const blob = new Blob([exportJson(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stw-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doImport(file: File) {
    try {
      const imported = importJson(await file.text());
      if (window.confirm('Replace all current data with this backup?')) update(imported);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Import failed.');
    }
  }

  const tierNames = ['10 → 20', '20 → 30', '30 → 40', '40 → 50'];
  const stepNames = RARITIES.slice(0, 4).map((r, i) => `${RARITY_LABELS[r]} → ${RARITY_LABELS[RARITIES[i + 1]]}`);

  return (
    <div className="space-y-8">
      <EpicSyncSection />
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Your inventory</h2>
          <div className="space-y-2">
            {RESOURCES.map((r) => (
              <NumberField
                key={r.key}
                label={r.label}
                value={state.inventory[r.key] ?? 0}
                onChange={(n) => update({ inventory: { ...state.inventory, [r.key]: n } })}
              />
            ))}
          </div>
        </section>

        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Cost settings</h2>
              <button
                onClick={() => window.confirm('Reset all costs to defaults?') && update({ costs: structuredClone(DEFAULT_COSTS) })}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <RotateCcw size={12} /> Reset to defaults
              </button>
            </div>
            <div className="space-y-4 text-sm">
              {state.costs.levelTiers.map((tier, i) => (
                <details key={i} className="rounded border border-zinc-800 px-3 py-2">
                  <summary className="cursor-pointer text-zinc-300">Level {tierNames[i]}</summary>
                  <div className="mt-2 space-y-2">
                    {(Object.keys(tier) as (keyof typeof tier)[]).map((k) => (
                      <NumberField
                        key={k}
                        label={RESOURCES.find((r) => r.key === k)?.label ?? k}
                        value={tier[k]}
                        onChange={(n) =>
                          update({
                            costs: {
                              ...state.costs,
                              levelTiers: state.costs.levelTiers.map((t, j) => (j === i ? { ...t, [k]: n } : t)),
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                </details>
              ))}
              {state.costs.perkSteps.map((step, i) => (
                <details key={i} className="rounded border border-zinc-800 px-3 py-2">
                  <summary className="cursor-pointer text-zinc-300">Perk {stepNames[i]}</summary>
                  <div className="mt-2 space-y-2">
                    <NumberField
                      label="RE-PERK!"
                      value={step.rePerk}
                      onChange={(n) =>
                        update({
                          costs: {
                            ...state.costs,
                            perkSteps: state.costs.perkSteps.map((s, j) => (j === i ? { ...s, rePerk: n } : s)),
                          },
                        })
                      }
                    />
                    <NumberField
                      label={RESOURCES.find((r) => r.key === step.specificKey)?.label ?? 'Specific'}
                      value={step.specificAmount}
                      onChange={(n) =>
                        update({
                          costs: {
                            ...state.costs,
                            perkSteps: state.costs.perkSteps.map((s, j) => (j === i ? { ...s, specificAmount: n } : s)),
                          },
                        })
                      }
                    />
                  </div>
                </details>
              ))}
              <NumberField
                label="RE-PERK! per perk change"
                value={state.costs.rePerkChange}
                onChange={(n) => update({ costs: { ...state.costs, rePerkChange: n } })}
              />
              <NumberField
                label="Elemental PERK-UP per element change"
                value={state.costs.elementChangeElemental}
                onChange={(n) => update({ costs: { ...state.costs, elementChangeElemental: n } })}
              />
              <NumberField
                label="Each elemental for Energy change"
                value={state.costs.elementChangeEnergyEach}
                onChange={(n) => update({ costs: { ...state.costs, elementChangeEnergyEach: n } })}
              />
              <NumberField
                label="RE-PERK! for Physical change"
                value={state.costs.elementChangePhysicalRePerk}
                onChange={(n) => update({ costs: { ...state.costs, elementChangePhysicalRePerk: n } })}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Backup</h2>
            <div className="flex gap-2">
              <button onClick={doExport} className="flex items-center gap-2 rounded border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500">
                <Download size={14} /> Export JSON
              </button>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500">
                <Upload size={14} /> Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) doImport(file);
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
