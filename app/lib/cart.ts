import type { Product } from './catalog';

export const CART_STORAGE = 'thanghestore-v3-supabase-cart-v1';
export const CART_CHANGED = 'thanghestore:cart-changed';
export type CartItem = { id: string; size: string; qty: number };

export function sanitizeCart(input: unknown): CartItem[] {
  if (!Array.isArray(input)) return [];
  const combined = new Map<string, CartItem>();
  for (const value of input.slice(0, 100)) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || row.id.length > 100 ||
        typeof row.size !== 'string' || row.size.length > 12 ||
        (typeof row.qty !== 'number') || !Number.isInteger(row.qty) || row.qty < 1) continue;
    const key = JSON.stringify([row.id, row.size]);
    const previous = combined.get(key);
    combined.set(key, {
      id: row.id, size: row.size,
      qty: Math.min(99, (previous?.qty ?? 0) + Number(row.qty))
    });
  }
  return [...combined.values()].slice(0, 50);
}

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return sanitizeCart(JSON.parse(window.localStorage.getItem(CART_STORAGE) || '[]'));
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): CartItem[] {
  const next = sanitizeCart(items);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CART_STORAGE, JSON.stringify(next));
    window.dispatchEvent(new Event(CART_CHANGED));
  }
  return next;
}

export function addToCart(product: Product, size: string, qty = 1): CartItem[] {
  const stock = product.stockBySize[size] ?? 0;
  if (stock < 1 || !Number.isInteger(qty) || qty < 1) return readCart();
  const next = readCart();
  const match = next.find(item => item.id === product.id && item.size === size);
  if (match) match.qty = Math.min(stock, match.qty + qty);
  else next.push({ id: product.id, size, qty: Math.min(stock, qty) });
  return writeCart(next);
}

export function reconcileCart(items: CartItem[], products: Product[]): CartItem[] {
  return sanitizeCart(items).flatMap(item => {
    const product = products.find(p => p.id === item.id);
    const stock = product?.stockBySize[item.size] ?? 0;
    return stock > 0 ? [{ ...item, qty: Math.min(item.qty, stock) }] : [];
  });
}

export async function fetchLiveProducts(signal?: AbortSignal): Promise<Product[]> {
  const { mapApiProduct } = await import('./catalog');
  const response = await fetch('/api/products', { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Không tải được danh mục sản phẩm.');
  const json: unknown = await response.json();
  if (!json || typeof json !== 'object' || (json as { ok?: boolean }).ok !== true) {
    throw new Error('Dữ liệu danh mục không hợp lệ.');
  }
  const rows = (json as { products?: unknown }).products;
  if (!Array.isArray(rows)) throw new Error('Danh sách sản phẩm không hợp lệ.');
  return rows.map(mapApiProduct).filter((p): p is Product => p !== null);
}
