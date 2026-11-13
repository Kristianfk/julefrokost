import { CATEGORIES } from '../lib/categories.js';
import { sendError } from '../lib/http.js';
import { getStore, KEYS } from '../lib/store.js';

// Offentlig: kategorierne og om afstemningen er åben. Ingen resultater.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Brug GET' });
  }
  try {
    const closed = Boolean(await getStore().get(KEYS.closed));
    return res.status(200).json({ closed, categories: CATEGORIES });
  } catch (err) {
    return sendError(res, err, 'status');
  }
}
