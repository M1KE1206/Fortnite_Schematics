import type { ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import {
  accessTokenFromDeviceAuth,
  createDeviceAuth,
  EpicApiError,
  exchangeAuthorizationCode,
  parseCampaignResources,
  queryCampaignProfile,
} from './epic.js';
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
