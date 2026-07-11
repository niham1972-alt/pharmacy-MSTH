import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseReturnsApi } from '../api/purchase-returns.api';
import type { CreateReturnPayload, SettlementStatus } from '../types/purchase-return.types';

export function useReturnableItems(grnId: string | null) {
  return useQuery({ queryKey: ['purchase-returns', 'returnable', grnId], enabled: !!grnId, queryFn: async () => (await purchaseReturnsApi.returnableItems(grnId!)).data });
}
export function useGrnList() {
  return useQuery({ queryKey: ['purchase-returns', 'grns'], queryFn: async () => (await purchaseReturnsApi.listGrns()).data });
}
export function useCreatePurchaseReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateReturnPayload) => (await purchaseReturnsApi.create(payload)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-returns'] }); qc.invalidateQueries({ queryKey: ['batches'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); },
  });
}
export function usePurchaseReturnsList(params: Record<string, string | number | undefined>, pending = false) {
  return useQuery({ queryKey: ['purchase-returns', 'list', pending, params], queryFn: async () => (pending ? purchaseReturnsApi.pending(params) : purchaseReturnsApi.list(params)) });
}
export function usePurchaseReturnDetail(id: string) {
  return useQuery({ queryKey: ['purchase-returns', 'detail', id], queryFn: async () => (await purchaseReturnsApi.detail(id)).data });
}
export function useUpdateSettlement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { settlementStatus: SettlementStatus; actualCreditedAmount?: number; supplierCreditNoteRef?: string; notes?: string }) => (await purchaseReturnsApi.updateSettlement(id, body)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-returns'] }); },
  });
}
