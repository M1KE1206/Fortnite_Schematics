import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DeviceAuth } from './epic.js';

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
