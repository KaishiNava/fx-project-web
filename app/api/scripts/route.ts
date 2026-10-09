import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { listScripts, saveScript } from '@/lib/github-storage';
import { uploadThumbnailToZFile } from '@/lib/zfile';
import { toPublicScript } from '@/lib/types';
import { jsonError, safeError } from '@/lib/http';
import { allowRequest } from '@/lib/ratelimit';
import { escapeHtml, sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BYTES = Math.min(Number(process.env.MAX_UPLOAD_BYTES || 2_800_000), 2_800_000);
export async function GET() {
  try { const scripts = await listScripts(); return NextResponse.json({ scripts: scripts.map(toPublicScript), totalDownloads: scripts.reduce((sum, s) => sum + (s.downloads || 0), 0) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return jsonError(safeError(error), 503); }
}
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  console.info(`[FX Project] upload request started id=${requestId} contentLength=${request.headers.get('content-length') || 'unknown'} contentType=${request.headers.get('content-type') || 'unknown'}`);
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowRequest(`upload:${forwarded}`, 5, 60_000)) { console.warn(`[FX Project] upload rate limited id=${requestId}`); return NextResponse.json({ error: 'Terlalu banyak upload dari koneksi ini. Coba lagi satu menit lagi.', requestId }, { status: 429 }); }
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 4_000_000) return NextResponse.json({ error: 'Request terlalu besar. Coba ZIP di bawah 2,8 MB dan thumbnail di bawah 300 KB.', requestId }, { status: 413 });
    let form: FormData;
    try { form = await request.formData(); }
    catch (parseError) { console.error(`[FX Project] upload form parse failed id=${requestId}`, parseError); return NextResponse.json({ error: 'Form upload tidak dapat dibaca server. Coba ZIP lebih kecil dan pilih ulang file.', requestId }, { status: 400 }); }
    console.info(`[FX Project] upload form parsed id=${requestId}`);
    const file = form.get('file'); const thumbnailFile = form.get('thumbnail'); const name = String(form.get('name') || '').trim(); const description = String(form.get('description') || '').trim(); const author = String(form.get('author') || '').trim(); const password = String(form.get('password') || '');
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
    let thumbnail: { bytes: Buffer; type: string; extension: string; url?: string } | undefined;
    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      if (thumbnailFile.size > 300_000) {
        return NextResponse.json({ error: 'Ukuran thumbnail maksimal 300 KB.', requestId }, { status: 400 });
      }

      const thumbnailBytes = Buffer.from(await thumbnailFile.arrayBuffer());
      // Jangan bergantung hanya pada MIME type dari browser/Android; beberapa picker mengirim MIME kosong atau tidak standar.
      const isJpeg = thumbnailBytes.length >= 3 &&
        thumbnailBytes[0] === 0xff && thumbnailBytes[1] === 0xd8 && thumbnailBytes[2] === 0xff;
      const isPng = thumbnailBytes.length >= 8 &&
        thumbnailBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const isWebp = thumbnailBytes.length >= 12 &&
        thumbnailBytes.toString('ascii', 0, 4) === 'RIFF' &&
        thumbnailBytes.toString('ascii', 8, 12) === 'WEBP';

      let extension: string;
      let type: string;
      if (isJpeg) { extension = 'jpg'; type = 'image/jpeg'; }
      else if (isPng) { extension = 'png'; type = 'image/png'; }
      else if (isWebp) { extension = 'webp'; type = 'image/webp'; }
      else {
        console.warn(`[FX Project] invalid thumbnail signature id=${requestId} name=${thumbnailFile.name} type=${thumbnailFile.type} bytes=${thumbnailBytes.length}`);
        return NextResponse.json({ error: 'Thumbnail tidak terbaca sebagai JPG, PNG, atau WEBP yang valid. Pilih ulang gambar asli.', requestId }, { status: 400 });
      }
      const zfileUrl = await uploadThumbnailToZFile(thumbnailBytes, `fx-thumbnail.${extension}`, type);
      thumbnail = { bytes: thumbnailBytes, type, extension, url: zfileUrl };
      console.info(`[FX Project] thumbnail validated id=${requestId} type=${type} bytes=${thumbnailBytes.length}`);
    }
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    console.info(`[FX Project] validating complete id=${requestId} zipBytes=${bytes.length} thumbnailBytes=${thumbnail?.bytes.length || 0}`);
    const script = await saveScript(bytes, { name, description, author, passwordProtected: Boolean(password), passwordHash }, thumbnail);
    console.info(`[FX Project] storage saved id=${requestId} scriptId=${script.id}`);
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
      `<b>Thumbnail:</b> ${(script.thumbnailPath || script.thumbnailUrl) ? 'Tersedia' : 'Tidak ada'}`,
      `<b>Link:</b> ${escapeHtml(scriptUrl)}`
    ].join('\n');
    try {
      const thumbUrl = (script.thumbnailPath || script.thumbnailUrl) && siteUrl ? `${siteUrl}/api/scripts/${script.id}/thumbnail` : '';
      if (thumbUrl) await sendTelegramPhoto(thumbUrl, notification.slice(0, 1000));
      else await sendTelegramMessage(notification);
    }
    catch (telegramError) { console.error('[FX Project] Telegram upload notification failed:', telegramError instanceof Error ? telegramError.message : 'unknown error'); }
    return NextResponse.json({ script: toPublicScript(script) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error(`[FX Project] upload failed id=${requestId}`, error); return NextResponse.json({ error: safeError(error), requestId }, { status: 500 }); }
}
