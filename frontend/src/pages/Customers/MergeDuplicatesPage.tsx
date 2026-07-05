import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api/client';
import { customersApi } from '../../features/customers/api/customers.api';

type Cust = { id: string; name: string; phone: string };

function Picker({ label, value, onPick }: { label: string; value: Cust | null; onPick: (c: Cust | null) => void }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Cust[]>([]);
  const search = async (t: string) => { setTerm(t); if (t.trim().length < 2) return setResults([]); try { setResults((await customersApi.search(t)).data); } catch { setResults([]); } };
  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      {value ? (
        <div className="flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm"><span>{value.name} · {value.phone}</span><button onClick={() => onPick(null)} className="text-gray-400">✕</button></div>
      ) : (
        <div className="relative">
          <input value={term} onChange={(e) => search(e.target.value)} placeholder="Search name / phone…" className={input} />
          {results.length > 0 && <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-lg">{results.map((c) => <li key={c.id}><button onClick={() => { onPick(c); setTerm(''); setResults([]); }} className="block w-full px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700">{c.name} · {c.phone}</button></li>)}</ul>}
        </div>
      )}
    </div>
  );
}

export function MergeDuplicatesPage() {
  const navigate = useNavigate();
  const [surviving, setSurviving] = useState<Cust | null>(null);
  const [mergedAway, setMergedAway] = useState<Cust | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const merge = async () => {
    if (!surviving || !mergedAway || surviving.id === mergedAway.id) return;
    if (!confirm('Merge these customers? This is irreversible — the second record is archived and its history moves to the surviving one.')) return;
    setBusy(true); setError(null);
    try {
      const r = (await customersApi.merge(surviving.id, mergedAway.id)).data;
      setDone(`Merged — ${r.reassignedSales} sale(s) reassigned to ${surviving.name}.`);
      setMergedAway(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Merge failed.');
    } finally { setBusy(false); }
  };

  const canMerge = surviving && mergedAway && surviving.id !== mergedAway.id;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/customers" className="underline">Customers</Link> / Merge Duplicates</div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Merge Duplicate Customers</h1>
      <p className="mb-4 text-sm text-gray-500">Pick the record to keep (surviving) and the duplicate to merge away. Purchase history, prescriptions, tags and notes move to the surviving record.</p>

      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {done && <div className="mb-3 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-700 dark:text-green-300">{done} <button onClick={() => navigate(`/customers/${surviving!.id}`)} className="underline">View</button></div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-green-300 dark:border-green-800 p-4"><Picker label="✅ Surviving record (keep)" value={surviving} onPick={setSurviving} /></div>
        <div className="rounded-lg border border-red-300 dark:border-red-800 p-4"><Picker label="🗑 Merge away (archive)" value={mergedAway} onPick={setMergedAway} /></div>
      </div>

      {surviving && mergedAway && surviving.id === mergedAway.id && <p className="mt-3 text-sm text-red-600">Pick two different customers.</p>}

      <div className="mt-4 flex justify-end">
        <button onClick={merge} disabled={!canMerge || busy} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{busy ? 'Merging…' : 'Confirm Merge'}</button>
      </div>
    </div>
  );
}
