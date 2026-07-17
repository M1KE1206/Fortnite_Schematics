import type { CostConfig, Inventory, Schematic } from '../types';
import { DEFAULT_COSTS } from '../data/costs';

export interface AppState {
  schematics: Schematic[];
  inventory: Inventory;
  costs: CostConfig;
  icons: Record<string, string>;
}

const KEY = 'stw-tracker:v1:state';
const VERSION = 1;

function defaults(): AppState {
  return { schematics: [], inventory: {}, costs: structuredClone(DEFAULT_COSTS), icons: {} };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCostConfig(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  return Array.isArray(v.levelTiers)
    && Array.isArray(v.perkSteps)
    && typeof v.rePerkChange === 'number'
    && typeof v.elementChangeRePerk === 'number'
    && typeof v.elementChangeElemental === 'number';
}

function isSchematic(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  return typeof v.id === 'string'
    && Array.isArray(v.perkSlots)
    && typeof v.currentLevel === 'number'
    && typeof v.targetLevel === 'number';
}

function isAppState(v: unknown): v is AppState {
  if (!isPlainObject(v)) return false;
  return Array.isArray(v.schematics)
    && v.schematics.every(isSchematic)
    && isPlainObject(v.inventory)
    && isCostConfig(v.costs)
    && isPlainObject(v.icons);
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as { version?: number; state?: unknown };
    if (parsed.version !== VERSION || !isAppState(parsed.state)) return defaults();
    return parsed.state;
  } catch {
    return defaults();
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, state }));
    return true;
  } catch {
    return false;
  }
}

export function exportJson(state: AppState): string {
  return JSON.stringify({ version: VERSION, state }, null, 2);
}

export function importJson(json: string): AppState {
  let parsed: { version?: number; state?: unknown };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (parsed.version !== VERSION || !isAppState(parsed.state)) {
    throw new Error('File is not a valid STW Tracker export.');
  }
  return parsed.state;
}
