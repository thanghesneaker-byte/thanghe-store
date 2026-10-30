'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import type { Product } from '../lib/catalog';
import { vnd } from '../lib/catalog';
import { readCart, writeCart, reconcileCart, fetchLiveProducts, type CartItem } from '../lib/cart';

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockNotice, setStockNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setItems(readCart());
    void (async () => {
      try {
        const catalog = await fetchLiveProducts(controller.signal);
        if (controller.signal.aborted) return;
        setProducts(catalog);
        const previous = readCart();
        const next = reconcileCart(previous, catalog);
        if (JSON.stringify(previous) !== JSON.stringify(next)) {
          setStockNotice('Giỏ hàng đã được cập nhật theo tồn kho hoặc trạng thái bán hiện tại.');
          writeCart(next);
        }
        setItems(next);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Không tải được sản phẩm.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  function change(id: string, size: string, amount: number) {
    const product = products.find(p => p.id === id);
    const max = product?.stockBySize[size] ?? 0;
    const next = items.map(item => {
      if (item.id !== id || item.size !== size) return item;
      return { ...item, qty: Math.max(0, Math.min(max, item.qty + amount)) };
    }).filter(item => item.qty > 0);
    setItems(writeCart(next));
  }

  const cartLines = items.flatMap(item => {
    const product = products.find(p => p.id === item.id);
    return product ? [{ ...item, product }] : [];
  });
  const amount = cartLines.reduce((sum, item) => sum + item.qty * item.product.price, 0);
  const count = cartLines.reduce((sum, item) => sum + item.qty, 0);

  return (
    <main className="cartPage">
      <div className="wrap">
        <div className="cartNav">
          <Link href="/">← Tiếp tục mua giày</Link>
          <strong>THANGHESTORE V3</strong>
        </div>
        <p className="cartDemoNote">BẢN THỬ NGHIỆM — CHƯA NHẬN ĐƠN HÀNG THẬT</p>
        <h1>GIỎ HÀNG <span>({count})</span></h1>
        {loading && <p>Đang kiểm tra tồn kho từ Supabase...</p>}
        {error && <p role="alert" className="cartAlert">{error} Vui lòng tải lại trang.</p>}
        {stockNotice && <p role="status" className="cartAlert">{stockNotice}</p>}
        {!loading && !error && cartLines.length === 0 && (
          <div className="cartEmptyPage">
            <ShoppingBag size={46} />
            <h2>Giỏ hàng chưa có sản phẩm</h2>
            <p>Hãy chọn một đôi giày và size còn hàng để thử đặt hàng.</p>
            <Link className="solidButton" href="/#products">KHÁM PHÁ GIÀY <ArrowRight size={16}/></Link>
          </div>
        )}
        {!loading && !error && cartLines.length > 0 && (
          <div className="cartColumns">
            <section aria-label="Sản phẩm trong giỏ hàng" className="cartLines">
              {cartLines.map(item => (
                <article className="cartLine" key={item.id + ':' + item.size}>
                  {item.product.image
                    ? <img src={item.product.image} alt={item.product.name}/>
                    : <div className="cartPlaceholder">Chưa có ảnh</div>}
                  <div className="cartLineInfo">
                    <Link href={'/san-pham/' + encodeURIComponent(item.product.slug)}>
                      <strong>{item.product.name}</strong>
                    </Link>
                    <small>Size EU {item.size} · Còn {item.product.stockBySize[item.size] ?? 0} đôi</small>
                    <b>{vnd(item.product.price)}</b>
                    <div className="cartQuantity" aria-label="Điều chỉnh số lượng">
                      <button type="button" aria-label="Giảm số lượng" onClick={() => change(item.id, item.size, -1)}><Minus size={15}/></button>
                      <span>{item.qty}</span>
                      <button type="button" aria-label="Tăng số lượng"
                        disabled={item.qty >= (item.product.stockBySize[item.size] ?? 0)}
                        onClick={() => change(item.id, item.size, 1)}><Plus size={15}/></button>
                    </div>
                  </div>
                  <button type="button" className="cartRemove"
                    aria-label={'Xóa ' + item.product.name + ' size ' + item.size}
                    onClick={() => change(item.id, item.size, -item.qty)}><Trash2 size={18}/></button>
                </article>
              ))}
            </section>
            <aside className="cartSummary">
              <h2>TÓM TẮT GIỎ HÀNG</h2>
              <p>Sản phẩm <strong>{count} đôi</strong></p>
              <p>Tạm tính <strong>{vnd(amount)}</strong></p>
              <p>Phí vận chuyển <strong>Chưa tính</strong></p>
              <hr/>
              <p className="cartSummaryTotal">Tổng tạm tính <strong>{vnd(amount)}</strong></p>
              <Link className="solidButton" href="/thanh-toan">
                TIẾP TỤC ĐẶT HÀNG DEMO <ArrowRight size={17}/>
              </Link>
              <small>Không giữ hàng, không thanh toán và không tạo đơn thật.</small>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
