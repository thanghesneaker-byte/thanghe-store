'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { Product } from '../lib/catalog';
import { vnd } from '../lib/catalog';
import { readCart, writeCart, reconcileCart, fetchLiveProducts, type CartItem } from '../lib/cart';

export default function DemoCheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

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

  async function validateDemoOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checking || loading || error || lines.length === 0) return;
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
      // Chỉ mô phỏng; tuyệt đối không POST đơn hàng hoặc lưu thông tin khách.
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không kiểm tra được tồn kho.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="cartPage">
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
            <p>Biểu mẫu hợp lệ, tồn kho hiện có đủ cho số lượng đã chọn.</p>
            <p><strong>Không có đơn hàng nào được tạo hoặc gửi đi.</strong></p>
            <p>Không lưu tên, số điện thoại, địa chỉ; không trừ tồn kho hoặc thu tiền.</p>
            <p>Tổng tạm tính: <strong>{vnd(subtotal)}</strong></p>
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
                <button className="solidButton" type="submit" disabled={checking}>
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
