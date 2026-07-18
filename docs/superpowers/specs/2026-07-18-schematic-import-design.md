# Schematic-import uit Epic — Design

Datum: 2026-07-18
Status: goedgekeurd door gebruiker

## Doel

Eén klik haalt alle wapen- en trap-schematics uit het Epic campaign-profiel van de gebruiker; via een keuzelijst importeert de gebruiker er een selectie van in de tracker, met naam, level, rarity en de huidige perks (incl. per-perk rarity) al ingevuld. Alleen de gewenste target-perks/rarities hoeft de gebruiker daarna zelf te kiezen.

## Server

### Endpoint

`POST /api/stw-sync/schematics` (zelfde Vite-plugin, zelfde auth-flow als `/sync`):
device auth → access token → `QueryProfile campaign` → parse → respons:

```ts
interface ImportedPerk { perkId: string | null; rarity: Rarity }        // perkId uit onze catalogus
interface ImportedSchematic {
  templateId: string;      // uniek, bv. "Schematic:sid_pistol_autoheavy_vr_ore_t04"
  name: string;            // geprettificeerd: "Pistol Autoheavy"
  rarity: Rarity;          // van de schematic zelf (alleen voor weergave in de picker)
  level: number;           // geclamd 10-50
  perks: ImportedPerk[];   // volgorde = alteration-volgorde, max 6
  unknownAlterations: string[]; // niet-gemapte AIDs (ook server-side gelogd)
}
// respons: { schematics: ImportedSchematic[], accountName: string }
```

Foutafhandeling identiek aan `/sync` (JSON `{error, needsRelink?}`, statusclamp 400/401/404/500/502; verlopen device auth → unlink + needsRelink).

### Parsing (`server/schematics.ts`, pure functies, unit-getest)

- Filter profiel-items op `templateId` beginnend met `schematic:sid_` (case-insensitief).
- **Rarity** van de schematic uit het templateId-token `_c_|_uc_|_r_|_vr_|_sr_` → white/green/blue/purple/gold.
- **Level** uit `attributes.level`, geclamd naar 10-50 (superchargers >50 → 50; <10 → 10).
- **Naam**: sluggedeelte na `sid_`, met bekende suffix-tokens verwijderd (rarity-token, `ore`, `crystal`, `t00`-`t05`) en woorden gekapitaliseerd: `sid_pistol_autoheavy_vr_ore_t04` → "Pistol Autoheavy".
- **Perks** uit `attributes.alterations` (array van alteration-templateIds):
  - Tier-suffix `_t01`..`_t05` → perk-rarity white..gold (geen suffix → white).
  - AID → catalogus-id via substring-patronen, specifiek vóór generiek (volgorde is significant), o.a.: `critchance`→critRating, `critdmg`→critDamage, `headshot`→headshotDamage, `firerate`/`attackrate`→fireRate, `attackspeed`→attackSpeed, `reload`→reloadSpeed, `clipsize`/`magazine`→magazineSize, `durability`→durability, `lifesteal`/`leech`→lifeLeech, `snared`/`slowed`→dmgSlowed, `mist`→dmgMist, `stun`/`stagger`/`knockdown`→dmgStunned, `affliction`→dmgAfflicted, `aiming`/`ads`→aimDamage, `stability`/`recoil`→stability, elementen `fire`/`water`/`nature`/`energy`/`physical`→elemFire/elemWater/elemNature/elemEnergy/elemPhysical (ná firerate-check), en als generieke vangnetten `dmg`/`damage`→damage.
  - Onbekende AID → `perkId: null`, opgenomen in `unknownAlterations` en server-side gelogd met prefix `[stw-sync]` (zelfde patroon als resources; wordt na de eerste echte import van de gebruiker aangevuld).
- De mapping is community-kennis en wordt live geverifieerd; de picker toont onbekende perks als "(unknown)".

## UI

- Schematics-tab: knop **"Import from Epic"** (lucide `Download`) naast "Add schematic"; disabled-melding als de sync-server onbereikbaar is (zelfde detectie als EpicSyncSection) of het account niet gekoppeld is (verwijst naar de Inventory-tab).
- Klik → modal `ImportModal`: laadt de lijst, toont per schematic een checkbox, naam, level-badge, rarity-kleur en compacte perks-preview; sorteren op level aflopend; "Select all" / "Clear"-knoppen; teller "N selected".
- **"Import selected"**: per gekozen item een `Schematic` via `makeDefaultSchematic()` +: `name`, `currentLevel` = level, per slot i `currentPerk` = perks[i].perkId, `currentRarity` = perks[i].rarity (ontbrekende slots blijven default), `targetRarity` blijft gold, `targetPerk` blijft null, geen icon (wiki-zoek/handmatig achteraf via bewerken). Toegevoegd aan `state.schematics`; modal sluit.
- Duplicaten worden niet tegengehouden (gebruiker kan verwijderen); wel toont de picker een "already added"-hint als er al een schematic met exact dezelfde naam bestaat.

## Testen

Vitest op `server/schematics.ts` met een fixture-profiel: templateId-filter, rarity-token-parsing, level-clamp (5→10, 145→50), naam-prettify, alteration-mapping (incl. tier→rarity, firerate vs fire-element volgorde, onbekende AID → null + unknownAlterations). UI en live endpoint handmatig met de gebruiker.

## Buiten scope

- Icons automatisch bepalen (wiki-zoek blijft de bestaande route via bewerken).
- Automatisch synchroon houden na import (eenmalige import; opnieuw importeren mag).
- Survivors/heroes/defenders.
