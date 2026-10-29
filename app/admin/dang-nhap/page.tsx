
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setMessage('');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      setMessage('Chưa cấu hình Supabase trên Vercel.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient(url, key);

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error || !data.user) {
        setMessage('Email hoặc mật khẩu không chính xác.');
        return;
      }

      const { data: admin, error: adminError } =
        await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle();

      if (adminError || !admin) {
        await supabase.auth.signOut();
        setMessage('Tài khoản chưa được cấp quyền quản trị.');
        return;
      }

      router.replace('/admin');
    } catch {
      setMessage('Không thể kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  async function sendResetEmail() {
    const address = email.trim();

    if (!address || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(address)) {
      setMessage('Hãy nhập email quản trị trước khi yêu cầu đặt lại mật khẩu.');
      return;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setMessage('Chưa cấu hình Supabase trên Vercel.');
      return;
    }

    setResetLoading(true);
    setMessage('');
    try {
      const supabase = createClient(url, key);
      const redirectTo = window.location.origin + '/admin/dat-lai-mat-khau';
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo,
      });
      if (error) throw error;
      setMessage('Nếu email có tài khoản, Supabase sẽ gửi liên kết đặt lại mật khẩu. Hãy mở email mới nhất.');
    } catch (error) {
      setMessage('Không thể gửi email khôi phục: ' +
        (error instanceof Error ? error.message : 'Lỗi không xác định'));
    } finally {
      setResetLoading(false);
    }
  }

  const fieldStyle = {
    width: '100%',
    padding: 13,
    marginTop: 8,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    boxSizing: 'border-box' as const,
    color: '#10263b',
    background: '#ffffff',
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#f1f5f9',
      padding: 20,
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#ffffff',
        padding: 32,
        borderRadius: 16,
        boxShadow: '0 8px 30px #00000012',
        color: '#10263b',
      }}>
        <h1 style={{ textAlign: 'center' }}>
          THANGHESTORE V3
        </h1>

        <h2 style={{ textAlign: 'center', fontSize: 20 }}>
          Đăng nhập quản trị
        </h2>

        <p style={{
          textAlign: 'center',
          color: '#64748b',
          fontSize: 14,
        }}>
          Quản lý sản phẩm, giá bán và tồn kho.
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="admin-email">
              Email quản trị
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              style={fieldStyle}
              placeholder="Nhập email quản trị"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label htmlFor="admin-password">
              Mật khẩu
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              style={fieldStyle}
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 15,
              background: loading ? '#64748b' : '#10263b',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'ĐANG KIỂM TRA...' : 'ĐĂNG NHẬP'}
          </button>

          <button
            type="button"
            onClick={() => void sendResetEmail()}
            disabled={loading || resetLoading}
            style={{
              display: 'block', margin: '16px auto 0',
              border: 0, background: 'transparent',
              color: '#0f766e', textDecoration: 'underline',
              cursor: loading || resetLoading ? 'wait' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            {resetLoading ? 'ĐANG GỬI EMAIL...' : 'QUÊN MẬT KHẨU?'}
          </button>

          {message && (
            <p role="alert" style={{
              marginTop: 16,
              color: '#b91c1c',
              fontSize: 14,
              textAlign: 'center',
            }}>
              {message}
            </p>
          )}
        </form>

        <p style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#64748b',
          marginTop: 24,
        }}>
          Hệ thống quản trị ThangHeStore V3
        </p>
      </div>
    </main>
  );
}
