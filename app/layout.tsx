import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ThangHeStore | Sneaker Store', description: 'Cửa hàng sneaker hiện đại - bản demo dự án độc lập.' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="vi"><body>{children}</body></html>}
