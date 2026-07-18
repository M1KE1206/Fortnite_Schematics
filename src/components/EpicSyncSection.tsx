import { useEffect, useState } from 'react';
import { ExternalLink, Link2, Loader2, RefreshCw, Unlink } from 'lucide-react';
import {
  EPIC_LOGIN_URL,
  EpicSyncError,
  getSyncStatus,
  linkAccount,
  syncInventory,
  unlinkAccount,
} from '../lib/epicSync';
import { useAppState } from '../state/AppStateContext';

export default function EpicSyncSection() {
  const { state, update } = useAppState();
  const [linked, setLinked] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    getSyncStatus()
      .then((s) => {
        setLinked(s.linked);
        setAccountName(s.accountName ?? '');
      })
      .catch(() => setUnavailable(true));
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      if (e instanceof EpicSyncError) {
        setError(e.message);
        if (e.needsRelink) {
          setLinked(false);
          setAccountName('');
        }
      } else {
        setError('Unexpected error');
      }
    } finally {
      setBusy(false);
    }
  }

  const doLink = () =>
    run(async () => {
      const r = await linkAccount(code);
      setLinked(true);
      setAccountName(r.accountName);
      setCode('');
    });

  const doSync = () =>
    run(async () => {
      const r = await syncInventory();
      update({ inventory: { ...state.inventory, ...r.resources } });
      setLastSynced(new Date(r.fetchedAt).toLocaleTimeString());
    });

  const doUnlink = () =>
    run(async () => {
      await unlinkAccount();
      setLinked(false);
      setAccountName('');
      setLastSynced('');
    });

  return (
    <section className="rounded border border-zinc-800 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Epic account sync</h2>
      {unavailable ? (
        <p className="text-sm text-zinc-500">Sync requires the dev server (npm run dev).</p>
      ) : linked ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-zinc-200">
            <Link2 size={14} className="text-green-400" /> {accountName}
          </span>
          <button
            onClick={doSync}
            disabled={busy}
            className="flex items-center gap-2 rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync from Epic
          </button>
          {lastSynced && <span className="text-xs text-zinc-500">Last synced: {lastSynced}</span>}
          <button
            onClick={doUnlink}
            disabled={busy}
            className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400"
          >
            <Unlink size={12} /> Unlink
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            Link your Epic account to pull your evolution and perk materials automatically.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={EPIC_LOGIN_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded border border-zinc-700 px-3 py-1.5 text-sm hover:border-zinc-500"
            >
              <ExternalLink size={14} /> Open Epic login
            </a>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste authorization code"
              className="w-64 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm"
            />
            <button
              onClick={doLink}
              disabled={busy || !code.trim()}
              className="flex items-center gap-2 rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Link account
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
