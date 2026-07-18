import type { Rarity, ResourceKey } from '../types';

export class EpicSyncError extends Error {
  needsRelink: boolean;

  constructor(message: string, needsRelink = false) {
    super(message);
    this.needsRelink = needsRelink;
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
  'https://www.epicgames.com/id/api/redirect?clientId=3f69e56c7649492c8cc29f1af08a8a12&responseType=code';

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
