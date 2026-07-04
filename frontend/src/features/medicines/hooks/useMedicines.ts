import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MedicineListParams, medicinesApi } from '../api/medicines.api';
import { MedicineFormValues, MedicineSearchResult } from '../types/medicine.types';

export function useMedicinesList(params: MedicineListParams) {
  return useQuery({
    queryKey: ['medicines', 'list', params],
    queryFn: async () => {
      const res = await medicinesApi.list(params);
      return { data: res.data, meta: res.meta as { page: number; limit: number; total: number; totalPages: number } };
    },
    placeholderData: keepPreviousData,
  });
}

export function useMedicineDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['medicines', 'detail', id],
    queryFn: async () => (await medicinesApi.getById(id!)).data,
    enabled: !!id,
  });
}

export function usePriceHistory(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['medicines', 'price-history', id],
    queryFn: async () => (await medicinesApi.priceHistory(id!)).data,
    enabled: !!id && enabled,
  });
}

/** Debounced typeahead search — shared with future POS (Module 4). */
export function useMedicineSearch(term: string, branchId?: string | null) {
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(h);
  }, [term]);

  return useQuery<MedicineSearchResult[]>({
    queryKey: ['medicines', 'search', debounced, branchId],
    queryFn: async () => (await medicinesApi.search(debounced, branchId)).data,
    enabled: debounced.trim().length >= 2,
  });
}

export function useMedicineMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['medicines'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const create = useMutation({ mutationFn: (body: MedicineFormValues) => medicinesApi.create(body), onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (v: { id: string; body: Partial<MedicineFormValues> & { priceChangeReason?: string } }) => medicinesApi.update(v.id, v.body),
    onSuccess: invalidate,
  });
  const changeStatus = useMutation({ mutationFn: (v: { id: string; status: string; reason?: string }) => medicinesApi.changeStatus(v.id, v.status, v.reason), onSuccess: invalidate });
  const archive = useMutation({ mutationFn: (id: string) => medicinesApi.archive(id), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => medicinesApi.remove(id), onSuccess: invalidate });

  return { create, update, changeStatus, archive, remove };
}
