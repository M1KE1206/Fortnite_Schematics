import type { ResourceKey } from '../types';

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
