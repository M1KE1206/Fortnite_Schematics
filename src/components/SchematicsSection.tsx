import { useState } from 'react';
import { Download, ListChecks, Plus, Trash2, X } from 'lucide-react';
import type { Schematic } from '../types';
import { makeDefaultSchematic } from '../lib/calculator';
import { findIconUrl } from '../lib/wiki';
import { useAppState } from '../state/AppStateContext';
import SchematicCard from './SchematicCard';
import SchematicForm from './SchematicForm';
import ImportModal from './ImportModal';

export default function SchematicsSection() {
  const { state, update, mutate } = useAppState();
  const [editing, setEditing] = useState<Schematic | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'schematic' : 'schematics'}?`)) {
      update({ schematics: state.schematics.filter((s) => !selectedIds.has(s.id)) });
      exitSelectMode();
    }
  }

  function deleteAll() {
    if (window.confirm(`Delete ALL ${state.schematics.length} schematics? This cannot be undone.`)) {
      update({ schematics: [] });
      exitSelectMode();
    }
  }

  function save(s: Schematic) {
    const exists = state.schematics.some((x) => x.id === s.id);
    update({
      schematics: exists ? state.schematics.map((x) => (x.id === s.id ? s : x)) : [...state.schematics, s],
    });
    setEditing(null);
  }

  function remove(id: string, name: string) {
    if (window.confirm(`Delete "${name}"?`)) {
      update({ schematics: state.schematics.filter((x) => x.id !== id) });
    }
  }

  function handleImported(created: Schematic[]) {
    update({ schematics: [...state.schematics, ...created] });
    void fetchIconsFor(created);
  }

  async function fetchIconsFor(created: Schematic[]) {
    for (const item of created) {
      const icon = await findIconUrl(item.name);
      if (!icon) continue;
      mutate((s) => ({
        ...s,
        icons: { ...s.icons, [item.name.toLowerCase()]: icon },
        schematics: s.schematics.map((x) => (x.id === item.id ? { ...x, iconUrl: icon } : x)),
      }));
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {state.schematics.length} {state.schematics.length === 1 ? 'schematic' : 'schematics'}
        </p>
        {selectMode ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-400">{selectedIds.size} selected</span>
            <button
              onClick={() => setSelectedIds(new Set(state.schematics.map((s) => s.id)))}
              className="rounded border border-zinc-700 px-3 py-2 hover:border-zinc-500"
            >
              Select all
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded border border-zinc-700 px-3 py-2 hover:border-zinc-500"
            >
              Clear
            </button>
            <button
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-2 rounded bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-500 disabled:opacity-40"
            >
              <Trash2 size={16} /> Delete selected
            </button>
            <button
              onClick={deleteAll}
              className="flex items-center gap-2 rounded border border-red-800 px-3 py-2 text-red-400 hover:border-red-500"
            >
              <Trash2 size={16} /> Delete all
            </button>
            <button onClick={exitSelectMode} className="flex items-center gap-1 px-2 py-2 text-zinc-400 hover:text-zinc-200">
              <X size={16} /> Cancel
            </button>
          </div>
        ) : (
          <div className="flex">
            {state.schematics.length > 0 && (
              <button
                onClick={() => setSelectMode(true)}
                className="mr-2 flex items-center gap-2 rounded border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500"
              >
                <ListChecks size={16} /> Select
              </button>
            )}
            <button
              onClick={() => setShowImport(true)}
              className="mr-2 flex items-center gap-2 rounded border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500"
            >
              <Download size={16} /> Import from Epic
            </button>
            <button
              onClick={() => setEditing(makeDefaultSchematic())}
              className="flex items-center gap-2 rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
            >
              <Plus size={16} /> Add schematic
            </button>
          </div>
        )}
      </div>
      {state.schematics.length === 0 ? (
        <p className="py-12 text-center text-zinc-500">No schematics yet. Add your first one.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.schematics.map((s) => (
            <SchematicCard
              key={s.id}
              schematic={s}
              onEdit={() => setEditing(s)}
              onDelete={() => remove(s.id, s.name)}
              selectMode={selectMode}
              selected={selectedIds.has(s.id)}
              onToggleSelect={() => toggleSelected(s.id)}
            />
          ))}
        </div>
      )}
      {editing && <SchematicForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={handleImported} />}
    </div>
  );
}
