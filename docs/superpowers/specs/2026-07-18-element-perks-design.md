# Element-perks in elk slot + extra resources — Design

Datum: 2026-07-18
Status: goedgekeurd door gebruiker (keuze "Element-perks in elk slot" + "Flux + Core RE-PERK! in voorraad")

## Doel

1. Element-perks (Fire/Water/Nature/Energy/Physical) worden gewone catalogus-perks, kiesbaar in **elk** slot — want bij traps zit het element vaak in slot 1 of ontbreekt het (Wall Launcher, Sound Wall). De juiste wisselkosten worden automatisch berekend; de aparte "Change element"-checkbox verdwijnt.
2. Vier extra resources worden gesynct en bijgehouden in de voorraad: Core RE-PERK! en Rare/Epic/Legendary Flux (alleen tracken; geen berekeningen).

## Deel 1: element-perks

### Catalogus (`src/data/perks.ts`)

Nieuwe groep "Element" met ids/labels:
`elemFire` "Element: Fire", `elemWater` "Element: Water", `elemNature` "Element: Nature", `elemEnergy` "Element: Energy", `elemPhysical` "Element: Physical".
Export `ELEMENT_PERK_IDS: Set<string>` met deze vijf ids.

### Kostenlogica (`src/lib/calculator.ts`)

`slotNeedsReroll` wordt vervangen door `slotChangeCost(slot, costs): ResourceTotals`:

- Beide perks leeg → legacy: `needsReroll` ? `{ rePerk: costs.rePerkChange }` : `{}`.
- Precies één gezet → `{}`.
- Beide gezet en gelijk → `{}`.
- Beide gezet en verschillend → kosten op basis van de **target**:
  - target `elemFire` → `{ fireUp: costs.elementChangeElemental }` (idem water→frostUp, nature→ampUp)
  - target `elemEnergy` → `{ fireUp: 600, frostUp: 600, ampUp: 600 }` via `costs.elementChangeEnergyEach`
  - target `elemPhysical` → `{ rePerk: costs.elementChangePhysicalRePerk }`
  - target normale perk → `{ rePerk: costs.rePerkChange }`

`schematicCost` telt per enabled slot: upgrade-kosten + `slotChangeCost`. Het element-slot-specifieke pad (`elementChange`) vervalt uit de berekening.

### Migratie van bestaande data

In `loadState` (na de bestaande validatie): voor elke schematic met `elementChange.needed === true` en een element gekozen → zet op slot index 5: `currentPerk = 'elemPhysical'`, `targetPerk = 'elem<Element>'` (fire→elemFire etc.; energy→elemEnergy), en zet `elementChange.needed = false`. Zo blijft de berekende uitkomst identiek aan vóór de migratie. Het `elementChange`-veld blijft in het type/opslag bestaan (versie blijft 1) maar wordt nergens meer gelezen behalve in deze migratie.

### UI

- `SchematicForm`: het "Change element"-blok (checkbox + element-select) verdwijnt.
- `PerkSlotEditor`: perk-selects nu ook op slot index 5 (label blijft "Element slot" als hint, maar gedraagt zich als gewone slot-editor met de volledige catalogus incl. Element-groep). De reroll/wissel-badge toont bij element-wissels "Element change" i.p.v. "Reroll".
- `SchematicCard`: element-badge op de kaart (de Zap + elementnaam) toont voortaan het target-element als een slot een element-perk als doel heeft; anders geen badge.

## Deel 2: extra resources

- `ResourceKey` + `RESOURCES` uitgebreid met: `coreRePerk` "Core RE-PERK!" (group 'perk'), `rareFlux` "Rare Flux", `epicFlux` "Epic Flux", `legendaryFlux` "Legendary Flux" (nieuwe group 'upgrade', label "Upgrade materials" in TotalsSection GROUP_LABELS).
- `TEMPLATE_MAP` in `server/epic.ts` + regels: `reagent_alteration_gameplay_generic → coreRePerk`, `reagent_evolverarity_r → rareFlux`, `reagent_evolverarity_vr → epicFlux`, `reagent_evolverarity_sr → legendaryFlux`.
- De Inventory-tab toont ze automatisch (via RESOURCES); in Totals verschijnen ze alleen als er ooit kosten in komen (nu dus niet). Sync overschrijft voortaan deze 16 keys.

## Testen

Uitbreiding `calculator.test.ts`: elementwissel naar fire (1800 fireUp), energy (3×600), physical (1500 rePerk), normale wissel blijft 600 rePerk, element→element (fire→water = 1800 frostUp), legacy-paden ongewijzigd. Uitbreiding `storage`-tests: migratie zet slot 5-perks en needed=false; uitkomst-equivalentie. `epic.test.ts`: nieuwe mappings.

## Buiten scope

- Kosten die Flux of Core RE-PERK! verbruiken (alleen voorraad).
- Schematic-import uit Epic (aparte feature hierna).
