import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type CartLine = { id: string; size: string; qty: number };

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function parseItems(input: unknown): CartLine[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20) return null;
  const seen = new Set<string>();
  let totalQty = 0;
  const lines: CartLine[] = [];
  for (const v of input) {
    if (!v || typeof v !== 'object') return null;
    const row = v as Record<string, unknown>;
    if (typeof row.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id) ||
        typeof row.size !== 'string' || !/^[0-9A-Za-z .-]{1,12}$/.test(row.size) ||
        typeof row.qty !== 'number' || !Number.isInteger(row.qty) ||
        row.qty < 1 || row.qty > 10) return null;
    const key = row.id + ':' + row.size;
    if (seen.has(key)) return null;
    seen.add(key);
    totalQty += row.qty;
    lines.push({ id: row.id, size: row.size, qty: row.qty });
  }
  return totalQty <= 30 ? lines : null;
}

// Server-side price & availability checks. Never accept a browser-supplied price.
export async function quoteCart(input: CartLine[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase chưa được cấu hình.');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ids = [...new Set(input.map(item => item.id))];
  const { data, error } = await db.from('products')
    .select('id, name, price_vnd, product_variants(size, stock_quantity)')
    .in('id', ids)
    .eq('is_active', true)
    .is('deleted_at', null);
  if (error) throw new Error('Không kiểm tra được giá và tồn kho từ Supabase.');

  const available = new Map((data ?? []).map(row => [String(row.id), row]));
  let total = 0;
  const lines: {
    id: string; name: string; size: string;
    qty: number; unit_price_vnd: number; line_total_vnd: number;
  }[] = [];

  for (const item of input) {
    const product = available.get(item.id);
    if (!product) throw new Error('Một sản phẩm đã ẩn, bị xóa hoặc không còn bán.');
    const price = Number(product.price_vnd);
    if (!Number.isSafeInteger(price) || price <= 0) {
      throw new Error('Giá của một sản phẩm chưa hợp lệ.');
    }
    const variants = Array.isArray(product.product_variants)
      ? product.product_variants : [];
    const stock = variants.reduce((sum, variant) => {
      if (variant.size !== item.size) return sum;
      return sum + Math.max(0, Number(variant.stock_quantity) || 0);
    }, 0);
    if (stock < item.qty) throw new Error(
      'Size ' + item.size + ' của "' + product.name + '" chỉ còn ' + stock + ' đôi.'
    );
    const lineTotal = price * item.qty;
    if (!Number.isSafeInteger(lineTotal)) throw new Error('Giá trị đơn vượt giới hạn.');
    total += lineTotal;
    if (!Number.isSafeInteger(total) || total > 500000000) {
      throw new Error('Giá trị đơn vượt giới hạn thử nghiệm.');
    }
    lines.push({
      id: item.id, name: product.name, size: item.size, qty: item.qty,
      unit_price_vnd: price, line_total_vnd: lineTotal,
    });
  }
  return { total_vnd: total, lines };
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) {
      return json({ ok: false, message: 'Yêu cầu khác nguồn không được chấp nhận.' }, 403);
    }
    const length = Number(request.headers.get('content-length') ?? 0);
    if (!Number.isFinite(length) || length > 8192) {
      return json({ ok: false, message: 'Giỏ hàng vượt giới hạn.' }, 413);
    }
    const raw = await request.text();
    if (raw.length > 8192) return json({ ok: false, message: 'Dữ liệu quá lớn.' }, 413);
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return json({ ok: false }, 400);
    const cart = parseItems((data as { items?: unknown }).items);
    if (!cart) return json({ ok: false, message: 'Giỏ hàng không hợp lệ.' }, 400);
    const quote = await quoteCart(cart);
    return json({ ok: true, ...quote, mode: 'preview_only' });
  } catch (error) {
    const message = error instanceof SyntaxError
      ? 'Dữ liệu gửi lên không hợp lệ.'
      : error instanceof Error ? error.message : 'Không thể kiểm tra giỏ hàng.';
    return json({ ok: false, message }, error instanceof SyntaxError ? 400 : 422);
  }
}
