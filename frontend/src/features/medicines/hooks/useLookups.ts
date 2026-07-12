import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LookupKind, lookupsApi } from '../api/medicines.api';

export function useLookups() {
  const categories = useQuery({ queryKey: ['lookups', 'categories'], queryFn: async () => (await lookupsApi.categories()).data, staleTime: 5 * 60_000 });
  const manufacturers = useQuery({ queryKey: ['lookups', 'manufacturers'], queryFn: async () => (await lookupsApi.manufacturers()).data, staleTime: 5 * 60_000 });
  const dosageForms = useQuery({ queryKey: ['lookups', 'dosageForms'], queryFn: async () => (await lookupsApi.dosageForms()).data, staleTime: 5 * 60_000 });
  const units = useQuery({ queryKey: ['lookups', 'units'], queryFn: async () => (await lookupsApi.units()).data, staleTime: 5 * 60_000 });
  const racks = useQuery({ queryKey: ['lookups', 'racks'], queryFn: async () => (await lookupsApi.racks()).data, staleTime: 5 * 60_000 });

  return {
    categories: categories.data ?? [],
    manufacturers: manufacturers.data ?? [],
    dosageForms: dosageForms.data ?? [],
    units: units.data ?? [],
    racks: racks.data ?? [],
    isLoading: categories.isLoading || manufacturers.isLoading || dosageForms.isLoading || units.isLoading,
  };
}

export function useLookupQuery(kind: LookupKind) {
  const map = { categories: lookupsApi.categories, manufacturers: lookupsApi.manufacturers, dosageForms: lookupsApi.dosageForms, units: lookupsApi.units, racks: lookupsApi.racks };
  return useQuery({ queryKey: ['lookups', kind], queryFn: async () => (await map[kind]()).data });
}

export function useLookupMutations(kind: LookupKind) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['lookups', kind] });

  const create = useMutation({ mutationFn: (body: Record<string, unknown>) => lookupsApi.create(kind, body), onSuccess: invalidate });
  const update = useMutation({ mutationFn: (v: { id: string; body: Record<string, unknown> }) => lookupsApi.update(kind, v.id, v.body), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => lookupsApi.remove(kind, id), onSuccess: invalidate });

  return { create, update, remove };
}
