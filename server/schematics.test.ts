import { describe, expect, it, vi } from 'vitest';
import { mapAlteration, parseCampaignSchematics, prettifyName } from './schematics.js';

function profileWith(items: Record<string, unknown>) {
  return { profileChanges: [{ profile: { items } }] };
}

describe('prettifyName', () => {
  it('strips sid tokens and capitalizes', () => {
    expect(prettifyName('pistol_autoheavy_vr_ore_t04')).toBe('Pistol Autoheavy');
    expect(prettifyName('edged_sword_medium_c_crystal_t01')).toBe('Edged Sword Medium');
  });
});

describe('mapAlteration', () => {
  it('maps known aids with tier rarity', () => {
    expect(mapAlteration('Alteration:aid_weapon_critchance_t05')).toEqual({ perkId: 'critRating', rarity: 'gold' });
    expect(mapAlteration('aid_weapon_critdmg_t03')).toEqual({ perkId: 'critDamage', rarity: 'blue' });
  });
  it('matches firerate before fire element', () => {
    expect(mapAlteration('aid_weapon_firerate_t02').perkId).toBe('fireRate');
    expect(mapAlteration('aid_weapon_element_fire_t04').perkId).toBe('elemFire');
  });
  it('returns null perk for unknown aids, keeping tier', () => {
    expect(mapAlteration('aid_weapon_mystery_t04')).toEqual({ perkId: null, rarity: 'purple' });
  });
  it('defaults to white without tier suffix', () => {
    expect(mapAlteration('aid_weapon_critchance').rarity).toBe('white');
  });
});

describe('parseCampaignSchematics', () => {
  const items = {
    a: {
      templateId: 'Schematic:sid_pistol_autoheavy_vr_ore_t04',
      attributes: { level: 30, alterations: ['aid_weapon_critchance_t04', 'aid_weapon_element_fire_t03', 'aid_weapon_mystery_t02'] },
    },
    b: {
      templateId: 'Schematic:sid_assault_auto_sr_crystal_t05',
      attributes: { level: 145, alterations: [] },
    },
    c: {
      templateId: 'Schematic:sid_launcher_grenade_uc_ore_t01',
      attributes: { level: 5 },
    },
    d: { templateId: 'Worker:managerexplorer_sr_eagle', attributes: { level: 50 } },
    e: { templateId: 'AccountResource:reagent_c_t01', quantity: 10 },
  };

  it('filters, parses and sorts by level descending', () => {
    const result = parseCampaignSchematics(profileWith(items));
    expect(result.map((r) => r.name)).toEqual(['Assault Auto', 'Pistol Autoheavy', 'Launcher Grenade']);
  });

  it('clamps level to 10-50', () => {
    const result = parseCampaignSchematics(profileWith(items));
    expect(result[0].level).toBe(50);
    expect(result[2].level).toBe(10);
  });

  it('parses schematic rarity token', () => {
    const result = parseCampaignSchematics(profileWith(items));
    expect(result[0].rarity).toBe('gold');
    expect(result[1].rarity).toBe('purple');
    expect(result[2].rarity).toBe('green');
  });

  it('maps perks and collects unknown alterations with logging', () => {
    const log = vi.fn();
    const result = parseCampaignSchematics(profileWith(items), log);
    const pistol = result.find((r) => r.name === 'Pistol Autoheavy')!;
    expect(pistol.perks).toEqual([
      { perkId: 'critRating', rarity: 'purple' },
      { perkId: 'elemFire', rarity: 'blue' },
      { perkId: null, rarity: 'green' },
    ]);
    expect(pistol.unknownAlterations).toEqual(['aid_weapon_mystery_t02']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('aid_weapon_mystery_t02'));
  });

  it('survives malformed input', () => {
    expect(parseCampaignSchematics(null)).toEqual([]);
    expect(parseCampaignSchematics({})).toEqual([]);
  });
});
