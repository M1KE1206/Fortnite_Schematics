# Epic STW Inventory Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eén klik in de tracker haalt de 12 STW-resources (evolutie- en perk-materialen) uit het Epic-account van de gebruiker en vult ze in bij de voorraad.

**Architecture:** Een Vite-plugin (`server/stw-sync-plugin.ts`) registreert vier lokale JSON-endpoints op de dev/preview-server; pure Epic-logica (OAuth device-auth flow + profiel-parsing) leeft in `server/epic.ts` en is unit-getest. De React-app praat via een dunne client-wrapper (`src/lib/epicSync.ts`) alleen met localhost; device-auth staat in gitignored `.stw-auth.json`.

**Tech Stack:** Bestaand project (Vite + React + TS + Vitest); Node 18+ global fetch; geen nieuwe runtime-dependencies (alleen `@types/node` als devDependency).

## Global Constraints

- Geen emojis in UI of code; iconen uitsluitend via lucide-react; geen CSS-gradients; UI-teksten in het Engels.
- `.stw-auth.json` staat in `.gitignore` en bevat `{ accountId, deviceId, secret, accountName }`.
- Sync overschrijft uitsluitend de 12 gemapte `ResourceKey`s in `state.inventory`; al het overige blijft onaangeraakt.
- Server-fouten antwoorden altijd JSON `{ error: string }` (+ optioneel `needsRelink: true`) met passende statuscode.
- Epic-endpoints en de publieke iOS-client-credentials exact zoals in de spec (`docs/superpowers/specs/2026-07-17-epic-inventory-sync-design.md`).

---

### Task 1: Epic-module met profiel-parsing (TDD)

**Files:**
- Create: `server/epic.ts`
- Test: `server/epic.test.ts`
- Modify: `tsconfig.node.json` (server-map meenemen in typecheck)

**Interfaces:**
- Consumes: `ResourceKey` uit `src/types.ts` (12 keys: pureDropsOfRain, lightningInABottle, eyeOfTheStorm, stormShard, rePerk, uncommonPerkUp, rarePerkUp, epicPerkUp, legendaryPerkUp, fireUp, frostUp, ampUp).
- Produces (voor Tasks 2-3):
  - `interface DeviceAuth { accountId: string; deviceId: string; secret: string; accountName: string }`
  - `class EpicApiError extends Error { status: number; epicCode?: string }`
  - `EPIC_LOGIN_URL: string`
  - `exchangeAuthorizationCode(code: string): Promise<{ accessToken: string; accountId: string; displayName: string }>`
  - `createDeviceAuth(accessToken: string, accountId: string): Promise<{ deviceId: string; secret: string }>`
  - `accessTokenFromDeviceAuth(auth: DeviceAuth): Promise<string>`
  - `queryCampaignProfile(accessToken: string, accountId: string): Promise<unknown>`
  - `parseCampaignResources(profile: unknown, log?: (msg: string) => void): Record<ResourceKey, number>`
  - `TEMPLATE_MAP: Record<string, ResourceKey>`

- [ ] **Step 1: Installeer @types/node en neem `server/` mee in de typecheck**

Run: `npm install -D @types/node`

Pas in `tsconfig.node.json` de include aan (laat de rest staan):
```json
"include": ["vite.config.ts", "server"]
```

- [ ] **Step 2: Schrijf failing tests**

`server/epic.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { parseCampaignResources, TEMPLATE_MAP } from './epic';

function profileWith(items: Record<string, { templateId?: string; quantity?: number }>) {
  return { profileChanges: [{ profile: { items } }] };
}

describe('parseCampaignResources', () => {
  it('maps all known reagents to resource keys', () => {
    const result = parseCampaignResources(
      profileWith({
        a: { templateId: 'AccountResource:reagent_c_t01', quantity: 1234 },
        b: { templateId: 'AccountResource:reagent_alteration_generic', quantity: 5000 },
        c: { templateId: 'AccountResource:reagent_alteration_upgrade_sr', quantity: 777 },
        d: { templateId: 'AccountResource:reagent_alteration_ele_water', quantity: 42 },
      }),
    );
    expect(result.pureDropsOfRain).toBe(1234);
    expect(result.rePerk).toBe(5000);
    expect(result.legendaryPerkUp).toBe(777);
    expect(result.frostUp).toBe(42);
  });

  it('is case-insensitive on templateId', () => {
    const result = parseCampaignResources(
      profileWith({ a: { templateId: 'accountresource:Reagent_C_T04', quantity: 9 } }),
    );
    expect(result.stormShard).toBe(9);
  });

  it('returns 0 for resources missing from the profile', () => {
    const result = parseCampaignResources(profileWith({}));
    for (const key of Object.values(TEMPLATE_MAP)) expect(result[key]).toBe(0);
  });

  it('ignores non-reagent items and logs unknown reagents', () => {
    const log = vi.fn();
    const result = parseCampaignResources(
      profileWith({
        a: { templateId: 'Schematic:sid_pistol_nocturno', quantity: 1 },
        b: { templateId: 'AccountResource:reagent_future_thing', quantity: 5 },
        c: { templateId: 'AccountResource:eventcurrency_scaling', quantity: 100 },
      }),
      log,
    );
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('reagent_future_thing'));
  });

  it('survives malformed input', () => {
    expect(parseCampaignResources(null).rePerk).toBe(0);
    expect(parseCampaignResources({ profileChanges: [] }).rePerk).toBe(0);
    expect(parseCampaignResources('garbage').rePerk).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL, module `./epic` bestaat niet. Bestaande 38 tests blijven groen.

- [ ] **Step 4: Implementeer `server/epic.ts`**

```ts
import type { ResourceKey } from '../src/types';

export interface DeviceAuth {
  accountId: string;
  deviceId: string;
  secret: string;
  accountName: string;
}

export class EpicApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public epicCode?: string,
  ) {
    super(message);
  }
}

const TOKEN_URL = 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token';
const ACCOUNT_URL = 'https://account-public-service-prod.ol.epicgames.com/account/api/public/account';
const PROFILE_URL = 'https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile';
const IOS_CLIENT_BASIC = 'MzQ0NmNkNzI2OTRjNGE0NDg1ZDgxYjc3YWRiYjIxNDE6OTIwOWQ0YTVlMjVhNDU3ZmI5YjA3NDg5ZDMxM2I0MWE=';

export const EPIC_LOGIN_URL =
  'https://www.epicgames.com/id/api/redirect?clientId=3446cd72694c4a4485d81b77adbb2141&responseType=code';

async function epicFetch(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new EpicApiError('Epic services unreachable', 0);
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof body.errorMessage === 'string' ? body.errorMessage : `Epic request failed (${res.status})`;
    const code = typeof body.errorCode === 'string' ? body.errorCode : undefined;
    throw new EpicApiError(message, res.status, code);
  }
  return body;
}

async function tokenRequest(params: Record<string, string>): Promise<Record<string, unknown>> {
  return epicFetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `basic ${IOS_CLIENT_BASIC}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
}

export async function exchangeAuthorizationCode(
  code: string,
): Promise<{ accessToken: string; accountId: string; displayName: string }> {
  const json = await tokenRequest({ grant_type: 'authorization_code', code });
  return {
    accessToken: String(json.access_token),
    accountId: String(json.account_id),
    displayName: typeof json.displayName === 'string' ? json.displayName : 'Epic account',
  };
}

export async function createDeviceAuth(
  accessToken: string,
  accountId: string,
): Promise<{ deviceId: string; secret: string }> {
  const json = await epicFetch(`${ACCOUNT_URL}/${accountId}/deviceAuth`, {
    method: 'POST',
    headers: { Authorization: `bearer ${accessToken}` },
  });
  return { deviceId: String(json.deviceId), secret: String(json.secret) };
}

export async function accessTokenFromDeviceAuth(auth: DeviceAuth): Promise<string> {
  const json = await tokenRequest({
    grant_type: 'device_auth',
    account_id: auth.accountId,
    device_id: auth.deviceId,
    secret: auth.secret,
  });
  return String(json.access_token);
}

export async function queryCampaignProfile(accessToken: string, accountId: string): Promise<unknown> {
  return epicFetch(`${PROFILE_URL}/${accountId}/client/QueryProfile?profileId=campaign&rvn=-1`, {
    method: 'POST',
    headers: { Authorization: `bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
}

export const TEMPLATE_MAP: Record<string, ResourceKey> = {
  reagent_c_t01: 'pureDropsOfRain',
  reagent_c_t02: 'lightningInABottle',
  reagent_c_t03: 'eyeOfTheStorm',
  reagent_c_t04: 'stormShard',
  reagent_alteration_generic: 'rePerk',
  reagent_alteration_upgrade_uc: 'uncommonPerkUp',
  reagent_alteration_upgrade_r: 'rarePerkUp',
  reagent_alteration_upgrade_vr: 'epicPerkUp',
  reagent_alteration_upgrade_sr: 'legendaryPerkUp',
  reagent_alteration_ele_fire: 'fireUp',
  reagent_alteration_ele_water: 'frostUp',
  reagent_alteration_ele_nature: 'ampUp',
};

interface ProfileItem {
  templateId?: string;
  quantity?: number;
}

export function parseCampaignResources(
  profile: unknown,
  log: (msg: string) => void = () => {},
): Record<ResourceKey, number> {
  const out = Object.fromEntries(Object.values(TEMPLATE_MAP).map((k) => [k, 0])) as Record<ResourceKey, number>;
  const items = (
    profile as { profileChanges?: { profile?: { items?: Record<string, ProfileItem> } }[] } | null
  )?.profileChanges?.[0]?.profile?.items;
  if (!items || typeof items !== 'object') return out;
  for (const item of Object.values(items)) {
    const tpl = item?.templateId?.toLowerCase();
    if (!tpl || !tpl.startsWith('accountresource:')) continue;
    const key = TEMPLATE_MAP[tpl.slice('accountresource:'.length)];
    if (key) out[key] += item.quantity ?? 0;
    else if (tpl.includes('reagent')) log(`Unknown reagent templateId: ${item.templateId}`);
  }
  return out;
}
```

- [ ] **Step 5: Run tests, verwacht groen**

Run: `npm test` — Expected: 43 tests PASS (38 bestaand + 5 nieuw).
Run: `npx tsc --noEmit` (of `npx tsc -b`) — Expected: geen fouten.

- [ ] **Step 6: Commit**

```powershell
git add server tsconfig.node.json package.json package-lock.json; git commit -m "feat: Epic API module with campaign profile parsing"
```

---

### Task 2: Auth-opslag (TDD)

**Files:**
- Create: `server/authStore.ts`
- Test: `server/authStore.test.ts`
- Modify: `.gitignore` (regel `.stw-auth.json` toevoegen)

**Interfaces:**
- Consumes: `DeviceAuth` uit `server/epic.ts` (Task 1).
- Produces (voor Task 3):
  - `readAuth(root: string): DeviceAuth | null`
  - `writeAuth(root: string, auth: DeviceAuth): void`
  - `deleteAuth(root: string): void`
  - `authPath(root: string): string` — `<root>/.stw-auth.json`

- [ ] **Step 1: Schrijf failing tests**

`server/authStore.test.ts`:
```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authPath, deleteAuth, readAuth, writeAuth } from './authStore';
import type { DeviceAuth } from './epic';

const AUTH: DeviceAuth = { accountId: 'acc1', deviceId: 'dev1', secret: 's3cret', accountName: 'TestUser' };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stw-auth-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('authStore', () => {
  it('returns null when no file exists', () => {
    expect(readAuth(dir)).toBeNull();
  });

  it('round-trips write/read', () => {
    writeAuth(dir, AUTH);
    expect(readAuth(dir)).toEqual(AUTH);
  });

  it('returns null on corrupt or incomplete file', () => {
    writeFileSync(authPath(dir), '{not json');
    expect(readAuth(dir)).toBeNull();
    writeFileSync(authPath(dir), JSON.stringify({ accountId: 'x' }));
    expect(readAuth(dir)).toBeNull();
  });

  it('deleteAuth removes the file and is idempotent', () => {
    writeAuth(dir, AUTH);
    deleteAuth(dir);
    expect(readAuth(dir)).toBeNull();
    deleteAuth(dir); // geen throw
  });
});
```

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npm test` — Expected: FAIL, module `./authStore` bestaat niet.

- [ ] **Step 3: Implementeer `server/authStore.ts`**

```ts
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DeviceAuth } from './epic';

const FILE_NAME = '.stw-auth.json';

export function authPath(root: string): string {
  return join(root, FILE_NAME);
}

export function readAuth(root: string): DeviceAuth | null {
  try {
    const parsed = JSON.parse(readFileSync(authPath(root), 'utf8')) as Record<string, unknown>;
    if (
      typeof parsed.accountId === 'string' &&
      typeof parsed.deviceId === 'string' &&
      typeof parsed.secret === 'string'
    ) {
      return {
        accountId: parsed.accountId,
        deviceId: parsed.deviceId,
        secret: parsed.secret,
        accountName: typeof parsed.accountName === 'string' ? parsed.accountName : 'Epic account',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeAuth(root: string, auth: DeviceAuth): void {
  writeFileSync(authPath(root), JSON.stringify(auth, null, 2));
}

export function deleteAuth(root: string): void {
  if (existsSync(authPath(root))) unlinkSync(authPath(root));
}
```

Voeg aan `.gitignore` toe (onder de bestaande regels):
```
.stw-auth.json
```

- [ ] **Step 4: Run tests, verwacht groen**

Run: `npm test` — Expected: 47 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/authStore.ts server/authStore.test.ts .gitignore; git commit -m "feat: device auth file store"
```

---

### Task 3: Vite-plugin met sync-endpoints

**Files:**
- Create: `server/stw-sync-plugin.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: alles uit Task 1 (`exchangeAuthorizationCode`, `createDeviceAuth`, `accessTokenFromDeviceAuth`, `queryCampaignProfile`, `parseCampaignResources`, `EpicApiError`) en Task 2 (`readAuth`, `writeAuth`, `deleteAuth`).
- Produces (voor Task 4): HTTP-endpoints op de dev/preview-server:
  - `GET /api/stw-sync/status` → `{ linked: boolean, accountName?: string }`
  - `POST /api/stw-sync/link` body `{ authorizationCode: string }` → `{ accountName: string }`
  - `POST /api/stw-sync/sync` → `{ resources: Record<ResourceKey, number>, accountName: string, fetchedAt: string }`
  - `POST /api/stw-sync/unlink` → `{ ok: true }`
  - Fouten: `{ error: string, needsRelink?: true }` met status 400/401/404/500/502.

- [ ] **Step 1: Implementeer `server/stw-sync-plugin.ts`**

```ts
import type { ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import {
  accessTokenFromDeviceAuth,
  createDeviceAuth,
  EpicApiError,
  exchangeAuthorizationCode,
  parseCampaignResources,
  queryCampaignProfile,
} from './epic';
import { deleteAuth, readAuth, writeAuth } from './authStore';

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function readBody(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}') as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });
  });
}

export function stwSyncPlugin(): Plugin {
  let root = process.cwd();

  async function handle(req: Connect.IncomingMessage, res: ServerResponse): Promise<void> {
    const route = `${req.method} ${req.url?.split('?')[0]}`;
    try {
      if (route === 'GET /status') {
        const auth = readAuth(root);
        sendJson(res, 200, auth ? { linked: true, accountName: auth.accountName } : { linked: false });
      } else if (route === 'POST /link') {
        const body = await readBody(req);
        const code = typeof body.authorizationCode === 'string' ? body.authorizationCode.trim() : '';
        if (!code) {
          sendJson(res, 400, { error: 'Missing authorization code' });
          return;
        }
        const { accessToken, accountId, displayName } = await exchangeAuthorizationCode(code);
        const { deviceId, secret } = await createDeviceAuth(accessToken, accountId);
        writeAuth(root, { accountId, deviceId, secret, accountName: displayName });
        sendJson(res, 200, { accountName: displayName });
      } else if (route === 'POST /sync') {
        const auth = readAuth(root);
        if (!auth) {
          sendJson(res, 401, { error: 'No Epic account linked', needsRelink: true });
          return;
        }
        let token: string;
        try {
          token = await accessTokenFromDeviceAuth(auth);
        } catch (e) {
          if (e instanceof EpicApiError && (e.status === 400 || e.status === 401)) {
            deleteAuth(root);
            sendJson(res, 401, { error: 'Epic link expired - link your account again', needsRelink: true });
            return;
          }
          throw e;
        }
        const profile = await queryCampaignProfile(token, auth.accountId);
        const resources = parseCampaignResources(profile, (msg) => console.warn(`[stw-sync] ${msg}`));
        sendJson(res, 200, { resources, accountName: auth.accountName, fetchedAt: new Date().toISOString() });
      } else if (route === 'POST /unlink') {
        deleteAuth(root);
        sendJson(res, 200, { ok: true });
      } else {
        sendJson(res, 404, { error: 'Not found' });
      }
    } catch (e) {
      if (e instanceof EpicApiError) {
        sendJson(res, e.status >= 400 && e.status < 600 ? e.status : 502, { error: e.message });
      } else {
        console.error('[stw-sync] Internal error:', e);
        sendJson(res, 500, { error: 'Internal sync error' });
      }
    }
  }

  const register = (middlewares: Connect.Server): void => {
    middlewares.use('/api/stw-sync', (req, res) => {
      void handle(req, res as ServerResponse);
    });
  };

  return {
    name: 'stw-sync',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      register(server.middlewares);
    },
    configurePreviewServer(server) {
      register(server.middlewares);
    },
  };
}
```

Let op: `middlewares.use('/api/stw-sync', ...)` stript de prefix — in de handler is `req.url` dus `/status`, `/link`, enz.

- [ ] **Step 2: Registreer de plugin in `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { stwSyncPlugin } from './server/stw-sync-plugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), stwSyncPlugin()],
});
```

- [ ] **Step 3: Verifieer**

Run: `npx tsc -b` — Expected: geen fouten. Run: `npm test` — Expected: 47 PASS. Run: `npm run build` — Expected: slaagt.
Start `npm run dev` op de achtergrond en run:
`Invoke-WebRequest -UseBasicParsing http://localhost:5173/api/stw-sync/status | Select-Object -ExpandProperty Content`
Expected: `{"linked":false}`. Test ook een onbekende route: `/api/stw-sync/nope` (POST) → 404 JSON. Stop de dev-server.

- [ ] **Step 4: Commit**

```powershell
git add server/stw-sync-plugin.ts vite.config.ts; git commit -m "feat: local sync endpoints via Vite plugin"
```

---

### Task 4: Client-helper en Epic-sync UI

**Files:**
- Create: `src/lib/epicSync.ts`, `src/components/EpicSyncSection.tsx`
- Modify: `src/components/InventorySection.tsx` (sectie bovenaan mounten)

**Interfaces:**
- Consumes: endpoints uit Task 3; `useAppState()`; `ResourceKey` uit `src/types.ts`.
- Produces:
  - `src/lib/epicSync.ts`: `EpicSyncError` (met `needsRelink: boolean`), `SyncStatus`, `SyncResult`, `EPIC_LOGIN_URL`, `getSyncStatus()`, `linkAccount(code)`, `syncInventory()`, `unlinkAccount()`
  - `<EpicSyncSection />` — zelfstandige sectie, gemount in InventorySection.

- [ ] **Step 1: Schrijf `src/lib/epicSync.ts`**

```ts
import type { ResourceKey } from '../types';

export class EpicSyncError extends Error {
  constructor(
    message: string,
    public needsRelink = false,
  ) {
    super(message);
  }
}

export interface SyncStatus {
  linked: boolean;
  accountName?: string;
}

export interface SyncResult {
  resources: Record<ResourceKey, number>;
  accountName: string;
  fetchedAt: string;
}

export const EPIC_LOGIN_URL =
  'https://www.epicgames.com/id/api/redirect?clientId=3446cd72694c4a4485d81b77adbb2141&responseType=code';

const DEV_SERVER_HINT = 'Sync requires the dev server (npm run dev).';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/stw-sync/${path}`, init);
  } catch {
    throw new EpicSyncError(DEV_SERVER_HINT);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new EpicSyncError(DEV_SERVER_HINT);
  }
  if (!res.ok) {
    const b = body as { error?: string; needsRelink?: boolean };
    throw new EpicSyncError(b.error ?? 'Sync failed', b.needsRelink === true);
  }
  return body as T;
}

export const getSyncStatus = (): Promise<SyncStatus> => call('status');

export const linkAccount = (authorizationCode: string): Promise<{ accountName: string }> =>
  call('link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorizationCode }),
  });

export const syncInventory = (): Promise<SyncResult> => call('sync', { method: 'POST' });

export const unlinkAccount = (): Promise<{ ok: boolean }> => call('unlink', { method: 'POST' });
```

- [ ] **Step 2: Schrijf `src/components/EpicSyncSection.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { ExternalLink, Link2, Loader2, RefreshCw, Unlink } from 'lucide-react';
import {
  EPIC_LOGIN_URL,
  EpicSyncError,
  getSyncStatus,
  linkAccount,
  syncInventory,
  unlinkAccount,
} from '../lib/epicSync';
import { useAppState } from '../state/AppStateContext';

export default function EpicSyncSection() {
  const { state, update } = useAppState();
  const [linked, setLinked] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    getSyncStatus()
      .then((s) => {
        setLinked(s.linked);
        setAccountName(s.accountName ?? '');
      })
      .catch(() => setUnavailable(true));
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      if (e instanceof EpicSyncError) {
        setError(e.message);
        if (e.needsRelink) {
          setLinked(false);
          setAccountName('');
        }
      } else {
        setError('Unexpected error');
      }
    } finally {
      setBusy(false);
    }
  }

  const doLink = () =>
    run(async () => {
      const r = await linkAccount(code);
      setLinked(true);
      setAccountName(r.accountName);
      setCode('');
    });

  const doSync = () =>
    run(async () => {
      const r = await syncInventory();
      update({ inventory: { ...state.inventory, ...r.resources } });
      setLastSynced(new Date(r.fetchedAt).toLocaleTimeString());
    });

  const doUnlink = () =>
    run(async () => {
      await unlinkAccount();
      setLinked(false);
      setAccountName('');
      setLastSynced('');
    });

  return (
    <section className="rounded border border-zinc-800 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Epic account sync</h2>
      {unavailable ? (
        <p className="text-sm text-zinc-500">Sync requires the dev server (npm run dev).</p>
      ) : linked ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-zinc-200">
            <Link2 size={14} className="text-green-400" /> {accountName}
          </span>
          <button
            onClick={doSync}
            disabled={busy}
            className="flex items-center gap-2 rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync from Epic
          </button>
          {lastSynced && <span className="text-xs text-zinc-500">Last synced: {lastSynced}</span>}
          <button
            onClick={doUnlink}
            disabled={busy}
            className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400"
          >
            <Unlink size={12} /> Unlink
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            Link your Epic account to pull your evolution and perk materials automatically.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={EPIC_LOGIN_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded border border-zinc-700 px-3 py-1.5 text-sm hover:border-zinc-500"
            >
              <ExternalLink size={14} /> Open Epic login
            </a>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste authorization code"
              className="w-64 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm"
            />
            <button
              onClick={doLink}
              disabled={busy || !code.trim()}
              className="flex items-center gap-2 rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Link account
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Mount in `src/components/InventorySection.tsx`**

Voeg de import toe en wikkel de bestaande grid in een fragment met de sectie erboven. De bestaande return:
```tsx
return (
    <div className="grid gap-8 lg:grid-cols-2">
```
wordt:
```tsx
return (
    <div className="space-y-8">
      <EpicSyncSection />
      <div className="grid gap-8 lg:grid-cols-2">
```
Sluit onderaan de extra `</div>` correct af en voeg bovenaan toe: `import EpicSyncSection from './EpicSyncSection';`

- [ ] **Step 4: Verifieer**

Run: `npx tsc -b` — geen fouten. `npm test` — 47 PASS. `npm run build` — slaagt.
Start `npm run dev` op de achtergrond, fetch `http://localhost:5173/` (HTML shell OK) en `http://localhost:5173/api/stw-sync/status` (`{"linked":false}`), stop de server. De visuele flow (login-knop, code plakken, sync) test de gebruiker live.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/epicSync.ts src/components/EpicSyncSection.tsx src/components/InventorySection.tsx; git commit -m "feat: Epic account sync UI in inventory tab"
```

---

### Task 5: README-update en eindverificatie

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: alles.
- Produces: gedocumenteerde feature.

- [ ] **Step 1: Voeg een sectie toe aan `README.md`** (na de Features-lijst, vóór "## Development")

```markdown
## Epic account sync (optional)

Link your Epic account once (Inventory & Settings tab) and pull your STW
evolution and perk materials with one click. Runs entirely on your machine:
the dev server talks to Epic's (unofficial) services and stores a revocable
device auth in `.stw-auth.json` (gitignored, never leaves your PC). Note:
these are the same unofficial endpoints community tools use - they may break
if Epic changes them.
```

Voeg ook aan de Features-lijst toe:
```markdown
- Optional one-click inventory sync from your Epic account (local only)
```

- [ ] **Step 2: Eindverificatie**

Run: `npm test` — 47 PASS. Run: `npm run build` — slaagt.

- [ ] **Step 3: Commit**

```powershell
git add README.md; git commit -m "docs: document Epic account sync"
```

---

## Live test (controller + gebruiker, na alle taken)

Geen subagent-taak. Samen met de gebruiker: `npm run dev` → Inventory-tab → "Open Epic login" → code plakken → "Link account" → "Sync from Epic" → aantallen vergelijken met in-game. Bij onbekende reagent-logs in de dev-server-console: TEMPLATE_MAP aanvullen.
