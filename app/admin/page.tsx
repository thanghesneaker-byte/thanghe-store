 
'use client';

 
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';


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
  const router = useRouter();
  const [adminStatus, setAdminStatus] =
    useState<'checking' | 'allowed'>('checking');

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('Nike');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [sizes, setSizes] = useState('39, 40, 41, 42, 43');
  const [stock, setStock] = useState('5');
  const [products, setProducts] = useState<Product[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key =
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

        if (!url || !key) {
          throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(url, key);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error('Not authenticated');
        }

        const { data: admin, error: adminError } =
          await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (adminError || !admin) {
          throw new Error('Not an administrator');
        }

        if (mounted) {
          setAdminStatus('allowed');
        }
      } catch {
        if (mounted) {
          router.replace('/admin/dang-nhap');
        }
      }
    }

    void checkAdmin();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (adminStatus !== 'allowed') {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f1f5f9',
        color: '#10263b',
      }}>
        Đang kiểm tra quyền quản trị...
      </main>
    );
  }


async function addProduct(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const priceNumber = Number(price);
  const stockNumber = Number(stock);

  if (
    !name.trim() ||
    !brand.trim() ||
    !Number.isSafeInteger(priceNumber) ||
    priceNumber <= 0 ||
    !Number.isInteger(stockNumber) ||
    stockNumber < 0
  ) {
    setNotice('Vui lòng kiểm tra tên, thương hiệu, giá và tồn kho.');
    return;
  }

  const sizeList = [
    ...new Set(
      sizes
        .split(/[,;\s]+/)
        .map((size) => size.trim())
        .filter(Boolean)
    ),
  ];

  if (sizeList.length === 0) {
    setNotice('Vui lòng nhập ít nhất một size.');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    setNotice('Thiếu cấu hình Supabase trên Vercel.');
    return;
  }

  const image = imageUrl.trim();

  if (image && !/^https?:\/\//i.test(image)) {
    setNotice('Đường dẫn ảnh phải bắt đầu bằng https:// hoặc http://');
    return;
  }

  const slugBase =
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'giay';

  const slug =
    `${slugBase}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let createdId: string | null = null;

  try {
    setNotice('Đang lưu sản phẩm vào Supabase...');

    const supabase = createClient(url, key);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const { data: admin, error: adminError } =
      await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (adminError || !admin) {
      throw new Error('Tài khoản không có quyền quản trị.');
    }

    // Tao san pham o che do an truoc
    const { data: productRow, error: productError } =
      await supabase
        .from('products')
        .insert({
          slug,
          name: name.trim(),
          brand: brand.trim(),
          category: 'Sneaker',
          description: description.trim(),
          price_vnd: priceNumber,
          image_url: image || null,
          is_active: false,
        })
        .select('id')
        .single();

    if (productError || !productRow) {
      throw new Error(
        productError?.message || 'Không tạo được sản phẩm.'
      );
    }

    const productId = String(productRow.id);
    createdId = productId;

    // Luu size va ton kho cho tung size
    const variants = sizeList.map((size, index) => ({
      product_id: productId,
      sku: `${slug}-size-${index + 1}`,
      size,
      color: '',
      stock_quantity: stockNumber,
    }));

    const { error: variantError } =
      await supabase
        .from('product_variants')
        .insert(variants);

    if (variantError) {
      throw new Error(
        'Lỗi lưu size: ' + variantError.message
      );
    }

    // Chi kich hoat sau khi luu size thanh cong
    const { data: published, error: publishError } =
      await supabase
        .from('products')
        .update({ is_active: true })
        .eq('id', productId)
        .select('id')
        .single();

    if (publishError || !published) {
      throw new Error(
        publishError?.message || 'Không thể đăng bán sản phẩm.'
      );
    }

    setName('');
    setPrice('');
    setImageUrl('');
    setDescription('');

    setNotice(
      'Đã lưu sản phẩm vào Supabase thành công! ' +
      'Sản phẩm đã được kích hoạt trên website thử nghiệm.'
    );
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : 'Lỗi không xác định.';

    setNotice(
      createdId
        ? 'Chưa hoàn tất. Sản phẩm được giữ ẩn trong Supabase. ' + detail
        : 'Không thể lưu sản phẩm. ' + detail
    );
  }
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
