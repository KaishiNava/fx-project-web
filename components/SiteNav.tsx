'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    function onClick(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, []);
  return <nav className="site-nav" ref={menuRef} aria-label="Navigasi utama">
    <div className="desktop-nav"><Link href="/" className="nav-link">Jelajahi</Link><Link href="/report" className="nav-link">Lapor</Link><Link href="/publish" className="button button-small"><span>＋</span> Upload Script</Link></div>
    <button type="button" className={`hamburger ${open ? 'is-open' : ''}`} aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-expanded={open} onClick={() => setOpen(v => !v)}><span/><span/><span/></button>
    {open && <div className="hamburger-menu"><div className="menu-kicker">FX PROJECT / MENU</div><Link href="/" onClick={() => setOpen(false)}><span>01</span> Jelajahi Script <b>↗</b></Link><Link href="/publish" onClick={() => setOpen(false)}><span>02</span> Upload Script <b>↗</b></Link><Link href="/report" onClick={() => setOpen(false)}><span>03</span> Laporkan Masalah <b>↗</b></Link><div className="menu-footer">BUILT TO SHARE · BY KyZX</div></div>}
  </nav>;
}
