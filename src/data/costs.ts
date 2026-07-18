import type { CostConfig, ResourceKey } from '../types';

export const DEFAULT_COSTS: CostConfig = {
  levelTiers: [
    { pureDropsOfRain: 20, lightningInABottle: 0, eyeOfTheStorm: 0, stormShard: 0 },
    { pureDropsOfRain: 40, lightningInABottle: 11, eyeOfTheStorm: 0, stormShard: 0 },
    { pureDropsOfRain: 60, lightningInABottle: 22, eyeOfTheStorm: 11, stormShard: 0 },
    { pureDropsOfRain: 80, lightningInABottle: 33, eyeOfTheStorm: 22, stormShard: 11 },
  ],
  perkSteps: [
    { rePerk: 45, specificAmount: 100, specificKey: 'uncommonPerkUp' },
    { rePerk: 65, specificAmount: 150, specificKey: 'rarePerkUp' },
    { rePerk: 95, specificAmount: 225, specificKey: 'epicPerkUp' },
    { rePerk: 140, specificAmount: 345, specificKey: 'legendaryPerkUp' },
  ],
  rePerkChange: 600,
  elementChangeElemental: 1800,
  elementChangeEnergyEach: 600,
  elementChangePhysicalRePerk: 1500,
};

export const RESOURCES: { key: ResourceKey; label: string; group: 'evolution' | 'perk' | 'element' | 'upgrade' }[] = [
  { key: 'pureDropsOfRain', label: 'Pure Drop of Rain', group: 'evolution' },
  { key: 'lightningInABottle', label: 'Lightning in a Bottle', group: 'evolution' },
  { key: 'eyeOfTheStorm', label: 'Eye of the Storm', group: 'evolution' },
  { key: 'stormShard', label: 'Storm Shard', group: 'evolution' },
  { key: 'uncommonPerkUp', label: 'Uncommon PERK-UP!', group: 'perk' },
  { key: 'rarePerkUp', label: 'Rare PERK-UP!', group: 'perk' },
  { key: 'epicPerkUp', label: 'Epic PERK-UP!', group: 'perk' },
  { key: 'legendaryPerkUp', label: 'Legendary PERK-UP!', group: 'perk' },
  { key: 'rePerk', label: 'RE-PERK!', group: 'perk' },
  { key: 'fireUp', label: 'FIRE-UP!', group: 'element' },
  { key: 'frostUp', label: 'FROST-UP!', group: 'element' },
  { key: 'ampUp', label: 'AMP-UP!', group: 'element' },
  { key: 'coreRePerk', label: 'Core RE-PERK!', group: 'perk' },
  { key: 'rareFlux', label: 'Rare Flux', group: 'upgrade' },
  { key: 'epicFlux', label: 'Epic Flux', group: 'upgrade' },
  { key: 'legendaryFlux', label: 'Legendary Flux', group: 'upgrade' },
];
