import { randomUUID } from 'node:crypto';
import { CATEGORY_IDS } from '../lib/categories.js';
import { parseBody, sendError } from '../lib/http.js';
import { sanitizeName } from '../lib/results.js';
import { getStore, KEYS } from '../lib/store.js';

// Afgiver én stemmeseddel med et navn i en eller flere kategorier. Anonymt.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Brug POST' });
  }
  try {
    const body = parseBody(req);

    // Skjult felt, som kun robotter udfylder: lad som om det lykkedes.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return res.status(200).json({ ok: true });
    }

    const store = getStore();
    if (await store.get(KEYS.closed)) {
      return res.status(403).json({ error: 'Afstemningen er lukket.' });
    }

    const votes = {};
    for (const id of CATEGORY_IDS) {
      const name = sanitizeName(body.votes?.[id]);
      if (name) votes[id] = name;
    }
    if (Object.keys(votes).length === 0) {
      return res.status(400).json({ error: 'Skriv mindst ét navn, før du stemmer.' });
    }

    await store.hset(KEYS.submissions, { [randomUUID()]: { t: Date.now(), v: votes } });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendError(res, err, 'vote');
  }
}
