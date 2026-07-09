import { apiClient } from '../../../shared/api/client';

export type SettingValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'JSON';

export interface SettingItem {
  key: string;
  label: string;
  description: string | null;
  category: string;
  valueType: SettingValueType;
  defaultValue: unknown;
  validationRule: Record<string, unknown> | null;
  scope: 'PHARMACY' | 'BRANCH';
  isSensitive: boolean;
  resolvedValue: unknown;
  isCustomized: boolean;
  branchOverride: unknown;
  pharmacyValue: unknown;
}

export interface SettingHistoryRow {
  id: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: string;
  branchId: string | null;
}

export const settingsApi = {
  list: (branchId?: string) => apiClient.get<Record<string, SettingItem[]>>(`/settings${branchId ? `?branchId=${branchId}` : ''}`),
  update: (key: string, value: unknown, branchId?: string) => apiClient.put<unknown>(`/settings/${encodeURIComponent(key)}`, { value, branchId }),
  reset: (key: string, branchId?: string) => apiClient.post<unknown>(`/settings/${encodeURIComponent(key)}/reset`, { branchId }),
  history: (key: string) => apiClient.get<SettingHistoryRow[]>(`/settings/${encodeURIComponent(key)}/history`),
};
