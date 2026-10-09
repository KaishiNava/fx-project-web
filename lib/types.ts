export type ScriptRecord = {
  id: string;
  name: string;
  description: string;
  author: string;
  file: string;
  thumbnailPath: string | null;
  thumbnailType: string | null;
  thumbnailUrl?: string | null;
  size: number;
  downloads: number;
  passwordProtected: boolean;
  passwordHash: string | null;
  createdAt: string;
};
export type PublicScript = Omit<ScriptRecord, 'passwordHash' | 'file'>;
export function toPublicScript(script: ScriptRecord): PublicScript {
  const { passwordHash: _hash, file: _file, ...safe } = script;
  return safe;
}
