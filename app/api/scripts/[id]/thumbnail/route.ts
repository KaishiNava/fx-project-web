import { NextRequest, NextResponse } from 'next/server';
import { getScript, getThumbnail } from '@/lib/github-storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const script = await getScript(params.id);
    if (!script?.thumbnailPath) return new NextResponse(null, { status: 404 });
    const thumb = await getThumbnail(script.thumbnailPath);
    if (!thumb) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(thumb.bytes), { headers: { 'Content-Type': thumb.type, 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new NextResponse(null, { status: 404 }); }
}
