import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadState, saveState, type AppState } from '../lib/storage';

interface Ctx {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  mutate: (fn: (s: AppState) => AppState) => void;
  saveFailed: boolean;
}

const AppStateContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [saveFailed, setSaveFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveFailed(!saveState(state));
  }, [state]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      saveFailed,
      update: (patch) => setState((s) => ({ ...s, ...patch })),
      mutate: (fn) => setState(fn),
    }),
    [state, saveFailed],
  );
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): Ctx {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
