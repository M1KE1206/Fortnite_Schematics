import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import type { Schematic } from '../types';
import { RARITY_TEXT } from '../data/rarity';
import { PERK_LABELS } from '../data/perks';
import { makeDefaultSchematic } from '../lib/calculator';
import { EpicSyncError, fetchEpicSchematics, type ImportedSchematic } from '../lib/epicSync';
import { useAppState } from '../state/AppStateContext';

export default function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (created: Schematic[]) => void }) {
  const { state } = useAppState();
  const [items, setItems] = useState<ImportedSchematic[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEpicSchematics()
      .then((r) => setItems(r.schematics))
      .catch((e) => setError(e instanceof EpicSyncError ? e.message : 'Unexpected error'));
  }, []);

  const existingNames = useMemo(
    () => new Set(state.schematics.map((s) => s.name.toLowerCase())),
    [state.schematics],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function importSelected() {
    if (!items) return;
    const created: Schematic[] = items
      .filter((i) => selected.has(i.templateId))
      .map((item) => {
        const s = makeDefaultSchematic();
        s.name = item.name;
        s.currentLevel = item.level;
        s.perkSlots = s.perkSlots.map((slot, i) => {
          const perk = item.perks[i];
          if (!perk) return { ...slot, enabled: false };
          return { ...slot, currentPerk: perk.perkId, currentRarity: perk.rarity };
        });
        return s;
      });
    onImported(created);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/70 p-6">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-700 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Import schematics from Epic</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" title="Close">
            <X size={18} />
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {!error && items === null && (
          <p className="flex items-center gap-2 py-8 text-sm text-zinc-400">
            <Loader2 size={16} className="animate-spin" /> Loading your schematics...
          </p>
        )}

        {items !== null && (
          <>
            <div className="mb-3 flex items-center gap-3 text-xs text-zinc-400">
              <button onClick={() => setSelected(new Set(items.map((i) => i.templateId)))} className="hover:text-zinc-200">
                Select all
              </button>
              <button onClick={() => setSelected(new Set())} className="hover:text-zinc-200">
                Clear
              </button>
              <span className="ml-auto">{selected.size} selected</span>
            </div>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {items.map((item) => (
                <label
                  key={item.templateId}
                  className="flex cursor-pointer items-center gap-3 rounded border border-zinc-800 px-3 py-2 hover:border-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.templateId)}
                    onChange={() => toggle(item.templateId)}
                  />
                  <span className={`min-w-0 truncate text-sm font-medium ${RARITY_TEXT[item.rarity]}`}>
                    {item.name}
                  </span>
                  <span className="text-xs text-zinc-500">Lv {item.level}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-xs text-zinc-500">
                    {item.perks.map((p) => (p.perkId ? PERK_LABELS[p.perkId] : '(unknown)')).join(', ')}
                  </span>
                  {existingNames.has(item.name.toLowerCase()) && (
                    <span className="shrink-0 text-xs text-amber-400">already added</span>
                  )}
                </label>
              ))}
              {items.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">No schematics found.</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
                Cancel
              </button>
              <button
                onClick={importSelected}
                disabled={selected.size === 0}
                className="flex items-center gap-2 rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
              >
                <Download size={14} /> Import selected
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
