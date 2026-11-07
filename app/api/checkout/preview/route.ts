import { NextResponse } from 'next/server';
import { parseItems, quoteCart } from '../../../lib/checkout-server';

export const dynamic = 'force-dynamic';

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}




export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) {
      return json({ ok: false, message: 'Yêu cầu khác nguồn không được chấp nhận.' }, 403);
    }
    if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
      return json({ ok: false, message: 'Chỉ nhận dữ liệu JSON.' }, 415);
    }
    const length = Number(request.headers.get('content-length') ?? 0);
    if (!Number.isFinite(length) || length > 8192) {
      return json({ ok: false, message: 'Giỏ hàng vượt giới hạn.' }, 413);
    }
    const raw = await request.text();
    if (raw.length > 8192) return json({ ok: false, message: 'Dữ liệu quá lớn.' }, 413);
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return json({ ok: false }, 400);

    // DEMO still never creates an order: protect only the server-side price/stock quote.
    const token = (data as { turnstile_token?: unknown }).turnstile_token;
    if (typeof token !== 'string' || token.length < 10 || token.length > 2048) {
      return json({ ok: false, message: 'Vui lòng hoàn tất xác minh chống bot.' }, 403);
    }
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      return json({ ok: false, message: 'Xác minh Turnstile chưa được cấu hình.' }, 503);
    }
    let verification: unknown;
    try {
      const checked = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }),
        cache: 'no-store',
        signal: AbortSignal.timeout(7000),
      });
      if (!checked.ok) {
        // Safe diagnostic: Cloudflare's known validation error codes only.
        // Never log the submitted token, the secret, or the raw response.
        const errorBody: unknown = await checked.json().catch(() => null);
        const reported = errorBody && typeof errorBody === 'object'
          ? (errorBody as { 'error-codes'?: unknown })['error-codes']
          : null;
        const safeCodes = new Set([
          'missing-input-secret', 'invalid-input-secret',
          'missing-input-response', 'invalid-input-response',
          'bad-request', 'timeout-or-duplicate', 'internal-error',
        ]);
        const codes = Array.isArray(reported)
          ? reported.filter((code): code is string => typeof code === 'string' && safeCodes.has(code)).slice(0, 5)
          : [];
        console.error('[THS_TURNSTILE_SITEVERIFY_HTTP]', {
          status: checked.status,
          codes,
          response_json: errorBody !== null,
        });
        return json({ ok: false, message: 'Tạm thời không xác minh được Turnstile.' }, 503);
      }
      verification = await checked.json();
    } catch (cause) {
      // Only log the error type, without request data or secrets.
      console.error('[THS_TURNSTILE_SITEVERIFY_NETWORK]', {
        type: cause instanceof Error ? cause.name : 'Unknown',
      });
      return json({ ok: false, message: 'Không kết nối được hệ thống xác minh.' }, 503);
    }
    if (!verification || typeof verification !== 'object' ||
        (verification as { success?: unknown }).success !== true ||
        (verification as { hostname?: unknown }).hostname !== new URL(request.url).hostname) {
      const details = verification as { success?: unknown; hostname?: unknown; 'error-codes'?: unknown };
      // Cloudflare error codes and public hostname only, never tokens or secrets.
      console.warn('[THS_TURNSTILE_SITEVERIFY_REJECTED]', {
        success: details.success === true,
        hostname_matches: details.hostname === new URL(request.url).hostname,
        codes: Array.isArray(details['error-codes'])
          ? details['error-codes'].filter((v): v is string => typeof v === 'string').slice(0, 6)
          : [],
      });
      return json({ ok: false, message: 'Xác minh chống bot không hợp lệ hoặc đã hết hạn.' }, 403);
    }

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
