# Epic STW-inventaris-sync — Design

Datum: 2026-07-17
Status: goedgekeurd door gebruiker

## Doel

Eén klik in de tracker haalt de actuele aantallen evolutie- en perk-materialen uit het Fortnite STW-account van de gebruiker en vult ze in bij de voorraad — geen handmatig overtypen meer. Alles draait lokaal op de pc van de gebruiker; er is geen externe database of gehoste backend.

## Aanpak

De Vite dev-server krijgt via een custom plugin een lokaal API-laagje dat met Epic's (niet-officiële) accountservices praat. De browser-app praat alleen met `localhost`; Epic-tokens verlaten de machine nooit richting derden.

Bewuste acceptatie door de gebruiker: dit gebruikt dezelfde niet-officiële endpoints als gangbare community-tools. Ze kunnen ooit breken en zijn technisch tegen de letter van Epic's voorwaarden. De device-auth-sleutel staat leesbaar op de eigen pc en is intrekbaar via de Epic-accountinstellingen.

## Componenten

### 1. Server: `server/stw-sync-plugin.ts` + `server/epic.ts`

`stwSyncPlugin()` wordt in `vite.config.ts` toegevoegd en registreert via `configureServer` (en `configurePreviewServer`) vier JSON-endpoints op de dev-server:

| Endpoint | Doet |
|---|---|
| `GET /api/stw-sync/status` | `{ linked: boolean, accountName?: string }` — leest `.stw-auth.json` |
| `POST /api/stw-sync/link` | body `{ authorizationCode }` → wisselt code om bij Epic, maakt device auth aan, schrijft `.stw-auth.json`, antwoordt `{ accountName }` |
| `POST /api/stw-sync/sync` | device auth → access token → QueryProfile `campaign` → parse → `{ resources: Partial<Record<ResourceKey, number>>, accountName, fetchedAt }` |
| `POST /api/stw-sync/unlink` | verwijdert `.stw-auth.json` → `{ ok: true }` |

`server/epic.ts` bevat de pure Epic-logica (fetch-calls + parsing), los van de plugin-wiring, zodat de parsing unit-testbaar is.

Epic-endpoints (bekend uit community-tools zoals DeviceAuthGenerator; bij implementatie geverifieerd tegen een echte respons):

- Authorization code (gebruiker opent in browser, ingelogd op Epic):
  `https://www.epicgames.com/id/api/redirect?clientId=3446cd72694c4a4485d81b77adbb2141&responseType=code`
- Token: `POST https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token`
  met Basic-auth van de publiek bekende iOS-client (`3446cd72694c4a4485d81b77adbb2141:9209d4a5e25a457fb9b07489d313b41a`);
  grants: `authorization_code` (bij koppelen) en `device_auth` (bij elke sync).
- Device auth aanmaken: `POST .../account/api/public/account/{accountId}/deviceAuth` (Bearer).
- Profiel: `POST https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/{accountId}/client/QueryProfile?profileId=campaign&rvn=-1` (Bearer, body `{}`).

### 2. Opslag: `.stw-auth.json` (projectroot)

`{ accountId, deviceId, secret, accountName }`. Wordt aan `.gitignore` toegevoegd. Bestaat het bestand niet → status `linked: false`.

### 3. Resource-mapping (in `server/epic.ts`)

Campaign-profiel items met templateId `AccountResource:*` → onze `ResourceKey`s:

| templateId | ResourceKey |
|---|---|
| `reagent_c_t01` | pureDropsOfRain |
| `reagent_c_t02` | lightningInABottle |
| `reagent_c_t03` | eyeOfTheStorm |
| `reagent_c_t04` | stormShard |
| `reagent_alteration_generic` | rePerk |
| `reagent_alteration_upgrade_uc` | uncommonPerkUp |
| `reagent_alteration_upgrade_r` | rarePerkUp |
| `reagent_alteration_upgrade_vr` | epicPerkUp |
| `reagent_alteration_upgrade_sr` | legendaryPerkUp |
| `reagent_alteration_ele_fire` | fireUp |
| `reagent_alteration_ele_water` | frostUp |
| `reagent_alteration_ele_nature` | ampUp |

Matching is case-insensitief op het deel na `AccountResource:`. Onbekende reagent-templateIds worden genegeerd en server-side gelogd. Ontbreekt een resource in het profiel → 0. De mapping wordt bij de eerste echte sync geverifieerd tegen de live respons van de gebruiker.

### 4. UI: sectie "Epic account sync" in `InventorySection`

- **Niet gekoppeld:** uitleg (1 regel) + knop "Open Epic login" (opent de authorization-code-URL in een nieuw tabblad) + invoerveld "Paste authorization code" + knop "Link account". Na succes: naam getoond.
- **Gekoppeld:** accountnaam + "Sync from Epic"-knop + "Last synced: <tijd>" + "Unlink"-link.
- Sync-resultaat overschrijft uitsluitend de 12 gemapte resource-keys in `state.inventory`; overige voorraadvelden en alle andere app-data blijven onaangeraakt.
- Status wordt bij het openen van de tab opgehaald via `/api/stw-sync/status`.

### 5. Client-helper: `src/lib/epicSync.ts`

Dunne fetch-wrapper rond de vier endpoints met nette fouten (`EpicSyncError` met leesbare boodschap), zodat de component geen fetch-details bevat.

## Foutafhandeling

- Endpoints niet bereikbaar (bijv. site geopend als statische build zonder dev-server) → sectie toont "Sync requires the dev server (npm run dev)" in plaats van knoppen.
- Ongeldige/verlopen authorization code → melding "Code invalid or expired - open the Epic login again and paste a fresh code."
- Device auth ingetrokken/verlopen → melding + terug naar niet-gekoppelde staat (auth-bestand wordt verwijderd).
- Epic onbereikbaar of onverwachte respons → niet-blokkerende foutmelding; handmatige invoer blijft altijd werken.
- Server antwoordt altijd JSON met `{ error: string }` en een passende statuscode bij fouten.

## Testen

- Vitest unit-tests voor de parsing/mapping in `server/epic.ts` met een fixture van een (geanonimiseerde) QueryProfile-respons: juiste aantallen, onbekende IDs genegeerd, ontbrekende resources → 0, case-insensitiviteit.
- Auth-flows (code omwisselen, device auth, live sync) worden handmatig samen met de gebruiker geverifieerd — die vereisen een echte Epic-login.

## Buiten scope

- Automatisch periodiek syncen (alleen op knopdruk).
- Syncen van andere profieldata (schematics, helden, XP): alleen de 12 resources.
- Ondersteuning buiten de dev/preview-server (geen gehoste variant).
