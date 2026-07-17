# STW Schematic Tracker — Design

Datum: 2026-07-17
Status: goedgekeurd door gebruiker

## Doel

Een client-side webapp waarmee je Fortnite Save the World schematics bijhoudt en exact berekent hoeveel resources er nodig zijn om elke schematic naar max level (PL130) en een god roll (alle perks Gold) te brengen — inclusief een totaaltelling over alle schematics en een voorraad/tekort-overzicht.

## Tech stack

- Vite + React + TypeScript + Tailwind CSS
- Lucide-react voor UI-iconen (geen emojis, geen gradients)
- Volledig client-side; geen backend, geen API-keys
- Persistentie: `localStorage` (schematics, voorraad, instellingen, icon-cache)
- Hostbaar als statische site (Netlify) of lokaal via `npm run dev` / `npm run preview`

## Datamodel

```ts
type Rarity = 'white' | 'green' | 'blue' | 'purple' | 'gold';
type Element = 'fire' | 'water' | 'nature' | 'energy' | 'physical';

interface PerkSlot {
  currentRarity: Rarity;      // huidige tier van de perk
  targetRarity: Rarity;       // standaard 'gold'
  needsReroll: boolean;       // perk moet nog gewisseld worden (RE-PERK!)
  enabled: boolean;           // slot meetellen ja/nee
}

interface Schematic {
  id: string;                 // uuid
  name: string;
  iconDataUrl: string | null; // gecachte icon (data-URL)
  iconSource: 'wiki' | 'manual' | 'fallback';
  fallbackIcon: string;       // Lucide icon-naam (wapentype)
  currentLevel: number;       // 10–50
  targetLevel: number;        // standaard 50
  perkSlots: PerkSlot[];      // 6 slots; slot index 5 = element-slot
  elementChange: {            // alleen relevant voor element-slot
    needed: boolean;
    element: Element | null;  // gewenst element
  };
}

interface Inventory {
  // per resource-key een aantal dat de gebruiker al bezit
  [resourceKey: string]: number;
}
```

Alles wordt opgeslagen onder één localStorage-namespace (`stw-tracker:*`) met een versienummer voor toekomstige migraties.

## Kostenconfiguratie (bewerkbaar via instellingen-paneel)

Alle onderstaande waardes staan in `src/data/costs.ts` als defaults en zijn door de gebruiker aanpasbaar in de UI (opgeslagen in localStorage, reset-knop naar defaults).

### Level-up (evolutie-materialen), per tier van 10 levels

| Tier    | Pure Drops of Rain | Lightning in a Bottle | Eye of the Storm | Storm Shard |
|---------|--------------------|-----------------------|------------------|-------------|
| 10 → 20 | 20                 | —                     | —                | —           |
| 20 → 30 | 40                 | 11                    | —                | —           |
| 30 → 40 | 60                 | 22                    | 11               | —           |
| 40 → 50 | 80                 | 33                    | 22               | 11          |

Tussenliggende levels tellen naar rato: elk level binnen een tier kost 1/10 van de tierkosten; totalen worden per resource naar boven afgerond.

### Perk-upgrade, per perk per stap

| Stap           | PERK-UP! | Rarity-specifiek        |
|----------------|----------|-------------------------|
| White → Green  | 45       | 100 Uncommon PERK-UP!   |
| Green → Blue   | 65       | 150 Rare PERK-UP!       |
| Blue → Purple  | 95       | 225 Epic PERK-UP!       |
| Purple → Gold  | 140      | 345 Legendary PERK-UP!  |

### Perk wisselen (RE-PERK!)

- Perk vervangen door een andere perk: **55 RE-PERK!** per wissel (default; aanpasbaar — waarde ter verificatie in-game).
- Element wisselen (slot 6): **1500 RE-PERK! + 1200 elementaal PERK-UP** (FIRE-UP!/FROST-UP!/AMP-UP!; default, aanpasbaar). Energy vereist alle drie de elementals (elk 1/3 van het bedrag, naar boven afgerond).

## Berekeningen

- **Per schematic:** som van (a) resterende evolutie-materialen van `currentLevel` → `targetLevel`, (b) per ingeschakeld perk-slot de cumulatieve upgrade-stappen van `currentRarity` → `targetRarity`, (c) RE-PERK!-kosten voor elk slot met `needsReroll`, (d) element-wisselkosten indien nodig.
- **Totaal:** som over alle schematics, per resource.
- **Tekort:** `max(0, totaalNodig − voorraad)` per resource.

Berekeningslogica leeft in pure functies (`src/lib/calculator.ts`), los van React — unit-testbaar met Vitest.

## Icon-lookup

1. Gebruiker typt schematic-naam → debounced zoekopdracht naar de Fortnite Wiki MediaWiki-API (`fortnite.fandom.com/api.php`, `action=query` + `generator=search` + `prop=pageimages`, `origin=*` voor CORS, geen key nodig).
2. Gevonden thumbnail wordt opgehaald, als data-URL geconverteerd en in localStorage gecached (key = genormaliseerde naam), zodat de icon offline blijft werken.
3. Fallbacks, in volgorde: (a) gebruiker plakt zelf een afbeelding-URL of uploadt een bestand, (b) generiek Lucide-icoon per wapentype (assault, shotgun, sniper, pistol, explosive, melee, trap).
4. Wiki onbereikbaar → niet-blokkerende melding; schematic kan altijd zonder icon opgeslagen worden.

## UI

Eén pagina met drie secties (tabs of gestapelde secties):

1. **Schematics** — kaarten-grid: icon, naam, level-badge, perk-rarity-indicatoren per slot, subtotaal-resources per schematic. Toevoegen via formulier/modal met naam-zoek (live icon-preview), level-slider, 6 perk-slot-editors. Bewerken en verwijderen (met bevestiging).
2. **Totaal** — geaggregeerde resourcetabel over alle schematics: evolutie-materialen, PERK-UP! per soort, RE-PERK!, elementals. Per rij: nodig / in bezit / tekort, met visuele voortgangsindicatie.
3. **Voorraad & instellingen** — invulvelden per resource voor huidige voorraad; kostenconfiguratie-editor; JSON-export/-import van alle data (backup en herstel).

Styling: donker thema passend bij Fortnite/STW-sfeer, rarity-kleuren (grijs/groen/blauw/paars/oranje) als accenten, vlakke kleuren zonder gradients, Lucide-iconen.

## Foutafhandeling

- Wiki-fetch faalt → melding + handmatige icon-fallback; app blijft volledig bruikbaar.
- localStorage corrupt of quota vol → app start met lege staat, toont waarschuwing en biedt JSON-import aan; schrijffouten worden gemeld i.p.v. stil te falen.
- JSON-import valideert structuur en versie voordat bestaande data wordt overschreven.

## Testen

- Vitest unit-tests voor `calculator.ts`: tiergrenzen (10/20/30/40/50), tussenliggende levels, cumulatieve perk-stappen, reroll- en elementkosten, tekortberekening.
- Handmatige verificatie van icon-lookup en localStorage-persistentie in de browser.

## Buiten scope

- Accounts, sync tussen apparaten, backend.
- Automatische game-data (schematic-lijsten, perk-namen); de gebruiker voert namen zelf in.
- Schematic XP (alleen evolutie-materialen worden geteld).
