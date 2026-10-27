 
'use client';

import { useState, type FormEvent } from 'react';

type Product = {
  id: number;
  name: string;
  brand: string;
  price: number;
  imageUrl: string;
  description: string;
  sizes: string[];
  stock: number;
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box' as const,
  background: '#fff',
  color: '#10263b',
};

const cardStyle = {
  background: 'white',
  borderRadius: 16,
  padding: 24,
  border: '1px solid #dbe3ea',
};

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);

export default function AdminPage() {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('Nike');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [sizes, setSizes] = useState('39, 40, 41, 42, 43');
  const [stock, setStock] = useState('5');
  const [products, setProducts] = useState<Product[]>([]);
  const [notice, setNotice] = useState('');

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const priceNumber = Number(price);
    const stockNumber = Number(stock);

    if (
      !name.trim() ||
      !brand.trim() ||
      !Number.isFinite(priceNumber) ||
      priceNumber <= 0 ||
      !Number.isInteger(stockNumber) ||
      stockNumber < 0
    ) {
      setNotice('Vui lòng kiểm tra tên, thương hiệu, giá và tồn kho.');
      return;
    }

    const sizeList = sizes
      .split(/[,\s;]+/)
      .map((size) => size.trim())
      .filter(Boolean);

    if (sizeList.length === 0) {
      setNotice('Vui lòng nhập ít nhất một size.');
      return;
    }

    const product: Product = {
      id: Date.now(),
      name: name.trim(),
      brand: brand.trim(),
      price: priceNumber,
      imageUrl: imageUrl.trim(),
      description: description.trim(),
      sizes: sizeList,
      stock: stockNumber,
    };

    setProducts((previous) => [product, ...previous]);
    setName('');
    setPrice('');
    setImageUrl('');
    setDescription('');
    setNotice('Đã thêm sản phẩm vào danh sách demo. Chưa lưu Supabase.');
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      color: '#10263b',
      fontFamily: 'Arial, sans-serif',
      padding: '32px 16px',
    }}>
      <div style={{ maxWidth: 1150, margin: 'auto' }}>

        <header style={{
          background: '#10263b',
          color: 'white',
          padding: 28,
          borderRadius: 16,
          marginBottom: 24,
        }}>
          <h1 style={{ margin: 0 }}>THANGHESTORE V3</h1>
          <p>Hệ thống quản trị sản phẩm giày</p>
          <span style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '7px 12px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 'bold',
          }}>
            BẢN DEMO - CHƯA LƯU DỮ LIỆU
          </span>
        </header>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gap: 24,
          alignItems: 'start',
        }}>
          <section style={cardStyle}>
            <h2>Thêm sản phẩm giày</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Nhập thông tin sản phẩm cần đăng.
            </p>

            <form onSubmit={addProduct} style={{
              display: 'grid',
              gap: 16,
            }}>
              <label>
                <strong>Tên sản phẩm</strong>
                <input
                  style={inputStyle}
                  placeholder="Ví dụ: Nike Air Force 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label>
                <strong>Thương hiệu</strong>
                <select
                  style={inputStyle}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                >
                  <option>Nike</option>
                  <option>Adidas</option>
                  <option>MLB</option>
                  <option>Puma</option>
                  <option>New Balance</option>
                  <option>Converse</option>
                  <option>Vans</option>
                  <option>Khác</option>
                </select>
              </label>

              <label>
                <strong>Giá bán (VNĐ)</strong>
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ví dụ: 790000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </label>

              <label>
                <strong>Đường dẫn ảnh sản phẩm</strong>
                <input
                  style={inputStyle}
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </label>

              <label>
                <strong>Size giày</strong>
                <input
                  style={inputStyle}
                  value={sizes}
                  onChange={(e) => setSizes(e.target.value)}
                />
                <small>Ngăn cách các size bằng dấu phẩy.</small>
              </label>

              <label>
                <strong>Số lượng tồn kho demo</strong>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </label>

              <label>
                <strong>Mô tả sản phẩm</strong>
                <textarea
                  style={{ ...inputStyle, minHeight: 100 }}
                  placeholder="Nhập mô tả đôi giày..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <button type="submit" style={{
                padding: 15,
                background: '#10bda9',
                color: '#082f33',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}>
                + THÊM SẢN PHẨM DEMO
              </button>

              {notice && (
                <p role="status" style={{ color: '#176b61' }}>
                  {notice}
                </p>
              )}
            </form>
          </section>

          <section style={cardStyle}>
            <h2>Danh sách sản phẩm demo</h2>
            <p style={{ color: '#64748b' }}>
              Số sản phẩm trong phiên: {products.length}
            </p>

            {products.length === 0 ? (
              <div style={{
                padding: 35,
                textAlign: 'center',
                background: '#f1f5f9',
                borderRadius: 12,
              }}>
                <p>Chưa có sản phẩm demo.</p>
                <small>Hãy nhập sản phẩm ở biểu mẫu bên trái.</small>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {products.map((product) => (
                  <article key={product.id} style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 16,
                  }}>
                    {product.imageUrl && (
                      <div style={{
                        height: 180,
                        backgroundImage: `url("${product.imageUrl}")`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: '#f1f5f9',
                        borderRadius: 8,
                        marginBottom: 12,
                      }} />
                    )}

                    <h3>{product.name}</h3>
                    <p>Thương hiệu: {product.brand}</p>
                    <p><strong>{money(product.price)}</strong></p>
                    <p>Size: {product.sizes.join(', ')}</p>
                    <p>Tồn kho demo: {product.stock}</p>
                    <p>{product.description}</p>

                    <button
                      type="button"
                      onClick={() => setProducts((previous) =>
                        previous.filter((item) => item.id !== product.id)
                      )}
                      style={{
                        padding: '10px 16px',
                        border: '1px solid #ef4444',
                        borderRadius: 8,
                        background: 'white',
                        color: '#b91c1c',
                        cursor: 'pointer',
                      }}
                    >
                      Xóa khỏi danh sách demo
                    </button>
                  </article>
                ))}
              </div>
            )}

            <p style={{
              marginTop: 24,
              fontSize: 13,
              color: '#64748b',
            }}>
              Dữ liệu demo chỉ tồn tại trong bộ nhớ của trang.
              Tải lại trang sẽ làm mất danh sách thử nghiệm.
              Chưa có thao tác ghi dữ liệu vào Supabase.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
