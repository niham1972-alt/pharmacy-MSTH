import { useEffect, useState } from 'react';
import { platformClient } from '../api/client';
import { clearImpersonation, getImpersonation } from '../impersonation/session';

/**
 * Mandatory, impossible-to-miss banner shown at the very top of the tenant-facing
 * app whenever THIS tab is running under an impersonation token. Renders nothing
 * otherwise. Shows the pharmacy + user being viewed and a live countdown to the
 * hard 30-minute expiry, with an always-visible "End Impersonation" that actually
 * terminates the session server-side (via the real platform-staff session) and
 * returns to the platform-app. On expiry it force-ends automatically.
 */
function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function ImpersonationBanner() {
  const session = getImpersonation();
  const [remaining, setRemaining] = useState(() => (session ? new Date(session.expiresAt).getTime() - Date.now() : 0));
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setRemaining(new Date(session.expiresAt).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [session?.sessionId]);

  useEffect(() => {
    if (session && remaining <= 0 && !ending) void end(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  if (!session) return null;

  const end = async (expired = false) => {
    setEnding(true);
    try {
      // Uses the REAL platform-staff session (platformClient), not the impersonation token.
      await platformClient.post(`/platform/impersonation/${session.sessionId}/end`);
    } catch {
      /* even if the call fails, we still leave the impersonated context */
    }
    clearImpersonation();
    const back = session.returnTo || '/platform-admin';
    window.location.href = `${back}${expired ? '?impExpired=1' : '?impEnded=1'}`;
  };

  return (
    <div role="alert" className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-black shadow-md">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-base">👁️</span>
        <span>
          You are viewing this as <strong>{session.pharmacyName}</strong> — <strong>{session.userName}</strong>. Impersonation active.
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded bg-black/15 px-2 py-0.5 font-mono tabular-nums" title="Time until this session hard-expires">
          ends in {fmt(remaining)}
        </span>
        <button
          type="button"
          onClick={() => void end(false)}
          disabled={ending}
          className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {ending ? 'Ending…' : 'End Impersonation'}
        </button>
      </div>
    </div>
  );
}
