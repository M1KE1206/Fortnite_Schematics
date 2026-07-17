import { useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, Search } from 'lucide-react';
import type { ElementType, Schematic } from '../types';
import { searchWikiIcons, toDataUrl, type WikiResult } from '../lib/wiki';
import { useAppState } from '../state/AppStateContext';
import PerkSlotEditor from './PerkSlotEditor';

interface Props {
  initial: Schematic;
  onSave: (s: Schematic) => void;
  onCancel: () => void;
}

const ELEMENTS: { value: ElementType; label: string }[] = [
  { value: 'fire', label: 'Fire' },
  { value: 'water', label: 'Water' },
  { value: 'nature', label: 'Nature' },
  { value: 'energy', label: 'Energy' },
];

export default function SchematicForm({ initial, onSave, onCancel }: Props) {
  const { state, update } = useAppState();
  const [draft, setDraft] = useState<Schematic>(initial);
  const [results, setResults] = useState<WikiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [wikiError, setWikiError] = useState(false);
  const debounce = useRef<number>(undefined);
  const requestId = useRef(0);

  useEffect(() => {
    window.clearTimeout(debounce.current);
    const q = draft.name.trim();
    if (q.length < 3) {
      requestId.current++;
      setResults([]);
      setWikiError(false);
      return;
    }
    debounce.current = window.setTimeout(async () => {
      const id = ++requestId.current;
      setSearching(true);
      setWikiError(false);
      try {
        const res = await searchWikiIcons(`${q} schematic`);
        if (requestId.current === id) setResults(res);
      } catch {
        if (requestId.current === id) {
          setWikiError(true);
          setResults([]);
        }
      } finally {
        if (requestId.current === id) setSearching(false);
      }
    }, 500);
    return () => window.clearTimeout(debounce.current);
  }, [draft.name]);

  async function pickIcon(r: WikiResult) {
    if (!r.thumbnailUrl) return;
    const cacheKey = r.title.toLowerCase();
    const cached = state.icons[cacheKey];
    const url = cached ?? (await toDataUrl(r.thumbnailUrl));
    if (!cached) update({ icons: { ...state.icons, [cacheKey]: url } });
    setDraft((d) => ({ ...d, iconUrl: url }));
    setResults([]);
  }

  function set<K extends keyof Schematic>(key: K, value: Schematic[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/70 p-6">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-bold">{initial.name ? 'Edit schematic' : 'Add schematic'}</h2>

        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800">
            {draft.iconUrl ? (
              <img src={draft.iconUrl} alt="" className="h-14 w-14 object-contain" />
            ) : (
              <ImageOff size={24} className="text-zinc-600" />
            )}
          </div>
          <div className="grow">
            <label className="mb-1 block text-sm text-zinc-400">Name</label>
            <div className="relative">
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Nocturno"
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 pr-9"
              />
              <span className="absolute right-2 top-2.5 text-zinc-500">
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </span>
            </div>
            {wikiError && <p className="mt-1 text-xs text-red-400">Wiki unreachable - paste an image URL below instead.</p>}
            {results.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {results.filter((r) => r.thumbnailUrl).map((r) => (
                  <button
                    key={r.title}
                    type="button"
                    onClick={() => pickIcon(r)}
                    title={r.title}
                    className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs hover:border-amber-500"
                  >
                    <img src={r.thumbnailUrl!} alt="" className="h-8 w-8 object-contain" />
                    {r.title}
                  </button>
                ))}
              </div>
            )}
            <input
              value={draft.iconUrl?.startsWith('data:') ? '' : (draft.iconUrl ?? '')}
              onChange={(e) => set('iconUrl', e.target.value || null)}
              placeholder="Or paste an image URL"
              className="mt-2 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
            />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm text-zinc-400">Level</label>
          <input
            type="number" min={10} max={50}
            value={draft.currentLevel}
            onChange={(e) => set('currentLevel', Number(e.target.value))}
            onBlur={() => set('currentLevel', Math.min(50, Math.max(10, draft.currentLevel || 10)))}
            className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
          <span className="text-zinc-500">to</span>
          <input
            type="number" min={10} max={50}
            value={draft.targetLevel}
            onChange={(e) => set('targetLevel', Number(e.target.value))}
            onBlur={() => set('targetLevel', Math.min(50, Math.max(10, draft.targetLevel || 10)))}
            className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </div>

        <div className="mb-4 space-y-2">
          {draft.perkSlots.map((slot, i) => (
            <PerkSlotEditor
              key={i}
              slot={slot}
              index={i}
              onChange={(s) => set('perkSlots', draft.perkSlots.map((p, j) => (j === i ? s : p)))}
            />
          ))}
        </div>

        <div className="mb-6 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.elementChange.needed}
              onChange={(e) => set('elementChange', { needed: e.target.checked, element: e.target.checked ? draft.elementChange.element : null })}
            />
            Change element
          </label>
          {draft.elementChange.needed && (
            <select
              value={draft.elementChange.element ?? ''}
              onChange={(e) => set('elementChange', { needed: true, element: e.target.value as ElementType })}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
            >
              <option value="" disabled>Pick element</option>
              {ELEMENTS.map((el) => (
                <option key={el.value} value={el.value}>{el.label}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button
            onClick={() => draft.name.trim() && onSave(draft)}
            disabled={!draft.name.trim()}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
