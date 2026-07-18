# Echte namen + auto-icons bij import — Design

Datum: 2026-07-18
Status: goedgekeurd door gebruiker

## Doel

1. Geïmporteerde schematics krijgen hun echte in-game naam (bijv. "Swan" i.p.v. "Assault Autodrum Ratrod") via een meegecommitte vertaaltabel, eenmalig gegenereerd uit de sitemap van stw-planner.com.
2. Na de import zoekt de app op de achtergrond automatisch de wiki-icon per geïmporteerde schematic en vult die in.
3. Slot-label "Element slot" wordt "Perk 6" (elementen zijn gewone perks geworden).

## Deel 1: namen-tabel

- **Generator** `scripts/generate-schematic-names.mjs` (Node, eenmalig handmatig te draaien): haalt `https://stw-planner.com/sitemap.xml` op, matcht URLs `/schematics/<rarity>-<naam-slug>/<Sid>`, en schrijft `server/data/schematicNames.ts` met `export const SCHEMATIC_NAMES: Record<string, string>`:
  - key = Sid lowercased zonder trailing rarity-token (`assault_autodrum_ratrod`)
  - waarde = naam-slug zonder rarity-prefix, woorden gekapitaliseerd ("the-take-down" → "The Take Down")
  - duplicaten: eerste wint. Gegenereerd bestand wordt gecommit; runtime praat nooit met stw-planner (offline-proof).
- **Lookup** in `parseCampaignSchematics`: basiskey = slug-tokens minus rarity/ore/crystal/tier-tokens, gejoind met `_`; hit → echte naam, miss → bestaande prettify-fallback. Signatuur krijgt optionele `names`-parameter (default `SCHEMATIC_NAMES`) voor testbaarheid.

## Deel 2: auto-icons

- Nieuwe helper in `src/lib/wiki.ts`: `findIconUrl(name: string): Promise<string | null>` — `searchWikiIcons("<name> schematic")`, eerste resultaat met thumbnail → `toDataUrl`; geen resultaat of fout → `null` (nooit throwen).
- `AppStateContext` krijgt naast `update` een `mutate(fn: (s: AppState) => AppState)` (functionele update; voorkomt stale-state bij achtergrond-writes).
- `ImportModal` geeft de aangemaakte schematics via een `onImported(created)`-callback aan `SchematicsSection`; de sectie doet de state-update en start een sequentiële achtergrondloop: per schematic `findIconUrl(name)` → bij succes `mutate` die `iconUrl` op die schematic zet en de icon cachet in `state.icons` (key = naam lowercased). Component blijft gemount (sectie), dus geen verloren updates; falen is stil (icon blijft leeg, zoals nu).

## Deel 3: label

- `PerkSlotEditor` en `SchematicCard`-tooltip: index 5 heet voortaan gewoon "Perk 6" (ternary weg).

## Testen

- Naam-lookup: hit met rarity/ore/tier-varianten in het templateId, miss → prettify-fallback (fixture-map geïnjecteerd).
- `findIconUrl`: gemockte fetch — succes → data-URL/hotlink, geen thumbnail of netwerkfout → null.
- Generator-script wordt niet in CI getest (eenmalig, handmatig); de gegenereerde tabel wel meegecommit.

## Buiten scope

- Periodiek verversen van de namen-tabel (opnieuw draaien van het script is handmatig).
- Icons voor al eerder geïmporteerde schematics (die bewerk je via het formulier zoals nu).
