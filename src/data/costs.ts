import type { CostConfig, ElementType, ResourceKey } from '../types';

export const DEFAULT_COSTS: CostConfig = {
  levelTiers: [
    { pureDropsOfRain: 20, lightningInABottle: 0, eyeOfTheStorm: 0, stormShard: 0 },
    { pureDropsOfRain: 40, lightningInABottle: 11, eyeOfTheStorm: 0, stormShard: 0 },
    { pureDropsOfRain: 60, lightningInABottle: 22, eyeOfTheStorm: 11, stormShard: 0 },
    { pureDropsOfRain: 80, lightningInABottle: 33, eyeOfTheStorm: 22, stormShard: 11 },
  ],
  perkSteps: [
    { perkUp: 45, specificAmount: 100, specificKey: 'uncommonPerkUp' },
    { perkUp: 65, specificAmount: 150, specificKey: 'rarePerkUp' },
    { perkUp: 95, specificAmount: 225, specificKey: 'epicPerkUp' },
    { perkUp: 140, specificAmount: 345, specificKey: 'legendaryPerkUp' },
  ],
  rePerkChange: 55,
  elementChangeRePerk: 1500,
  elementChangeElemental: 1200,
};

export const RESOURCES: { key: ResourceKey; label: string; group: 'evolution' | 'perk' | 'element' }[] = [
  { key: 'pureDropsOfRain', label: 'Pure Drop of Rain', group: 'evolution' },
  { key: 'lightningInABottle', label: 'Lightning in a Bottle', group: 'evolution' },
  { key: 'eyeOfTheStorm', label: 'Eye of the Storm', group: 'evolution' },
  { key: 'stormShard', label: 'Storm Shard', group: 'evolution' },
  { key: 'perkUp', label: 'PERK-UP!', group: 'perk' },
  { key: 'uncommonPerkUp', label: 'Uncommon PERK-UP!', group: 'perk' },
  { key: 'rarePerkUp', label: 'Rare PERK-UP!', group: 'perk' },
  { key: 'epicPerkUp', label: 'Epic PERK-UP!', group: 'perk' },
  { key: 'legendaryPerkUp', label: 'Legendary PERK-UP!', group: 'perk' },
  { key: 'rePerk', label: 'RE-PERK!', group: 'perk' },
  { key: 'fireUp', label: 'FIRE-UP!', group: 'element' },
  { key: 'frostUp', label: 'FROST-UP!', group: 'element' },
  { key: 'ampUp', label: 'AMP-UP!', group: 'element' },
];

export const ELEMENT_RESOURCE: Record<Exclude<ElementType, 'energy'>, ResourceKey> = {
  fire: 'fireUp',
  water: 'frostUp',
  nature: 'ampUp',
};
