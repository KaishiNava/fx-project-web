import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getScript, getZip, incrementDownloads } from '@/lib/github-storage';
import { jsonError, safeError } from '@/lib/http';
import { allowRequest } from '@/lib/ratelimit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowRequest(`download:${forwarded}:${params.id}`, 20, 60_000)) return jsonError('Terlalu banyak permintaan download. Coba lagi sebentar.', 429);
  try {
    const script = await getScript(params.id); if (!script) return jsonError('Script tidak ditemukan.', 404);
    let password = '';
    try { const body = await request.json(); password = typeof body.password === 'string' ? body.password : ''; } catch { /* empty request body */ }
    if (script.passwordProtected && (!password || !script.passwordHash || !(await bcrypt.compare(password, script.passwordHash)))) return jsonError('Password salah atau belum diisi.', 401);
    const zip = await getZip(script.file);
    // Count only after the password has been accepted and the file has been read successfully.
    await incrementDownloads(script.id);
    const safeName = script.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').trim().slice(0, 80) || 'script';
    return new NextResponse(new Uint8Array(zip), { status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${safeName}.zip"`, 'Content-Length': String(zip.length), 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(safeError(error), 503); }
}
