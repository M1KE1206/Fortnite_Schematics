import { useState } from 'react';
import { AlertTriangle, Package, Sigma, Swords } from 'lucide-react';
import { useAppState } from './state/AppStateContext';
import SchematicsSection from './components/SchematicsSection';
import TotalsSection from './components/TotalsSection';
import InventorySection from './components/InventorySection';

type Tab = 'schematics' | 'totals' | 'inventory';

const TABS: { id: Tab; label: string; icon: typeof Swords }[] = [
  { id: 'schematics', label: 'Schematics', icon: Swords },
  { id: 'totals', label: 'Totals', icon: Sigma },
  { id: 'inventory', label: 'Inventory & Settings', icon: Package },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('schematics');
  const { saveFailed } = useAppState();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <Swords className="text-amber-400" size={24} />
        <h1 className="text-xl font-bold tracking-tight">STW Schematic Tracker</h1>
      </header>
      {saveFailed && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-200">
          <AlertTriangle size={16} /> Saving failed (storage full?). Export your data as backup.
        </div>
      )}
      <nav className="flex gap-1 px-6 pt-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-t px-4 py-2 text-sm font-medium ${
              tab === id ? 'bg-zinc-900 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>
      <main className="mx-6 mb-6 rounded-b rounded-tr bg-zinc-900 p-6">
        {tab === 'schematics' && <SchematicsSection />}
        {tab === 'totals' && <TotalsSection />}
        {tab === 'inventory' && <InventorySection />}
      </main>
    </div>
  );
}
