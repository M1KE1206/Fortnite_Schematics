export const RARITIES = ['white', 'green', 'blue', 'purple', 'gold'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABELS: Record<Rarity, string> = {
  white: 'White',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
  gold: 'Gold',
};

export type ElementType = 'fire' | 'water' | 'nature' | 'energy';

export type ResourceKey =
  | 'pureDropsOfRain'
  | 'lightningInABottle'
  | 'eyeOfTheStorm'
  | 'stormShard'
  | 'perkUp'
  | 'uncommonPerkUp'
  | 'rarePerkUp'
  | 'epicPerkUp'
  | 'legendaryPerkUp'
  | 'rePerk'
  | 'fireUp'
  | 'frostUp'
  | 'ampUp';

export type ResourceTotals = Partial<Record<ResourceKey, number>>;
export type Inventory = Partial<Record<ResourceKey, number>>;

export interface PerkSlot {
  enabled: boolean;
  currentRarity: Rarity;
  targetRarity: Rarity;
  needsReroll: boolean;
}

export interface Schematic {
  id: string;
  name: string;
  iconUrl: string | null; // data-URL of https-URL
  currentLevel: number;   // 10-50
  targetLevel: number;    // 10-50
  perkSlots: PerkSlot[];  // lengte 6; index 5 = element-slot
  elementChange: { needed: boolean; element: ElementType | null };
}

export interface LevelTierCost {
  pureDropsOfRain: number;
  lightningInABottle: number;
  eyeOfTheStorm: number;
  stormShard: number;
}

export interface PerkStepCost {
  perkUp: number;
  specificAmount: number;
  specificKey: ResourceKey;
}

export interface CostConfig {
  levelTiers: LevelTierCost[]; // index 0 = 10→20 ... index 3 = 40→50
  perkSteps: PerkStepCost[];   // index 0 = white→green ... index 3 = purple→gold
  rePerkChange: number;
  elementChangeRePerk: number;
  elementChangeElemental: number;
}
