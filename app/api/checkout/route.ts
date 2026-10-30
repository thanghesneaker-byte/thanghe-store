import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseItems } from '../../lib/checkout-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TWO independent server-side switches, both OFF by default.
// Never use NEXT_PUBLIC_ flags for enabling paid/real actions.
const enabled = () => process.env.STORE_REAL_CHECKOUT_ENABLED === 'true' &&
  process.env.STORE_CHECKOUT_LIVE_APPROVED === 'true';

function reply(body: object, status = 200) {
  return NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
}

function requestOriginOk(request: Request) {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}

export async function GET() {
  // A boolean status only. Never expose configuration values or secrets.
  return reply({ mode: enabled() ? 'live' : 'demo', accepts_real_orders: enabled() });
}

export async function POST(request: Request) {
  if (!enabled()) {
    return reply({
      ok: false, message: 'Nhận đơn thật đang khóa. Website vẫn ở chế độ DEMO.',
    }, 503);
  }
  if (!requestOriginOk(request)) return reply({ ok: false, message: 'Forbidden origin' }, 403);
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
    return reply({ ok: false, message: 'Only JSON is accepted' }, 415);
  }
  if (Number(request.headers.get('content-length') || 0) > 12000) {
    return reply({ ok: false, message: 'Payload too large' }, 413);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!url || !secretKey || !turnstileSecret) {
    // Fail closed even if both feature flags were accidentally enabled.
    return reply({ ok: false, message: 'Live checkout chưa đủ cấu hình bảo mật.' }, 503);
  }

  try {
    const raw = await request.text();
    if (raw.length > 12000) return reply({ ok: false, message: 'Payload too large' }, 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object') return reply({ ok: false }, 400);
    const data = body as Record<string, unknown>;
    if (data.website) return reply({ ok: false, message: 'Rejected' }, 400);
    const items = parseItems(data.items);
    if (!items) return reply({ ok: false, message: 'Giỏ hàng không hợp lệ.' }, 400);
    const customer = data.customer;
    if (!customer || typeof customer !== 'object') {
      return reply({ ok: false, message: 'Thiếu thông tin người nhận.' }, 400);
    }
    const c = customer as Record<string, unknown>;
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    const phone = typeof c.phone === 'string' ? c.phone.trim() : '';
    const address = typeof c.address === 'string' ? c.address.trim() : '';
    const note = typeof c.note === 'string' ? c.note.trim() : '';
    if (name.length < 2 || name.length > 120 ||
        !/^0[0-9]{9}$/.test(phone) ||
        address.length < 10 || address.length > 500 ||
        note.length > 500) {
      return reply({ ok: false, message: 'Thông tin khách hàng chưa hợp lệ.' }, 400);
    }
    const requestId = data.request_id;
    if (typeof requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return reply({ ok: false, message: 'Thiếu mã yêu cầu hợp lệ.' }, 400);
    }
    const token = data.turnstile_token;
    if (typeof token !== 'string' || token.length < 10 || token.length > 2048) {
      return reply({ ok: false, message: 'Cần xác minh chống bot.' }, 403);
    }

    // Verify anti-bot token server-side before handling any personal data.
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: token }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });
    if (!verify.ok) return reply({ ok: false, message: 'Không xác minh được bảo mật.' }, 503);
    const antiBot: unknown = await verify.json();
    if (!antiBot || typeof antiBot !== 'object') {
      return reply({ ok: false, message: 'Xác minh bảo mật không hợp lệ.' }, 403);
    }
    const checked = antiBot as { success?: boolean; hostname?: string };
    if (checked.success !== true ||
        checked.hostname !== new URL(request.url).hostname) {
      return reply({ ok: false, message: 'Xác minh chống bot thất bại.' }, 403);
    }

    const db = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Transaction, price, live stock and idempotency handled entirely in SQL.
    const { data: order, error } = await db.rpc('store_v3_place_checkout', {
      p_request_id: requestId,
      p_name: name,
      p_phone: phone,
      p_address: address,
      p_note: note,
      p_items: items,
    });
    if (error) {
      // Avoid revealing internal SQL messages or customer information publicly.
      return reply({ ok: false, message: 'Chưa thể tạo đơn. Hãy kiểm tra size, giá và thử lại.' }, 409);
    }
    if (!order || typeof order !== 'object' || typeof order.id !== 'string') {
      return reply({ ok: false, message: 'Không nhận được xác nhận đặt hàng.' }, 500);
    }
    return reply({
      ok: true, order_id: order.id, total_vnd: order.total_vnd,
      status: 'pending', payment_collected: false,
    }, 201);
  } catch {
    return reply({ ok: false, message: 'Yêu cầu chưa hoàn tất. Hãy thử lại.' }, 400);
  }
}
