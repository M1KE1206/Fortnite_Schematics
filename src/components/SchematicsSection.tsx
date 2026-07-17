import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Schematic } from '../types';
import { makeDefaultSchematic } from '../lib/calculator';
import { useAppState } from '../state/AppStateContext';
import SchematicCard from './SchematicCard';
import SchematicForm from './SchematicForm';

export default function SchematicsSection() {
  const { state, update } = useAppState();
  const [editing, setEditing] = useState<Schematic | null>(null);

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
        <button
          onClick={() => setEditing(makeDefaultSchematic())}
          className="flex items-center gap-2 rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          <Plus size={16} /> Add schematic
        </button>
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
    </div>
  );
}
