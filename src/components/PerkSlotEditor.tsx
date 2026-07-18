import { ArrowRight, RefreshCw } from 'lucide-react';
import type { PerkSlot } from '../types';
import { PERKS, ELEMENT_PERK_IDS } from '../data/perks';
import RaritySelect from './RaritySelect';

interface Props {
  slot: PerkSlot;
  index: number;
  onChange: (slot: PerkSlot) => void;
}

const GROUPS = [...new Set(PERKS.map((p) => p.group))];

function PerkSelect({
  value,
  onChange,
  title,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  title: string;
}) {
  return (
    <select
      title={title}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="max-w-44 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-xs text-zinc-200"
    >
      <option value="">(none)</option>
      {GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {PERKS.filter((p) => p.group === g).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function PerkSlotEditor({ slot, index, onChange }: Props) {
  const label = `Perk ${index + 1}`;
  const cur = slot.currentPerk ?? null;
  const tgt = slot.targetPerk ?? null;
  const changed = cur !== null && tgt !== null && cur !== tgt;
  const isElementChange = changed && ELEMENT_PERK_IDS.has(tgt);
  const showLegacyCheckbox = index < 5 && cur === null && tgt === null;

  return (
    <div className={`rounded border border-zinc-800 px-3 py-2 ${slot.enabled ? '' : 'opacity-50'}`}>
      <div className="flex flex-wrap items-center gap-3">
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
        {showLegacyCheckbox && (
          <label className="ml-auto flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={slot.needsReroll}
              onChange={(e) => onChange({ ...slot, needsReroll: e.target.checked })}
            />
            Needs reroll (RE-PERK!)
          </label>
        )}
        {changed && (
          <span className="ml-auto flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
            <RefreshCw size={11} /> {isElementChange ? 'Element change' : 'Reroll'}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PerkSelect title="Current perk" value={cur} onChange={(v) => onChange({ ...slot, currentPerk: v })} />
        <ArrowRight size={12} className="text-zinc-500" />
        <PerkSelect title="Target perk" value={tgt} onChange={(v) => onChange({ ...slot, targetPerk: v })} />
      </div>
    </div>
  );
}
