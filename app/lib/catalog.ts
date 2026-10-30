export type Variant = {
  id: string;
  sku: string | null;
  size: string;
  color: string;
  stockQuantity: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  oldPrice: number | null;
  image: string | null;
  images: string[];
  tag: string;
  sizes: string[];
  stockBySize: Record<string, number>;
  variants: Variant[];
};

export const vnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Chuyen ket qua Supabase thanh kieu san pham su dung trong giao dien.
export function mapApiProduct(value: unknown): Product | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.slug !== 'string' ||
      typeof row.name !== 'string' || typeof row.brand !== 'string') return null;

  const price = Number(row.price_vnd);
  if (!Number.isFinite(price) || price < 0) return null;
  const old = row.compare_at_price_vnd == null ? null : Number(row.compare_at_price_vnd);
  const oldPrice = old !== null && Number.isFinite(old) && old > price ? old : null;
  const rawVariants = Array.isArray(row.product_variants) ? row.product_variants : [];
  const variants: Variant[] = rawVariants.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || item.size == null) return [];
    const size = String(item.size).trim();
    const quantity = Number(item.stock_quantity);
    if (!size || !Number.isInteger(quantity) || quantity < 0) return [];
    return [{
      id: item.id,
      sku: typeof item.sku === 'string' ? item.sku : null,
      size,
      color: typeof item.color === 'string' ? item.color : '',
      stockQuantity: quantity
    }];
  });
  const stockBySize: Record<string, number> = {};
  for (const variant of variants) {
    stockBySize[variant.size] = (stockBySize[variant.size] || 0) + variant.stockQuantity;
  }
  const sizes = Object.keys(stockBySize).sort((a, b) => Number(a) - Number(b));
  const cover = typeof row.image_url === 'string' ? row.image_url.trim() : '';
  const extraImages = Array.isArray(row.image_urls)
    ? row.image_urls.filter((u: unknown): u is string =>
        typeof u === 'string' && /^https?:\/\//i.test(u))
    : [];
  const images = [...new Set([cover, ...extraImages].filter(Boolean))].slice(0, 10);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: typeof row.category === 'string' ? row.category : 'Sneaker',
    description: typeof row.description === 'string' ? row.description : '',
    price,
    oldPrice,
    image: images[0] ?? null,
    images,
    tag: typeof row.category === 'string' ? row.category.toUpperCase() : 'SNEAKER',
    sizes,
    stockBySize,
    variants
  };
}
