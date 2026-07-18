import type { Rarity } from '../src/types.js';
import { SCHEMATIC_NAMES } from './data/schematicNames.js';
import { NAME_OVERRIDES } from './data/nameOverrides.js';

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
  ['criticalchance', 'critRating'],
  ['criticalrating', 'critRating'],
  ['critdmg', 'critDamage'],
  ['critdamage', 'critDamage'],
  ['criticaldamage', 'critDamage'],
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
  ['knockback', 'knockback'],
  ['knockdown', 'dmgStunned'],
  ['affliction', 'dmgAfflicted'],
  ['aiming', 'aimDamage'],
  ['ads', 'aimDamage'],
  ['stability', 'stability'],
  ['recoil', 'stability'],
  ['buildingheal', 'buildingHeal'],
  ['effectduration', 'effectDuration'],
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
  names: Record<string, string> = SCHEMATIC_NAMES,
): ImportedSchematic[] {
  const items = (
    profile as { profileChanges?: { profile?: { items?: Record<string, ProfileItem> } }[] } | null
  )?.profileChanges?.[0]?.profile?.items;
  if (!items || typeof items !== 'object') return [];
  const out: ImportedSchematic[] = [];
  const reported = new Set<string>();
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
      const aidBase = aid.toLowerCase().replace(/^alteration:/, '').replace(/_t0[1-5]\b/, '');
      if (!reported.has(aidBase)) {
        reported.add(aidBase);
        log(`Alteration mapping: ${aidBase} -> ${mapped.perkId ?? 'UNKNOWN'}`);
      }
      if (mapped.perkId === null) {
        unknownAlterations.push(aid);
        log(`Unknown alteration: ${aid}`);
      }
    }
    const baseTokens = tokens.filter((t) => !SUFFIX_TOKENS.has(t));
    const baseKey = baseTokens.join('_');
    const exactKey = rarityToken ? `${baseKey}_${rarityToken}` : baseKey;
    const name = NAME_OVERRIDES[exactKey] ?? NAME_OVERRIDES[baseKey] ?? names[exactKey] ?? names[baseKey] ?? prettifyName(slug);
    out.push({ templateId: tpl, name, rarity, level, perks, unknownAlterations });
  }
  return out.sort((a, b) => b.level - a.level);
}
