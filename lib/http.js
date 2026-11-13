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

// Fælles svar ved fejl. En manglende database får en tydelig besked, så den er nem at finde.
export function sendError(res, err, label) {
  console.error(`${label} fejlede:`, err);
  if (err?.code === 'DB_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'Databasen er ikke forbundet til projektet endnu.' });
  }
  return res.status(500).json({ error: 'Noget gik galt. Prøv igen om lidt.' });
}
