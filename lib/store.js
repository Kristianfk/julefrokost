// Lager til stemmerne.
//
// På Vercel bruges Upstash Redis (gratis via Vercel Marketplace). Når man
// forbinder databasen til projektet, sætter Vercel selv KV_REST_API_URL og
// KV_REST_API_TOKEN. Lokalt (uden de variabler) bruges et lager i hukommelsen,
// som er tomt, hver gang serveren starter.
import { Redis } from '@upstash/redis';

export const KEYS = {
  submissions: 'jf:submissions', // hash: id -> { t, v: { kategori: navn } }
  aliases: 'jf:aliases', // hash: "kategori|nøgle" -> { from, to }
  closed: 'jf:closed', // true når afstemningen er lukket
};

function memoryStore() {
  const hashes = new Map();
  const strings = new Map();
  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  return {
    kind: 'memory',
    async hgetall(key) {
      const h = hashes.get(key);
      if (!h || h.size === 0) return null;
      return Object.fromEntries([...h].map(([k, v]) => [k, clone(v)]));
    },
    async hset(key, obj) {
      if (!hashes.has(key)) hashes.set(key, new Map());
      for (const [k, v] of Object.entries(obj)) hashes.get(key).set(k, clone(v));
    },
    async hdel(key, ...fields) {
      const h = hashes.get(key);
      if (h) for (const f of fields) h.delete(f);
    },
    async get(key) {
      return strings.has(key) ? clone(strings.get(key)) : null;
    },
    async set(key, value) {
      strings.set(key, clone(value));
    },
    async del(...keys) {
      for (const k of keys) {
        hashes.delete(k);
        strings.delete(k);
      }
    },
  };
}

let cached;

// Vercel kan give variablerne et præfiks (fx STORAGE_KV_REST_API_URL), så vi leder efter endelsen.
function envBySuffix(names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  for (const [key, value] of Object.entries(process.env)) {
    if (value && names.some((n) => key.endsWith(`_${n}`))) return value;
  }
  return undefined;
}

export function getStore() {
  if (cached) return cached;
  const url = envBySuffix(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
  const token = envBySuffix(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);
  if (url && token) {
    cached = new Redis({ url, token });
  } else if (process.env.VERCEL) {
    // På Vercel må stemmer aldrig stille ende i hukommelsen og forsvinde.
    const err = new Error('Databasen er ikke forbundet: KV_REST_API_URL / KV_REST_API_TOKEN mangler.');
    err.code = 'DB_NOT_CONFIGURED';
    throw err;
  } else {
    cached = memoryStore();
  }
  return cached;
}
