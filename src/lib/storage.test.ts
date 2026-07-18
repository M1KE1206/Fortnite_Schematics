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
      inventory: { rePerk: 500 },
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

  it('importJson rejects state with empty costs object', () => {
    const payload = '{"version":1,"state":{"schematics":[],"inventory":{},"costs":{},"icons":{}}}';
    expect(() => importJson(payload)).toThrow();
  });

  it('loadState salvages valid schematics and drops invalid ones', () => {
    const valid = makeDefaultSchematic();
    valid.name = 'Nocturno';
    const payload = {
      version: 1,
      state: {
        schematics: [valid, { id: 'broken' }],
        inventory: { rePerk: 10 },
        costs: DEFAULT_COSTS,
        icons: {},
      },
    };
    localStorage.setItem('stw-tracker:v1:state', JSON.stringify(payload));
    const s = loadState();
    expect(s.schematics).toEqual([valid]);
    expect(s.inventory).toEqual({ rePerk: 10 });
    expect(s.costs).toEqual(DEFAULT_COSTS);
  });

  it('loadState keeps valid schematics and restores default costs when costs are broken', () => {
    const valid = makeDefaultSchematic();
    valid.name = 'Siegebreaker';
    const payload = {
      version: 1,
      state: {
        schematics: [valid],
        inventory: {},
        costs: { levelTiers: [] }, // missing required fields
        icons: {},
      },
    };
    localStorage.setItem('stw-tracker:v1:state', JSON.stringify(payload));
    const s = loadState();
    expect(s.schematics).toEqual([valid]);
    expect(s.costs).toEqual(DEFAULT_COSTS);
  });

  it('saveState returns false when setItem throws', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    vi.stubGlobal('localStorage', storage);
    const state = loadState();
    expect(saveState(state)).toBe(false);
  });
});

describe('elementChange migration', () => {
  function stateWithElement(element: 'fire' | 'energy') {
    const schematic = makeDefaultSchematic();
    schematic.name = 'Old trap';
    schematic.elementChange = { needed: true, element };
    return {
      schematics: [schematic],
      inventory: {},
      costs: structuredClone(DEFAULT_COSTS),
      icons: {},
    };
  }

  it('migrates elementChange to slot 5 perks on load', () => {
    localStorage.setItem('stw-tracker:v1:state', JSON.stringify({ version: 1, state: stateWithElement('fire') }));
    const loaded = loadState();
    const slot = loaded.schematics[0].perkSlots[5];
    expect(slot.currentPerk).toBe('elemPhysical');
    expect(slot.targetPerk).toBe('elemFire');
    expect(loaded.schematics[0].elementChange.needed).toBe(false);
  });

  it('migrates energy on import and leaves untouched schematics alone', () => {
    const json = JSON.stringify({ version: 1, state: stateWithElement('energy') });
    const imported = importJson(json);
    expect(imported.schematics[0].perkSlots[5].targetPerk).toBe('elemEnergy');
  });

  it('does not overwrite already-set slot 5 perks', () => {
    const state = stateWithElement('fire');
    state.schematics[0].perkSlots[5].targetPerk = 'elemWater';
    localStorage.setItem('stw-tracker:v1:state', JSON.stringify({ version: 1, state }));
    const loaded = loadState();
    expect(loaded.schematics[0].perkSlots[5].targetPerk).toBe('elemWater');
    expect(loaded.schematics[0].elementChange.needed).toBe(false);
  });
});
