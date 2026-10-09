import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { listScripts, saveScript } from '@/lib/github-storage';
import { toPublicScript } from '@/lib/types';
import { jsonError, safeError } from '@/lib/http';
import { allowRequest } from '@/lib/ratelimit';
import { escapeHtml, sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 3_500_000);
export async function GET() {
  try { const scripts = await listScripts(); return NextResponse.json({ scripts: scripts.map(toPublicScript), totalDownloads: scripts.reduce((sum, s) => sum + (s.downloads || 0), 0) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return jsonError(safeError(error), 503); }
}
export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowRequest(`upload:${forwarded}`, 5, 60_000)) return jsonError('Terlalu banyak upload dari koneksi ini. Coba lagi satu menit lagi.', 429);
  try {
    const form = await request.formData();
    const file = form.get('file'); const name = String(form.get('name') || '').trim(); const description = String(form.get('description') || '').trim(); const author = String(form.get('author') || '').trim(); const password = String(form.get('password') || '');
    if (!(file instanceof File)) return jsonError('File ZIP wajib dipilih.');
    if (!name || name.length < 2 || name.length > 70) return jsonError('Nama script harus 2–70 karakter.');
    if (description.length > 500) return jsonError('Deskripsi maksimal 500 karakter.');
    if (!author || author.length > 40) return jsonError('Nama author wajib diisi dan maksimal 40 karakter.');
    if (password && (password.length < 4 || password.length > 100)) return jsonError('Password harus 4–100 karakter.');
    if (file.size < 22 || file.size > MAX_BYTES) return jsonError(`Ukuran ZIP harus antara 22 byte dan ${(MAX_BYTES / 1_000_000).toFixed(1)} MB.`);
    if (!file.name.toLowerCase().endsWith('.zip')) return jsonError('File harus berformat .zip.');
    const bytes = Buffer.from(await file.arrayBuffer());
    // ZIP local-file, empty-archive, or spanning signature. This is a format check, not malware scanning.
    const sig = bytes.subarray(0, 4).toString('hex');
    if (!['504b0304', '504b0506', '504b0708'].includes(sig)) return jsonError('Isi file tidak terlihat seperti ZIP yang valid.');
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const script = await saveScript(bytes, { name, description, author, passwordProtected: Boolean(password), passwordHash });
    // Upload must succeed even if Telegram is temporarily unavailable.
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const scriptUrl = siteUrl ? `${siteUrl}/scripts/${script.id}` : `/scripts/${script.id}`;
    const notification = [
      '📦 <b>UPLOAD BARU — FX PROJECT</b>',
      '',
      `<b>ID Script:</b> <code>${escapeHtml(script.id)}</code>`,
      `<b>Nama:</b> ${escapeHtml(script.name)}`,
      `<b>Developer / Author:</b> ${escapeHtml(script.author)}`,
      `<b>Deskripsi:</b> ${escapeHtml(script.description || 'Tidak ada deskripsi')}`,
      `<b>Ukuran:</b> ${(script.size / 1024).toFixed(1)} KB`,
      `<b>Password download:</b> ${script.passwordProtected ? 'YA (disimpan sebagai hash; password asli tidak dikirim)' : 'TIDAK'}`,
      `<b>Jumlah download:</b> ${script.downloads}`,
      `<b>Waktu upload:</b> ${escapeHtml(script.createdAt)}`,
      `<b>Link:</b> ${escapeHtml(scriptUrl)}`
    ].join('\n');
    try { await sendTelegramMessage(notification); }
    catch (telegramError) { console.error('[FX Project] Telegram upload notification failed:', telegramError instanceof Error ? telegramError.message : 'unknown error'); }
    return NextResponse.json({ script: toPublicScript(script) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(safeError(error), 500); }
}
