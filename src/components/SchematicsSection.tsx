import { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import type { Schematic } from '../types';
import { makeDefaultSchematic } from '../lib/calculator';
import { useAppState } from '../state/AppStateContext';
import SchematicCard from './SchematicCard';
import SchematicForm from './SchematicForm';
import ImportModal from './ImportModal';

export default function SchematicsSection() {
  const { state, update } = useAppState();
  const [editing, setEditing] = useState<Schematic | null>(null);
  const [showImport, setShowImport] = useState(false);

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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {state.schematics.length} {state.schematics.length === 1 ? 'schematic' : 'schematics'}
        </p>
        <div className="flex">
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
      </div>
      {state.schematics.length === 0 ? (
        <p className="py-12 text-center text-zinc-500">No schematics yet. Add your first one.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.schematics.map((s) => (
            <SchematicCard key={s.id} schematic={s} onEdit={() => setEditing(s)} onDelete={() => remove(s.id, s.name)} />
          ))}
        </div>
      )}
      {editing && <SchematicForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
