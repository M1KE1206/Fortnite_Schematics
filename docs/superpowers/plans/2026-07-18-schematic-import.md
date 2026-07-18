# Epic Schematic Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eén klik haalt alle wapen/trap-schematics uit het Epic campaign-profiel; via een keuzelijst importeert de gebruiker ze met naam, level en huidige perks (incl. rarity) vooringevuld.

**Architecture:** Pure parsing in `server/schematics.ts` (TDD; templateId-filter, naam-prettify, AID→perk-mapping met tier→rarity); de Vite-plugin krijgt een `POST /schematics`-route en een gedeelde `requireToken`-helper (refactor van het /sync-authblok); client-side een `fetchEpicSchematics`-wrapper en een `ImportModal` in de Schematics-tab die selecties omzet naar `Schematic`-objecten via `makeDefaultSchematic()`.

**Tech Stack:** Bestaand project; geen nieuwe dependencies.

## Global Constraints

- Geen emojis; iconen alleen lucide-react; geen gradients; UI Engels; server/-imports met `.js`-extensie (nodenext); src/-imports zonder extensie.
- Endpoint-foutcontract identiek aan /sync: JSON `{error, needsRelink?}`, statusclamp {400,401,404,500,502}; verlopen device auth → auth-bestand weg + 401 needsRelink.
- Onbekende alterations → `perkId: null` + `unknownAlterations` + server-log `[stw-sync] Unknown alteration: <aid>`.
- Level geclamd 10-50; tier-suffix `_t01`..`_t05` → white..gold (geen suffix → white); schematic-rarity-token c/uc/r/vr/sr → white/green/blue/purple/gold.
- VEILIGHEID voor implementers: roep NOOIT `POST /api/stw-sync/schematics` of `/sync` aan tegen de draaiende dev-server — er staat een echte gekoppelde device auth op deze machine (`.stw-auth.json`) en dat zou live Epic-calls doen. Verificatie alleen via tsc/tests/build en een `GET /status`-check; de live test doet de gebruiker.

---

### Task 1: Parsing-module `server/schematics.ts` (TDD)

**Files:**
- Create: `server/schematics.ts`
- Test: `server/schematics.test.ts`

**Interfaces:**
- Consumes: `Rarity` uit `../src/types.js`.
- Produces (voor Tasks 2-3):
  - `interface ImportedPerk { perkId: string | null; rarity: Rarity }`
  - `interface ImportedSchematic { templateId: string; name: string; rarity: Rarity; level: number; perks: ImportedPerk[]; unknownAlterations: string[] }`
  - `parseCampaignSchematics(profile: unknown, log?: (msg: string) => void): ImportedSchematic[]` (gesorteerd op level aflopend)
  - `mapAlteration(aid: string): ImportedPerk`
  - `prettifyName(slug: string): string`

- [ ] **Step 1: Schrijf failing tests**

`server/schematics.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { mapAlteration, parseCampaignSchematics, prettifyName } from './schematics.js';

function profileWith(items: Record<string, unknown>) {
  return { profileChanges: [{ profile: { items } }] };
}

describe('prettifyName', () => {
  it('strips sid tokens and capitalizes', () => {
    expect(prettifyName('pistol_autoheavy_vr_ore_t04')).toBe('Pistol Autoheavy');
    expect(prettifyName('edged_sword_medium_c_crystal_t01')).toBe('Edged Sword Medium');
  });
});

describe('mapAlteration', () => {
  it('maps known aids with tier rarity', () => {
    expect(mapAlteration('Alteration:aid_weapon_critchance_t05')).toEqual({ perkId: 'critRating', rarity: 'gold' });
    expect(mapAlteration('aid_weapon_critdmg_t03')).toEqual({ perkId: 'critDamage', rarity: 'blue' });
  });
  it('matches firerate before fire element', () => {
    expect(mapAlteration('aid_weapon_firerate_t02').perkId).toBe('fireRate');
    expect(mapAlteration('aid_weapon_element_fire_t04').perkId).toBe('elemFire');
  });
  it('returns null perk for unknown aids, keeping tier', () => {
    expect(mapAlteration('aid_weapon_mystery_t04')).toEqual({ perkId: null, rarity: 'purple' });
  });
  it('defaults to white without tier suffix', () => {
    expect(mapAlteration('aid_weapon_critchance').rarity).toBe('white');
  });
});

describe('parseCampaignSchematics', () => {
  const items = {
    a: {
      templateId: 'Schematic:sid_pistol_autoheavy_vr_ore_t04',
      attributes: { level: 30, alterations: ['aid_weapon_critchance_t04', 'aid_weapon_element_fire_t03', 'aid_weapon_mystery_t02'] },
    },
    b: {
      templateId: 'Schematic:sid_assault_auto_sr_crystal_t05',
      attributes: { level: 145, alterations: [] },
    },
    c: {
      templateId: 'Schematic:sid_launcher_grenade_uc_ore_t01',
      attributes: { level: 5 },
    },
    d: { templateId: 'Worker:managerexplorer_sr_eagle', attributes: { level: 50 } },
    e: { templateId: 'AccountResource:reagent_c_t01', quantity: 10 },
  };

  it('filters, parses and sorts by level descending', () => {
    const result = parseCampaignSchematics(profileWith(items));
    expect(result.map((r) => r.name)).toEqual(['Assault Auto', 'Pistol Autoheavy', 'Launcher Grenade']);
  });

  it('clamps level to 10-50', () => {
    const result = parseCampaignSchematics(profileWith(items));
    expect(result[0].level).toBe(50);
    expect(result[2].level).toBe(10);
  });

  it('parses schematic rarity token', () => {
    const result = parseCampaignSchematics(profileWith(items));
    expect(result[0].rarity).toBe('gold');
    expect(result[1].rarity).toBe('purple');
    expect(result[2].rarity).toBe('green');
  });

  it('maps perks and collects unknown alterations with logging', () => {
    const log = vi.fn();
    const result = parseCampaignSchematics(profileWith(items), log);
    const pistol = result.find((r) => r.name === 'Pistol Autoheavy')!;
    expect(pistol.perks).toEqual([
      { perkId: 'critRating', rarity: 'purple' },
      { perkId: 'elemFire', rarity: 'blue' },
      { perkId: null, rarity: 'green' },
    ]);
    expect(pistol.unknownAlterations).toEqual(['aid_weapon_mystery_t02']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('aid_weapon_mystery_t02'));
  });

  it('survives malformed input', () => {
    expect(parseCampaignSchematics(null)).toEqual([]);
    expect(parseCampaignSchematics({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL, module `./schematics.js` bestaat niet. Bestaande 57 tests groen.

- [ ] **Step 3: Implementeer `server/schematics.ts`**

```ts
import type { Rarity } from '../src/types.js';

export interface ImportedPerk {
  perkId: string | null;
  rarity: Rarity;
}

export interface ImportedSchematic {
  templateId: string;
  name: string;
  rarity: Rarity;
  level: number;
  perks: ImportedPerk[];
  unknownAlterations: string[];
}

const TIER_RARITY: Record<string, Rarity> = {
  '1': 'white',
  '2': 'green',
  '3': 'blue',
  '4': 'purple',
  '5': 'gold',
};

const RARITY_TOKEN: Record<string, Rarity> = {
  c: 'white',
  uc: 'green',
  r: 'blue',
  vr: 'purple',
  sr: 'gold',
};

const AID_PATTERNS: [string, string][] = [
  ['critchance', 'critRating'],
  ['critdmg', 'critDamage'],
  ['headshot', 'headshotDamage'],
  ['firerate', 'fireRate'],
  ['attackrate', 'fireRate'],
  ['attackspeed', 'attackSpeed'],
  ['reload', 'reloadSpeed'],
  ['clipsize', 'magazineSize'],
  ['magazine', 'magazineSize'],
  ['durability', 'durability'],
  ['lifesteal', 'lifeLeech'],
  ['leech', 'lifeLeech'],
  ['snared', 'dmgSlowed'],
  ['slowed', 'dmgSlowed'],
  ['mist', 'dmgMist'],
  ['stun', 'dmgStunned'],
  ['stagger', 'dmgStunned'],
  ['knockdown', 'dmgStunned'],
  ['affliction', 'dmgAfflicted'],
  ['aiming', 'aimDamage'],
  ['ads', 'aimDamage'],
  ['stability', 'stability'],
  ['recoil', 'stability'],
  ['fire', 'elemFire'],
  ['water', 'elemWater'],
  ['nature', 'elemNature'],
  ['energy', 'elemEnergy'],
  ['physical', 'elemPhysical'],
  ['damage', 'damage'],
  ['dmg', 'damage'],
];

export function mapAlteration(aid: string): ImportedPerk {
  const lower = aid.toLowerCase().replace(/^alteration:/, '');
  const tierMatch = lower.match(/_t0([1-5])\b/);
  const rarity: Rarity = tierMatch ? TIER_RARITY[tierMatch[1]] : 'white';
  for (const [pattern, perkId] of AID_PATTERNS) {
    if (lower.includes(pattern)) return { perkId, rarity };
  }
  return { perkId: null, rarity };
}

const SUFFIX_TOKENS = new Set(['c', 'uc', 'r', 'vr', 'sr', 'ore', 'crystal', 't00', 't01', 't02', 't03', 't04', 't05']);

export function prettifyName(slug: string): string {
  return slug
    .split('_')
    .filter((token) => token && !SUFFIX_TOKENS.has(token))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface ProfileItem {
  templateId?: string;
  attributes?: { level?: number; alterations?: unknown };
}

export function parseCampaignSchematics(
  profile: unknown,
  log: (msg: string) => void = () => {},
): ImportedSchematic[] {
  const items = (
    profile as { profileChanges?: { profile?: { items?: Record<string, ProfileItem> } }[] } | null
  )?.profileChanges?.[0]?.profile?.items;
  if (!items || typeof items !== 'object') return [];
  const out: ImportedSchematic[] = [];
  for (const item of Object.values(items)) {
    const tpl = item?.templateId;
    if (!tpl || !tpl.toLowerCase().startsWith('schematic:sid_')) continue;
    const slug = tpl.slice(tpl.toLowerCase().indexOf('sid_') + 'sid_'.length).toLowerCase();
    const tokens = slug.split('_');
    const rarityToken = tokens.find((t) => t in RARITY_TOKEN);
    const rarity = rarityToken ? RARITY_TOKEN[rarityToken] : 'white';
    const rawLevel = typeof item.attributes?.level === 'number' ? item.attributes.level : 10;
    const level = Math.min(50, Math.max(10, rawLevel));
    const alterations = Array.isArray(item.attributes?.alterations) ? item.attributes.alterations : [];
    const perks: ImportedPerk[] = [];
    const unknownAlterations: string[] = [];
    for (const aid of alterations.slice(0, 6)) {
      if (typeof aid !== 'string' || aid === '') {
        perks.push({ perkId: null, rarity: 'white' });
        continue;
      }
      const mapped = mapAlteration(aid);
      perks.push(mapped);
      if (mapped.perkId === null) {
        unknownAlterations.push(aid);
        log(`Unknown alteration: ${aid}`);
      }
    }
    out.push({ templateId: tpl, name: prettifyName(slug), rarity, level, perks, unknownAlterations });
  }
  return out.sort((a, b) => b.level - a.level);
}
```

- [ ] **Step 4: Run tests, verwacht groen**

Run: `npm test` — Expected: 68 tests PASS (57 + 11 nieuw). Run: `npx tsc -b` — geen fouten.

- [ ] **Step 5: Commit**

```powershell
git add server/schematics.ts server/schematics.test.ts; git commit -m "feat: parse campaign schematics with alteration mapping"
```

---

### Task 2: `/schematics`-endpoint met gedeelde token-helper

**Files:**
- Modify: `server/stw-sync-plugin.ts`

**Interfaces:**
- Consumes: `parseCampaignSchematics` (Task 1), bestaande auth/profiel-functies, `DeviceAuth`-type uit `./epic.js`.
- Produces: `POST /api/stw-sync/schematics` → `{ schematics: ImportedSchematic[], accountName: string }`; `/sync` gedraagt zich exact zoals voorheen.

- [ ] **Step 1: Refactor + nieuwe route**

In `server/stw-sync-plugin.ts`:

1. Imports uitbreiden: voeg `type DeviceAuth` toe aan de import uit `'./epic.js'` en voeg toe: `import { parseCampaignSchematics } from './schematics.js';`
2. Voeg binnen `stwSyncPlugin()` (boven `handle`) de helper toe:
```ts
  async function requireToken(res: ServerResponse): Promise<{ token: string; auth: DeviceAuth } | null> {
    const auth = readAuth(root);
    if (!auth) {
      sendJson(res, 401, { error: 'No Epic account linked', needsRelink: true });
      return null;
    }
    try {
      return { token: await accessTokenFromDeviceAuth(auth), auth };
    } catch (e) {
      if (e instanceof EpicApiError && (e.status === 400 || e.status === 401)) {
        deleteAuth(root);
        sendJson(res, 401, { error: 'Epic link expired - link your account again', needsRelink: true });
        return null;
      }
      throw e;
    }
  }
```
3. Vervang in de `POST /sync`-branch het bestaande auth+token-blok (van `const auth = readAuth(root);` t/m het einde van de try/catch rond `accessTokenFromDeviceAuth`) door:
```ts
        const session = await requireToken(res);
        if (!session) return;
        const profile = await queryCampaignProfile(session.token, session.auth.accountId);
        const resources = parseCampaignResources(profile, (msg) => console.warn(`[stw-sync] ${msg}`));
        sendJson(res, 200, { resources, accountName: session.auth.accountName, fetchedAt: new Date().toISOString() });
```
4. Voeg vóór de `POST /unlink`-branch toe:
```ts
      } else if (route === 'POST /schematics') {
        const session = await requireToken(res);
        if (!session) return;
        const profile = await queryCampaignProfile(session.token, session.auth.accountId);
        const schematics = parseCampaignSchematics(profile, (msg) => console.warn(`[stw-sync] ${msg}`));
        sendJson(res, 200, { schematics, accountName: session.auth.accountName });
```

- [ ] **Step 2: Verifieer (GEEN live Epic-calls — zie Global Constraints)**

Run: `npx tsc -b` — geen fouten. `npm test` — 68 PASS. `npm run build` — slaagt.
Start `npm run dev` op de achtergrond en check ALLEEN `GET /api/stw-sync/status` (moet `{"linked":true,...}` of `{"linked":false}` geven) en een onbekende route (404 JSON). Roep `/sync` en `/schematics` NIET aan. Stop de server.

- [ ] **Step 3: Commit**

```powershell
git add server/stw-sync-plugin.ts; git commit -m "feat: schematics endpoint with shared token helper"
```

---

### Task 3: Client-wrapper, ImportModal en knop

**Files:**
- Modify: `src/lib/epicSync.ts`, `src/components/SchematicsSection.tsx`, `README.md`
- Create: `src/components/ImportModal.tsx`

**Interfaces:**
- Consumes: endpoint (Task 2), `makeDefaultSchematic`, `PERK_LABELS`, `RARITY_TEXT` (uit `src/data/rarity.ts`), `useAppState`.
- Produces: `fetchEpicSchematics(): Promise<{ schematics: ImportedSchematic[]; accountName: string }>` + types `ImportedPerk`/`ImportedSchematic` in `epicSync.ts`; `<ImportModal onClose>`.

- [ ] **Step 1: `src/lib/epicSync.ts` uitbreiden**

Voeg bovenaan toe aan de bestaande type-import: `import type { Rarity, ResourceKey } from '../types';` (Rarity toevoegen). Voeg onderaan toe:
```ts
export interface ImportedPerk {
  perkId: string | null;
  rarity: Rarity;
}

export interface ImportedSchematic {
  templateId: string;
  name: string;
  rarity: Rarity;
  level: number;
  perks: ImportedPerk[];
  unknownAlterations: string[];
}

export const fetchEpicSchematics = (): Promise<{ schematics: ImportedSchematic[]; accountName: string }> =>
  call('schematics', { method: 'POST' });
```

- [ ] **Step 2: Schrijf `src/components/ImportModal.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import type { Schematic } from '../types';
import { RARITY_TEXT } from '../data/rarity';
import { PERK_LABELS } from '../data/perks';
import { makeDefaultSchematic } from '../lib/calculator';
import { EpicSyncError, fetchEpicSchematics, type ImportedSchematic } from '../lib/epicSync';
import { useAppState } from '../state/AppStateContext';

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const { state, update } = useAppState();
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
        item.perks.forEach((perk, i) => {
          if (i > 5) return;
          s.perkSlots[i] = { ...s.perkSlots[i], currentPerk: perk.perkId, currentRarity: perk.rarity };
        });
        return s;
      });
    update({ schematics: [...state.schematics, ...created] });
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
```

- [ ] **Step 3: Knop in `src/components/SchematicsSection.tsx`**

1. Imports: voeg `Download` toe aan de lucide-import en `import ImportModal from './ImportModal';`
2. State: naast `editing` toevoegen: `const [showImport, setShowImport] = useState(false);`
3. In de header-rij (waar de "Add schematic"-knop staat), vóór de Add-knop:
```tsx
        <button
          onClick={() => setShowImport(true)}
          className="mr-2 flex items-center gap-2 rounded border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500"
        >
          <Download size={16} /> Import from Epic
        </button>
```
   (De bestaande wrapper-div bevat `justify-between`; zet beide knoppen samen in een `<div className="flex">` als dat nodig is voor de layout.)
4. Onderaan naast de bestaande `{editing && ...}`: `{showImport && <ImportModal onClose={() => setShowImport(false)} />}`

- [ ] **Step 4: README**

Voeg in `README.md` aan de Features-lijst toe:
```markdown
- One-click import of your schematics (name, level, current perks) from your Epic account
```

- [ ] **Step 5: Verifieer (geen live Epic-calls)**

`npx tsc -b` — geen fouten. `npm test` — 68 PASS. `npm run build` — slaagt. `npm run dev` op de achtergrond, fetch `http://localhost:5173/` (HTML shell), stop. Visuele/live import-test doet de gebruiker.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/epicSync.ts src/components/ImportModal.tsx src/components/SchematicsSection.tsx README.md; git commit -m "feat: import schematics from Epic with selection modal"
```
