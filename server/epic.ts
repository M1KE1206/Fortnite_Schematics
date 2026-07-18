import type { ResourceKey } from '../src/types.js';

export interface DeviceAuth {
  accountId: string;
  deviceId: string;
  secret: string;
  accountName: string;
}

export class EpicApiError extends Error {
  status: number;
  epicCode?: string;

  constructor(
    message: string,
    status: number,
    epicCode?: string,
  ) {
    super(message);
    this.status = status;
    this.epicCode = epicCode;
  }
}

const TOKEN_URL = 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token';
const ACCOUNT_URL = 'https://account-public-service-prod.ol.epicgames.com/account/api/public/account';
const PROFILE_URL = 'https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile';
const ANDROID_CLIENT_BASIC = 'M2Y2OWU1NmM3NjQ5NDkyYzhjYzI5ZjFhZjA4YThhMTI6YjUxZWU5Y2IxMjIzNGY1MGE2OWVmYTY3ZWY1MzgxMmU=';

export const EPIC_LOGIN_URL =
  'https://www.epicgames.com/id/api/redirect?clientId=3f69e56c7649492c8cc29f1af08a8a12&responseType=code';

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
      Authorization: `basic ${ANDROID_CLIENT_BASIC}`,
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
  reagent_alteration_gameplay_generic: 'coreRePerk',
  reagent_evolverarity_r: 'rareFlux',
  reagent_evolverarity_vr: 'epicFlux',
  reagent_evolverarity_sr: 'legendaryFlux',
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
