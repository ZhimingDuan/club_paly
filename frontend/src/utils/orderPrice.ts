import { Item } from '@/types';

export const parseQty = (raw: string | number | null | undefined): number => {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().toLowerCase();
  if (!s) return NaN;
  const m = s.match(/^([\d.]+)\s*([kw])?$/i);
  if (!m) return NaN;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return NaN;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'k') return n * 1000;
  if (unit === 'w') return n * 10000;
  return n;
};

export type OrderLineInput = {
  item_id?: number;
  target_qty?: string | number;
  premium_rate?: number;
};

export const calcOrderLineEstimate = (
  line: OrderLineInput,
  itemsById: Map<number, Item>
): number => {
  if (!line.item_id) return 0;
  const item = itemsById.get(line.item_id);
  if (!item || !item.unit_qty) return 0;
  const qty = parseQty(line.target_qty);
  if (Number.isNaN(qty) || qty <= 0) return 0;
  const premium = Number(line.premium_rate ?? 1) || 1;
  return (qty / item.unit_qty) * item.unit_price * premium;
};

export const calcOrderTotalEstimate = (
  lines: OrderLineInput[] | undefined,
  items: Item[]
): number => {
  if (!lines?.length) return 0;
  const itemsById = new Map(items.map((i) => [i.id, i]));
  return lines.reduce((sum, line) => sum + calcOrderLineEstimate(line, itemsById), 0);
};
