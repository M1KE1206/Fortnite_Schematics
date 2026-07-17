import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ImageOff, Pencil, Trash2, Zap } from 'lucide-react';
import type { Schematic } from '../types';
import { schematicCost } from '../lib/calculator';
import { RARITY_COLORS } from '../data/rarity';
import { useAppState } from '../state/AppStateContext';
import ResourceList from './ResourceList';

interface Props {
  schematic: Schematic;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SchematicCard({ schematic, onEdit, onDelete }: Props) {
  const { state } = useAppState();
  const [open, setOpen] = useState(false);
  const cost = useMemo(() => schematicCost(schematic, state.costs), [schematic, state.costs]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-zinc-800">
          {schematic.iconUrl ? (
            <img src={schematic.iconUrl} alt="" className="h-11 w-11 object-contain" />
          ) : (
            <ImageOff size={20} className="text-zinc-600" />
          )}
        </div>
        <div className="min-w-0 grow">
          <p className="truncate font-semibold">{schematic.name}</p>
          <p className="text-xs text-zinc-400">
            Lv {schematic.currentLevel} → {schematic.targetLevel}
            {schematic.elementChange.needed && schematic.elementChange.element && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
                <Zap size={10} /> {schematic.elementChange.element}
              </span>
            )}
          </p>
        </div>
        <button onClick={onEdit} className="text-zinc-500 hover:text-zinc-200" title="Edit"><Pencil size={16} /></button>
        <button onClick={onDelete} className="text-zinc-500 hover:text-red-400" title="Delete"><Trash2 size={16} /></button>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {schematic.perkSlots.map((slot, i) => (
          <span
            key={i}
            title={`${i === 5 ? 'Element slot' : `Perk ${i + 1}`}: ${slot.currentRarity} → ${slot.targetRarity}`}
            className={`h-3 w-3 rounded-full ${RARITY_COLORS[slot.currentRarity]} ${slot.enabled ? '' : 'opacity-25'}`}
          />
        ))}
        <button
          onClick={() => setOpen(!open)}
          className="ml-auto flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          Resources {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <ResourceList totals={cost} />
        </div>
      )}
    </div>
  );
}
