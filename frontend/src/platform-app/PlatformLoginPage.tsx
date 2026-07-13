import { FormEvent, useState } from 'react';
import { supabase } from '../shared/auth/supabaseClient';

/** Platform-staff login — a DISTINCT portal from the tenant login, clearly
 *  labeled so no one confuses which system they're entering. */
export function PlatformLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    window.location.href = '/platform-admin';
  };

  const input = 'mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 outline-none focus:border-indigo-400';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-xs font-bold tracking-wider text-white">PLATFORM</span>
          <h1 className="text-lg font-semibold text-white">Admin Console</h1>
        </div>
        <p className="mb-5 text-xs text-slate-400">Vendor staff sign-in — this is <strong>not</strong> a pharmacy portal.</p>
        {error && <div role="alert" className="mb-3 rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</div>}
        <label className="block text-sm text-slate-300">Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="you@vendor.com" required />
        </label>
        <label className="mt-3 block text-sm text-slate-300">Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} required />
        </label>
        <button type="submit" disabled={busy} className="mt-5 w-full rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in to Platform'}
        </button>
      </form>
    </div>
  );
}
