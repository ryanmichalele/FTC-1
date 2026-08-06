import { createServer } from 'http';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { resolve, extname, join } from 'path';

const PORT = parseInt(process.env.PORT || '3000');
const SITE_DIR = resolve(import.meta.dirname, 'site');
const HOST = '127.0.0.1';
const BASE_URL = 'https://www.ftc.gov';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.ts': 'text/typescript; charset=utf-8',
};

function rewriteFtcLinks(html) {
  let out = html.replace(/(src|href|action)\s*=\s*"(https:\/\/www\.ftc\.gov)\//g, '$1="/');
  out = out.replace(/(src|href|action)\s*=\s*"https:\/\/reportfraud\.ftc\.gov\/?"/g, '$1="/report-fraud"');
  out = out.replace(/^\s*#\s*toolbarTray\.prepend\(label\);\s*$/gm, '    toolbarTray.prepend(label);');
  return out;
}

const redirectMap = new Map();
const redirectPath = join(SITE_DIR, '_redirects.json');
if (existsSync(redirectPath)) {
  try {
    for (const [from, to] of JSON.parse(readFileSync(redirectPath, 'utf-8'))) {
      redirectMap.set(from, to);
    }
    console.log(`Loaded ${redirectMap.size} redirects`);
  } catch (e) { console.error('Failed to load redirects:', e.message); }
}

function findFile(urlPath) {
  const decoded = decodeURIComponent(urlPath).replace(/\\/g, '/');
  const clean = decoded.replace(/\/+/g, '/');
  const fullPath = join(SITE_DIR, clean);

  if (existsSync(fullPath) && statSync(fullPath).isFile()) return fullPath;

  if (!extname(clean) || clean.endsWith('/')) {
    const idx = join(fullPath, 'index.html');
    if (existsSync(idx)) return idx;
  }

  if (!extname(clean)) {
    const h = fullPath + '.html';
    if (existsSync(h)) return h;
  }

  const ws = join(SITE_DIR, clean.replace(/\/?$/, '/'), 'index.html');
  if (existsSync(ws)) return ws;

  if (clean === '' || clean === '/') {
    const ri = join(SITE_DIR, 'index.html');
    if (existsSync(ri)) return ri;
  }

  // Try _external directory
  const extPath = join(SITE_DIR, '_external', clean);
  if (existsSync(extPath) && statSync(extPath).isFile()) return extPath;

  return null;
}

function serveFile(res, filePath) {
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  try {
    let content = readFileSync(filePath);
    if (ext === '.html') content = rewriteFtcLinks(content.toString('utf-8'));
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': content.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      'X-Robots-Tag': 'noindex',
    });
    res.end(content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
}

function serveDirListing(res, dirPath, urlPath) {
  try {
    const items = readdirSync(dirPath, { withFileTypes: true });
    let listing = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Directory: ${urlPath}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2em auto;padding:0 1em}
h1{border-bottom:1px solid #ddd;padding-bottom:.5em}ul{list-style:none;padding:0}
li{padding:.3em 0}a{text-decoration:none;color:#1a73e8}a:hover{text-decoration:underline}
.dir::before{content:"\\1F4C1 "}.file::before{content:"\\1F4C4 "}
</style></head><body><h1>Index of ${urlPath}</h1><ul><li><a href="../">../</a></li>`;
    for (const item of items) {
      if (item.name.startsWith('.')) continue;
      const cls = item.isDirectory() ? 'dir' : 'file';
      const href = join(urlPath, item.name).replace(/\\/g, '/');
      listing += `\n<li><a href="${href}" class="${cls}">${item.name}${item.isDirectory() ? '/' : ''}</a></li>`;
    }
    listing += '\n</ul></body></html>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(listing);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
}

const server = createServer((req, res) => {
  let urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  urlPath = decodeURIComponent(urlPath).replace(/\\/g, '/');
  const cleanPath = urlPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

  // Handle redirects (from crawler redirect map)
  const redirectUrl = redirectMap.get(BASE_URL + cleanPath);
  if (redirectUrl) {
    const rp = new URL(redirectUrl).pathname;
    res.writeHead(302, { 'Location': rp }); res.end(); return;
  }

  const filePath = findFile(cleanPath);
  if (filePath) {
    serveFile(res, filePath);
    return;
  }

  const dirPath = join(SITE_DIR, cleanPath);
  if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
    serveDirListing(res, dirPath, cleanPath);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end(`404 Not Found: ${cleanPath}`);
});

server.listen(PORT, HOST, () => {
  console.log(`\n========================================`);
  console.log(`  FTC Mirror Server`);
  console.log(`  Local: http://${HOST}:${PORT}`);
  console.log(`  Serving: ${SITE_DIR}`);
  console.log(`========================================\n`);
});
