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

function isAppState(v: unknown): v is AppState {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.schematics) && typeof o.inventory === 'object' && o.inventory !== null
    && typeof o.costs === 'object' && o.costs !== null && typeof o.icons === 'object' && o.icons !== null;
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
