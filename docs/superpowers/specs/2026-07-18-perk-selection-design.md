# Echte perk-keuze per slot — Design

Datum: 2026-07-18
Status: goedgekeurd door gebruiker

## Doel

Per perk-slot de echte STW-perk kiezen (huidig én doel, bijv. "Damage → Critical Rating"), zodat reroll-kosten (600 RE-PERK!) automatisch meetellen zodra huidig en doel verschillen — in plaats van het handmatige "needs reroll"-vinkje.

## Datamodel

`PerkSlot` (in `src/types.ts`) krijgt twee optionele velden:

```ts
interface PerkSlot {
  enabled: boolean;
  currentRarity: Rarity;
  targetRarity: Rarity;
  needsReroll: boolean;          // legacy; blijft voor bestaande data
  currentPerk: string | null;    // perk-id uit de catalogus
  targetPerk: string | null;
}
```

`makeDefaultSchematic()` zet beide op `null`. Storage-versie blijft 1; `loadState` vult ontbrekende velden aan met `null` (oude opgeslagen schematics blijven geldig — de bestaande `isSchematic`-validatie eist deze velden niet).

## Perk-catalogus

Nieuw bestand `src/data/perks.ts`:

```ts
export interface PerkDef { id: string; label: string; group: string }
export const PERKS: PerkDef[] = [ ... ];
export const PERK_LABELS: Record<string, string>; // afgeleid
```

Groepen en perks (vrije keuze per slot; geen wapen-specifieke pools):

- **Damage:** Damage, Critical Rating, Critical Damage, Headshot Damage, Damage to Afflicted, Damage to Slowed and Snared, Damage to Mist Monsters and Bosses, Damage to Stunned Staggered and Knocked Down
- **Speed:** Attack Speed, Fire Rate, Reload Speed
- **Utility:** Magazine Size, Durability, Life Leech, Ranged Weapon Damage while Aiming, Weapon Stability
- **Sixth perk:** Affliction, Snare, Stun, Knockback, Causes Affliction (6s), Headshots grant Energy

De lijst is een curated startpunt; onbekende wensen kan de gebruiker later melden (uitbreiden = één regel in `perks.ts`).

## Kostenlogica

In `schematicCost` (`src/lib/calculator.ts`) wordt de reroll-conditie per slot:

```
rerollNeeded = (currentPerk != null && targetPerk != null && currentPerk !== targetPerk)
            || (currentPerk == null && targetPerk == null && needsReroll)
```

Alle overige berekeningen ongewijzigd. Slot 6 (element) blijft via `elementChange` lopen; perk-keuze geldt alleen voor slots 1-5 (index 0-4).

## UI

- **PerkSlotEditor** (slots 0-4): twee compacte selects "Current perk" → "Target perk" met "(none)" als default, opties gegroepeerd per catalogus-groep (`<optgroup>`). Zodra ze beide gezet zijn en verschillen: badge "Reroll" (amber, met RefreshCw-icoon van lucide). Het oude reroll-checkbox is alléén zichtbaar wanneer beide selects op "(none)" staan (legacy-gedrag).
- **SchematicCard**: de tooltip van elk rarity-bolletje toont voortaan ook de perk-namen: `Perk 2: Damage → Critical Rating (blue → gold)`; zonder gekozen perks blijft de huidige tooltip.
- Element-slot (index 5) verandert niet.

## Testen

Vitest-uitbreiding op `calculator.test.ts`: reroll telt bij verschillende perks; telt niet bij gelijke perks; telt niet bij één gezette perk; legacy needsReroll blijft werken als beide perks leeg zijn; legacy needsReroll telt NIET meer zodra perks gezet en gelijk zijn.

## Buiten scope

- Wapen-specifieke perk-pools per slot.
- Perks automatisch uit het Epic-profiel lezen (alteration-ID's) — eventueel latere feature.
- Percentages/waardes per rarity van elke perk (alleen namen).
