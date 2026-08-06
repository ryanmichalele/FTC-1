import { readdirSync, renameSync, statSync, existsSync, mkdirSync } from 'fs';
import { resolve, extname, dirname, basename, join } from 'path';

const SITE_DIR = resolve(import.meta.dirname, 'site');
const seen = new Set();

function processDir(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(full);
    } else if (entry.isFile()) {
      const match = entry.name.match(/^(.+)__(?:til85l|v_[\d.]+)(\.\w+)$/);
      if (match) {
        const newName = match[1] + match[2];
        const newPath = join(dir, newName);
        if (full !== newPath && !existsSync(newPath)) {
          renameSync(full, newPath);
          console.log(`Renamed: ${entry.name} -> ${newName}`);
        }
      }
    }
  }
}

processDir(SITE_DIR);
console.log('\nDone renaming files');
