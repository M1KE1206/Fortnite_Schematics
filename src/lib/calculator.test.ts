import { describe, it, expect } from 'vitest';
import { DEFAULT_COSTS } from '../data/costs';
import {
  levelUpCost, perkUpgradeCost, schematicCost, totalCost, shortage, addTotals, makeDefaultSchematic, slotChangeCost,
} from './calculator';

describe('levelUpCost', () => {
  it('full 10→50 matches spec totals', () => {
    expect(levelUpCost(10, 50, DEFAULT_COSTS)).toEqual({
      pureDropsOfRain: 200, lightningInABottle: 66, eyeOfTheStorm: 33, stormShard: 11,
    });
  });
  it('single tier 10→20 only pure drops', () => {
    expect(levelUpCost(10, 20, DEFAULT_COSTS)).toEqual({ pureDropsOfRain: 20 });
  });
  it('mid-tier start prorates and ceils per resource', () => {
    // 25→30 = 5/10 van tier 20→30 (40 PD + 11 LiB) = 20 PD + 5.5→6 LiB
    expect(levelUpCost(25, 30, DEFAULT_COSTS)).toEqual({ pureDropsOfRain: 20, lightningInABottle: 6 });
  });
  it('spans tier boundaries and ceils once per resource', () => {
    // 15→25 = 5 levels of tier 10→20 (2 PD each) + 5 levels of tier 20→30 (4 PD + 1.1 LiB each)
    // PD: 5*2 + 5*4 = 30; LiB: 5*1.1 = 5.5 → 6
    expect(levelUpCost(15, 25, DEFAULT_COSTS)).toEqual({ pureDropsOfRain: 30, lightningInABottle: 6 });
  });
  it('ceils once per resource across multiple partial tiers', () => {
    // 25→45: LiB = 5*1.1 + 10*2.2 + 5*3.3 = 44.0 (ceil-per-tier would give 45)
    expect(levelUpCost(25, 45, DEFAULT_COSTS)).toEqual({
      pureDropsOfRain: 120,
      lightningInABottle: 44,
      eyeOfTheStorm: 22,
      stormShard: 6,
    });
  });
  it('no cost when at or above target', () => {
    expect(levelUpCost(50, 50, DEFAULT_COSTS)).toEqual({});
    expect(levelUpCost(50, 40, DEFAULT_COSTS)).toEqual({});
  });
  it('clamps out-of-range levels to 10..50', () => {
    expect(levelUpCost(1, 60, DEFAULT_COSTS)).toEqual(levelUpCost(10, 50, DEFAULT_COSTS));
  });
});

describe('perkUpgradeCost', () => {
  it('white→gold sums all steps', () => {
    expect(perkUpgradeCost('white', 'gold', DEFAULT_COSTS)).toEqual({
      rePerk: 345, uncommonPerkUp: 100, rarePerkUp: 150, epicPerkUp: 225, legendaryPerkUp: 345,
    });
  });
  it('blue→gold sums last two steps', () => {
    expect(perkUpgradeCost('blue', 'gold', DEFAULT_COSTS)).toEqual({
      rePerk: 235, epicPerkUp: 225, legendaryPerkUp: 345,
    });
  });
  it('no cost when already at or above target', () => {
    expect(perkUpgradeCost('gold', 'gold', DEFAULT_COSTS)).toEqual({});
    expect(perkUpgradeCost('gold', 'blue', DEFAULT_COSTS)).toEqual({});
  });
});

describe('schematicCost', () => {
  it('default schematic = level 10→50 + 6x white→gold', () => {
    const s = makeDefaultSchematic();
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.pureDropsOfRain).toBe(200);
    expect(c.rePerk).toBe(345 * 6);
    expect(c.legendaryPerkUp).toBe(345 * 6);
    expect(Object.keys(c)).toEqual(
      expect.not.arrayContaining(['perkUp']),
    );
  });
  it('disabled slots do not count', () => {
    const s = makeDefaultSchematic();
    s.perkSlots.forEach((p) => (p.enabled = false));
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.rePerk).toBeUndefined();
    expect(c.legendaryPerkUp).toBeUndefined();
  });
  it('reroll adds 600 rePerk per flagged slot on top of upgrade rePerk', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].needsReroll = true;
    s.perkSlots[1].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(345 * 6 + 600 * 2);
  });
});

describe('totals & shortage', () => {
  it('totalCost sums schematics', () => {
    const a = makeDefaultSchematic();
    const b = makeDefaultSchematic();
    expect(totalCost([a, b], DEFAULT_COSTS).pureDropsOfRain).toBe(400);
  });
  it('shortage clamps at zero', () => {
    expect(shortage({ uncommonPerkUp: 100, rePerk: 50 }, { uncommonPerkUp: 30, rePerk: 200 })).toEqual({ uncommonPerkUp: 70 });
  });
  it('addTotals merges keys', () => {
    expect(addTotals({ uncommonPerkUp: 1 }, { uncommonPerkUp: 2, rePerk: 3 })).toEqual({ uncommonPerkUp: 3, rePerk: 3 });
  });
});

describe('slot change costs', () => {
  it('counts 600 rePerk when normal perks differ', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'damage';
    s.perkSlots[0].targetPerk = 'critRating';
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070 + 600);
  });

  it('no cost when perks are equal, even with legacy flag set', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'critRating';
    s.perkSlots[0].targetPerk = 'critRating';
    s.perkSlots[0].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070);
  });

  it('no cost when only one perk is set, even with legacy flag', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'damage';
    s.perkSlots[0].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070);
  });

  it('legacy needsReroll still counts when no perks are set', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070 + 600);
  });

  it('handles legacy stored slots without perk fields', () => {
    const s = makeDefaultSchematic();
    const legacy = s.perkSlots[0] as Partial<typeof s.perkSlots[0]>;
    delete legacy.currentPerk;
    delete legacy.targetPerk;
    s.perkSlots[0].needsReroll = true;
    expect(slotChangeCost(s.perkSlots[0], DEFAULT_COSTS)).toEqual({ rePerk: 600 });
  });

  it('element change to fire costs 1800 fireUp in any slot', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].currentPerk = 'elemPhysical';
    s.perkSlots[0].targetPerk = 'elemFire';
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.fireUp).toBe(1800);
    expect(c.rePerk).toBe(2070);
  });

  it('element to element uses target cost (fire to water = 1800 frostUp)', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[2].currentPerk = 'elemFire';
    s.perkSlots[2].targetPerk = 'elemWater';
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.frostUp).toBe(1800);
    expect(c.fireUp).toBeUndefined();
  });

  it('element change to energy costs 600 of each elemental', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[5].currentPerk = 'elemPhysical';
    s.perkSlots[5].targetPerk = 'elemEnergy';
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.fireUp).toBe(600);
    expect(c.frostUp).toBe(600);
    expect(c.ampUp).toBe(600);
  });

  it('element change to physical costs 1500 rePerk', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[5].currentPerk = 'elemFire';
    s.perkSlots[5].targetPerk = 'elemPhysical';
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(2070 + 1500);
  });

  it('elementChange field is no longer read by the calculator', () => {
    const s = makeDefaultSchematic();
    s.elementChange = { needed: true, element: 'fire' };
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.fireUp).toBeUndefined();
    expect(c.rePerk).toBe(2070);
  });
});
