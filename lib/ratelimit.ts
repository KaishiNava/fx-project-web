// Lightweight per-instance guard. On serverless deployments, add a persistent edge/WAF rate limit for strong protection.
const buckets = new Map<string, { count: number; reset: number }>();
export function allowRequest(key: string, limit = 8, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.reset <= now) { buckets.set(key, { count: 1, reset: now + windowMs }); return true; }
  if (current.count >= limit) return false;
  current.count += 1;
  if (buckets.size > 2000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  return true;
}
