# STW Schematic Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Client-side webapp die per Fortnite STW-schematic de resterende resources naar max level (PL130) en god roll berekent, met totaaltelling, voorraad/tekort-overzicht en automatische icon-lookup via de Fortnite Wiki.

**Architecture:** Vite + React SPA zonder backend. Pure berekeningsfuncties in `src/lib/` (Vitest-getest), persistentie in localStorage via een versioned storage-module, UI in drie secties (Schematics / Totaal / Voorraad & instellingen) met React context als state-laag.

**Tech Stack:** Vite, React 18+, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), lucide-react, Vitest.

## Global Constraints

- Geen emojis in UI of code; iconen uitsluitend via `lucide-react`.
- Geen CSS-gradients; vlakke kleuren.
- Geen backend, geen API-keys; alle persistentie in localStorage onder namespace `stw-tracker:v1:`.
- Alle UI-teksten in het Engels (gaming-doelgroep), code-identifiers in het Engels.
- Kostenwaardes komen altijd uit `CostConfig` (nooit hardcoded in componenten of berekeningen).
- Rarity-volgorde overal: white → green → blue → purple → gold.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`

**Interfaces:**
- Produces: draaiende Vite dev-server met Tailwind v4 en Vitest-testrunner; alle latere taken bouwen hierop.

- [ ] **Step 1: Scaffold Vite-project in de bestaande map**

Run (in `c:\Users\david\Desktop\Schematic_Tracker`):
```powershell
npm create vite@latest . -- --template react-ts
npm install
npm install lucide-react
npm install -D tailwindcss @tailwindcss/vite vitest
```
Let op: `npm create vite` kan vragen over de niet-lege map (docs/, .git) — kies "Ignore files and continue".

- [ ] **Step 2: Configureer Vite + Tailwind + Vitest**

Vervang `vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Vervang `src/index.css` volledig door:
```css
@import "tailwindcss";
```

Voeg in `package.json` onder `"scripts"` toe: `"test": "vitest run"`.

- [ ] **Step 3: Minimale App**

Vervang `src/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <h1 className="text-2xl font-bold">STW Schematic Tracker</h1>
    </div>
  );
}
```

Verwijder `src/App.css` en `src/assets/react.svg`; haal de `import './App.css'`-regel weg als die bestaat. Zet in `index.html` de `<title>` op `STW Schematic Tracker`.

- [ ] **Step 4: Verifieer dev-server en testrunner**

Run: `npm run build` — Expected: build slaagt.
Run: `npm test` — Expected: "No test files found" (exit code 0 met `--passWithNoTests` niet nodig; als Vitest faalt op geen tests, voeg `--passWithNoTests` toe aan het script).

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest"
```

---

### Task 2: Types en kostenconfiguratie

**Files:**
- Create: `src/types.ts`, `src/data/costs.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `Rarity`, `ElementType`, `ResourceKey`, `PerkSlot`, `Schematic`, `Inventory`, `CostConfig`, `ResourceTotals`, `RARITIES`, `RARITY_LABELS`
  - `costs.ts`: `DEFAULT_COSTS: CostConfig`, `RESOURCES: { key: ResourceKey; label: string; group: 'evolution' | 'perk' | 'element' }[]`, `ELEMENT_RESOURCE: Record<Exclude<ElementType, 'energy'>, ResourceKey>`

- [ ] **Step 1: Schrijf `src/types.ts`**

```ts
export const RARITIES = ['white', 'green', 'blue', 'purple', 'gold'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABELS: Record<Rarity, string> = {
  white: 'White',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
  gold: 'Gold',
};

export type ElementType = 'fire' | 'water' | 'nature' | 'energy';

export type ResourceKey =
  | 'pureDropsOfRain'
  | 'lightningInABottle'
  | 'eyeOfTheStorm'
  | 'stormShard'
  | 'perkUp'
  | 'uncommonPerkUp'
  | 'rarePerkUp'
  | 'epicPerkUp'
  | 'legendaryPerkUp'
  | 'rePerk'
  | 'fireUp'
  | 'frostUp'
  | 'ampUp';

export type ResourceTotals = Partial<Record<ResourceKey, number>>;
export type Inventory = Partial<Record<ResourceKey, number>>;

export interface PerkSlot {
  enabled: boolean;
  currentRarity: Rarity;
  targetRarity: Rarity;
  needsReroll: boolean;
}

export interface Schematic {
  id: string;
  name: string;
  iconUrl: string | null; // data-URL of https-URL
  fallbackIcon: string;   // lucide icon-naam, bv. 'crosshair'
  currentLevel: number;   // 10-50
  targetLevel: number;    // 10-50
  perkSlots: PerkSlot[];  // lengte 6; index 5 = element-slot
  elementChange: { needed: boolean; element: ElementType | null };
}

export interface LevelTierCost {
  pureDropsOfRain: number;
  lightningInABottle: number;
  eyeOfTheStorm: number;
  stormShard: number;
}

export interface PerkStepCost {
  perkUp: number;
  specificAmount: number;
  specificKey: ResourceKey;
}

export interface CostConfig {
  levelTiers: LevelTierCost[]; // index 0 = 10→20 ... index 3 = 40→50
  perkSteps: PerkStepCost[];   // index 0 = white→green ... index 3 = purple→gold
  rePerkChange: number;
  elementChangeRePerk: number;
  elementChangeElemental: number;
}
```

- [ ] **Step 2: Schrijf `src/data/costs.ts`**

```ts
import type { CostConfig, ElementType, ResourceKey } from '../types';

export const DEFAULT_COSTS: CostConfig = {
  levelTiers: [
    { pureDropsOfRain: 20, lightningInABottle: 0, eyeOfTheStorm: 0, stormShard: 0 },
    { pureDropsOfRain: 40, lightningInABottle: 11, eyeOfTheStorm: 0, stormShard: 0 },
    { pureDropsOfRain: 60, lightningInABottle: 22, eyeOfTheStorm: 11, stormShard: 0 },
    { pureDropsOfRain: 80, lightningInABottle: 33, eyeOfTheStorm: 22, stormShard: 11 },
  ],
  perkSteps: [
    { perkUp: 45, specificAmount: 100, specificKey: 'uncommonPerkUp' },
    { perkUp: 65, specificAmount: 150, specificKey: 'rarePerkUp' },
    { perkUp: 95, specificAmount: 225, specificKey: 'epicPerkUp' },
    { perkUp: 140, specificAmount: 345, specificKey: 'legendaryPerkUp' },
  ],
  rePerkChange: 55,
  elementChangeRePerk: 1500,
  elementChangeElemental: 1200,
};

export const RESOURCES: { key: ResourceKey; label: string; group: 'evolution' | 'perk' | 'element' }[] = [
  { key: 'pureDropsOfRain', label: 'Pure Drop of Rain', group: 'evolution' },
  { key: 'lightningInABottle', label: 'Lightning in a Bottle', group: 'evolution' },
  { key: 'eyeOfTheStorm', label: 'Eye of the Storm', group: 'evolution' },
  { key: 'stormShard', label: 'Storm Shard', group: 'evolution' },
  { key: 'perkUp', label: 'PERK-UP!', group: 'perk' },
  { key: 'uncommonPerkUp', label: 'Uncommon PERK-UP!', group: 'perk' },
  { key: 'rarePerkUp', label: 'Rare PERK-UP!', group: 'perk' },
  { key: 'epicPerkUp', label: 'Epic PERK-UP!', group: 'perk' },
  { key: 'legendaryPerkUp', label: 'Legendary PERK-UP!', group: 'perk' },
  { key: 'rePerk', label: 'RE-PERK!', group: 'perk' },
  { key: 'fireUp', label: 'FIRE-UP!', group: 'element' },
  { key: 'frostUp', label: 'FROST-UP!', group: 'element' },
  { key: 'ampUp', label: 'AMP-UP!', group: 'element' },
];

export const ELEMENT_RESOURCE: Record<Exclude<ElementType, 'energy'>, ResourceKey> = {
  fire: 'fireUp',
  water: 'frostUp',
  nature: 'ampUp',
};
```

- [ ] **Step 3: Verifieer typecheck en commit**

Run: `npx tsc --noEmit` — Expected: geen fouten.

```powershell
git add src/types.ts src/data/costs.ts; git commit -m "feat: add domain types and default cost config"
```

---

### Task 3: Calculator (TDD)

**Files:**
- Create: `src/lib/calculator.ts`
- Test: `src/lib/calculator.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `DEFAULT_COSTS`, `ELEMENT_RESOURCE` uit Task 2.
- Produces:
  - `levelUpCost(from: number, to: number, costs: CostConfig): ResourceTotals`
  - `perkUpgradeCost(from: Rarity, to: Rarity, costs: CostConfig): ResourceTotals`
  - `schematicCost(s: Schematic, costs: CostConfig): ResourceTotals`
  - `totalCost(list: Schematic[], costs: CostConfig): ResourceTotals`
  - `shortage(needed: ResourceTotals, inventory: Inventory): ResourceTotals`
  - `addTotals(...totals: ResourceTotals[]): ResourceTotals`
  - `makeDefaultSchematic(): Schematic` (fabriek met 6 slots, level 10→50, alle perks white→gold)

- [ ] **Step 1: Schrijf failing tests**

`src/lib/calculator.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_COSTS } from '../data/costs';
import {
  levelUpCost, perkUpgradeCost, schematicCost, totalCost, shortage, addTotals, makeDefaultSchematic,
} from './calculator';

describe('levelUpCost', () => {
  it('full 10→50 matches spec totals', () => {
    expect(levelUpCost(10, 50, DEFAULT_COSTS)).toEqual({
      pureDropsOfRain: 200, lightningInABottle: 66, eyeOfTheStorm: 33, stormShard: 11,
    });
  });
  it('single tier 10→20 only pure drops', () => {
    expect(levelUpCost(10, 20, DEFAULT_COSTS)).toEqual({ pureDropsOfRain: 20 });
  });
  it('mid-tier start prorates and ceils per resource', () => {
    // 25→30 = 5/10 van tier 20→30 (40 PD + 11 LiB) = 20 PD + 5.5→6 LiB
    expect(levelUpCost(25, 30, DEFAULT_COSTS)).toEqual({ pureDropsOfRain: 20, lightningInABottle: 6 });
  });
  it('no cost when at or above target', () => {
    expect(levelUpCost(50, 50, DEFAULT_COSTS)).toEqual({});
    expect(levelUpCost(50, 40, DEFAULT_COSTS)).toEqual({});
  });
});

describe('perkUpgradeCost', () => {
  it('white→gold sums all steps', () => {
    expect(perkUpgradeCost('white', 'gold', DEFAULT_COSTS)).toEqual({
      perkUp: 345, uncommonPerkUp: 100, rarePerkUp: 150, epicPerkUp: 225, legendaryPerkUp: 345,
    });
  });
  it('blue→gold sums last two steps', () => {
    expect(perkUpgradeCost('blue', 'gold', DEFAULT_COSTS)).toEqual({
      perkUp: 235, epicPerkUp: 225, legendaryPerkUp: 345,
    });
  });
  it('no cost when already at or above target', () => {
    expect(perkUpgradeCost('gold', 'gold', DEFAULT_COSTS)).toEqual({});
    expect(perkUpgradeCost('gold', 'blue', DEFAULT_COSTS)).toEqual({});
  });
});

describe('schematicCost', () => {
  it('default schematic = level 10→50 + 6x white→gold', () => {
    const s = makeDefaultSchematic();
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.pureDropsOfRain).toBe(200);
    expect(c.perkUp).toBe(345 * 6);
    expect(c.legendaryPerkUp).toBe(345 * 6);
    expect(c.rePerk).toBeUndefined();
  });
  it('disabled slots do not count', () => {
    const s = makeDefaultSchematic();
    s.perkSlots.forEach((p) => (p.enabled = false));
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.perkUp).toBeUndefined();
  });
  it('reroll adds rePerk per flagged slot', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].needsReroll = true;
    s.perkSlots[1].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(110);
  });
  it('element change fire adds rePerk + fireUp', () => {
    const s = makeDefaultSchematic();
    s.elementChange = { needed: true, element: 'fire' };
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.rePerk).toBe(1500);
    expect(c.fireUp).toBe(1200);
  });
  it('element change energy splits over three elementals', () => {
    const s = makeDefaultSchematic();
    s.elementChange = { needed: true, element: 'energy' };
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.fireUp).toBe(400);
    expect(c.frostUp).toBe(400);
    expect(c.ampUp).toBe(400);
  });
});

describe('totals & shortage', () => {
  it('totalCost sums schematics', () => {
    const a = makeDefaultSchematic();
    const b = makeDefaultSchematic();
    expect(totalCost([a, b], DEFAULT_COSTS).pureDropsOfRain).toBe(400);
  });
  it('shortage clamps at zero', () => {
    expect(shortage({ perkUp: 100, rePerk: 50 }, { perkUp: 30, rePerk: 200 })).toEqual({ perkUp: 70 });
  });
  it('addTotals merges keys', () => {
    expect(addTotals({ perkUp: 1 }, { perkUp: 2, rePerk: 3 })).toEqual({ perkUp: 3, rePerk: 3 });
  });
});
```

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL, module `./calculator` bestaat niet.

- [ ] **Step 3: Implementeer `src/lib/calculator.ts`**

```ts
import { RARITIES } from '../types';
import type { CostConfig, Inventory, Rarity, ResourceKey, ResourceTotals, Schematic } from '../types';
import { ELEMENT_RESOURCE } from '../data/costs';

export function addTotals(...totals: ResourceTotals[]): ResourceTotals {
  const out: ResourceTotals = {};
  for (const t of totals) {
    for (const [k, v] of Object.entries(t) as [ResourceKey, number][]) {
      if (v > 0) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

export function levelUpCost(from: number, to: number, costs: CostConfig): ResourceTotals {
  const raw: Record<string, number> = {};
  for (let lvl = Math.max(10, from); lvl < Math.min(50, to); lvl++) {
    const tier = costs.levelTiers[Math.floor((lvl - 10) / 10)];
    if (!tier) continue;
    for (const [k, v] of Object.entries(tier)) {
      if (v > 0) raw[k] = (raw[k] ?? 0) + v / 10;
    }
  }
  const out: ResourceTotals = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Math.ceil(v - 1e-9);
    if (n > 0) out[k as ResourceKey] = n;
  }
  return out;
}

export function perkUpgradeCost(from: Rarity, to: Rarity, costs: CostConfig): ResourceTotals {
  const fromIdx = RARITIES.indexOf(from);
  const toIdx = RARITIES.indexOf(to);
  const parts: ResourceTotals[] = [];
  for (let i = fromIdx; i < toIdx; i++) {
    const step = costs.perkSteps[i];
    parts.push({ perkUp: step.perkUp, [step.specificKey]: step.specificAmount });
  }
  return addTotals(...parts);
}

export function schematicCost(s: Schematic, costs: CostConfig): ResourceTotals {
  const parts: ResourceTotals[] = [levelUpCost(s.currentLevel, s.targetLevel, costs)];
  for (const slot of s.perkSlots) {
    if (!slot.enabled) continue;
    parts.push(perkUpgradeCost(slot.currentRarity, slot.targetRarity, costs));
    if (slot.needsReroll) parts.push({ rePerk: costs.rePerkChange });
  }
  if (s.elementChange.needed && s.elementChange.element) {
    const el = s.elementChange.element;
    const elemental: ResourceTotals =
      el === 'energy'
        ? {
            fireUp: Math.ceil(costs.elementChangeElemental / 3),
            frostUp: Math.ceil(costs.elementChangeElemental / 3),
            ampUp: Math.ceil(costs.elementChangeElemental / 3),
          }
        : { [ELEMENT_RESOURCE[el]]: costs.elementChangeElemental };
    parts.push({ rePerk: costs.elementChangeRePerk }, elemental);
  }
  return addTotals(...parts);
}

export function totalCost(list: Schematic[], costs: CostConfig): ResourceTotals {
  return addTotals(...list.map((s) => schematicCost(s, costs)));
}

export function shortage(needed: ResourceTotals, inventory: Inventory): ResourceTotals {
  const out: ResourceTotals = {};
  for (const [k, v] of Object.entries(needed) as [ResourceKey, number][]) {
    const missing = v - (inventory[k] ?? 0);
    if (missing > 0) out[k] = missing;
  }
  return out;
}

export function makeDefaultSchematic(): Schematic {
  return {
    id: crypto.randomUUID(),
    name: '',
    iconUrl: null,
    fallbackIcon: 'crosshair',
    currentLevel: 10,
    targetLevel: 50,
    perkSlots: Array.from({ length: 6 }, () => ({
      enabled: true,
      currentRarity: 'white' as Rarity,
      targetRarity: 'gold' as Rarity,
      needsReroll: false,
    })),
    elementChange: { needed: false, element: null },
  };
}
```

- [ ] **Step 4: Run tests, verwacht groen**

Run: `npm test` — Expected: alle tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib; git commit -m "feat: resource calculator with level, perk, reroll and element costs"
```

---

### Task 4: Storage-module (TDD)

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `DEFAULT_COSTS`.
- Produces:
  - `loadState(): AppState` — leest localStorage, valt terug op defaults bij ontbrekende/corrupte data
  - `saveState(state: AppState): boolean` — schrijft; `false` bij quota/schrijffout
  - `exportJson(state: AppState): string`
  - `importJson(json: string): AppState` — gooit `Error` met leesbare boodschap bij ongeldig formaat
  - `interface AppState { schematics: Schematic[]; inventory: Inventory; costs: CostConfig; icons: Record<string, string> }`

- [ ] **Step 1: Schrijf failing tests**

`src/lib/storage.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COSTS } from '../data/costs';
import { exportJson, importJson, loadState, saveState, type AppState } from './storage';
import { makeDefaultSchematic } from './calculator';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

describe('storage', () => {
  it('loadState returns defaults on empty storage', () => {
    const s = loadState();
    expect(s.schematics).toEqual([]);
    expect(s.costs).toEqual(DEFAULT_COSTS);
    expect(s.inventory).toEqual({});
  });

  it('round-trips state through save/load', () => {
    const schematic = makeDefaultSchematic();
    schematic.name = 'Nocturno';
    const state: AppState = {
      schematics: [schematic],
      inventory: { perkUp: 500 },
      costs: DEFAULT_COSTS,
      icons: { nocturno: 'data:image/png;base64,x' },
    };
    expect(saveState(state)).toBe(true);
    expect(loadState()).toEqual(state);
  });

  it('loadState survives corrupt JSON', () => {
    localStorage.setItem('stw-tracker:v1:state', '{not json');
    expect(loadState().schematics).toEqual([]);
  });

  it('export/import round-trips', () => {
    const state = loadState();
    state.inventory = { rePerk: 42 };
    const restored = importJson(exportJson(state));
    expect(restored.inventory).toEqual({ rePerk: 42 });
  });

  it('importJson rejects wrong shape', () => {
    expect(() => importJson('{"hello":1}')).toThrow();
    expect(() => importJson('not json')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL, module `./storage` bestaat niet.

- [ ] **Step 3: Implementeer `src/lib/storage.ts`**

```ts
import type { CostConfig, Inventory, Schematic } from '../types';
import { DEFAULT_COSTS } from '../data/costs';

export interface AppState {
  schematics: Schematic[];
  inventory: Inventory;
  costs: CostConfig;
  icons: Record<string, string>;
}

const KEY = 'stw-tracker:v1:state';
const VERSION = 1;

function defaults(): AppState {
  return { schematics: [], inventory: {}, costs: structuredClone(DEFAULT_COSTS), icons: {} };
}

function isAppState(v: unknown): v is AppState {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.schematics) && typeof o.inventory === 'object' && o.inventory !== null
    && typeof o.costs === 'object' && o.costs !== null && typeof o.icons === 'object' && o.icons !== null;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as { version?: number; state?: unknown };
    if (parsed.version !== VERSION || !isAppState(parsed.state)) return defaults();
    return parsed.state;
  } catch {
    return defaults();
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, state }));
    return true;
  } catch {
    return false;
  }
}

export function exportJson(state: AppState): string {
  return JSON.stringify({ version: VERSION, state }, null, 2);
}

export function importJson(json: string): AppState {
  let parsed: { version?: number; state?: unknown };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (parsed.version !== VERSION || !isAppState(parsed.state)) {
    throw new Error('File is not a valid STW Tracker export.');
  }
  return parsed.state;
}
```

- [ ] **Step 4: Run tests, verwacht groen**

Run: `npm test` — Expected: alle tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/storage.ts src/lib/storage.test.ts; git commit -m "feat: versioned localStorage persistence with export/import"
```

---

### Task 5: Wiki icon-lookup (TDD)

**Files:**
- Create: `src/lib/wiki.ts`
- Test: `src/lib/wiki.test.ts`

**Interfaces:**
- Consumes: niets projectspecifieks (alleen `fetch`).
- Produces:
  - `buildSearchUrl(query: string): string`
  - `parseSearchResponse(json: unknown): WikiResult[]` met `interface WikiResult { title: string; thumbnailUrl: string | null }`
  - `searchWikiIcons(query: string): Promise<WikiResult[]>` — gooit `Error('Wiki unreachable')` bij netwerkfout
  - `toDataUrl(url: string): Promise<string>` — probeert fetch→blob→data-URL; geeft bij CORS/netwerkfout de originele URL terug (hotlink-fallback)

- [ ] **Step 1: Schrijf failing tests**

`src/lib/wiki.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSearchUrl, parseSearchResponse, searchWikiIcons, toDataUrl } from './wiki';

afterEach(() => vi.unstubAllGlobals());

describe('buildSearchUrl', () => {
  it('encodes query and requests CORS + pageimages', () => {
    const url = buildSearchUrl('Nocturno sword');
    expect(url).toContain('https://fortnite.fandom.com/api.php');
    expect(url).toContain('origin=*');
    expect(url).toContain('generator=search');
    expect(url).toContain('gsrsearch=Nocturno%20sword');
    expect(url).toContain('prop=pageimages');
  });
});

describe('parseSearchResponse', () => {
  it('maps pages to results sorted by search index', () => {
    const json = {
      query: {
        pages: {
          '1': { index: 2, title: 'Siegebreaker', thumbnail: { source: 'https://img/s.png' } },
          '2': { index: 1, title: 'Nocturno', thumbnail: { source: 'https://img/n.png' } },
          '3': { index: 3, title: 'No Image Page' },
        },
      },
    };
    expect(parseSearchResponse(json)).toEqual([
      { title: 'Nocturno', thumbnailUrl: 'https://img/n.png' },
      { title: 'Siegebreaker', thumbnailUrl: 'https://img/s.png' },
      { title: 'No Image Page', thumbnailUrl: null },
    ]);
  });
  it('returns empty array for empty/odd responses', () => {
    expect(parseSearchResponse({})).toEqual([]);
    expect(parseSearchResponse(null)).toEqual([]);
  });
});

describe('searchWikiIcons', () => {
  it('throws readable error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
    await expect(searchWikiIcons('x')).rejects.toThrow('Wiki unreachable');
  });
});

describe('toDataUrl', () => {
  it('falls back to original url on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('cors')));
    await expect(toDataUrl('https://img/n.png')).resolves.toBe('https://img/n.png');
  });
});
```

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL, module `./wiki` bestaat niet.

- [ ] **Step 3: Implementeer `src/lib/wiki.ts`**

```ts
export interface WikiResult {
  title: string;
  thumbnailUrl: string | null;
}

export function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '6',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '128',
    format: 'json',
    origin: '*',
  });
  return `https://fortnite.fandom.com/api.php?${params.toString().replace(/\+/g, '%20')}`;
}

interface RawPage {
  index?: number;
  title?: string;
  thumbnail?: { source?: string };
}

export function parseSearchResponse(json: unknown): WikiResult[] {
  const pages = (json as { query?: { pages?: Record<string, RawPage> } } | null)?.query?.pages;
  if (!pages) return [];
  return Object.values(pages)
    .filter((p): p is RawPage & { title: string } => typeof p?.title === 'string')
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .map((p) => ({ title: p.title, thumbnailUrl: p.thumbnail?.source ?? null }));
}

export async function searchWikiIcons(query: string): Promise<WikiResult[]> {
  let res: Response;
  try {
    res = await fetch(buildSearchUrl(query));
  } catch {
    throw new Error('Wiki unreachable');
  }
  if (!res.ok) throw new Error('Wiki unreachable');
  return parseSearchResponse(await res.json());
}

export async function toDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}
```

- [ ] **Step 4: Run tests, verwacht groen**

Run: `npm test` — Expected: alle tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/wiki.ts src/lib/wiki.test.ts; git commit -m "feat: Fortnite Wiki icon search with data-URL caching fallback"
```

---

### Task 6: App-state context en tab-layout

**Files:**
- Create: `src/state/AppStateContext.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `loadState`/`saveState` (Task 4), types.
- Produces:
  - `AppStateProvider` (React provider, laadt state bij mount, autosave bij elke wijziging via `useEffect`)
  - `useAppState(): { state: AppState; update(patch: Partial<AppState>): void; saveFailed: boolean }`
  - `App` rendert header + drie tabs: `schematics` | `totals` | `inventory` (lucide-iconen `Swords`, `Sigma`, `Package`), met placeholder-content per tab die in Tasks 7–10 vervangen wordt.

- [ ] **Step 1: Schrijf `src/state/AppStateContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadState, saveState, type AppState } from '../lib/storage';

interface Ctx {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  saveFailed: boolean;
}

const AppStateContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [saveFailed, setSaveFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveFailed(!saveState(state));
  }, [state]);

  const value = useMemo<Ctx>(
    () => ({ state, saveFailed, update: (patch) => setState((s) => ({ ...s, ...patch })) }),
    [state, saveFailed],
  );
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): Ctx {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
```

- [ ] **Step 2: Vervang `src/App.tsx` door tab-layout**

```tsx
import { useState } from 'react';
import { AlertTriangle, Package, Sigma, Swords } from 'lucide-react';
import { useAppState } from './state/AppStateContext';

type Tab = 'schematics' | 'totals' | 'inventory';

const TABS: { id: Tab; label: string; icon: typeof Swords }[] = [
  { id: 'schematics', label: 'Schematics', icon: Swords },
  { id: 'totals', label: 'Totals', icon: Sigma },
  { id: 'inventory', label: 'Inventory & Settings', icon: Package },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('schematics');
  const { saveFailed } = useAppState();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <Swords className="text-amber-400" size={24} />
        <h1 className="text-xl font-bold tracking-tight">STW Schematic Tracker</h1>
      </header>
      {saveFailed && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-200">
          <AlertTriangle size={16} /> Saving failed (storage full?). Export your data as backup.
        </div>
      )}
      <nav className="flex gap-1 px-6 pt-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-t px-4 py-2 text-sm font-medium ${
              tab === id ? 'bg-zinc-900 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>
      <main className="mx-6 mb-6 rounded-b rounded-tr bg-zinc-900 p-6">
        {tab === 'schematics' && <p className="text-zinc-400">Schematics section (Task 7-8)</p>}
        {tab === 'totals' && <p className="text-zinc-400">Totals section (Task 9)</p>}
        {tab === 'inventory' && <p className="text-zinc-400">Inventory section (Task 10)</p>}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Wrap provider in `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AppStateProvider } from './state/AppStateContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: Verifieer**

Run: `npm test` — Expected: PASS. Run: `npm run build` — Expected: slaagt.
Run: `npm run dev`, open browser — Expected: donkere pagina met header en drie werkende tabs.

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat: app state provider with autosave and tab layout"
```

---

### Task 7: Schematic-formulier met icon-zoek en perk-slot-editor

**Files:**
- Create: `src/components/RaritySelect.tsx`, `src/components/PerkSlotEditor.tsx`, `src/components/SchematicForm.tsx`
- Create: `src/data/rarity.ts`

**Interfaces:**
- Consumes: types, `makeDefaultSchematic`, `searchWikiIcons`, `toDataUrl`, `useAppState`.
- Produces:
  - `RARITY_COLORS: Record<Rarity, string>` in `src/data/rarity.ts` (Tailwind-klassen per rarity)
  - `<RaritySelect value onChange>` — knoppenrij van 5 rarity-bolletjes
  - `<PerkSlotEditor slot index onChange>` — rij met enable-checkbox, current/target RaritySelect, reroll-checkbox; index 5 toont label "Element slot"
  - `<SchematicForm initial onSave onCancel>` — volledig formulier (naam + debounced wiki-zoek met resultaat-thumbnails, handmatige URL-invoer, level-inputs, 6 PerkSlotEditors, element-wissel-select); roept `onSave(schematic)` aan

- [ ] **Step 1: Schrijf `src/data/rarity.ts`**

```ts
import type { Rarity } from '../types';

export const RARITY_COLORS: Record<Rarity, string> = {
  white: 'bg-zinc-300',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  gold: 'bg-amber-500',
};

export const RARITY_TEXT: Record<Rarity, string> = {
  white: 'text-zinc-300',
  green: 'text-green-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  gold: 'text-amber-400',
};
```

- [ ] **Step 2: Schrijf `src/components/RaritySelect.tsx`**

```tsx
import { RARITIES, RARITY_LABELS, type Rarity } from '../types';
import { RARITY_COLORS } from '../data/rarity';

export default function RaritySelect({ value, onChange }: { value: Rarity; onChange: (r: Rarity) => void }) {
  return (
    <div className="flex gap-1">
      {RARITIES.map((r) => (
        <button
          key={r}
          type="button"
          title={RARITY_LABELS[r]}
          onClick={() => onChange(r)}
          className={`h-5 w-5 rounded-full ${RARITY_COLORS[r]} ${
            value === r ? 'ring-2 ring-white' : 'opacity-40 hover:opacity-80'
          }`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Schrijf `src/components/PerkSlotEditor.tsx`**

```tsx
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
```

- [ ] **Step 4: Schrijf `src/components/SchematicForm.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, Search } from 'lucide-react';
import type { ElementType, Schematic } from '../types';
import { searchWikiIcons, toDataUrl, type WikiResult } from '../lib/wiki';
import { useAppState } from '../state/AppStateContext';
import PerkSlotEditor from './PerkSlotEditor';

interface Props {
  initial: Schematic;
  onSave: (s: Schematic) => void;
  onCancel: () => void;
}

const ELEMENTS: { value: ElementType; label: string }[] = [
  { value: 'fire', label: 'Fire' },
  { value: 'water', label: 'Water' },
  { value: 'nature', label: 'Nature' },
  { value: 'energy', label: 'Energy' },
];

export default function SchematicForm({ initial, onSave, onCancel }: Props) {
  const { state, update } = useAppState();
  const [draft, setDraft] = useState<Schematic>(initial);
  const [results, setResults] = useState<WikiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [wikiError, setWikiError] = useState(false);
  const debounce = useRef<number>(undefined);

  useEffect(() => {
    window.clearTimeout(debounce.current);
    const q = draft.name.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    debounce.current = window.setTimeout(async () => {
      setSearching(true);
      setWikiError(false);
      try {
        setResults(await searchWikiIcons(`${q} schematic`));
      } catch {
        setWikiError(true);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => window.clearTimeout(debounce.current);
  }, [draft.name]);

  async function pickIcon(r: WikiResult) {
    if (!r.thumbnailUrl) return;
    const cacheKey = r.title.toLowerCase();
    const cached = state.icons[cacheKey];
    const url = cached ?? (await toDataUrl(r.thumbnailUrl));
    if (!cached) update({ icons: { ...state.icons, [cacheKey]: url } });
    setDraft((d) => ({ ...d, iconUrl: url }));
    setResults([]);
  }

  function set<K extends keyof Schematic>(key: K, value: Schematic[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/70 p-6">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-bold">{initial.name ? 'Edit schematic' : 'Add schematic'}</h2>

        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800">
            {draft.iconUrl ? (
              <img src={draft.iconUrl} alt="" className="h-14 w-14 object-contain" />
            ) : (
              <ImageOff size={24} className="text-zinc-600" />
            )}
          </div>
          <div className="grow">
            <label className="mb-1 block text-sm text-zinc-400">Name</label>
            <div className="relative">
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Nocturno"
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 pr-9"
              />
              <span className="absolute right-2 top-2.5 text-zinc-500">
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </span>
            </div>
            {wikiError && <p className="mt-1 text-xs text-red-400">Wiki unreachable - paste an image URL below instead.</p>}
            {results.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {results.filter((r) => r.thumbnailUrl).map((r) => (
                  <button
                    key={r.title}
                    type="button"
                    onClick={() => pickIcon(r)}
                    title={r.title}
                    className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs hover:border-amber-500"
                  >
                    <img src={r.thumbnailUrl!} alt="" className="h-8 w-8 object-contain" />
                    {r.title}
                  </button>
                ))}
              </div>
            )}
            <input
              value={draft.iconUrl?.startsWith('data:') ? '' : (draft.iconUrl ?? '')}
              onChange={(e) => set('iconUrl', e.target.value || null)}
              placeholder="Or paste an image URL"
              className="mt-2 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
            />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm text-zinc-400">Level</label>
          <input
            type="number" min={10} max={50}
            value={draft.currentLevel}
            onChange={(e) => set('currentLevel', Math.min(50, Math.max(10, Number(e.target.value))))}
            className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
          <span className="text-zinc-500">to</span>
          <input
            type="number" min={10} max={50}
            value={draft.targetLevel}
            onChange={(e) => set('targetLevel', Math.min(50, Math.max(10, Number(e.target.value))))}
            className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </div>

        <div className="mb-4 space-y-2">
          {draft.perkSlots.map((slot, i) => (
            <PerkSlotEditor
              key={i}
              slot={slot}
              index={i}
              onChange={(s) => set('perkSlots', draft.perkSlots.map((p, j) => (j === i ? s : p)))}
            />
          ))}
        </div>

        <div className="mb-6 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.elementChange.needed}
              onChange={(e) => set('elementChange', { ...draft.elementChange, needed: e.target.checked })}
            />
            Change element
          </label>
          {draft.elementChange.needed && (
            <select
              value={draft.elementChange.element ?? ''}
              onChange={(e) => set('elementChange', { needed: true, element: e.target.value as ElementType })}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
            >
              <option value="" disabled>Pick element</option>
              {ELEMENTS.map((el) => (
                <option key={el.value} value={el.value}>{el.label}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button
            onClick={() => draft.name.trim() && onSave(draft)}
            disabled={!draft.name.trim()}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verifieer en commit**

Run: `npm run build` — Expected: slaagt (componenten nog niet gemount; dat gebeurt in Task 8).

```powershell
git add src/components src/data/rarity.ts; git commit -m "feat: schematic form with wiki icon search and perk slot editors"
```

---

### Task 8: Schematic-lijst met kaarten, bewerken en verwijderen

**Files:**
- Create: `src/components/SchematicCard.tsx`, `src/components/SchematicsSection.tsx`, `src/components/ResourceList.tsx`
- Modify: `src/App.tsx` (placeholder `schematics`-tab vervangen)

**Interfaces:**
- Consumes: `schematicCost`, `useAppState`, `SchematicForm`, `RARITY_COLORS`, `RESOURCES`, `makeDefaultSchematic`.
- Produces:
  - `<ResourceList totals compact?>` — herbruikbare lijst "label: aantal" voor een `ResourceTotals` (ook gebruikt in Task 9)
  - `<SchematicCard schematic onEdit onDelete>` — icon, naam, levelbadge, 6 rarity-bolletjes, uitklapbare subtotalen
  - `<SchematicsSection />` — grid + "Add schematic"-knop + modalbeheer

- [ ] **Step 1: Schrijf `src/components/ResourceList.tsx`**

```tsx
import { RESOURCES } from '../data/costs';
import type { ResourceTotals } from '../types';

export default function ResourceList({ totals }: { totals: ResourceTotals }) {
  const rows = RESOURCES.filter((r) => (totals[r.key] ?? 0) > 0);
  if (rows.length === 0) return <p className="text-sm text-zinc-500">Nothing needed.</p>;
  return (
    <ul className="space-y-0.5 text-sm">
      {rows.map((r) => (
        <li key={r.key} className="flex justify-between gap-6">
          <span className="text-zinc-400">{r.label}</span>
          <span className="font-mono tabular-nums">{(totals[r.key] ?? 0).toLocaleString('en-US')}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Schrijf `src/components/SchematicCard.tsx`**

```tsx
import { useState } from 'react';
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
  const cost = schematicCost(schematic, state.costs);

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
```

- [ ] **Step 3: Schrijf `src/components/SchematicsSection.tsx`**

```tsx
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
        <p className="text-sm text-zinc-400">{state.schematics.length} schematic(s)</p>
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
```

- [ ] **Step 4: Mount in `src/App.tsx`**

Vervang de placeholder-regel `{tab === 'schematics' && ...}` door `{tab === 'schematics' && <SchematicsSection />}` en voeg bovenaan toe: `import SchematicsSection from './components/SchematicsSection';`

- [ ] **Step 5: Verifieer handmatig**

Run: `npm run dev` — voeg een schematic toe (typ bv. "Nocturno"), controleer: wiki-zoekresultaten verschijnen, icon wordt gezet, kaart toont level + bolletjes, subtotalen kloppen (level 10→50 = 200 Pure Drops), herladen van de pagina behoudt de data, bewerken en verwijderen werken.

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "feat: schematic list with cards, add/edit/delete and per-schematic totals"
```

---

### Task 9: Totaal-overzicht met voorraad en tekort

**Files:**
- Create: `src/components/TotalsSection.tsx`
- Modify: `src/App.tsx` (placeholder `totals`-tab vervangen)

**Interfaces:**
- Consumes: `totalCost`, `shortage`, `RESOURCES`, `useAppState`.
- Produces: `<TotalsSection />` — tabel per resource-groep: Needed / Have / Missing met kleur (groen = gedekt, rood = tekort).

- [ ] **Step 1: Schrijf `src/components/TotalsSection.tsx`**

```tsx
import { Check, X } from 'lucide-react';
import { RESOURCES } from '../data/costs';
import { totalCost } from '../lib/calculator';
import { useAppState } from '../state/AppStateContext';

const GROUP_LABELS: Record<string, string> = {
  evolution: 'Evolution materials',
  perk: 'Perk resources',
  element: 'Elemental resources',
};

export default function TotalsSection() {
  const { state } = useAppState();
  const totals = totalCost(state.schematics, state.costs);
  const groups = ['evolution', 'perk', 'element'] as const;

  if (state.schematics.length === 0) {
    return <p className="py-12 text-center text-zinc-500">Add schematics to see totals.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const rows = RESOURCES.filter((r) => r.group === g && (totals[r.key] ?? 0) > 0);
        if (rows.length === 0) return null;
        return (
          <div key={g}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">{GROUP_LABELS[g]}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-500">
                  <th className="py-1.5 font-medium">Resource</th>
                  <th className="py-1.5 text-right font-medium">Needed</th>
                  <th className="py-1.5 text-right font-medium">Have</th>
                  <th className="py-1.5 text-right font-medium">Missing</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const needed = totals[r.key] ?? 0;
                  const have = state.inventory[r.key] ?? 0;
                  const missing = Math.max(0, needed - have);
                  return (
                    <tr key={r.key} className="border-b border-zinc-800/50">
                      <td className="py-1.5">{r.label}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{needed.toLocaleString('en-US')}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-zinc-400">{have.toLocaleString('en-US')}</td>
                      <td className={`py-1.5 text-right font-mono tabular-nums ${missing > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {missing.toLocaleString('en-US')}
                      </td>
                      <td className="pl-2">
                        {missing > 0 ? <X size={14} className="text-red-400" /> : <Check size={14} className="text-green-400" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Mount in `src/App.tsx`**

Vervang `{tab === 'totals' && ...}` door `{tab === 'totals' && <TotalsSection />}` met bijbehorende import.

- [ ] **Step 3: Verifieer handmatig**

Run: `npm run dev` — met 2 schematics: Needed = 2× de per-schematic waardes; vul (tijdelijk via devtools of na Task 10) voorraad in en controleer Missing-kleuren.

- [ ] **Step 4: Commit**

```powershell
git add -A; git commit -m "feat: aggregated totals with inventory shortage view"
```

---

### Task 10: Voorraad, kosteninstellingen en export/import

**Files:**
- Create: `src/components/InventorySection.tsx`
- Modify: `src/App.tsx` (placeholder `inventory`-tab vervangen)

**Interfaces:**
- Consumes: `RESOURCES`, `DEFAULT_COSTS`, `exportJson`, `importJson`, `useAppState`.
- Produces: `<InventorySection />` met drie blokken: (1) voorraad-inputs per resource, (2) kostenconfiguratie-editor (level-tiers, perk-steps, RE-PERK!-waardes) met "Reset to defaults", (3) Export/Import JSON-knoppen.

- [ ] **Step 1: Schrijf `src/components/InventorySection.tsx`**

```tsx
import { useRef } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { DEFAULT_COSTS, RESOURCES } from '../data/costs';
import { exportJson, importJson } from '../lib/storage';
import { useAppState } from '../state/AppStateContext';
import { RARITY_LABELS, RARITIES } from '../types';

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-400">{label}</span>
      <input
        type="number" min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
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
                    label="PERK-UP!"
                    value={step.perkUp}
                    onChange={(n) =>
                      update({
                        costs: {
                          ...state.costs,
                          perkSteps: state.costs.perkSteps.map((s, j) => (j === i ? { ...s, perkUp: n } : s)),
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
              label="RE-PERK! per element change"
              value={state.costs.elementChangeRePerk}
              onChange={(n) => update({ costs: { ...state.costs, elementChangeRePerk: n } })}
            />
            <NumberField
              label="Elemental PERK-UP per element change"
              value={state.costs.elementChangeElemental}
              onChange={(n) => update({ costs: { ...state.costs, elementChangeElemental: n } })}
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
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount in `src/App.tsx`**

Vervang `{tab === 'inventory' && ...}` door `{tab === 'inventory' && <InventorySection />}` met import.

- [ ] **Step 3: Verifieer handmatig**

Run: `npm run dev` — vul voorraad in, check dat Totals-tab Missing bijwerkt; wijzig een kostwaarde en check dat subtotalen veranderen; exporteer JSON, wis localStorage (devtools), importeer JSON en controleer dat alles terug is.

- [ ] **Step 4: Commit**

```powershell
git add -A; git commit -m "feat: inventory, editable cost settings and JSON backup"
```

---

### Task 11: Eindcontrole en README

**Files:**
- Create: `README.md`
- Modify: eventueel kleine fixes uit de eindcontrole

**Interfaces:**
- Consumes: alles.
- Produces: gedocumenteerd, gebouwd project.

- [ ] **Step 1: Volledige verificatie**

Run: `npm test` — Expected: alle tests PASS.
Run: `npm run build` — Expected: slaagt zonder TypeScript-fouten.
Run: `npm run preview` — doorloop het hele flow-scenario: schematic toevoegen met wiki-icon, level 27 invullen (controleer pro-rata), perks deels op blue zetten, reroll aanvinken, element change op fire, voorraad invullen, totals en missing controleren, export/import, pagina herladen.

- [ ] **Step 2: Schrijf `README.md`**

```markdown
# STW Schematic Tracker

Client-side tracker for Fortnite Save the World schematics: calculates the exact
resources needed to bring schematics to max level (PL130) and god-roll all perks,
across your whole collection, with inventory tracking and shortage overview.

## Features

- Per-schematic level (10-50) and per-perk-slot rarity tracking (6 slots)
- Reroll (RE-PERK!) and element change costs included
- Automatic in-game icons via the Fortnite Wiki (no API key), cached in your browser
- Aggregated totals + inventory shortage view
- All cost values editable in Settings (defaults follow current in-game values)
- Data stored in localStorage; JSON export/import for backup

## Development

npm install
npm run dev     # dev server
npm test        # unit tests (Vitest)
npm run build   # production build to dist/
```

- [ ] **Step 3: Commit**

```powershell
git add -A; git commit -m "docs: add README"
```
