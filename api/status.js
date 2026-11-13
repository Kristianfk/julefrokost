import { CATEGORIES } from '../lib/categories.js';
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
    console.error('status fejlede:', err);
    return res.status(500).json({ error: 'Noget gik galt. Prøv igen om lidt.' });
  }
}
