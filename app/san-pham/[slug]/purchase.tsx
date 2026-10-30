'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Product } from '../../lib/catalog';
import { addToCart } from '../../lib/cart';

export default function ProductPurchase({ product }: { product: Product }) {
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const stock = size === null ? 0 : (product.stockBySize[size] ?? 0);

  function add() {
    if (size === null || stock < 1) return;
    try {
      const updated = addToCart(product, size, Math.min(quantity, stock));
      if (!updated.some(item => item.id === product.id && item.size === size)) {
        throw new Error('Giỏ hàng không được cập nhật.');
      }
      setError('');
      setAdded(true);
    } catch {
      setAdded(false);
      setError('Không lưu được giỏ hàng trong trình duyệt. Hãy kiểm tra cài đặt trình duyệt.');
    }
  }

  return <div className="purchase">
    <strong>CHỌN SIZE EU</strong>
    <div className="sizes">
      {product.sizes.map(value => (
        <button type="button" key={value}
          disabled={(product.stockBySize[value] ?? 0) < 1}
          className={size === value ? 'selected' : ''}
          onClick={() => { setSize(value); setQuantity(1); setAdded(false); }}>
          {value}
        </button>
      ))}
    </div>
    <p className="sizeHint">
      {size !== null ? 'Tồn kho ghi nhận: ' + stock + ' đôi' : 'Vui lòng chọn size còn hàng.'}
    </p>
    {size !== null && stock > 0 && (
      <div className="purchaseQuantity">
        <span>Số lượng</span>
        <button type="button" aria-label="Giảm số lượng" disabled={quantity <= 1}
          onClick={() => { setQuantity(q => Math.max(1, q - 1)); setAdded(false); }}>−</button>
        <strong>{quantity}</strong>
        <button type="button" aria-label="Tăng số lượng" disabled={quantity >= stock}
          onClick={() => { setQuantity(q => Math.min(stock, q + 1)); setAdded(false); }}>+</button>
      </div>
    )}
    <button type="button" className="solidButton"
      disabled={size === null || stock < 1} onClick={add}>
      THÊM VÀO GIỎ HÀNG DEMO
    </button>
    {error && <p role="alert" className="cartAlert">{error}</p>}
    {added && <div className="purchaseSuccess" role="status">
      Đã thêm giày size {size} vào giỏ trên trình duyệt.
      <Link href="/gio-hang"> XEM GIỎ HÀNG →</Link>
    </div>}
  </div>;
}
