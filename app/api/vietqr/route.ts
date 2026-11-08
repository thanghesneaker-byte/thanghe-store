
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const fail = (message: string, status: number) =>
    NextResponse.json(
      { ok: false, message },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );

  const orderId = request.nextUrl.searchParams.get('orderId');

  if (!orderId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(orderId)) {
    return fail('Mã đơn không hợp lệ', 400);
  }

  const bankAccount = process.env.VIETQR_ACCOUNT_NO;
  const bankName = process.env.VIETQR_ACCOUNT_NAME;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!bankAccount || !bankName || !url || !secret) {
    return fail('Chưa cấu hình VietQR', 503);
  }

  try {
    const db = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await db
      .from('store_checkout_orders_v3')
      .select('id,total_vnd,status')
      .eq('id', orderId)
      .single();

    if (error || !data) return fail('Không tìm thấy đơn hàng', 404);
    if (data.status === 'cancelled') {
      return fail('Đơn hàng đã hủy', 409);
    }

    const amount = Number(data.total_vnd);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return fail('Số tiền không hợp lệ', 422);
    }

    const description = `THS ${data.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const params = new URLSearchParams({
      amount: String(amount),
      addInfo: description,
      accountName: bankName,
    });

    const qrUrl =
      `https://img.vietqr.io/image/TCB-${encodeURIComponent(bankAccount)}-compact2.png?${params}`;

    return NextResponse.json(
      {
        ok: true,
        order_id: data.id,
        amount_vnd: amount,
        transfer_content: description,
        qr_url: qrUrl,
        payment_collected: false,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return fail('Không thể tạo thông tin thanh toán', 500);
  }
}
