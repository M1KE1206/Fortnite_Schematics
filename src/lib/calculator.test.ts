import { describe, it, expect } from 'vitest';
import { DEFAULT_COSTS } from '../data/costs';
import {
  levelUpCost, perkUpgradeCost, schematicCost, totalCost, shortage, addTotals, makeDefaultSchematic,
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
  it('no cost when at or above target', () => {
    expect(levelUpCost(50, 50, DEFAULT_COSTS)).toEqual({});
    expect(levelUpCost(50, 40, DEFAULT_COSTS)).toEqual({});
  });
});

describe('perkUpgradeCost', () => {
  it('white→gold sums all steps', () => {
    expect(perkUpgradeCost('white', 'gold', DEFAULT_COSTS)).toEqual({
      perkUp: 345, uncommonPerkUp: 100, rarePerkUp: 150, epicPerkUp: 225, legendaryPerkUp: 345,
    });
  });
  it('blue→gold sums last two steps', () => {
    expect(perkUpgradeCost('blue', 'gold', DEFAULT_COSTS)).toEqual({
      perkUp: 235, epicPerkUp: 225, legendaryPerkUp: 345,
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
    expect(c.perkUp).toBe(345 * 6);
    expect(c.legendaryPerkUp).toBe(345 * 6);
    expect(c.rePerk).toBeUndefined();
  });
  it('disabled slots do not count', () => {
    const s = makeDefaultSchematic();
    s.perkSlots.forEach((p) => (p.enabled = false));
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.perkUp).toBeUndefined();
  });
  it('reroll adds rePerk per flagged slot', () => {
    const s = makeDefaultSchematic();
    s.perkSlots[0].needsReroll = true;
    s.perkSlots[1].needsReroll = true;
    expect(schematicCost(s, DEFAULT_COSTS).rePerk).toBe(110);
  });
  it('element change fire adds rePerk + fireUp', () => {
    const s = makeDefaultSchematic();
    s.elementChange = { needed: true, element: 'fire' };
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.rePerk).toBe(1500);
    expect(c.fireUp).toBe(1200);
  });
  it('element change energy splits over three elementals', () => {
    const s = makeDefaultSchematic();
    s.elementChange = { needed: true, element: 'energy' };
    const c = schematicCost(s, DEFAULT_COSTS);
    expect(c.fireUp).toBe(400);
    expect(c.frostUp).toBe(400);
    expect(c.ampUp).toBe(400);
  });
});

describe('totals & shortage', () => {
  it('totalCost sums schematics', () => {
    const a = makeDefaultSchematic();
    const b = makeDefaultSchematic();
    expect(totalCost([a, b], DEFAULT_COSTS).pureDropsOfRain).toBe(400);
  });
  it('shortage clamps at zero', () => {
    expect(shortage({ perkUp: 100, rePerk: 50 }, { perkUp: 30, rePerk: 200 })).toEqual({ perkUp: 70 });
  });
  it('addTotals merges keys', () => {
    expect(addTotals({ perkUp: 1 }, { perkUp: 2, rePerk: 3 })).toEqual({ perkUp: 3, rePerk: 3 });
  });
});
