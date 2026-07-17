import { ArrowRight } from 'lucide-react';
import type { PerkSlot } from '../types';
import RaritySelect from './RaritySelect';

interface Props {
  slot: PerkSlot;
  index: number;
  onChange: (slot: PerkSlot) => void;
}

export default function PerkSlotEditor({ slot, index, onChange }: Props) {
  const label = index === 5 ? 'Element slot' : `Perk ${index + 1}`;
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded border border-zinc-800 px-3 py-2 ${slot.enabled ? '' : 'opacity-50'}`}>
      <label className="flex w-28 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={slot.enabled}
          onChange={(e) => onChange({ ...slot, enabled: e.target.checked })}
        />
        {label}
      </label>
      <RaritySelect value={slot.currentRarity} onChange={(r) => onChange({ ...slot, currentRarity: r })} />
      <ArrowRight size={14} className="text-zinc-500" />
      <RaritySelect value={slot.targetRarity} onChange={(r) => onChange({ ...slot, targetRarity: r })} />
      {index < 5 && (
        <label className="ml-auto flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={slot.needsReroll}
            onChange={(e) => onChange({ ...slot, needsReroll: e.target.checked })}
          />
          Needs reroll (RE-PERK!)
        </label>
      )}
    </div>
  );
}
