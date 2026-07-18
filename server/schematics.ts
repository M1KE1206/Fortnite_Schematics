import type { Rarity } from '../src/types.js';

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

const TIER_RARITY: Record<string, Rarity> = {
  '1': 'white',
  '2': 'green',
  '3': 'blue',
  '4': 'purple',
  '5': 'gold',
};

const RARITY_TOKEN: Record<string, Rarity> = {
  c: 'white',
  uc: 'green',
  r: 'blue',
  vr: 'purple',
  sr: 'gold',
};

const AID_PATTERNS: [string, string][] = [
  ['critchance', 'critRating'],
  ['critdmg', 'critDamage'],
  ['headshot', 'headshotDamage'],
  ['firerate', 'fireRate'],
  ['attackrate', 'fireRate'],
  ['attackspeed', 'attackSpeed'],
  ['reload', 'reloadSpeed'],
  ['clipsize', 'magazineSize'],
  ['magazine', 'magazineSize'],
  ['durability', 'durability'],
  ['lifesteal', 'lifeLeech'],
  ['leech', 'lifeLeech'],
  ['snared', 'dmgSlowed'],
  ['slowed', 'dmgSlowed'],
  ['mist', 'dmgMist'],
  ['stun', 'dmgStunned'],
  ['stagger', 'dmgStunned'],
  ['knockdown', 'dmgStunned'],
  ['affliction', 'dmgAfflicted'],
  ['aiming', 'aimDamage'],
  ['ads', 'aimDamage'],
  ['stability', 'stability'],
  ['recoil', 'stability'],
  ['fire', 'elemFire'],
  ['water', 'elemWater'],
  ['nature', 'elemNature'],
  ['energy', 'elemEnergy'],
  ['physical', 'elemPhysical'],
  ['damage', 'damage'],
  ['dmg', 'damage'],
];

export function mapAlteration(aid: string): ImportedPerk {
  const lower = aid.toLowerCase().replace(/^alteration:/, '');
  const tierMatch = lower.match(/_t0([1-5])\b/);
  const rarity: Rarity = tierMatch ? TIER_RARITY[tierMatch[1]] : 'white';
  for (const [pattern, perkId] of AID_PATTERNS) {
    if (lower.includes(pattern)) return { perkId, rarity };
  }
  return { perkId: null, rarity };
}

const SUFFIX_TOKENS = new Set(['c', 'uc', 'r', 'vr', 'sr', 'ore', 'crystal', 't00', 't01', 't02', 't03', 't04', 't05']);

export function prettifyName(slug: string): string {
  return slug
    .split('_')
    .filter((token) => token && !SUFFIX_TOKENS.has(token))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface ProfileItem {
  templateId?: string;
  attributes?: { level?: number; alterations?: unknown };
}

export function parseCampaignSchematics(
  profile: unknown,
  log: (msg: string) => void = () => {},
): ImportedSchematic[] {
  const items = (
    profile as { profileChanges?: { profile?: { items?: Record<string, ProfileItem> } }[] } | null
  )?.profileChanges?.[0]?.profile?.items;
  if (!items || typeof items !== 'object') return [];
  const out: ImportedSchematic[] = [];
  for (const item of Object.values(items)) {
    const tpl = item?.templateId;
    if (!tpl || !tpl.toLowerCase().startsWith('schematic:sid_')) continue;
    const slug = tpl.slice(tpl.toLowerCase().indexOf('sid_') + 'sid_'.length).toLowerCase();
    const tokens = slug.split('_');
    const rarityToken = tokens.find((t) => t in RARITY_TOKEN);
    const rarity = rarityToken ? RARITY_TOKEN[rarityToken] : 'white';
    const rawLevel = typeof item.attributes?.level === 'number' ? item.attributes.level : 10;
    const level = Math.min(50, Math.max(10, rawLevel));
    const alterations = Array.isArray(item.attributes?.alterations) ? item.attributes.alterations : [];
    const perks: ImportedPerk[] = [];
    const unknownAlterations: string[] = [];
    for (const aid of alterations.slice(0, 6)) {
      if (typeof aid !== 'string' || aid === '') {
        perks.push({ perkId: null, rarity: 'white' });
        continue;
      }
      const mapped = mapAlteration(aid);
      perks.push(mapped);
      if (mapped.perkId === null) {
        unknownAlterations.push(aid);
        log(`Unknown alteration: ${aid}`);
      }
    }
    out.push({ templateId: tpl, name: prettifyName(slug), rarity, level, perks, unknownAlterations });
  }
  return out.sort((a, b) => b.level - a.level);
}
