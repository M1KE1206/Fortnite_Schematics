import { describe, expect, it, vi } from 'vitest';
import { parseCampaignResources, TEMPLATE_MAP } from './epic.js';

function profileWith(items: Record<string, { templateId?: string; quantity?: number }>) {
  return { profileChanges: [{ profile: { items } }] };
}

describe('parseCampaignResources', () => {
  it('maps all known reagents to resource keys', () => {
    const result = parseCampaignResources(
      profileWith({
        a: { templateId: 'AccountResource:reagent_c_t01', quantity: 1234 },
        b: { templateId: 'AccountResource:reagent_alteration_generic', quantity: 5000 },
        c: { templateId: 'AccountResource:reagent_alteration_upgrade_sr', quantity: 777 },
        d: { templateId: 'AccountResource:reagent_alteration_ele_water', quantity: 42 },
      }),
    );
    expect(result.pureDropsOfRain).toBe(1234);
    expect(result.rePerk).toBe(5000);
    expect(result.legendaryPerkUp).toBe(777);
    expect(result.frostUp).toBe(42);
  });

  it('maps core re-perk and flux reagents', () => {
    const result = parseCampaignResources(
      profileWith({
        a: { templateId: 'AccountResource:reagent_alteration_gameplay_generic', quantity: 321 },
        b: { templateId: 'AccountResource:reagent_evolverarity_r', quantity: 11 },
        c: { templateId: 'AccountResource:reagent_evolverarity_vr', quantity: 22 },
        d: { templateId: 'AccountResource:reagent_evolverarity_sr', quantity: 33 },
      }),
    );
    expect(result.coreRePerk).toBe(321);
    expect(result.rareFlux).toBe(11);
    expect(result.epicFlux).toBe(22);
    expect(result.legendaryFlux).toBe(33);
  });

  it('is case-insensitive on templateId', () => {
    const result = parseCampaignResources(
      profileWith({ a: { templateId: 'accountresource:Reagent_C_T04', quantity: 9 } }),
    );
    expect(result.stormShard).toBe(9);
  });

  it('returns 0 for resources missing from the profile', () => {
    const result = parseCampaignResources(profileWith({}));
    for (const key of Object.values(TEMPLATE_MAP)) expect(result[key]).toBe(0);
  });

  it('ignores non-reagent items and logs unknown reagents', () => {
    const log = vi.fn();
    const result = parseCampaignResources(
      profileWith({
        a: { templateId: 'Schematic:sid_pistol_nocturno', quantity: 1 },
        b: { templateId: 'AccountResource:reagent_future_thing', quantity: 5 },
        c: { templateId: 'AccountResource:eventcurrency_scaling', quantity: 100 },
      }),
      log,
    );
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('reagent_future_thing'));
  });

  it('survives malformed input', () => {
    expect(parseCampaignResources(null).rePerk).toBe(0);
    expect(parseCampaignResources({ profileChanges: [] }).rePerk).toBe(0);
    expect(parseCampaignResources('garbage').rePerk).toBe(0);
  });
});
