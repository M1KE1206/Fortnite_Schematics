import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authPath, deleteAuth, readAuth, writeAuth } from './authStore.js';
import type { DeviceAuth } from './epic.js';

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
    deleteAuth(dir); // no throw
  });
});
