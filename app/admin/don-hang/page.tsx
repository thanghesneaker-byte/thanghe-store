'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type OrderStatus = 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled';
type OrderItem = { name: string; size: string; quantity: number; price_vnd: number };
type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  note: string;
  items: OrderItem[];
  total_vnd: number;
  status: OrderStatus;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

const STATUS: Record<OrderStatus, { label: string; color: string; background: string }> = {
  pending: { label: 'Chờ xác nhận', color: '#92400e', background: '#fef3c7' },
  confirmed: { label: 'Đã xác nhận', color: '#075985', background: '#e0f2fe' },
  shipping: { label: 'Đang giao', color: '#5b21b6', background: '#ede9fe' },
  completed: { label: 'Hoàn thành', color: '#166534', background: '#dcfce7' },
  cancelled: { label: 'Đã hủy', color: '#991b1b', background: '#fee2e2' },
};
const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
const FIELDS = 'id, customer_name, customer_phone, customer_address, note, items, total_vnd, status, is_demo, created_at, updated_at';

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Chưa cấu hình Supabase trên Vercel.');
  return createClient(url, key);
}
function cash(v: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(v);
}
function dateTime(v: string) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
    }).format(new Date(v));
  } catch {
    return v;
  }
}
function readableError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Có lỗi không xác định.';
}

const card: CSSProperties = {
  background: 'white', border: '1px solid #d9e4ed',
  borderRadius: 14, padding: 22,
};
const button: CSSProperties = {
  background: '#10273c', color: 'white', border: 0, borderRadius: 8,
  fontWeight: 700, padding: '10px 15px', cursor: 'pointer',
};

export default function AdminOrdersPage() {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const supabase = getClient();
      const { data, error: requestError } = await supabase
        .from('store_orders_v3')
        .select(FIELDS)
        .order('created_at', { ascending: false })
        .limit(100);
      if (requestError) throw requestError;
      setOrders((data ?? []) as OrderRow[]);
    } catch (cause) {
      setError('Không tải được đơn hàng. ' + readableError(cause) +
        ' Nếu chưa chạy SQL tạo bảng store_orders_v3, hãy hoàn tất bước thiết lập Supabase.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error('Chưa đăng nhập.');
        const { data: admin, error: adminError } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', auth.user.id)
          .maybeSingle();
        if (adminError || !admin) throw new Error('Không có quyền quản trị.');
        if (cancelled) return;
        setAccess('allowed');
        await load();
      } catch (cause) {
        if (!cancelled) {
          setAccess('denied');
          setLoading(false);
          setError(readableError(cause));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function createDemoOrder() {
    if (workingId || access !== 'allowed') return;
    if (!window.confirm('Tạo một đơn hàng DEMO giả lập? Đơn này không gửi khách, không trừ kho và không thu tiền.')) return;
    setWorkingId('create');
    setNotice('');
    try {
      const supabase = getClient();
      const { error: insertError } = await supabase
        .from('store_orders_v3')
        .insert({
          customer_name: 'Khách hàng DEMO',
          customer_phone: '0000000000',
          customer_address: 'Địa chỉ giả lập — không giao hàng',
          note: 'Dữ liệu thử nghiệm. Không phải đơn của khách.',
          items: [{ name: 'Sản phẩm minh họa', size: '39', quantity: 1, price_vnd: 795000 }],
          total_vnd: 795000,
          status: 'pending',
          is_demo: true,
        });
      if (insertError) throw insertError;
      await load(true);
      setNotice('Đã tạo đơn minh họa. Không có đơn thật được gửi, không trừ tồn kho.');
    } catch (cause) {
      setError('Không tạo được đơn demo: ' + readableError(cause));
    } finally {
      setWorkingId(null);
    }
  }

  async function updateStatus(order: OrderRow, next: OrderStatus) {
    if (!ORDER_NEXT[order.status].includes(next) || workingId) return;
    const label = STATUS[next].label;
    if (!window.confirm(
      'Cập nhật đơn DEMO #' + order.id.slice(0, 8).toUpperCase() +
      ' sang "' + label + '"?\nThao tác này KHÔNG trừ kho, giao hàng hoặc thu tiền.'
    )) return;
    setWorkingId(order.id);
    setNotice('');
    setError('');
    try {
      const supabase = getClient();
      const { data, error: updateError } = await supabase
        .from('store_orders_v3')
        .update({ status: next })
        .eq('id', order.id)
        .eq('status', order.status)
        .eq('is_demo', true)
        .select(FIELDS)
        .single();
      if (updateError || !data) {
        throw new Error(updateError?.message || 'Đơn hàng đã thay đổi; hãy tải lại danh sách.');
      }
      setOrders(current => current.map(row =>
        row.id === order.id ? data as OrderRow : row
      ));
      setNotice('Đã cập nhật trạng thái đơn DEMO. Không có tác động đến tồn kho.');
    } catch (cause) {
      setError('Không cập nhật được trạng thái: ' + readableError(cause));
      await load(true);
    } finally {
      setWorkingId(null);
    }
  }

  const search = query.trim().toLocaleLowerCase('vi-VN');
  const shown = orders.filter(o =>
    (filter === 'all' || o.status === filter) &&
    [o.id, o.customer_name, o.customer_phone].some(v =>
      v.toLocaleLowerCase('vi-VN').includes(search))
  );
  const counts: Record<OrderStatus, number> = {
    pending: 0, confirmed: 0, shipping: 0, completed: 0, cancelled: 0,
  };
  orders.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });

  return (
    <main style={{
      minHeight: '100vh', background: '#f1f5f9', color: '#10273c',
      padding: '30px 16px 80px', fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <header style={{
          background: '#10273c', color: 'white', borderRadius: 14,
          padding: 26, marginBottom: 22,
        }}>
          <p style={{ marginTop: 0, fontSize: 13, letterSpacing: 1 }}>
            THANGHESTORE V3 · QUẢN TRỊ
          </p>
          <h1 style={{ margin: '8px 0 12px', fontSize: 30 }}>Quản lý đơn hàng</h1>
          <p style={{ color: '#bcece5', fontSize: 14 }}>
            KHU VỰC DEMO — CHƯA NHẬN ĐƠN THẬT, KHÔNG TRỪ TỒN KHO
          </p>
          <Link href="/admin" style={{
            color: '#10273c', display: 'inline-block',
            background: '#44e2cc', padding: '10px 14px',
            borderRadius: 8, fontWeight: 700, textDecoration: 'none',
          }}>
            ← Về quản lý sản phẩm
          </Link>
          <Link href="/admin/don-hang-that" style={{
            color: '#10273c', display: 'inline-block', marginLeft: 12,
            marginTop: 8, background: '#fee2e2', padding: '10px 14px',
            borderRadius: 8, fontWeight: 700, textDecoration: 'none',
          }}>
            Đơn hàng thật (chưa bật) →
          </Link>
        </header>
        {access === 'checking' && <div style={card}>Đang kiểm tra quyền quản trị...</div>}
        {access === 'denied' && (
          <section style={card}>
            <p role="alert">{error || 'Bạn chưa có quyền truy cập.'}</p>
            <Link href="/admin/dang-nhap">Đến trang đăng nhập quản trị →</Link>
          </section>
        )}
        {access === 'allowed' && (
          <>
            <section style={{ ...card, marginBottom: 18 }}>
              <h2 style={{ marginTop: 0 }}>Tổng quan 100 đơn DEMO gần nhất</h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 10, margin: '18px 0',
              }}>
                {(Object.keys(STATUS) as OrderStatus[]).map(status => (
                  <div key={status} style={{
                    background: STATUS[status].background,
                    borderRadius: 9, padding: 14,
                    color: STATUS[status].color,
                  }}>
                    <div style={{ fontSize: 13 }}>{STATUS[status].label}</div>
                    <strong style={{ fontSize: 25 }}>{counts[status]}</strong>
                  </div>
                ))}
              </div>
              <button type="button" style={button} disabled={workingId !== null}
                onClick={() => void createDemoOrder()}>
                {workingId === 'create' ? 'ĐANG TẠO...' : '+ TẠO ĐƠN DEMO THỬ NGHIỆM'}
              </button>
              <button type="button" style={{
                ...button, background: '#ecf7f6', color: '#0c5b55',
                marginLeft: 10, border: '1px solid #95d4cc',
              }} disabled={workingId !== null} onClick={() => void load()}>
                TẢI LẠI DANH SÁCH
              </button>
            </section>
            {notice && <p role="status" style={{
              background: '#dcfce7', color: '#166534',
              padding: 14, borderRadius: 8,
            }}>{notice}</p>}
            {error && <p role="alert" style={{
              background: '#fee2e2', color: '#991b1b', padding: 14, borderRadius: 8,
            }}>{error}</p>}
            <section style={card}>
              <h2 style={{ marginTop: 0 }}>Danh sách đơn thử nghiệm</h2>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12, marginBottom: 17,
              }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <strong>Tìm đơn</strong>
                  <input value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Mã đơn, tên hoặc số điện thoại demo"
                    style={{ border: '1px solid #cbd5e1', padding: 12, borderRadius: 8 }}/>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <strong>Lọc trạng thái</strong>
                  <select value={filter}
                    onChange={e => setFilter(e.target.value as typeof filter)}
                    style={{ border: '1px solid #cbd5e1', padding: 12, borderRadius: 8 }}>
                    <option value="all">Tất cả trạng thái</option>
                    {(Object.keys(STATUS) as OrderStatus[]).map(s => (
                      <option value={s} key={s}>{STATUS[s].label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {loading ? <p>Đang tải đơn hàng...</p> :
                shown.length === 0 ? (
                  <p>Không có đơn DEMO phù hợp. Có thể nhấn “Tạo đơn DEMO thử nghiệm” ở trên.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    {shown.map(order => (
                      <article key={order.id} style={{
                        border: '1px solid #dae4ec', borderRadius: 12,
                        padding: 17, background: '#fff',
                      }}>
                        <div style={{
                          display: 'flex', flexWrap: 'wrap',
                          alignItems: 'center', gap: 10, justifyContent: 'space-between',
                        }}>
                          <div>
                            <strong>ĐƠN DEMO #{order.id.slice(0, 8).toUpperCase()}</strong>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                              {dateTime(order.created_at)} · {order.customer_name}
                            </div>
                          </div>
                          <span style={{
                            padding: '7px 10px', fontSize: 12,
                            fontWeight: 700, borderRadius: 20,
                            color: STATUS[order.status].color,
                            background: STATUS[order.status].background,
                          }}>
                            {STATUS[order.status].label}
                          </span>
                        </div>
                        <p><strong>Tổng giá trị minh họa: {cash(order.total_vnd)}</strong></p>
                        <button type="button" onClick={() => setExpanded(
                          expanded === order.id ? null : order.id
                        )} style={{
                          ...button, background: '#e0f2fe',
                          color: '#075985', marginRight: 10,
                        }}>
                          {expanded === order.id ? 'ẨN CHI TIẾT' : 'XEM CHI TIẾT'}
                        </button>
                        {ORDER_NEXT[order.status].map(next => (
                          <button key={next} type="button"
                            disabled={workingId !== null}
                            onClick={() => void updateStatus(order, next)}
                            style={{
                              ...button,
                              background: next === 'cancelled' ? '#b91c1c' : '#0f766e',
                              margin: '6px 8px 0 0',
                            }}>
                            {workingId === order.id ? 'ĐANG LƯU...' : STATUS[next].label}
                          </button>
                        ))}
                        {expanded === order.id && (
                          <div style={{
                            marginTop: 14, padding: 16,
                            background: '#f8fafc', borderRadius: 8,
                            overflowWrap: 'anywhere',
                          }}>
                            <p>Người nhận DEMO: {order.customer_name}</p>
                            <p>Số liên hệ DEMO: {order.customer_phone}</p>
                            <p>Địa chỉ DEMO: {order.customer_address}</p>
                            {order.note && <p>Ghi chú: {order.note}</p>}
                            <strong>Sản phẩm trong đơn:</strong>
                            <ul style={{ paddingLeft: 23 }}>
                              {Array.isArray(order.items) && order.items.map((item, index) => (
                                <li key={index}>
                                  {item.name} · Size {item.size} · SL {item.quantity} ·
                                  {cash(item.price_vnd)}
                                </li>
                              ))}
                            </ul>
                            <small>Mã nội bộ: {order.id}</small>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                Danh sách chỉ hiển thị tối đa 100 đơn mới nhất và không bao gồm
                dữ liệu ở bảng orders cũ. Các thay đổi trạng thái ở đây là mô phỏng:
                không gửi tin nhắn, không giao hàng, không thu tiền, không trừ tồn kho.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
