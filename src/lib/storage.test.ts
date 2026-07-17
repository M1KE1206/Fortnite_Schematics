import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COSTS } from '../data/costs';
import { exportJson, importJson, loadState, saveState, type AppState } from './storage';
import { makeDefaultSchematic } from './calculator';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

describe('storage', () => {
  it('loadState returns defaults on empty storage', () => {
    const s = loadState();
    expect(s.schematics).toEqual([]);
    expect(s.costs).toEqual(DEFAULT_COSTS);
    expect(s.inventory).toEqual({});
  });

  it('round-trips state through save/load', () => {
    const schematic = makeDefaultSchematic();
    schematic.name = 'Nocturno';
    const state: AppState = {
      schematics: [schematic],
      inventory: { perkUp: 500 },
      costs: DEFAULT_COSTS,
      icons: { nocturno: 'data:image/png;base64,x' },
    };
    expect(saveState(state)).toBe(true);
    expect(loadState()).toEqual(state);
  });

  it('loadState survives corrupt JSON', () => {
    localStorage.setItem('stw-tracker:v1:state', '{not json');
    expect(loadState().schematics).toEqual([]);
  });

  it('export/import round-trips', () => {
    const state = loadState();
    state.inventory = { rePerk: 42 };
    const restored = importJson(exportJson(state));
    expect(restored.inventory).toEqual({ rePerk: 42 });
  });

  it('importJson rejects wrong shape', () => {
    expect(() => importJson('{"hello":1}')).toThrow();
    expect(() => importJson('not json')).toThrow();
  });
});
