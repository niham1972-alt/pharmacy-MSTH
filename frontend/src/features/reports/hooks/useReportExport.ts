import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiClientError } from '../../../shared/api/client';
import { reportsApi } from '../api/reports.api';
import { ExportFormat, ReportFilters, ReportType } from '../types/reports.types';

/**
 * Shared async-export hook (spec §9). Requests an export job, then polls its
 * status until READY (auto-downloads the artifact) or FAILED. Reused by every
 * report page via <ExportButton>.
 */
export function useReportExport() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadedFor, setDownloadedFor] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['report-export', jobId],
    queryFn: async () => (await reportsApi.exportStatus(jobId as string)).data,
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'READY' || s === 'FAILED' ? false : 1200;
    },
  });

  const job = status.data;
  // Trigger the browser download exactly once when the artifact becomes ready.
  if (job?.status === 'READY' && job.fileUrl && downloadedFor !== job.id) {
    setDownloadedFor(job.id);
    const a = document.createElement('a');
    a.href = job.fileUrl;
    a.download = job.fileName ?? 'report';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const start = async (reportType: ReportType, fmt: ExportFormat, filters: ReportFilters) => {
    setError(null);
    setFormat(fmt);
    try {
      const res = await reportsApi.requestExport(reportType, fmt, filters);
      setDownloadedFor(null);
      setJobId(res.data.jobId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not start the export.');
    }
  };

  const isBusy = !!jobId && job?.status === 'GENERATING';
  return { start, isBusy, job, format, error: error ?? (job?.status === 'FAILED' ? job.error : null), reset: () => { setJobId(null); setError(null); } };
}
