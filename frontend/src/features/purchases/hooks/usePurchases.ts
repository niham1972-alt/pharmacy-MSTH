import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { POListParams, purchasesApi } from '../api/purchases.api';

export function useSuppliers() {
  return useQuery({ queryKey: ['purchases', 'suppliers'], queryFn: async () => (await purchasesApi.suppliers()).data, staleTime: 5 * 60_000 });
}

export function usePurchaseOrders(params: POListParams) {
  return useQuery({
    queryKey: ['purchases', 'orders', params],
    queryFn: async () => {
      const res = await purchasesApi.listOrders(params);
      return { data: res.data, meta: res.meta as { page: number; limit: number; total: number; totalPages: number } };
    },
    placeholderData: keepPreviousData,
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({ queryKey: ['purchases', 'order', id], queryFn: async () => (await purchasesApi.getOrder(id!)).data, enabled: !!id });
}

export function usePendingApprovals(branchId?: string | null, enabled = true) {
  return useQuery({ queryKey: ['purchases', 'pending-approvals', branchId], queryFn: async () => (await purchasesApi.pendingApprovals(branchId)).data, enabled, refetchInterval: 30_000 });
}

export function usePurchaseSummary(branchId?: string | null) {
  return useQuery({ queryKey: ['purchases', 'summary', branchId], queryFn: async () => (await purchasesApi.summary(branchId)).data });
}

export function usePurchaseMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['purchases'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['medicines'] });
  };
  return {
    submit: useMutation({ mutationFn: (id: string) => purchasesApi.submit(id), onSuccess: invalidate }),
    approve: useMutation({ mutationFn: (id: string) => purchasesApi.approve(id), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: (v: { id: string; reason: string }) => purchasesApi.reject(v.id, v.reason), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: (v: { id: string; reason?: string }) => purchasesApi.cancel(v.id, v.reason), onSuccess: invalidate }),
    recordPayment: useMutation({ mutationFn: (v: { id: string; amount: number; method: string; referenceNumber?: string }) => purchasesApi.recordPayment(v.id, v), onSuccess: invalidate }),
  };
}
