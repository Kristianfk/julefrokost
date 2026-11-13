// Navne, normalisering og optælling.
import { CATEGORY_IDS } from './categories.js';

const MAX_NAME_LENGTH = 60;

// Renser et navn fra brugeren: ingen kontroltegn, ensartede mellemrum, max 60 tegn.
export function sanitizeName(input) {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F​-‍﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
}

// "Mette " og "mette" skal tælle som samme person.
export function normalizeKey(name) {
  return sanitizeName(name)
    .toLocaleLowerCase('da')
    .replace(/[.,;:!?'"]+$/g, '')
    .trim();
}

export function aliasId(category, key) {
  return `${category}|${key}`;
}

// Følger sammenlægninger (A -> B -> C) til det endelige navn.
export function resolveAlias(aliases, category, name) {
  let key = normalizeKey(name);
  let display = sanitizeName(name);
  for (let i = 0; i < 6; i += 1) {
    const a = aliases[aliasId(category, key)];
    if (!a) break;
    const nextKey = normalizeKey(a.to);
    if (!nextKey || nextKey === key) break;
    key = nextKey;
    display = a.to;
  }
  return { key, display };
}

// Ville en sammenlægning af `from` ind i `to` skabe en cirkel?
export function wouldCycle(aliases, category, fromKey, toName) {
  let key = normalizeKey(toName);
  for (let i = 0; i < 8; i += 1) {
    if (key === fromKey) return true;
    const a = aliases[aliasId(category, key)];
    if (!a) return false;
    key = normalizeKey(a.to);
  }
  return true;
}

// submissions: [{ id, t, v }], aliases: { "kategori|nøgle": { from, to } }
// Returnerer { [kategori]: { total, entries: [{ key, name, count }] } }
export function buildResults(submissions, aliases = {}) {
  const out = {};
  for (const category of CATEGORY_IDS) {
    const byKey = new Map(); // key -> { count, variants: Map(raw -> count), firstT }
    let total = 0;
    for (const s of submissions) {
      const raw = s.v?.[category];
      if (!raw) continue;
      const { key, display } = resolveAlias(aliases, category, raw);
      if (!key) continue;
      total += 1;
      let entry = byKey.get(key);
      if (!entry) {
        entry = { count: 0, variants: new Map(), firstT: s.t };
        byKey.set(key, entry);
      }
      entry.count += 1;
      entry.firstT = Math.min(entry.firstT, s.t);
      entry.variants.set(display, (entry.variants.get(display) || 0) + 1);
    }
    const entries = [...byKey].map(([key, e]) => {
      // Vis den mest brugte stavemåde; ved lighed den med stort bogstav, så den første.
      const name = [...e.variants]
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          const aUpper = a[0] !== a[0].toLocaleLowerCase('da') ? 1 : 0;
          const bUpper = b[0] !== b[0].toLocaleLowerCase('da') ? 1 : 0;
          return bUpper - aUpper;
        })[0][0];
      return { key, name, count: e.count, firstT: e.firstT };
    });
    entries.sort((a, b) => b.count - a.count || a.firstT - b.firstT || a.name.localeCompare(b.name, 'da'));
    out[category] = { total, entries: entries.map(({ key, name, count }) => ({ key, name, count })) };
  }
  return out;
}
