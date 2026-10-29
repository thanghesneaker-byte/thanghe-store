import { NextResponse } from 'next/server';
import { parseItems, quoteCart } from '../../../lib/checkout-server';

export const dynamic = 'force-dynamic';


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
