import { useEffect, useState } from 'react';
import { ApiClientError } from '../../../shared/api/client';
import { SettingItem, settingsApi } from '../api/settings.api';

/** Renders the correct control purely from a setting's valueType/validationRule,
 * so a new setting in the registry gets a working UI with no bespoke code.
 * Save-on-blur (or toggle change), inline validation errors, reset, history. */
export function SettingField({ item, canWrite, onSaved, onHistory }: { item: SettingItem; canWrite: boolean; onSaved: () => void; onHistory: (key: string) => void }) {
  const [value, setValue] = useState<unknown>(item.resolvedValue);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setValue(item.resolvedValue); }, [item.resolvedValue]);

  const save = async (v: unknown) => {
    if (!canWrite || JSON.stringify(v) === JSON.stringify(item.resolvedValue)) return;
    setStatus('saving'); setError(null);
    try { await settingsApi.update(item.key, v); setStatus('saved'); onSaved(); setTimeout(() => setStatus('idle'), 1500); }
    catch (e) { setStatus('error'); setError(e instanceof ApiClientError ? e.message : 'Failed'); setValue(item.resolvedValue); }
  };
  const reset = async () => {
    if (!confirm(`Reset "${item.label}" to its default?`)) return;
    try { await settingsApi.reset(item.key); onSaved(); } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Failed'); }
  };

  const rule = item.validationRule ?? {};
  const input = 'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
            {item.scope === 'BRANCH' && <span className="rounded bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-400">per-branch</span>}
            {item.isCustomized && <span className="rounded bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">customized</span>}
          </div>
          {item.description && <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>}
          <code className="text-[10px] text-gray-400">{item.key}</code>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Control by type */}
          {item.valueType === 'BOOLEAN' && (
            <button disabled={!canWrite} onClick={() => { const nv = !value; setValue(nv); save(nv); }} className={`relative h-6 w-11 rounded-full transition ${value ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'} ${!canWrite ? 'opacity-50' : ''}`} aria-pressed={!!value}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${value ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          )}
          {item.valueType === 'NUMBER' && (
            <input type="number" disabled={!canWrite} value={value as number} min={rule.min as number} max={rule.max as number}
              onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => save(value)}
              className={`w-28 ${input}`} />
          )}
          {item.valueType === 'ENUM' && (
            <select disabled={!canWrite} value={value as string} onChange={(e) => { setValue(e.target.value); save(e.target.value); }} className={input}>
              {(rule.allowedValues as string[])?.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
            </select>
          )}
          {item.valueType === 'STRING' && (
            <input disabled={!canWrite} value={value as string} onChange={(e) => setValue(e.target.value)} onBlur={() => save(value)} className={`w-56 ${input}`} />
          )}
          {item.valueType === 'JSON' && rule.expiryTiers ? (
            <ExpiryTiersEditor value={value as { red: number; orange: number; yellow: number }} disabled={!canWrite} onCommit={(v) => { setValue(v); save(v); }} />
          ) : item.valueType === 'JSON' ? (
            <code className="max-w-xs truncate text-xs text-gray-500">{JSON.stringify(value)}</code>
          ) : null}

          <span className="w-4 text-xs">{status === 'saving' ? '…' : status === 'saved' ? '✓' : ''}</span>
          <button onClick={() => onHistory(item.key)} className="text-xs text-gray-400 hover:text-gray-600" title="History">🕐</button>
          {canWrite && item.isCustomized && <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500" title="Reset to default">↺</button>}
        </div>
      </div>
    </div>
  );
}

/** Structured editor for the JSON expiry-tier boundaries (ascending red<orange<yellow). */
function ExpiryTiersEditor({ value, disabled, onCommit }: { value: { red: number; orange: number; yellow: number }; disabled: boolean; onCommit: (v: { red: number; orange: number; yellow: number }) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const box = 'w-16 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm';
  const commit = () => { if (v.red < v.orange && v.orange < v.yellow) onCommit(v); };
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-red-500">red&lt;</span><input type="number" disabled={disabled} value={v.red} onChange={(e) => setV({ ...v, red: Number(e.target.value) })} onBlur={commit} className={box} />
      <span className="text-orange-500">org&lt;</span><input type="number" disabled={disabled} value={v.orange} onChange={(e) => setV({ ...v, orange: Number(e.target.value) })} onBlur={commit} className={box} />
      <span className="text-yellow-600">yel&lt;</span><input type="number" disabled={disabled} value={v.yellow} onChange={(e) => setV({ ...v, yellow: Number(e.target.value) })} onBlur={commit} className={box} />
      <span className="text-gray-400">days</span>
    </div>
  );
}
