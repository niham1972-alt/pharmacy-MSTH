import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../shared/auth/supabaseClient';

export type RealtimeStatus = 'live' | 'reconnecting';

const POLL_INTERVAL_MS = 60_000;

/**
 * Subscribes to stock/expiry changes so the Alerts panel updates live.
 * Falls back to 60s polling (via query invalidation) whenever the channel
 * isn't in the `SUBSCRIBED` state — spec §2.3/§21 "reconnecting" requirement.
 */
export function useDashboardRealtime(branchId: string | null): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('reconnecting');
  const queryClient = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!branchId) return;

    const invalidateAlerts = () => void queryClient.invalidateQueries({ queryKey: ['dashboard', 'alerts'] });

    const channel = supabase
      .channel(`dashboard-alerts-${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Medicine', filter: `branchId=eq.${branchId}` }, invalidateAlerts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'MedicineBatch', filter: `branchId=eq.${branchId}` }, invalidateAlerts)
      .subscribe((subStatus) => {
        setStatus(subStatus === 'SUBSCRIBED' ? 'live' : 'reconnecting');
      });

    pollRef.current = setInterval(() => {
      if (status !== 'live') invalidateAlerts();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollRef.current);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, queryClient]);

  return status;
}
