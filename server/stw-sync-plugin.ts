import type { ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import type { DeviceAuth } from './epic.js';
import {
  accessTokenFromDeviceAuth,
  createDeviceAuth,
  EpicApiError,
  exchangeAuthorizationCode,
  parseCampaignResources,
  queryCampaignProfile,
} from './epic.js';
import { parseCampaignSchematics } from './schematics.js';
import { deleteAuth, readAuth, writeAuth } from './authStore.js';

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
    req.on('error', () => resolve({}));
  });
}

export function stwSyncPlugin(): Plugin {
  let root = process.cwd();

  async function requireToken(res: ServerResponse): Promise<{ token: string; auth: DeviceAuth } | null> {
    const auth = readAuth(root);
    if (!auth) {
      sendJson(res, 401, { error: 'No Epic account linked', needsRelink: true });
      return null;
    }
    try {
      return { token: await accessTokenFromDeviceAuth(auth), auth };
    } catch (e) {
      if (e instanceof EpicApiError && (e.status === 400 || e.status === 401)) {
        deleteAuth(root);
        sendJson(res, 401, { error: 'Epic link expired - link your account again', needsRelink: true });
        return null;
      }
      throw e;
    }
  }

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
        const session = await requireToken(res);
        if (!session) return;
        const profile = await queryCampaignProfile(session.token, session.auth.accountId);
        const resources = parseCampaignResources(profile, (msg) => console.warn(`[stw-sync] ${msg}`));
        sendJson(res, 200, { resources, accountName: session.auth.accountName, fetchedAt: new Date().toISOString() });
      } else if (route === 'POST /schematics') {
        const session = await requireToken(res);
        if (!session) return;
        const profile = await queryCampaignProfile(session.token, session.auth.accountId);
        const schematics = parseCampaignSchematics(profile, (msg) => console.warn(`[stw-sync] ${msg}`));
        sendJson(res, 200, { schematics, accountName: session.auth.accountName });
      } else if (route === 'POST /unlink') {
        deleteAuth(root);
        sendJson(res, 200, { ok: true });
      } else {
        sendJson(res, 404, { error: 'Not found' });
      }
    } catch (e) {
      if (e instanceof EpicApiError) {
        const status = e.status === 400 || e.status === 401 || e.status === 404 ? e.status : 502;
        sendJson(res, status, { error: e.message });
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
