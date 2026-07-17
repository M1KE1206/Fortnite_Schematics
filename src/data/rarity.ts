import type { Rarity } from '../types';

export const RARITY_COLORS: Record<Rarity, string> = {
  white: 'bg-zinc-300',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  gold: 'bg-amber-500',
};

export const RARITY_TEXT: Record<Rarity, string> = {
  white: 'text-zinc-300',
  green: 'text-green-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  gold: 'text-amber-400',
};
