// SQL-Lernwerkstatt – minimaler HTTP-Server ohne Abhängigkeiten.
// Liefert die statische App aus und speichert Lernstände (JSON) im Datenverzeichnis.
import http from 'node:http';
import { createReadStream, promises as fs, statSync, mkdirSync, readdirSync, chownSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DATA_DIR = path.resolve(process.env.DATA_DIR || '/data');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 1024 * 1024; // 1 MB pro Lernstand
const VERSION = process.env.APP_VERSION || '2.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.sql': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.sql', '.wasm', '.svg', '.webmanifest']);

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

let dataWritable = false;

/**
 * Startet der Prozess als root (z. B. mit Bind-Mount /DATA/AppData/sqlwork auf ZimaOS),
 * übernimmt er das Datenverzeichnis für den Laufzeitbenutzer und gibt danach alle
 * Rechte ab. Benötigt nur die Capabilities CHOWN, SETUID und SETGID.
 */
export function dropPrivileges() {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return;
  const uid = Number(process.env.PUID || 1000);
  const gid = Number(process.env.PGID || 1000);
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    // Erst den Inhalt, dann den Ordner selbst: Nach der Übergabe des Ordners darf
    // root ohne CAP_DAC_OVERRIDE (cap_drop: ALL) ihn nicht mehr lesen.
    for (const f of readdirSync(DATA_DIR)) chownSync(path.join(DATA_DIR, f), uid, gid);
    chownSync(DATA_DIR, uid, gid);
  } catch (e) {
    console.warn(`[sqlwork] Konnte ${DATA_DIR} nicht übernehmen (${e.code}).`);
  }
  try {
    if (process.setgroups) process.setgroups([gid]);
    process.setgid(gid);
    process.setuid(uid);
    console.log(`[sqlwork] läuft als UID ${uid} (Rechte abgegeben)`);
  } catch (e) {
    console.error(`[sqlwork] Rechte konnten nicht abgegeben werden (${e.code}) – Abbruch aus Sicherheitsgründen.`);
    process.exit(1);
  }
}
async function initData() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const probe = path.join(DATA_DIR, '.probe');
    await fs.writeFile(probe, 'ok');
    await fs.unlink(probe);
    dataWritable = true;
  } catch (e) {
    console.warn(`[sqlwork] Datenverzeichnis ${DATA_DIR} nicht beschreibbar (${e.code}). Lernstände werden nur im Browser gespeichert.`);
  }
}

const gzCache = new Map();
async function gzipped(file, mtime) {
  const hit = gzCache.get(file);
  if (hit && hit.mtime === mtime) return hit.buf;
  const raw = await fs.readFile(file);
  const buf = zlib.gzipSync(raw, { level: 9 });
  gzCache.set(file, { mtime, buf });
  return buf;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
  let st;
  try { st = statSync(file); } catch { st = null; }
  if (!st || !st.isFile()) {
    // Unbekannte Pfade ohne Dateiendung → App (Hash-Router)
    if (!path.extname(rel)) return serveStatic(req, res, '/index.html');
    return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  const ext = path.extname(file).toLowerCase();
  const immutable = rel.startsWith('/vendor/') || rel.startsWith('/fonts/');
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Last-Modified': st.mtime.toUTCString(),
    Vary: 'Accept-Encoding',
  };
  if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) {
    return send(res, 304, null, headers);
  }
  if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const buf = await gzipped(file, st.mtimeMs);
    return send(res, 200, req.method === 'HEAD' ? null : buf, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': buf.length });
  }
  res.writeHead(200, { ...SECURITY_HEADERS, ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const PROFILE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const profileFile = (p) => path.join(DATA_DIR, `profil-${p}.json`);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') return json(res, 200, { status: 'ok', version: VERSION, storage: dataWritable ? 'server' : 'browser-only' });
  const m = url.pathname.match(/^\/api\/state\/([^/]+)$/);
  if (!m) return json(res, 404, { error: 'not found' });
  const profile = m[1].toLowerCase();
  if (!PROFILE_RE.test(profile)) return json(res, 400, { error: 'invalid profile' });
  if (!dataWritable) return json(res, 503, { error: 'storage unavailable' });
  const file = profileFile(profile);
  if (req.method === 'GET') {
    try { return send(res, 200, await fs.readFile(file), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); }
    catch { return send(res, 204, null, { 'Cache-Control': 'no-store' }); }
  }
  if (req.method === 'PUT') {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'json expected' });
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, e.status || 400, { error: 'body' }); }
    let parsed;
    try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'invalid json' }); }
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.updatedAt !== 'number') return json(res, 400, { error: 'invalid state' });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(parsed));
    await fs.rename(tmp, file);
    return json(res, 200, { ok: true, updatedAt: parsed.updatedAt });
  }
  return json(res, 405, { error: 'method not allowed' });
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return await serveStatic(req, res, url.pathname);
    } catch (e) {
      console.error('[sqlwork]', e);
      if (!res.headersSent) send(res, 500, 'Internal error');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dropPrivileges();
  await initData();
  const server = createServer();
  server.listen(PORT, HOST, () => console.log(`[sqlwork] läuft auf http://${HOST}:${PORT} (Daten: ${dataWritable ? DATA_DIR : 'nur Browser'})`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

export { initData };
