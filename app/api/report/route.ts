import { NextRequest, NextResponse } from 'next/server';
import { allowRequest } from '@/lib/ratelimit';
import { escapeHtml, sendTelegramMessage } from '@/lib/telegram';
import { jsonError } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowRequest(`report:${ip}`, 3, 60_000)) return jsonError('Terlalu banyak laporan. Coba lagi dalam satu menit.', 429);
  try {
    const body = await request.json();
    const category = String(body.category || '').trim();
    const target = String(body.target || '').trim();
    const message = String(body.message || '').trim();
    const contact = String(body.contact || '').trim();
    // Honeypot for simple automated spam.
    if (String(body.website || '').trim()) return NextResponse.json({ ok: true });
    const allowed = ['Script bermasalah', 'File berbahaya', 'Pelanggaran hak cipta', 'Bug website', 'Lainnya'];
    if (!allowed.includes(category)) return jsonError('Pilih kategori laporan yang tersedia.');
    if (message.length < 10 || message.length > 1500) return jsonError('Detail laporan harus 10–1500 karakter.');
    if (target.length > 180 || contact.length > 100) return jsonError('Kolom tautan atau kontak terlalu panjang.');
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'FX Project';
    const text = [
      '🚨 <b>LAPORAN BARU — FX PROJECT</b>',
      '', `<b>Kategori:</b> ${escapeHtml(category)}`,
      `<b>Target / Script ID:</b> ${escapeHtml(target || 'Tidak diisi')}`,
      `<b>Kontak pelapor:</b> ${escapeHtml(contact || 'Tidak diisi')}`,
      `<b>Detail:</b> ${escapeHtml(message)}`,
      `<b>Waktu:</b> ${escapeHtml(new Date().toISOString())}`,
      `<b>IP:</b> tidak dicatat di notifikasi`,
      `<b>Website:</b> ${escapeHtml(site)}`
    ].join('\n');
    await sendTelegramMessage(text);
    return NextResponse.json({ ok: true, message: 'Laporan berhasil dikirim ke admin.' });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Telegram belum dikonfigurasi')) return jsonError(error.message, 503);
    return jsonError('Laporan belum berhasil dikirim. Coba lagi nanti.', 502);
  }
}
