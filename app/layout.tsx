import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'FX Project — Script Repository',
  description: 'Upload, bagikan, dan unduh script bot dalam format ZIP. Dibuat oleh KyZX.',
  applicationName: 'FX Project',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body><header className="topbar"><Link href="/" className="brand"><span className="brand-mark">FX</span><span>FX PROJECT<span className="brand-dot">.</span><small> SCRIPT REPOSITORY</small></span></Link><SiteNav /></header>{children}<footer className="footer"><span>© {new Date().getFullYear()} FX PROJECT</span><span>CRAFTED BY <strong>KyZX</strong> · BUILT TO SHARE.</span></footer></body></html>
}
