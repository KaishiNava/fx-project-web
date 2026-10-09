import { NextResponse } from 'next/server';
export function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
export function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Terjadi kesalahan server.';
  if (message.includes('Storage belum dikonfigurasi')) return message;
  if (message.startsWith('GitHub Storage (')) return 'GitHub storage menolak permintaan. Periksa token, izin repository, nama repository, dan branch.';
  return message;
}
