import { CATEGORY_IDS } from '../lib/categories.js';
import { parseBody, sendError } from '../lib/http.js';
import { normalizeKey, sanitizeName } from '../lib/results.js';
import { getStore, KEYS } from '../lib/store.js';

// Afgiver én stemmeseddel med et navn i en eller flere kategorier.
// Hver person (efter navn) har én stemmeseddel: stemmer man igen, erstattes den gamle.
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

    const voter = sanitizeName(body.voter);
    if (voter.length < 2) {
      return res.status(400).json({ error: 'Skriv dit navn for at stemme.' });
    }
    const voterKey = normalizeKey(voter);

    const votes = {};
    for (const id of CATEGORY_IDS) {
      const name = sanitizeName(body.votes?.[id]);
      if (name) votes[id] = name;
    }
    if (Object.keys(votes).length === 0) {
      return res.status(400).json({ error: 'Skriv mindst ét navn, før du stemmer.' });
    }

    const existing = await store.hget(KEYS.submissions, voterKey);
    // Beholder den første stavemåde af navnet, så "anne hansen" ikke erstatter "Anne Hansen".
    const name = typeof existing?.name === 'string' && existing.name ? existing.name : voter;
    await store.hset(KEYS.submissions, { [voterKey]: { t: Date.now(), name, v: votes } });
    return res.status(200).json({ ok: true, replaced: Boolean(existing) });
  } catch (err) {
    return sendError(res, err, 'vote');
  }
}
