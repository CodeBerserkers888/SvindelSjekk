// Simple in-memory rate limiter
// For production scale, replace with Upstash Redis

const requests = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 20; // 20 checks per hour per IP

export function rateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = ip;

  const existing = requests.get(key);

  if (!existing || now > existing.resetAt) {
    // New window
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetIn: WINDOW_MS };
  }

  if (existing.count >= MAX_REQUESTS) {
    const resetIn = existing.resetAt - now;
    return { allowed: false, remaining: 0, resetIn };
  }

  existing.count++;
  return { allowed: true, remaining: MAX_REQUESTS - existing.count, resetIn: existing.resetAt - now };
}

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of requests.entries()) {
    if (now > val.resetAt) requests.delete(key);
  }
}, 10 * 60 * 1000);