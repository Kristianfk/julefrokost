// Lokal udviklingsserver, så man kan prøve siden uden Vercel-konto.
// Kør: npm run dev  ->  http://localhost:3000   (admin: /admin)
// Uden database-variabler bruges et lager i hukommelsen (tomt ved hver start).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = join(root, 'public');
const port = Number(process.env.PORT) || 3000;

if (!process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = 'test';
  console.log('ADMIN_PASSWORD er ikke sat. Bruger "test" lokalt.');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  if ((req.headers['content-type'] || '').includes('application/json')) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Efterligner Vercels hjælpefunktioner på res.
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    try {
      const mod = await import(pathToFileURL(join(root, 'api', `${name}.js`)).href);
      req.body = await readJsonBody(req);
      return await mod.default(req, res);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' && String(err.message).includes(`${name}.js`)) {
        return res.status(404).json({ error: 'Ikke fundet' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Serverfejl' });
    }
  }

  // Statiske filer, med /admin -> admin.html som på Vercel (cleanUrls).
  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!extname(path)) path += '.html';
  const file = normalize(join(publicDir, path));
  if (!file.startsWith(publicDir)) return res.status(403).end();
  try {
    const data = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.status(404).end('Ikke fundet');
  }
});

server.listen(port, () => console.log(`Julefrokost-afstemning: http://localhost:${port}  (admin: /admin)`));
