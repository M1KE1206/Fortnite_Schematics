import { RARITIES } from '../types';
import type { CostConfig, Inventory, Rarity, ResourceKey, ResourceTotals, Schematic } from '../types';
import { ELEMENT_RESOURCE } from '../data/costs';

export function addTotals(...totals: ResourceTotals[]): ResourceTotals {
  const out: ResourceTotals = {};
  for (const t of totals) {
    for (const [k, v] of Object.entries(t) as [ResourceKey, number][]) {
      if (v > 0) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

export function levelUpCost(from: number, to: number, costs: CostConfig): ResourceTotals {
  const raw: Record<string, number> = {};
  for (let lvl = Math.max(10, from); lvl < Math.min(50, to); lvl++) {
    const tier = costs.levelTiers[Math.floor((lvl - 10) / 10)];
    if (!tier) continue;
    for (const [k, v] of Object.entries(tier)) {
      if (v > 0) raw[k] = (raw[k] ?? 0) + v / 10;
    }
  }
  const out: ResourceTotals = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Math.ceil(v - 1e-9);
    if (n > 0) out[k as ResourceKey] = n;
  }
  return out;
}

export function perkUpgradeCost(from: Rarity, to: Rarity, costs: CostConfig): ResourceTotals {
  const fromIdx = RARITIES.indexOf(from);
  const toIdx = RARITIES.indexOf(to);
  const parts: ResourceTotals[] = [];
  for (let i = fromIdx; i < toIdx; i++) {
    const step = costs.perkSteps[i];
    parts.push({ perkUp: step.perkUp, [step.specificKey]: step.specificAmount });
  }
  return addTotals(...parts);
}

export function schematicCost(s: Schematic, costs: CostConfig): ResourceTotals {
  const parts: ResourceTotals[] = [levelUpCost(s.currentLevel, s.targetLevel, costs)];
  for (const slot of s.perkSlots) {
    if (!slot.enabled) continue;
    parts.push(perkUpgradeCost(slot.currentRarity, slot.targetRarity, costs));
    if (slot.needsReroll) parts.push({ rePerk: costs.rePerkChange });
  }
  if (s.elementChange.needed && s.elementChange.element) {
    const el = s.elementChange.element;
    const elemental: ResourceTotals =
      el === 'energy'
        ? {
            fireUp: Math.ceil(costs.elementChangeElemental / 3),
            frostUp: Math.ceil(costs.elementChangeElemental / 3),
            ampUp: Math.ceil(costs.elementChangeElemental / 3),
          }
        : { [ELEMENT_RESOURCE[el]]: costs.elementChangeElemental };
    parts.push({ rePerk: costs.elementChangeRePerk }, elemental);
  }
  return addTotals(...parts);
}

export function totalCost(list: Schematic[], costs: CostConfig): ResourceTotals {
  return addTotals(...list.map((s) => schematicCost(s, costs)));
}

export function shortage(needed: ResourceTotals, inventory: Inventory): ResourceTotals {
  const out: ResourceTotals = {};
  for (const [k, v] of Object.entries(needed) as [ResourceKey, number][]) {
    const missing = v - (inventory[k] ?? 0);
    if (missing > 0) out[k] = missing;
  }
  return out;
}

export function makeDefaultSchematic(): Schematic {
  return {
    id: crypto.randomUUID(),
    name: '',
    iconUrl: null,
    fallbackIcon: 'crosshair',
    currentLevel: 10,
    targetLevel: 50,
    perkSlots: Array.from({ length: 6 }, () => ({
      enabled: true,
      currentRarity: 'white' as Rarity,
      targetRarity: 'gold' as Rarity,
      needsReroll: false,
    })),
    elementChange: { needed: false, element: null },
  };
}
