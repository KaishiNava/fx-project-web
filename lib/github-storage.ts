import crypto from 'node:crypto';
import type { ScriptRecord } from './types';

const API = 'https://api.github.com';
const META_PATH = 'data/scripts.json';
type GitHubContent = { sha?: string; content?: string; download_url?: string; size?: number };

function config() {
  const token = process.env.GITHUB_STORAGE_TOKEN;
  const owner = process.env.GITHUB_STORAGE_OWNER;
  const repo = process.env.GITHUB_STORAGE_REPO;
  const branch = process.env.GITHUB_STORAGE_BRANCH || 'main';
  if (!token || !owner || !repo) throw new Error('Storage belum dikonfigurasi. Isi GITHUB_STORAGE_TOKEN, GITHUB_STORAGE_OWNER, dan GITHUB_STORAGE_REPO di Vercel.');
  return { token, owner, repo, branch };
}

async function github(path: string, init: RequestInit = {}): Promise<any> {
  const c = config();
  const response = await fetch(`${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json', Authorization: `Bearer ${c.token}`,
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'FX-Project-Uploader',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {})
    }, cache: 'no-store'
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GitHub Storage (${response.status}): ${body.slice(0, 220)}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function readJson(): Promise<{ records: ScriptRecord[]; sha?: string }> {
  try {
    const file = await github(META_PATH) as GitHubContent;
    const text = Buffer.from(file.content || '', 'base64').toString('utf8');
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('data/scripts.json harus berisi array JSON.');
    return { records: parsed, sha: file.sha };
  } catch (error) {
    if ((error as { status?: number }).status === 404) return { records: [] };
    throw error;
  }
}

async function writeJson(records: ScriptRecord[], sha: string | undefined, message: string) {
  const c = config();
  const body: Record<string, string> = {
    message, content: Buffer.from(JSON.stringify(records, null, 2)).toString('base64'), branch: c.branch
  };
  if (sha) body.sha = sha;
  await github(META_PATH, { method: 'PUT', body: JSON.stringify(body) });
}

async function updateMetadata(mutator: (records: ScriptRecord[]) => ScriptRecord[], message: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await readJson();
    const next = mutator(current.records);
    try { await writeJson(next, current.sha, message); return next; }
    catch (error) {
      if ((error as { status?: number }).status !== 409 || attempt === 4) throw error;
    }
  }
  throw new Error('Gagal memperbarui metadata. Coba lagi.');
}

export async function listScripts(): Promise<ScriptRecord[]> {
  const { records } = await readJson();
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getScript(id: string): Promise<ScriptRecord | null> {
  if (!/^[a-f0-9]{12}$/.test(id)) return null;
  return (await listScripts()).find(script => script.id === id) || null;
}

export async function saveScript(file: Buffer, meta: Pick<ScriptRecord, 'name' | 'description' | 'author' | 'passwordProtected' | 'passwordHash'>): Promise<ScriptRecord> {
  const c = config();
  const id = crypto.randomBytes(6).toString('hex');
  const filePath = `scripts/${id}.zip`;
  const zipBody = { message: `FX Project: upload ${id}`, content: file.toString('base64'), branch: c.branch };
  await github(filePath, { method: 'PUT', body: JSON.stringify(zipBody) });
  const record: ScriptRecord = { ...meta, id, file: filePath, size: file.length, downloads: 0, createdAt: new Date().toISOString() };
  try {
    await updateMetadata(records => [record, ...records], `FX Project: register ${id}`);
  } catch (error) {
    // Leave an orphaned ZIP only if GitHub metadata update fails; never report a false success.
    throw error;
  }
  return record;
}

export async function getZip(path: string): Promise<Buffer> {
  if (!/^scripts\/[a-f0-9]{12}\.zip$/.test(path)) throw new Error('Path file tidak valid.');
  const file = await github(path) as GitHubContent;
  if (file.content) return Buffer.from(file.content, 'base64');
  if (!file.download_url) throw new Error('File ZIP tidak ditemukan di storage.');
  const c = config();
  const response = await fetch(file.download_url, { headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
  if (!response.ok) throw new Error('Gagal mengambil file ZIP dari storage.');
  return Buffer.from(await response.arrayBuffer());
}

export async function incrementDownloads(id: string): Promise<number> {
  let result = 0;
  await updateMetadata(records => records.map(record => {
    if (record.id !== id) return record;
    result = (record.downloads || 0) + 1;
    return { ...record, downloads: result };
  }), `FX Project: download ${id}`);
  return result;
}
