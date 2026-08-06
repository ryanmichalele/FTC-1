import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname, extname, join, basename, sep } from 'path';

const BASE_URL = 'https://www.ftc.gov';
const OUTPUT_DIR = resolve(import.meta.dirname, 'site');
const MAX_PAGES = 2000;
const CONCURRENCY = 10;
const TIMEOUT_MS = 30000;

const visited = new Set();
const toVisit = [];
const queued = new Set();
const downloadedFiles = new Set();
const downloadQueue = [];
const downloadVisited = new Set();
const errors = [];
const redirectMap = new Map();

function normalizeUrl(url, base) {
  try {
    const u = new URL(url, base);
    u.hash = '';
    if (u.hostname === 'ftc.gov') u.hostname = 'www.ftc.gov';
    if (!u.hostname.endsWith('ftc.gov') && !u.hostname.endsWith('ftc.gov/')) return null;
    let path = u.pathname;
    if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
    u.pathname = path;
    return u.href;
  } catch { return null; }
}

function isSameDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'www.ftc.gov' || u.hostname === 'ftc.gov';
  } catch { return false; }
}

function isAsset(url) {
  const exts = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.pdf', '.mp4', '.webm',
    '.ogg', '.avi', '.mov', '.mp3', '.wav', '.json', '.xml', '.txt', '.webmanifest',
    '.map', '.avif', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip',
    '.csv', '.ts', '.mjs', '.cjs'];
  const u = new URL(url);
  const path = u.pathname.toLowerCase();
  return exts.some(e => path.endsWith(e));
}

function urlToLocalPath(url) {
  const u = new URL(url);
  let path = u.pathname;
  if (path.endsWith('/')) path += 'index.html';
  else if (!extname(path)) path += '/index.html';
  let result = path.slice(1);
  if (u.search) {
    const q = u.search.replace(/[^a-zA-Z0-9_\-.]/g, '_');
    if (q) {
      const dot = result.lastIndexOf('.');
      if (dot > 0) result = result.slice(0, dot) + '_' + q + result.slice(dot);
      else result += '_' + q;
    }
  }
  return result || 'index.html';
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get('Retry-After') || '5');
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      return resp;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return null;
}

function extractUrls(html, baseUrl) {
  const urls = new Set();
  const patterns = [
    // <a href="...">
    { regex: /<a[^>]+href=["']([^"']+)["']/gi, attr: 'href' },
    // <link href="...">
    { regex: /<link[^>]+href=["']([^"']+)["']/gi, attr: 'href' },
    // <script src="...">
    { regex: /<script[^>]+src=["']([^"']+)["']/gi, attr: 'src' },
    // <img src="...">
    { regex: /<img[^>]+src=["']([^"']+)["']/gi, attr: 'src' },
    // <source src="..."> and srcset
    { regex: /<source[^>]+src=["']([^"']+)["']/gi, attr: 'src' },
    // <video src="..."> and <audio src="...">
    { regex: /<(?:video|audio|track)[^>]+src=["']([^"']+)["']/gi, attr: 'src' },
    // <iframe src="...">
    { regex: /<iframe[^>]+src=["']([^"']+)["']/gi, attr: 'src' },
    // <embed src="...">
    { regex: /<embed[^>]+src=["']([^"']+)["']/gi, attr: 'src' },
    // <object data="...">
    { regex: /<object[^>]+data=["']([^"']+)["']/gi, attr: 'data' },
    // meta content
    { regex: /<meta[^>]+content=["']([^"']+)["']/gi, attr: 'content' },
    // @import url(...)
    { regex: /@import\s+(?:url\s*)?[\(]?\s*["']([^"']+)["']/gi, attr: 'import' },
    // srcset
    { regex: /srcset=["']([^"']+)["']/gi, attr: 'srcset' },
    // images inside srcset
  ];

  for (const { regex } of patterns) {
    const matches = html.matchAll(regex);
    for (const m of matches) {
      const raw = m[1];
      if (m[0].toLowerCase().includes('srcset') && raw.includes(',')) {
        const parts = raw.split(',');
        for (const part of parts) {
          const trimmed = part.trim().split(/\s+/)[0];
          if (trimmed) urls.add(trimmed);
        }
      } else {
        urls.add(raw);
      }
    }
  }

  // JSON inside script tags (importmap, etc.)
  const scriptMatches = html.matchAll(/<script[^>]*>([^<]*)<\/script>/gi);
  for (const m of scriptMatches) {
    try {
      const json = JSON.parse(m[1]);
      if (json.imports) {
        for (const key of Object.keys(json.imports)) {
          urls.add(json.imports[key]);
        }
      }
    } catch { /* not JSON */ }
  }

  // CSS url() references
  const cssUrls = html.matchAll(/url\(["']?([^"')]+)["']?\)/gi);
  for (const m of cssUrls) {
    urls.add(m[1]);
  }

  // webmanifest link
  const manifestMatches = html.matchAll(/<link[^>]+rel=["'](?:manifest|apple-touch-icon|icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/gi);
  for (const m of manifestMatches) {
    urls.add(m[1]);
  }

  const results = [];
  for (const raw of urls) {
    try {
      const resolved = new URL(raw, baseUrl).href;
      results.push(resolved);
    } catch { /* skip invalid */ }
  }
  return results;
}

function extractCssUrls(css, baseUrl) {
  const urls = new Set();
  const patterns = [
    /url\(["']?([^"')]+)["']?\)/gi,
    /@import\s+(?:url\s*)?[\(]?\s*["']([^"']+)["']/gi,
    /src:\s*(?:local\s*)?[\(]?\s*["']([^"']+)["']/gi,
  ];
  for (const regex of patterns) {
    const matches = css.matchAll(regex);
    for (const m of matches) {
      try {
        const resolved = new URL(m[1], baseUrl).href;
        urls.add(resolved);
      } catch { /* skip */ }
    }
  }

  // sourceMappingURL
  const sm = css.match(/\/\/# sourceMappingURL=(.+)/);
  if (sm) {
    try { urls.add(new URL(sm[1], baseUrl).href); } catch {}
  }

  return [...urls];
}

function extractJsUrls(js, baseUrl) {
  const urls = new Set();
  // import statements
  const imports = js.matchAll(/(?:import|export)\s+(?:\{[^}]*\}|[^"']*)\s+from\s+["']([^"']+)["']/gi);
  for (const m of imports) {
    try {
      const resolved = new URL(m[1], baseUrl).href;
      urls.add(resolved);
    } catch { /* skip bare specifiers */ }
  }
  // dynamic import()
  const dynImports = js.matchAll(/import\(["']([^"']+)["']\)/gi);
  for (const m of dynImports) {
    try {
      const resolved = new URL(m[1], baseUrl).href;
      urls.add(resolved);
    } catch {}
  }
  // sourceMappingURL
  const sm = js.match(/\/\/# sourceMappingURL=(.+)/);
  if (sm) {
    try { urls.add(new URL(sm[1], baseUrl).href); } catch {}
  }
  return [...urls];
}

async function downloadFile(url, destPath) {
  if (downloadedFiles.has(url)) return;
  downloadedFiles.add(url);

  const fullPath = join(OUTPUT_DIR, destPath);
  const dir = dirname(fullPath);
  mkdirSync(dir, { recursive: true });

  try {
    const resp = await fetchWithRetry(url);
    if (!resp) {
      errors.push(`Failed to fetch ${url}`);
      return;
    }

    // Handle redirects
    if (resp.redirected && resp.url !== url) {
      const canon = normalizeUrl(resp.url, resp.url);
      if (canon) {
        redirectMap.set(url, canon);
        if (!downloadedFiles.has(canon)) {
          const canonPath = urlToLocalPath(canon);
          downloadFile(canon, canonPath);
        }
        return;
      }
    }

    const contentType = resp.headers.get('content-type') || '';
    const isText = contentType.includes('text') || contentType.includes('javascript') ||
      contentType.includes('json') || contentType.includes('xml') ||
      contentType.includes('svg') || !contentType;

    let buffer;
    if (isText) {
      const text = await resp.text();
      buffer = Buffer.from(text, 'utf-8');
    } else {
      buffer = Buffer.from(await resp.arrayBuffer());
    }

    writeFileSync(fullPath, buffer);
    downloadedFiles.add(url);

    // If HTML, extract more URLs
    if (contentType.includes('text/html')) {
      const text = buffer.toString('utf-8');
      const urls = extractUrls(text, url);
      for (const u of urls) {
        if (isSameDomain(u) && !downloadVisited.has(u)) {
          downloadVisited.add(u);
          if (isAsset(u)) {
            const dest = urlToLocalPath(u);
            await downloadFile(u, dest);
          }
        }
      }
    }

    // If CSS, extract URLs
    if (contentType.includes('text/css')) {
      const text = buffer.toString('utf-8');
      const cssUrls = extractCssUrls(text, url);
      for (const u of cssUrls) {
        if (isSameDomain(u) && !downloadVisited.has(u)) {
          downloadVisited.add(u);
          if (isAsset(u)) {
            const dest = urlToLocalPath(u);
            await downloadFile(u, dest);
          }
        }
      }
    }

    // If JS, extract URLs
    if (contentType.includes('javascript') || contentType.includes('ecmascript') || extname(url) === '.js' || extname(url) === '.mjs') {
      const text = buffer.toString('utf-8');
      const jsUrls = extractJsUrls(text, url);
      for (const u of jsUrls) {
        if (isSameDomain(u) && !downloadVisited.has(u)) {
          downloadVisited.add(u);
          if (isAsset(u)) {
            const dest = urlToLocalPath(u);
            await downloadFile(u, dest);
          }
        }
      }
    }

    console.log(`  [OK] ${url} -> ${destPath}`);
  } catch (e) {
    errors.push(`Error downloading ${url}: ${e.message}`);
    console.error(`  [ERR] ${url}: ${e.message}`);
  }
}

async function crawlPage(url) {
  if (visited.has(url)) return;
  visited.add(url);

  console.log(`\n[CRAWL] ${url}`);
  const destPath = urlToLocalPath(url);
  const fullPath = join(OUTPUT_DIR, destPath);

  try {
    const resp = await fetchWithRetry(url);
    if (!resp) {
      errors.push(`Failed to fetch ${url}`);
      return;
    }

    // Handle redirect
    if (resp.redirected && resp.url !== url) {
      const canon = normalizeUrl(resp.url, resp.url);
      if (canon) {
        redirectMap.set(url, canon);
        if (!visited.has(canon)) {
          toVisit.push(canon);
        }
        return;
      }
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return;

    const html = await resp.text();

    // Save HTML
    const dir = dirname(fullPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, html, 'utf-8');
    downloadedFiles.add(url);

    // Extract all URLs from HTML
    const allUrls = extractUrls(html, url);

    // Separate into pages and assets
    const sameDomainUrls = allUrls.filter(isSameDomain);

    for (const u of sameDomainUrls) {
      const ext = extname(new URL(u).pathname).toLowerCase();
      const isPage = !ext || ext === '.html' || ext === '.htm' || ext === '.php' ||
        ext === '.asp' || ext === '.aspx' || ext === '' || u.endsWith('/');

      if (isAsset(u) || ext === '.json') {
        if (!downloadVisited.has(u)) {
          downloadVisited.add(u);
          const assetDest = urlToLocalPath(u);
          await downloadFile(u, assetDest);
        }
      } else if (isPage) {
        const norm = normalizeUrl(u, url);
        if (norm && !visited.has(norm) && !queued.has(norm) && visited.size + queued.size < MAX_PAGES) {
          queued.add(norm);
          toVisit.push(norm);
        }
      }
    }

    console.log(`  Saved: ${destPath}`);
  } catch (e) {
    errors.push(`Error crawling ${url}: ${e.message}`);
    console.error(`  [ERR] Crawl ${url}: ${e.message}`);
  }
}

async function downloadSiteAssets() {
  console.log('\n=== DOWNLOADING REMAINING ASSETS ===');

  // Download known asset paths
  const knownAssets = [
    '/favicon.ico', '/site.webmanifest', '/robots.txt', '/sitemap.xml',
    '/browserconfig.xml', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png',
  ];

  for (const asset of knownAssets) {
    const url = BASE_URL + asset;
    if (!downloadedFiles.has(url)) {
      downloadVisited.add(url);
      await downloadFile(url, urlToLocalPath(url));
    }
  }
}

async function main() {
  console.log('=== FTC WEBSITE MIRROR ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Start with the main page
  toVisit.push(BASE_URL + '/');

  // Crawl pages sequentially
  while (toVisit.length > 0 && visited.size < MAX_PAGES) {
    const url = toVisit.shift();
    if (visited.has(url)) continue;
    await crawlPage(url);
  }

  // Download remaining known assets
  await downloadSiteAssets();

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Pages crawled: ${visited.size}`);
  console.log(`Files downloaded: ${downloadedFiles.size}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const e of errors.slice(0, 50)) {
      console.log(`  - ${e}`);
    }
    if (errors.length > 50) console.log(`  ... and ${errors.length - 50} more`);
  }

  // Save redirect map
  if (redirectMap.size > 0) {
    const mapPath = join(OUTPUT_DIR, '_redirects.json');
    writeFileSync(mapPath, JSON.stringify([...redirectMap], null, 2));
    console.log(`\nRedirect map saved: _redirects.json (${redirectMap.size} entries)`);
  }
}

main().catch(console.error);
