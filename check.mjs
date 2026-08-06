import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const html = readFileSync(join(import.meta.dirname, 'site', 'index.html'), 'utf-8');

const urls = new Set();
const patterns = [
  /<script[^>]+src="([^"]+)"/g,
  /<link[^>]+href="([^"]+)"/g,
  /<img[^>]+src="([^"]+)"/g,
  /<source[^>]+src="([^"]+)"/g,
  /<video[^>]+src="([^"]+)"/g,
  /srcset="([^"]+)"/g,
  /<meta[^>]+content="([^"]+)"/g,
  /url\(["']?([^"')]+)["']?\)/g,
];

for (const regex of patterns) {
  const matches = html.matchAll(regex);
  for (const m of matches) {
    const raw = m[1];
    if (raw.includes(',')) {
      for (const part of raw.split(',')) {
        const trimmed = part.trim().split(/\s+/)[0];
        if (trimmed) urls.add(trimmed);
      }
    } else {
      urls.add(raw);
    }
  }
}

const root = resolve(import.meta.dirname, 'site');

const localUrls = [...urls].filter(u => {
  if (u.startsWith('http')) {
    return u.includes('ftc.gov');
  }
  return !u.startsWith('#') && !u.startsWith('mailto:') && !u.startsWith('tel:') && !u.startsWith('javascript:');
});

const externalUrls = [...urls].filter(u => u.startsWith('http') && !u.includes('ftc.gov'));

console.log('=== MISSING LOCAL ASSETS FROM INDEX.HTML ===');
let missing = 0;
let found = 0;
for (const url of localUrls) {
  const clean = url.split('?')[0].split('#')[0];
  let localPath;
  if (url.startsWith('http')) {
    const u = new URL(url);
    localPath = join(root, u.pathname.replace(/^\//, '').replace(/\\/g, '/'));
  } else {
    localPath = join(root, clean.replace(/^\//, '').replace(/\\/g, '/'));
  }
  if (existsSync(localPath)) {
    found++;
  } else {
    // Check with index.html
    if (existsSync(join(localPath, 'index.html'))) {
      found++;
    } else {
      missing++;
      console.log('MISSING: ' + url);
    }
  }
}
console.log('Found: ' + found);
console.log('Missing: ' + missing);

console.log('\n=== EXTERNAL RESOURCES ===');
for (const url of externalUrls) {
  console.log(url);
}
