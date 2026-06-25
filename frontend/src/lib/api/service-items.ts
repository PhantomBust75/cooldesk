import { apiClient } from '@/lib/api/client';
import type { ServiceItem } from '@/types/operations';

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Number(value); return Number.isNaN(n) ? fallback : n; }
  return fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function mapServiceItem(row: UnknownRecord): ServiceItem {
  return {
    id: asString(row.id),
    name: asString(row.name),
    pricingType: (asString(row.pricing_type) as ServiceItem['pricingType']) || 'fixed',
    unitPrice: asNumber(row.unit_price),
    unitLabel: asNullableString(row.unit_label),
    createdAt: asString(row.created_at),
  };
}

export async function fetchServiceItems(): Promise<ServiceItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>('/service-items');
  return rows.map(mapServiceItem);
}

export type CreateServiceItemInput = {
  name: string;
  pricingType: 'fixed' | 'variable';
  unitPrice: number;
  unitLabel?: string;
};

export async function createServiceItem(input: CreateServiceItemInput): Promise<ServiceItem> {
  const row = await apiClient.post<UnknownRecord>('/service-items', {
    name: input.name,
    pricingType: input.pricingType,
    unitPrice: input.unitPrice,
    unitLabel: input.unitLabel,
  });
  return mapServiceItem(row);
}

export function updateServiceItem(id: string, input: Partial<CreateServiceItemInput>): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(`/service-items/${id}`, {
    name: input.name,
    pricingType: input.pricingType,
    unitPrice: input.unitPrice,
    unitLabel: input.unitLabel,
  });
}

export function deleteServiceItem(id: string): Promise<{ ok: true }> {
  return apiClient.delete<{ ok: true }>(`/service-items/${id}`);
}
