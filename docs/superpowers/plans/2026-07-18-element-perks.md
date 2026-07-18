# Element Perks + Extra Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Element-perks kiesbaar in elk slot met automatische wisselkosten (traps!), de aparte "Change element"-flow vervalt met een verliesvrije datamigratie, en Core RE-PERK! + Flux worden mee-gesynct in de voorraad.

**Architecture:** `slotNeedsReroll` wordt vervangen door `slotChangeCost(slot, costs): ResourceTotals` dat op basis van de target-perk de juiste kosten kiest; `loadState`/`importJson` migreren oude `elementChange`-data naar slot-5-perks (uitkomst-equivalent); `ResourceKey`/`RESOURCES`/`TEMPLATE_MAP` groeien van 12 naar 16 resources; de UI toont perk-selects op alle 6 slots.

**Tech Stack:** Bestaand project; geen nieuwe dependencies.

## Global Constraints

- Geen emojis; iconen alleen lucide-react; geen gradients; UI Engels; kosten alleen via `CostConfig`.
- Kostenregels `slotChangeCost` exact: beide leeg → legacy `needsReroll` (600 rePerk); precies één gezet of gelijk → niets; target `elemFire|elemWater|elemNature` → 1800 van de bijbehorende elemental (`elementChangeElemental`); target `elemEnergy` → 3× `elementChangeEnergyEach` (600); target `elemPhysical` → `elementChangePhysicalRePerk` (1500 rePerk); target normale perk → `rePerkChange` (600 rePerk).
- Storage-versie blijft 1; migratie is uitkomst-equivalent (oude elementChange fire = nieuwe slot-5 physical→fire = 1800 fireUp). Bewuste uitzondering: een disabled slot 5 telt na migratie niet meer mee (voorheen telde elementChange altijd).
- Nieuwe ResourceKeys exact: `coreRePerk`, `rareFlux`, `epicFlux`, `legendaryFlux`; TEMPLATE_MAP: `reagent_alteration_gameplay_generic`→coreRePerk, `reagent_evolverarity_r`→rareFlux, `reagent_evolverarity_vr`→epicFlux, `reagent_evolverarity_sr`→legendaryFlux.

---

### Task 1: Element-perks in de catalogus en `slotChangeCost` (TDD)

**Files:**
- Modify: `src/data/perks.ts`, `src/lib/calculator.ts`
- Test: `src/lib/calculator.test.ts`

**Interfaces:**
- Consumes: bestaande `PERKS`, `PerkSlot`, `CostConfig` (velden `rePerkChange`, `elementChangeElemental`, `elementChangeEnergyEach`, `elementChangePhysicalRePerk`).
- Produces:
  - `perks.ts`: vijf extra `PERKS`-entries (group `'Element'`): `elemFire` "Element: Fire", `elemWater` "Element: Water", `elemNature` "Element: Nature", `elemEnergy` "Element: Energy", `elemPhysical` "Element: Physical"; export `ELEMENT_PERK_IDS: Set<string>` met die vijf ids.
  - `calculator.ts`: `slotChangeCost(slot: PerkSlot, costs: CostConfig): ResourceTotals` (export); `slotNeedsReroll` VERVALT; `schematicCost` gebruikt `slotChangeCost` per enabled slot en leest `s.elementChange` niet meer.

- [ ] **Step 1: Herschrijf de betrokken tests**

In `src/lib/calculator.test.ts`:

1. Verwijder in de import van `./calculator` het symbool `slotNeedsReroll` en voeg `slotChangeCost` toe.
2. VERWIJDER de vijf oude element-tests die `s.elementChange` zetten ("element change fire...", "...water...", "...nature...", "...energy splits...", "...physical...") uit het `schematicCost`-describe-block.
3. VERVANG het volledige `describe('perk-based rerolls', ...)`-block door:

```ts
describe('slot change costs', () => {
  it('counts 600 rePerk when normal perks differ', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'damage';
    s.perkSlots[0].targetPerk = 'critRating';
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070 + 600);
  });

  it('no cost when perks are equal, even with legacy flag set', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'critRating';
    s.perkSlots[0].targetPerk = 'critRating';
    s.perkSlots[0].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070);
  });

  it('no cost when only one perk is set, even with legacy flag', () => {
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
    expect(slotChangeCost(s.perkSlots[0], DEFAULT_COSTS)).toEqual({ rePerk: 600 });
  });

  it('element change to fire costs 1800 fireUp in any slot', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'elemPhysical';
    s.perkSlots[0].targetPerk = 'elemFire';
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.fireUp).toBe(1800);
    expect(c.rePerk).toBe(2070);
  });

  it('element to element uses target cost (fire to water = 1800 frostUp)', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[2].currentPerk = 'elemFire';
    s.perkSlots[2].targetPerk = 'elemWater';
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.frostUp).toBe(1800);
    expect(c.fireUp).toBeUndefined();
  });

  it('element change to energy costs 600 of each elemental', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[5].currentPerk = 'elemPhysical';
    s.perkSlots[5].targetPerk = 'elemEnergy';
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.fireUp).toBe(600);
    expect(c.frostUp).toBe(600);
    expect(c.ampUp).toBe(600);
  });

  it('element change to physical costs 1500 rePerk', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[5].currentPerk = 'elemFire';
    s.perkSlots[5].targetPerk = 'elemPhysical';
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070 + 1500);
  });

  it('elementChange field is no longer read by the calculator', () => {
    const s = makeDefaultSchematic();
    s.elementChange = { needed: true, element: 'fire' };
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.fireUp).toBeUndefined();
    expect(c.rePerk).toBe(2070);
  });
});
```

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL (`slotChangeCost` bestaat niet; element-tests falen).

- [ ] **Step 3: Implementeer**

`src/data/perks.ts` — voeg onderaan de `PERKS`-array toe (vóór de sluitende `];`):
```ts
  { id: 'elemFire', label: 'Element: Fire', group: 'Element' },
  { id: 'elemWater', label: 'Element: Water', group: 'Element' },
  { id: 'elemNature', label: 'Element: Nature', group: 'Element' },
  { id: 'elemEnergy', label: 'Element: Energy', group: 'Element' },
  { id: 'elemPhysical', label: 'Element: Physical', group: 'Element' },
```
en na `PERK_LABELS`:
```ts
export const ELEMENT_PERK_IDS = new Set(
  PERKS.filter((p) => p.group === 'Element').map((p) => p.id),
);
```

`src/lib/calculator.ts` — vervang de volledige `slotNeedsReroll`-functie door:
```ts
export function slotChangeCost(slot: PerkSlot, costs: CostConfig): ResourceTotals {
  const cur = slot.currentPerk ?? null;
  const tgt = slot.targetPerk ?? null;
  if (cur === null && tgt === null) {
    return slot.needsReroll ? { rePerk: costs.rePerkChange } : {};
  }
  if (cur === null || tgt === null || cur === tgt) return {};
  switch (tgt) {
    case 'elemFire':
      return { fireUp: costs.elementChangeElemental };
    case 'elemWater':
      return { frostUp: costs.elementChangeElemental };
    case 'elemNature':
      return { ampUp: costs.elementChangeElemental };
    case 'elemEnergy':
      return {
        fireUp: costs.elementChangeEnergyEach,
        frostUp: costs.elementChangeEnergyEach,
        ampUp: costs.elementChangeEnergyEach,
      };
    case 'elemPhysical':
      return { rePerk: costs.elementChangePhysicalRePerk };
    default:
      return { rePerk: costs.rePerkChange };
  }
}
```
In `schematicCost`: vervang de regel `if (slotNeedsReroll(slot)) parts.push({ rePerk: costs.rePerkChange });` door `parts.push(slotChangeCost(slot, costs));` en VERWIJDER het volledige `if (s.elementChange.needed && ...)`-blok (incl. de dan ongebruikte `ELEMENT_RESOURCE`-import als tsc daarover klaagt).

- [ ] **Step 4: Run tests, verwacht groen**

Run: `npm test` — Expected: 52 tests PASS (5 oude element-tests verwijderd, het 5-test reroll-block vervangen door 10 nieuwe tests: 52 − 5 − 5 + 10 = 52). Run: `npx tsc -b` — geen fouten.

- [ ] **Step 5: Commit**

```powershell
git add src/data/perks.ts src/lib/calculator.ts src/lib/calculator.test.ts; git commit -m "feat: element perks selectable in any slot with target-based change costs"
```

---

### Task 2: Datamigratie van elementChange (TDD)

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `AppState`, bestaande `loadState`/`importJson`; `Schematic.elementChange`.
- Produces: interne migratie in `storage.ts` — geen nieuwe publieke exports; `loadState` en `importJson` retourneren gemigreerde staat.

- [ ] **Step 1: Schrijf failing tests**

Voeg toe aan `src/lib/storage.test.ts` (imports: voeg `makeDefaultSchematic` staat er al; niets extra nodig):

```ts
describe('elementChange migration', () => {
  function stateWithElement(element: 'fire' | 'energy') {
    const schematic = makeDefaultSchematic();
    schematic.name = 'Old trap';
    schematic.elementChange = { needed: true, element };
    return {
      schematics: [schematic],
      inventory: {},
      costs: structuredClone(DEFAULT_COSTS),
      icons: {},
    };
  }

  it('migrates elementChange to slot 5 perks on load', () => {
    localStorage.setItem('stw-tracker:v1:state', JSON.stringify({ version: 1, state: stateWithElement('fire') }));
    const loaded = loadState();
    const slot = loaded.schematics[0].perkSlots[5];
    expect(slot.currentPerk).toBe('elemPhysical');
    expect(slot.targetPerk).toBe('elemFire');
    expect(loaded.schematics[0].elementChange.needed).toBe(false);
  });

  it('migrates energy on import and leaves untouched schematics alone', () => {
    const json = JSON.stringify({ version: 1, state: stateWithElement('energy') });
    const imported = importJson(json);
    expect(imported.schematics[0].perkSlots[5].targetPerk).toBe('elemEnergy');
  });

  it('does not overwrite already-set slot 5 perks', () => {
    const state = stateWithElement('fire');
    state.schematics[0].perkSlots[5].targetPerk = 'elemWater';
    localStorage.setItem('stw-tracker:v1:state', JSON.stringify({ version: 1, state }));
    const loaded = loadState();
    expect(loaded.schematics[0].perkSlots[5].targetPerk).toBe('elemWater');
    expect(loaded.schematics[0].elementChange.needed).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL (migratie bestaat nog niet).

- [ ] **Step 3: Implementeer in `src/lib/storage.ts`**

Voeg boven `loadState` toe:
```ts
const ELEMENT_TO_PERK: Record<string, string> = {
  fire: 'elemFire',
  water: 'elemWater',
  nature: 'elemNature',
  energy: 'elemEnergy',
};

function migrateSchematic(s: Schematic): Schematic {
  const el = s.elementChange;
  if (!el?.needed || !el.element) return s;
  const target = ELEMENT_TO_PERK[el.element];
  if (!target) return s;
  const perkSlots = s.perkSlots.map((slot, i) => {
    if (i !== 5) return slot;
    if ((slot.currentPerk ?? null) !== null || (slot.targetPerk ?? null) !== null) return slot;
    return { ...slot, currentPerk: 'elemPhysical', targetPerk: target };
  });
  return { ...s, perkSlots, elementChange: { needed: false, element: null } };
}

function migrateState(state: AppState): AppState {
  return { ...state, schematics: state.schematics.map(migrateSchematic) };
}
```
Let op de "does not overwrite"-regel: als slot 5 al een perk heeft, worden alleen `elementChange.needed` op false gezet (de map-stap laat het slot ongemoeid, de return zet `elementChange` altijd terug).

Wikkel vervolgens de succes-returns van `loadState` en `importJson` in `migrateState(...)` (elke plek waar een gevalideerde `AppState` wordt geretourneerd, óók het salvage-pad).

- [ ] **Step 4: Run tests, verwacht groen**

Run: `npm test` — Expected: 55 tests PASS. `npx tsc -b` — geen fouten.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/storage.ts src/lib/storage.test.ts; git commit -m "feat: migrate legacy elementChange data to slot perks"
```

---

### Task 3: Extra resources (Core RE-PERK! en Flux) (TDD)

**Files:**
- Modify: `src/types.ts`, `src/data/costs.ts`, `src/components/TotalsSection.tsx`, `server/epic.ts`
- Test: `server/epic.test.ts`

**Interfaces:**
- Consumes: bestaande `ResourceKey`, `RESOURCES`, `TEMPLATE_MAP`.
- Produces: `ResourceKey` + `'coreRePerk' | 'rareFlux' | 'epicFlux' | 'legendaryFlux'`; `RESOURCES`-groep `'upgrade'`; TEMPLATE_MAP van 16 entries.

- [ ] **Step 1: Schrijf failing test**

Voeg toe aan `server/epic.test.ts` in het `parseCampaignResources`-describe-block:
```ts
  it('maps core re-perk and flux reagents', () => {
    const result = parseCampaignResources(
      profileWith({
        a: { templateId: 'AccountResource:reagent_alteration_gameplay_generic', quantity: 321 },
        b: { templateId: 'AccountResource:reagent_evolverarity_r', quantity: 11 },
        c: { templateId: 'AccountResource:reagent_evolverarity_vr', quantity: 22 },
        d: { templateId: 'AccountResource:reagent_evolverarity_sr', quantity: 33 },
      }),
    );
    expect(result.coreRePerk).toBe(321);
    expect(result.rareFlux).toBe(11);
    expect(result.epicFlux).toBe(22);
    expect(result.legendaryFlux).toBe(33);
  });
```

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL (keys bestaan niet).

- [ ] **Step 3: Implementeer**

`src/types.ts` — breid het `ResourceKey`-union uit met:
```ts
  | 'coreRePerk'
  | 'rareFlux'
  | 'epicFlux'
  | 'legendaryFlux'
```

`src/data/costs.ts` — het group-type van `RESOURCES` wordt `'evolution' | 'perk' | 'element' | 'upgrade'`; voeg onderaan de array toe:
```ts
  { key: 'coreRePerk', label: 'Core RE-PERK!', group: 'perk' },
  { key: 'rareFlux', label: 'Rare Flux', group: 'upgrade' },
  { key: 'epicFlux', label: 'Epic Flux', group: 'upgrade' },
  { key: 'legendaryFlux', label: 'Legendary Flux', group: 'upgrade' },
```

`src/components/TotalsSection.tsx` — voeg aan `GROUP_LABELS` toe: `upgrade: 'Upgrade materials',` en breid de groups-array uit tot `['evolution', 'perk', 'element', 'upgrade'] as const`.

`server/epic.ts` — voeg aan `TEMPLATE_MAP` toe:
```ts
  reagent_alteration_gameplay_generic: 'coreRePerk',
  reagent_evolverarity_r: 'rareFlux',
  reagent_evolverarity_vr: 'epicFlux',
  reagent_evolverarity_sr: 'legendaryFlux',
```

- [ ] **Step 4: Run tests, verwacht groen**

Run: `npm test` — Expected: 56 tests PASS. `npx tsc -b` — geen fouten. Let op: de bestaande test "ignores non-reagent items and logs unknown reagents" gebruikt `reagent_future_thing` — die blijft onbekend en blijft dus slagen.

- [ ] **Step 5: Commit**

```powershell
git add src/types.ts src/data/costs.ts src/components/TotalsSection.tsx server/epic.ts server/epic.test.ts; git commit -m "feat: track core re-perk and flux resources in inventory sync"
```

---

### Task 4: UI — selects op alle slots, element-badge, form-opschoning

**Files:**
- Modify: `src/components/PerkSlotEditor.tsx`, `src/components/SchematicForm.tsx`, `src/components/SchematicCard.tsx`

**Interfaces:**
- Consumes: `ELEMENT_PERK_IDS`, `PERK_LABELS` (Task 1), `slotChangeCost`-semantiek.
- Produces: geen nieuwe exports.

- [ ] **Step 1: `src/components/PerkSlotEditor.tsx`**

Drie wijzigingen (de rest blijft staan):
1. Badge-logica: vervang de regel `const autoReroll = cur !== null && tgt !== null && cur !== tgt;` door:
```ts
  const changed = cur !== null && tgt !== null && cur !== tgt;
  const isElementChange = changed && ELEMENT_PERK_IDS.has(tgt);
```
en voeg de import toe: `import { PERKS, ELEMENT_PERK_IDS } from '../data/perks';` (vervangt de bestaande PERKS-import).
2. Badge-render: vervang `{autoReroll && (` door `{changed && (` en de badge-tekst `Reroll` door `{isElementChange ? 'Element change' : 'Reroll'}`.
3. Perk-selects op alle slots: vervang de conditie `{index < 5 && (` rond het selects-blok door `{(` → oftewel verwijder de `index < 5 &&`-guard zodat het blok altijd rendert (de legacy-checkbox-conditie `index < 5` blijft WEL staan).

- [ ] **Step 2: `src/components/SchematicForm.tsx`**

Verwijder het volledige element-blok (de `<div className="mb-6 flex items-center gap-3">` met de "Change element"-checkbox en de element-`<select>`), de `ELEMENTS`-constante en de nu ongebruikte `ElementType`-import. `draft.elementChange` verder nergens aanraken (het veld blijft bestaan in het type).

- [ ] **Step 3: `src/components/SchematicCard.tsx`**

Vervang de bestaande element-badge (het blok met `schematic.elementChange.needed && schematic.elementChange.element` rond de `Zap`) door een afleiding uit de slots. Voeg boven de `return` toe:
```ts
  const elementTarget = schematic.perkSlots.find(
    (p) => p.enabled && p.targetPerk && ELEMENT_PERK_IDS.has(p.targetPerk) && p.targetPerk !== 'elemPhysical',
  )?.targetPerk;
```
en vervang het badge-blok door:
```tsx
            {elementTarget && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
                <Zap size={10} /> {(PERK_LABELS[elementTarget] ?? '').replace('Element: ', '')}
              </span>
            )}
```
Pas de imports aan: `import { ELEMENT_PERK_IDS, PERK_LABELS } from '../data/perks';` (vervangt de bestaande PERK_LABELS-import).

- [ ] **Step 4: Verifieer**

`npx tsc -b` — geen fouten (controleer dat `ElementType` nergens meer ongebruikt is). `npm test` — 56 PASS. `npm run build` — slaagt. Start `npm run dev` op de achtergrond, fetch `http://localhost:5173/` (HTML shell), stop. Visuele controle door controller/gebruiker daarna: alle 6 slots hebben selects incl. Element-groep; element-wissel toont "Element change"-badge en telt 1800 elemental; het Change element-blok is weg; kaart toont element-badge bij element-target.

- [ ] **Step 5: Commit**

```powershell
git add src/components/PerkSlotEditor.tsx src/components/SchematicForm.tsx src/components/SchematicCard.tsx; git commit -m "feat: element perk selection UI on all slots"
```
