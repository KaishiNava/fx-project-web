import { createClient } from '@supabase/supabase-js';

type InitResponse = {
  deduped?: boolean;
  url?: string;
  ticket?: string;
  upload?: { supabaseUrl: string; anonKey: string; bucket: string; path: string; token: string };
  message?: string;
  error?: string;
};

async function readJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || data?.error || `ZFile API gagal (HTTP ${response.status})`;
    throw new Error(String(message).slice(0, 240));
  }
  return data;
}

export async function uploadThumbnailToZFile(bytes: Buffer, filename: string, mimeType: string): Promise<string> {
  const base = 'https://zfile.web.id';
  const init = await readJson(await fetch(`${base}/api/v1/upload/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, size: bytes.length, mimeType, expiry: 'never' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
  })) as InitResponse;

  if (init.deduped && init.url) return init.url;
  if (!init.url || !init.ticket || !init.upload?.supabaseUrl || !init.upload.anonKey || !init.upload.bucket || !init.upload.path || !init.upload.token) {
    throw new Error('Respons inisialisasi ZFile tidak lengkap.');
  }

  const supabase = createClient(init.upload.supabaseUrl, init.upload.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await supabase.storage
    .from(init.upload.bucket)
    .uploadToSignedUrl(init.upload.path, init.upload.token, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Upload thumbnail ke storage gagal: ${error.message}`);

  const finalized = await readJson(await fetch(`${base}/api/v1/upload/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket: init.ticket }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
  }));
  if (typeof finalized.url !== 'string' || !finalized.url.startsWith('https://zfile.web.id/')) {
    throw new Error('ZFile tidak mengembalikan URL thumbnail yang valid.');
  }
  return finalized.url;
}
