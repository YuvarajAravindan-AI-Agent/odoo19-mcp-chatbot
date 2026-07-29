// Best-effort in-memory rate limit (per IP). Note: on Vercel serverless this is
// per-instance, so it's a soft guard, not a hard cap. For a strict limit across
// instances, swap in Upstash Redis / Vercel KV later.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;

export function rateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
