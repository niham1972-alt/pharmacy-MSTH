import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesReturnsApi } from '../api/sales-returns.api';
import type { CreateReturnPayload } from '../types/sales-return.types';

export function useReturnEligibility(saleId: string | null) {
  return useQuery({ queryKey: ['returns', 'eligibility', saleId], enabled: !!saleId, queryFn: async () => (await salesReturnsApi.eligibility(saleId!)).data });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateReturnPayload) => (await salesReturnsApi.create(payload)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['returns'] }); qc.invalidateQueries({ queryKey: ['sales'] }); },
  });
}

export function useSalesReturnsList(params: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: ['returns', 'list', params], queryFn: async () => salesReturnsApi.list(params) });
}

export function useSalesReturnDetail(id: string) {
  return useQuery({ queryKey: ['returns', 'detail', id], queryFn: async () => (await salesReturnsApi.detail(id)).data });
}

export function useStoreCredit(customerId: string | null) {
  return useQuery({ queryKey: ['store-credit', customerId], enabled: !!customerId, queryFn: async () => (await salesReturnsApi.storeCredit(customerId!)).data });
}

export function useReturnReports(params: Record<string, string | undefined>) {
  const byMedicine = useQuery({ queryKey: ['returns', 'by-medicine', params], queryFn: async () => (await salesReturnsApi.byMedicine(params)).data });
  const byReason = useQuery({ queryKey: ['returns', 'by-reason', params], queryFn: async () => (await salesReturnsApi.byReason(params)).data });
  return { byMedicine, byReason };
}
