'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { Product } from '../lib/catalog';
import { vnd } from '../lib/catalog';
import { readCart, writeCart, reconcileCart, fetchLiveProducts, type CartItem } from '../lib/cart';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function DemoCheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [verifiedTotal, setVerifiedTotal] = useState<number | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [turnstileWarning, setTurnstileWarning] = useState('');
  const turnstileBoxRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  useEffect(() => {
    const controller = new AbortController();
    setItems(readCart());
    void (async () => {
      try {
        const catalog = await fetchLiveProducts(controller.signal);
        if (controller.signal.aborted) return;
        const current = readCart();
        const valid = reconcileCart(current, catalog);
        if (JSON.stringify(current) !== JSON.stringify(valid)) {
          writeCart(valid);
          setError('Tồn kho hoặc trạng thái sản phẩm đã thay đổi. Vui lòng kiểm tra giỏ hàng trước khi tiếp tục.');
        }
        setProducts(catalog);
        setItems(valid);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Không thể kiểm tra tồn kho.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const lines = items.flatMap(item => {
    const product = products.find(p => p.id === item.id);
    return product ? [{ ...item, product }] : [];
  });
  const subtotal = lines.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  useEffect(() => {
    if (!turnstileLoaded || !turnstileSiteKey || loading || error || done || lines.length === 0) return;
    const container = turnstileBoxRef.current;
    const turnstile = window.turnstile;
    if (!container || !turnstile) return;

    let widgetId: string;
    try {
      widgetId = turnstile.render(container, {
        sitekey: turnstileSiteKey,
        callback: (token) => {
          setTurnstileWarning('');
          setTurnstileToken(token);
        },
        'expired-callback': () => {
          setTurnstileToken('');
          setTurnstileWarning('Xác minh đã hết hạn. Vui lòng xác minh lại.');
        },
        'error-callback': () => {
          setTurnstileToken('');
          setTurnstileWarning('Không thể xác minh. Vui lòng thử lại hoặc tải lại trang.');
        },
      });
      turnstileWidgetIdRef.current = widgetId;
    } catch {
      setTurnstileWarning('Không tải được Turnstile. Vui lòng tải lại trang.');
      return;
    }

    return () => {
      try { turnstile.remove(widgetId); } catch { /* Widget already removed. */ }
      turnstileWidgetIdRef.current = null;
    };
  }, [turnstileLoaded, turnstileSiteKey, loading, error, done, lines.length]);

  async function validateDemoOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checking || loading || error || !turnstileToken || lines.length === 0) return;
    const token = turnstileToken;
    setChecking(true);
    try {
      const latest = await fetchLiveProducts();
      const inCart = readCart();
      const valid = reconcileCart(inCart, latest);
      if (JSON.stringify(valid) !== JSON.stringify(inCart) || inCart.length === 0) {
        setProducts(latest);
        setItems(writeCart(valid));
        setError('Giỏ hàng đã thay đổi do tồn kho mới. Hãy kiểm tra lại giỏ hàng.');
        return;
      }
      // Chỉ gửi danh sách ID, size và số lượng. Không gửi thông tin người mua.
      const response = await fetch('/api/checkout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ items: valid, turnstile_token: token }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== 'object' ||
          (result as { ok?: boolean }).ok !== true) {
        const message = result && typeof result === 'object'
          ? (result as { message?: unknown }).message : null;
        throw new Error(typeof message === 'string'
          ? message : 'Máy chủ không xác thực được giá và tồn kho.');
      }
      const amount = (result as { total_vnd?: unknown }).total_vnd;
      if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error('Tổng tiền trả về từ máy chủ không hợp lệ.');
      }
      setVerifiedTotal(amount);
      // Giữ nguyên DEMO: không gửi PII, không INSERT đơn, không trừ kho.
      setDone(true);
    } catch (reason) {
      // Keep the demo form visible after a temporary verification failure.
      // The token is reset below, so the next attempt must be verified again.
      setTurnstileWarning(reason instanceof Error ? reason.message : 'Không kiểm tra được tồn kho.');
    } finally {
      setChecking(false);
      setTurnstileToken('');
      const widgetId = turnstileWidgetIdRef.current;
      if (widgetId) window.turnstile?.reset(widgetId);
    }
  }

  return (
    <main className="cartPage">
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setTurnstileLoaded(true)}
          onError={() => setTurnstileWarning('Không tải được dịch vụ Turnstile.')}
        />
      )}
      <div className="wrap">
        <div className="cartNav">
          <Link href="/gio-hang">← Quay lại giỏ hàng</Link>
          <strong>THANGHESTORE V3</strong>
        </div>
        <p className="cartDemoNote">CHẾ ĐỘ DEMO — KHÔNG GỬI ĐƠN, KHÔNG THU TIỀN</p>
        <h1>THÔNG TIN ĐẶT HÀNG THỬ NGHIỆM</h1>
        {loading && <p>Đang kiểm tra sản phẩm và tồn kho...</p>}
        {error && <p role="alert" className="cartAlert">{error} <Link href="/gio-hang">Kiểm tra giỏ hàng</Link></p>}
        {!loading && !error && lines.length === 0 && (
          <p>Giỏ hàng trống. <Link href="/#products">Chọn giày để thử đặt hàng →</Link></p>
        )}
        {done ? (
          <section className="demoReceipt" role="status">
            <ShieldCheck size={38}/>
            <h2>ĐÃ KIỂM TRA ĐƠN DEMO</h2>
            <p>Biểu mẫu hợp lệ. Máy chủ đã đối chiếu giá và tồn kho hiện tại với Supabase.</p>
            <p><strong>Không có đơn hàng nào được tạo hoặc gửi đi.</strong></p>
            <p>Không lưu tên, số điện thoại, địa chỉ; không trừ tồn kho hoặc thu tiền.</p>
            <p>Tổng tạm tính do máy chủ xác nhận: <strong>{vnd(verifiedTotal ?? subtotal)}</strong></p>
            <Link className="solidButton" href="/gio-hang">QUAY LẠI GIỎ HÀNG</Link>
          </section>
        ) : !loading && !error && lines.length > 0 && (
          <div className="cartColumns">
            <section className="demoFormBox">
              <h2>THÔNG TIN NGƯỜI NHẬN (DEMO)</h2>
              <p>Chỉ để thử giao diện. Đừng nhập thông tin cá nhân thật. Dữ liệu không gửi lên máy chủ.</p>
              <form onSubmit={e => void validateDemoOrder(e)}>
                <label>Họ và tên
                  <input name="name" required minLength={2} maxLength={100} autoComplete="off" placeholder="Khách hàng Demo"/>
                </label>
                <label>Số điện thoại (10 chữ số)
                  <input name="phone" required inputMode="numeric" pattern="0[0-9]{9}"
                    title="Nhập số điện thoại gồm 10 chữ số bắt đầu bằng 0"
                    autoComplete="off" placeholder="0900000000"/>
                </label>
                <label>Địa chỉ giao hàng thử nghiệm
                  <textarea name="address" required minLength={10} maxLength={300}
                    autoComplete="off" placeholder="Địa chỉ giả lập để kiểm tra biểu mẫu"/>
                </label>
                <label>Ghi chú (không bắt buộc)
                  <textarea name="note" maxLength={300} autoComplete="off"
                    placeholder="Ví dụ: giao buổi chiều (demo)"/>
                </label>
                <div style={{ margin: '16px 0' }}>
                  <p><strong>Xác minh chống bot (Cloudflare Turnstile)</strong></p>
                  {turnstileSiteKey ? (
                    <>
                      <div ref={turnstileBoxRef} aria-label="Cloudflare Turnstile" />
                      {!turnstileLoaded && <small>Đang tải bước xác minh...</small>}
                      {turnstileWarning && <p role="alert" className="cartAlert">{turnstileWarning}</p>}
                    </>
                  ) : (
                    <p role="alert" className="cartAlert">Turnstile chưa được cấu hình cho bản thử nghiệm.</p>
                  )}
                </div>
                <button className="solidButton" type="submit"
                  disabled={checking || !turnstileToken || !turnstileSiteKey}>
                  {checking ? 'ĐANG KIỂM TRA TỒN KHO...' : 'KIỂM TRA ĐƠN HÀNG DEMO'} <ArrowRight size={16}/>
                </button>
              </form>
            </section>
            <aside className="cartSummary">
              <h2>SẢN PHẨM ĐÃ CHỌN</h2>
              {lines.map(line => (
                <p key={line.id + line.size}>
                  <span>{line.product.name} · Size {line.size} · x{line.qty}</span>
                  <strong>{vnd(line.product.price * line.qty)}</strong>
                </p>
              ))}
              <hr/>
              <p className="cartSummaryTotal"><span>Tạm tính</span><strong>{vnd(subtotal)}</strong></p>
              <small>Phí vận chuyển và phương thức thanh toán chưa được kích hoạt.
                Chưa có chức năng gửi đơn thật.</small>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
