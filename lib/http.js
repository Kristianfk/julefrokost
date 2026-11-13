import { createHash, timingSafeEqual } from 'node:crypto';

export function parseBody(req) {
  const b = req.body;
  if (b == null || b === '') return {};
  if (typeof b === 'string') {
    try {
      const parsed = JSON.parse(b);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof b === 'object' ? b : {};
}

// Sammenligner uden at afsløre, hvor mange tegn der er rigtige.
export function passwordMatches(given, expected) {
  if (typeof given !== 'string' || !expected) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function bearerToken(req) {
  const header = req.headers?.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}
