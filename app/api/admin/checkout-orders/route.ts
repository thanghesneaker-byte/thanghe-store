import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nextStatuses: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping'],
  shipping: ['completed'],
  completed: [],
  cancelled: [],
};

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
}
function serverConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !secret) return null;
  return { url, publicKey, secret };
}

async function authorize(request: Request) {
  const config = serverConfig();
  if (!config) return null;
  const authHeader = request.headers.get('authorization') || '';
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authHeader);
  if (!match) return null;
  const publicDb = createClient(config.url, config.publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await publicDb.auth.getUser(match[1]);
  if (error || !data.user) return null;

  const db = createClient(config.url, config.secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Server-side admin membership check; never rely solely on a browser flag.
  const { data: admin, error: adminError } = await db.from('admin_users')
    .select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (adminError || !admin) return null;
  return db;
}

export async function GET(request: Request) {
  if (!serverConfig()) return response({
    ok: false, message: 'Chưa cấu hình khóa máy chủ cho quản lý đơn thật.',
  }, 503);
  const db = await authorize(request);
  if (!db) return response({ ok: false, message: 'Không có quyền quản trị.' }, 403);
  const { data, error } = await db.from('store_checkout_orders_v3')
    .select('id, customer_name, customer_phone, customer_address, note, items, total_vnd, status, created_at, updated_at')
    .order('created_at', { ascending: false }).limit(100);
  if (error) return response({
    ok: false, message: 'Không tải được danh sách. Kiểm tra xem đã chạy migration đơn hàng thật chưa.',
  }, 503);
  return response({ ok: true, orders: data || [] });
}

export async function PATCH(request: Request) {
  if (!serverConfig()) return response({ ok: false, message: 'Thiếu cấu hình máy chủ.' }, 503);
  if (!request.headers.get('origin') ||
      request.headers.get('origin') !== new URL(request.url).origin) {
    return response({ ok: false, message: 'Yêu cầu không hợp lệ.' }, 403);
  }
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) {
    return response({ ok: false, message: 'Chỉ nhận JSON.' }, 415);
  }
  const db = await authorize(request);
  if (!db) return response({ ok: false, message: 'Không có quyền quản trị.' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 2048) {
    return response({ ok: false, message: 'Dữ liệu quá lớn.' }, 413);
  }

  try {
    const raw = await request.text();
    if (raw.length > 2048) return response({ ok: false }, 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object') return response({ ok: false }, 400);
    const v = body as Record<string, unknown>;
    if (typeof v.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id) ||
        typeof v.expected !== 'string' ||
        typeof v.next !== 'string' ||
        !nextStatuses[v.expected]?.includes(v.next)) {
      return response({ ok: false, message: 'Chuyển trạng thái không hợp lệ.' }, 400);
    }
    const { data, error } = await db.rpc('store_v3_transition_checkout', {
      p_order_id: v.id,
      p_expected_status: v.expected,
      p_next_status: v.next,
    });
    if (error || data !== v.next) {
      return response({
        ok: false,
        message: 'Không thể xác nhận. Đơn có thể đã đổi trạng thái hoặc không đủ tồn kho. Tải lại và kiểm tra.',
      }, 409);
    }
    return response({ ok: true, status: data });
  } catch {
    return response({ ok: false, message: 'Yêu cầu không hợp lệ.' }, 400);
  }
}
