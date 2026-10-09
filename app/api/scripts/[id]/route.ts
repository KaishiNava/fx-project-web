import { NextRequest, NextResponse } from 'next/server';
import { getScript } from '@/lib/github-storage';
import { toPublicScript } from '@/lib/types';
import { jsonError, safeError } from '@/lib/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try { const script = await getScript(params.id); if (!script) return jsonError('Script tidak ditemukan.', 404); return NextResponse.json({ script: toPublicScript(script) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return jsonError(safeError(error), 503); }
}
