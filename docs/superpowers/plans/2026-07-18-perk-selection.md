# Perk Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per perk-slot de echte STW-perk kiezen (huidig → doel) zodat reroll-kosten (600 RE-PERK!) automatisch meetellen zodra ze verschillen.

**Architecture:** Nieuwe perk-catalogus in `src/data/perks.ts`; `PerkSlot` krijgt `currentPerk`/`targetPerk` (string | null); de reroll-conditie verhuist naar een pure helper `slotNeedsReroll` in de calculator (TDD); de UI vervangt het reroll-vinkje door twee gegroepeerde selects met een automatische "Reroll"-badge (vinkje blijft alleen zichtbaar als legacy-fallback wanneer beide selects leeg zijn).

**Tech Stack:** Bestaand project (Vite + React + TS + Vitest + lucide-react); geen nieuwe dependencies.

## Global Constraints

- Geen emojis in UI of code; iconen uitsluitend via lucide-react; geen CSS-gradients; UI-teksten in het Engels.
- Kostenwaardes alleen via `CostConfig` (reroll = `costs.rePerkChange`, default 600).
- Storage-versie blijft 1; oude opgeslagen schematics (zonder perk-velden) blijven geldig en hun `needsReroll`-vinkje blijft correct meetellen.
- Reroll-conditie exact: perks beide gezet en verschillend → reroll; beide leeg → legacy `needsReroll`; precies één gezet → géén reroll.
- Slot 6 (index 5, element-slot) krijgt géén perk-selects; `elementChange` blijft ongewijzigd.

---

### Task 1: Perk-catalogus, types en reroll-logica (TDD)

**Files:**
- Create: `src/data/perks.ts`
- Modify: `src/types.ts` (PerkSlot), `src/lib/calculator.ts` (makeDefaultSchematic + schematicCost)
- Test: `src/lib/calculator.test.ts` (nieuwe describe-block toevoegen)

**Interfaces:**
- Consumes: bestaande `PerkSlot`, `schematicCost`, `makeDefaultSchematic`, `DEFAULT_COSTS` (rePerkChange = 600).
- Produces (voor Task 2):
  - `src/data/perks.ts`: `interface PerkDef { id: string; label: string; group: string }`, `PERKS: PerkDef[]`, `PERK_LABELS: Record<string, string>`
  - `PerkSlot` uitgebreid met `currentPerk: string | null; targetPerk: string | null`
  - `slotNeedsReroll(slot: PerkSlot): boolean` (export uit `calculator.ts`)

- [ ] **Step 1: Schrijf failing tests**

Voeg onderaan `src/lib/calculator.test.ts` toe:

```ts
import { slotNeedsReroll } from './calculator';

describe('perk-based rerolls', () => {
  it('counts reroll when current and target perks differ', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'damage';
    s.perkSlots[0].targetPerk = 'critRating';
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070 + 600);
  });

  it('no reroll when perks are equal, even with legacy flag set', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'critRating';
    s.perkSlots[0].targetPerk = 'critRating';
    s.perkSlots[0].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070);
  });

  it('no reroll when only one perk is set, even with legacy flag', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'damage';
    s.perkSlots[0].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070);
  });

  it('legacy needsReroll still counts when no perks are set', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070 + 600);
  });

  it('handles legacy stored slots without perk fields', () => {
    const s = makeDefaultSchematic();
    const legacy = s.perkSlots[0] as Partial<typeof s.perkSlots[0]>;
    delete legacy.currentPerk;
    delete legacy.targetPerk;
    s.perkSlots[0].needsReroll = true;
    expect(slotNeedsReroll(s.perkSlots[0])).toBe(true);
  });
});
```

Opmerking: `2070` is de bestaande rePerk-som van 6 slots white→gold (6 × 345).

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL (`slotNeedsReroll` bestaat niet; `currentPerk` bestaat niet op het type). Bestaande 47 tests blijven relevant.

- [ ] **Step 3: Implementeer**

`src/data/perks.ts` (nieuw):
```ts
export interface PerkDef {
  id: string;
  label: string;
  group: string;
}

export const PERKS: PerkDef[] = [
  { id: 'damage', label: 'Damage', group: 'Damage' },
  { id: 'critRating', label: 'Critical Rating', group: 'Damage' },
  { id: 'critDamage', label: 'Critical Damage', group: 'Damage' },
  { id: 'headshotDamage', label: 'Headshot Damage', group: 'Damage' },
  { id: 'dmgAfflicted', label: 'Damage to Afflicted', group: 'Damage' },
  { id: 'dmgSlowed', label: 'Damage to Slowed and Snared', group: 'Damage' },
  { id: 'dmgMist', label: 'Damage to Mist Monsters and Bosses', group: 'Damage' },
  { id: 'dmgStunned', label: 'Damage to Stunned Staggered and Knocked Down', group: 'Damage' },
  { id: 'attackSpeed', label: 'Attack Speed', group: 'Speed' },
  { id: 'fireRate', label: 'Fire Rate', group: 'Speed' },
  { id: 'reloadSpeed', label: 'Reload Speed', group: 'Speed' },
  { id: 'magazineSize', label: 'Magazine Size', group: 'Utility' },
  { id: 'durability', label: 'Durability', group: 'Utility' },
  { id: 'lifeLeech', label: 'Life Leech', group: 'Utility' },
  { id: 'aimDamage', label: 'Ranged Weapon Damage while Aiming', group: 'Utility' },
  { id: 'stability', label: 'Weapon Stability', group: 'Utility' },
  { id: 'affliction', label: 'Affliction', group: 'Sixth perk' },
  { id: 'snare', label: 'Snare', group: 'Sixth perk' },
  { id: 'stun', label: 'Stun', group: 'Sixth perk' },
  { id: 'knockback', label: 'Knockback', group: 'Sixth perk' },
  { id: 'causesAffliction', label: 'Causes Affliction (6s)', group: 'Sixth perk' },
  { id: 'headshotEnergy', label: 'Headshots grant Energy', group: 'Sixth perk' },
];

export const PERK_LABELS: Record<string, string> = Object.fromEntries(
  PERKS.map((p) => [p.id, p.label]),
);
```

`src/types.ts` — breid `PerkSlot` uit:
```ts
export interface PerkSlot {
  enabled: boolean;
  currentRarity: Rarity;
  targetRarity: Rarity;
  needsReroll: boolean;
  currentPerk: string | null;
  targetPerk: string | null;
}
```

`src/lib/calculator.ts` — twee wijzigingen:

1. In `makeDefaultSchematic` de slot-factory uitbreiden:
```ts
    perkSlots: Array.from({ length: 6 }, () => ({
      enabled: true,
      currentRarity: 'white' as Rarity,
      targetRarity: 'gold' as Rarity,
      needsReroll: false,
      currentPerk: null,
      targetPerk: null,
    })),
```

2. Nieuwe export + gebruik in `schematicCost` (vervang `if (slot.needsReroll)`):
```ts
export function slotNeedsReroll(slot: PerkSlot): boolean {
  const cur = slot.currentPerk ?? null;
  const tgt = slot.targetPerk ?? null;
  if (cur !== null && tgt !== null) return cur !== tgt;
  if (cur === null && tgt === null) return slot.needsReroll;
  return false;
}
```
```ts
    if (slotNeedsReroll(slot)) parts.push({ rePerk: costs.rePerkChange });
```
De `?? null` vangt oude opgeslagen slots op waar de velden `undefined` zijn.

- [ ] **Step 4: Run tests, verwacht groen**

Run: `npm test` — Expected: 52 tests PASS (47 + 5 nieuw). Run: `npx tsc -b` — Expected: geen fouten.

- [ ] **Step 5: Commit**

```powershell
git add src/data/perks.ts src/types.ts src/lib/calculator.ts src/lib/calculator.test.ts; git commit -m "feat: perk catalogue and automatic reroll detection"
```

---

### Task 2: Perk-selects in de editor en perknamen in tooltips

**Files:**
- Modify: `src/components/PerkSlotEditor.tsx` (volledig vervangen), `src/components/SchematicCard.tsx` (tooltip-regel)

**Interfaces:**
- Consumes: `PERKS`, `PERK_LABELS` (Task 1), uitgebreide `PerkSlot`.
- Produces: geen nieuwe exports; UI-gedrag per spec.

- [ ] **Step 1: Vervang `src/components/PerkSlotEditor.tsx` volledig**

```tsx
import { ArrowRight, RefreshCw } from 'lucide-react';
import type { PerkSlot } from '../types';
import { PERKS } from '../data/perks';
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
  const label = index === 5 ? 'Element slot' : `Perk ${index + 1}`;
  const cur = slot.currentPerk ?? null;
  const tgt = slot.targetPerk ?? null;
  const autoReroll = cur !== null && tgt !== null && cur !== tgt;
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
        {autoReroll && (
          <span className="ml-auto flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
            <RefreshCw size={11} /> Reroll
          </span>
        )}
      </div>
      {index < 5 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PerkSelect title="Current perk" value={cur} onChange={(v) => onChange({ ...slot, currentPerk: v })} />
          <ArrowRight size={12} className="text-zinc-500" />
          <PerkSelect title="Target perk" value={tgt} onChange={(v) => onChange({ ...slot, targetPerk: v })} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tooltip in `src/components/SchematicCard.tsx`**

Voeg bovenaan de imports toe: `import { PERK_LABELS } from '../data/perks';`

Vervang in de rarity-bolletjes-map de bestaande `title={...}`-regel:
```tsx
            title={`${i === 5 ? 'Element slot' : `Perk ${i + 1}`}: ${slot.currentRarity} → ${slot.targetRarity}`}
```
door:
```tsx
            title={`${i === 5 ? 'Element slot' : `Perk ${i + 1}`}: ${
              slot.currentPerk || slot.targetPerk
                ? `${PERK_LABELS[slot.currentPerk ?? ''] ?? '(none)'} → ${PERK_LABELS[slot.targetPerk ?? ''] ?? '(none)'} (${slot.currentRarity} → ${slot.targetRarity})`
                : `${slot.currentRarity} → ${slot.targetRarity}`
            }`}
```

- [ ] **Step 3: Verifieer**

Run: `npx tsc -b` — geen fouten. `npm test` — 52 PASS. `npm run build` — slaagt.
Start `npm run dev`, open de app: bewerk een schematic → per slot 1-5 twee perk-dropdowns zichtbaar, gegroepeerd; kies verschillende perks → "Reroll"-badge verschijnt en het RE-PERK!-subtotaal stijgt met 600; gelijke perks → badge weg; beide "(none)" → oude checkbox zichtbaar. Element-slot heeft geen dropdowns. Kaart-tooltip toont perknamen. Stop de server.

- [ ] **Step 4: Commit**

```powershell
git add src/components/PerkSlotEditor.tsx src/components/SchematicCard.tsx; git commit -m "feat: perk pickers with automatic reroll badge and perk-name tooltips"
```
