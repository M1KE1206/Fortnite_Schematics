export interface PerkDef {
  id: string;
  label: string;
  group: string;
}

export const PERKS: PerkDef[] = [
  { id: 'damage', label: 'Damage', group: 'Damage' },
  { id: 'critRating', label: 'Critical Rating', group: 'Damage' },
  { id: 'critDamage', label: 'Critical Damage', group: 'Damage' },
  { id: 'headshotDamage', label: 'Headshot Damage', group: 'Damage' },
  { id: 'dmgAfflicted', label: 'Damage to Afflicted', group: 'Damage' },
  { id: 'dmgSlowed', label: 'Damage to Slowed and Snared', group: 'Damage' },
  { id: 'dmgMist', label: 'Damage to Mist Monsters and Bosses', group: 'Damage' },
  { id: 'dmgStunned', label: 'Damage to Stunned Staggered and Knocked Down', group: 'Damage' },
  { id: 'attackSpeed', label: 'Attack Speed', group: 'Speed' },
  { id: 'fireRate', label: 'Fire Rate', group: 'Speed' },
  { id: 'reloadSpeed', label: 'Reload Speed', group: 'Speed' },
  { id: 'magazineSize', label: 'Magazine Size', group: 'Utility' },
  { id: 'durability', label: 'Durability', group: 'Utility' },
  { id: 'lifeLeech', label: 'Life Leech', group: 'Utility' },
  { id: 'aimDamage', label: 'Ranged Weapon Damage while Aiming', group: 'Utility' },
  { id: 'stability', label: 'Weapon Stability', group: 'Utility' },
  { id: 'affliction', label: 'Affliction', group: 'Sixth perk' },
  { id: 'snare', label: 'Snare', group: 'Sixth perk' },
  { id: 'stun', label: 'Stun', group: 'Sixth perk' },
  { id: 'knockback', label: 'Knockback', group: 'Sixth perk' },
  { id: 'causesAffliction', label: 'Causes Affliction (6s)', group: 'Sixth perk' },
  { id: 'headshotEnergy', label: 'Headshots grant Energy', group: 'Sixth perk' },
];

export const PERK_LABELS: Record<string, string> = Object.fromEntries(
  PERKS.map((p) => [p.id, p.label]),
);
