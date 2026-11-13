import { CATEGORIES, CATEGORY_IDS } from '../lib/categories.js';
import { bearerToken, parseBody, passwordMatches, sendError } from '../lib/http.js';
import { aliasId, buildResults, normalizeKey, sanitizeName, wouldCycle } from '../lib/results.js';
import { getStore, KEYS } from '../lib/store.js';

const RECENT_LIMIT = 150;

async function snapshot(store) {
  const [rawSubs, rawAliases, closed] = await Promise.all([
    store.hgetall(KEYS.submissions),
    store.hgetall(KEYS.aliases),
    store.get(KEYS.closed),
  ]);
  const aliases = rawAliases || {};
  const submissions = Object.entries(rawSubs || {})
    .map(([id, s]) => ({ id, t: Number(s?.t) || 0, name: typeof s?.name === 'string' ? s.name : '', v: s?.v || {} }))
    .sort((a, b) => b.t - a.t);

  return {
    closed: Boolean(closed),
    categories: CATEGORIES.map(({ id, emoji, title }) => ({ id, emoji, title })),
    totalSubmissions: submissions.length,
    results: buildResults(submissions, aliases),
    aliases: Object.entries(aliases).map(([id, a]) => ({
      id,
      category: id.split('|')[0],
      from: a.from,
      to: a.to,
    })),
    // Valgene vises uden navn og uden id, så de ikke kan kobles til en person i overblikket.
    recent: submissions.slice(0, RECENT_LIMIT).map(({ t, v }) => ({ t, v })),
    // Hvem der har stemt: alfabetisk og uden tidspunkt.
    voters: submissions
      .map(({ id, name }) => ({ id, name: name || '(uden navn)' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'da')),
  };
}

// Admin: resultater, løbende stemmer og oprydning. Kræver ADMIN_PASSWORD.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return res.status(503).json({ error: 'ADMIN_PASSWORD er ikke sat i Vercel.' });
  }
  if (!passwordMatches(bearerToken(req), expected)) {
    return res.status(401).json({ error: 'Forkert adgangskode.' });
  }

  try {
    const store = getStore();

    if (req.method === 'GET') {
      return res.status(200).json(await snapshot(store));
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Brug GET eller POST' });
    }

    const body = parseBody(req);
    switch (body.action) {
      case 'delete': {
        if (typeof body.id !== 'string' || !body.id) {
          return res.status(400).json({ error: 'Mangler id.' });
        }
        await store.hdel(KEYS.submissions, body.id);
        break;
      }
      case 'merge': {
        const category = body.category;
        const from = sanitizeName(body.from);
        const to = sanitizeName(body.to);
        const fromKey = normalizeKey(from);
        if (!CATEGORY_IDS.includes(category) || !fromKey || !to) {
          return res.status(400).json({ error: 'Ugyldig sammenlægning.' });
        }
        if (fromKey === normalizeKey(to)) {
          return res.status(400).json({ error: 'Vælg to forskellige navne.' });
        }
        const aliases = (await store.hgetall(KEYS.aliases)) || {};
        if (wouldCycle(aliases, category, fromKey, to)) {
          return res.status(400).json({ error: 'Den sammenlægning ville gå i ring.' });
        }
        await store.hset(KEYS.aliases, { [aliasId(category, fromKey)]: { from, to } });
        break;
      }
      case 'unmerge': {
        if (typeof body.id !== 'string' || !body.id) {
          return res.status(400).json({ error: 'Mangler id.' });
        }
        await store.hdel(KEYS.aliases, body.id);
        break;
      }
      case 'setClosed': {
        await store.set(KEYS.closed, body.closed === true);
        break;
      }
      case 'reset': {
        if (body.confirm !== 'NULSTIL') {
          return res.status(400).json({ error: 'Skriv NULSTIL for at bekræfte.' });
        }
        await store.del(KEYS.submissions, KEYS.aliases);
        break;
      }
      default:
        return res.status(400).json({ error: 'Ukendt handling.' });
    }

    return res.status(200).json(await snapshot(store));
  } catch (err) {
    return sendError(res, err, 'admin');
  }
}
