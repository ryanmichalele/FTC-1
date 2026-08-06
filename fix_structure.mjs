import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, unlinkSync, readdirSync, statSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';

const SITE = resolve(import.meta.dirname, 'site');

// Find files that should be directories with index.html
function processDir(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Check if this directory has a file with the same name (without extension) inside
      processDir(full);
    } else if (entry.isFile() && !entry.name.includes('.')) {
      // File without extension - should be a directory with index.html
      const content = readFileSync(full);
      const dirPath = full;
      // This file was downloaded without extension, it's likely HTML
      // Check if it looks like HTML
      if (content[0] === 60 || content.toString('utf-8', 0, 100).includes('<!DOCTYPE html') || content.toString('utf-8', 0, 100).includes('<html')) {
        // Move to directory/index.html
        const newDir = full;
        const indexPath = join(newDir, 'index.html');
        mkdirSync(newDir, { recursive: true });
        writeFileSync(indexPath, content);
        // Now we need to remove the old file and keep the directory
        // But mkdir already created the directory with the same name
        // We wrote index.html to the new dir, so we need to clean up
        // Actually, since mkdir with same name as file fails...
        // Let me handle differently
        console.log(`Need to fix: ${full}`);
      }
    }
  }
}

function fixFiles() {
  const fixes = [
    { from: 'about-ftc/budget-strategy', name: 'budget-strategy' },
    { from: 'about-ftc/careers', name: 'careers' },
    { from: 'about-ftc/commissioners-staff', name: 'commissioners-staff' },
    { from: 'about-ftc/contact', name: 'contact' },
    { from: 'about-ftc/history', name: 'history' },
    { from: 'about-ftc/mission', name: 'mission' },
    { from: 'about-ftc/bureaus-offices/office-secretary/document-filing', name: 'document-filing' },
  ];

  for (const fix of fixes) {
    const src = join(SITE, fix.from);
    const destDir = join(SITE, fix.from.replace(/\\?$/, ''));
    const destFile = join(destDir, 'index.html');

    if (!existsSync(src)) {
      console.log(`  SKIP (not found): ${fix.from}`);
      continue;
    }

    const stat = statSync(src);
    if (stat.isDirectory()) {
      console.log(`  SKIP (already dir): ${fix.from}`);
      continue;
    }

    const content = readFileSync(src);
    if (content[0] === 60 || content.toString('utf-8', 0, 200).includes('<!DOCTYPE') || content.toString('utf-8', 0, 200).includes('<html')) {
      // Create temp directory next to the file
      const parent = dirname(src);
      const tempDir = join(parent, fix.name + '_tmp_' + Date.now());
      mkdirSync(tempDir, { recursive: true });
      const tempFile = join(tempDir, 'index.html');
      writeFileSync(tempFile, content);

      // Remove original file
      unlinkSync(src);

      // Now rename temp dir to original name
      // But only if no directory exists with that name
      if (!existsSync(destDir)) {
        renameSync(tempDir, destDir);
        console.log(`  FIXED: ${fix.from} -> ${fix.from}/index.html`);
      } else {
        // Directory exists but file was also there - just clean up
        const existingContent = readFileSync(join(destDir, 'index.html'));
        if (existingContent.length === content.length && existingContent.equals(content)) {
          unlinkSync(tempFile);
          console.log(`  SKIP (duplicate): ${fix.from}`);
        } else {
          writeFileSync(join(destDir, 'index.html'), content);
          console.log(`  MERGED: ${fix.from}`);
        }
        // Cleanup temp dir
        try {
          const files = readdirSync(tempDir);
          for (const f of files) unlinkSync(join(tempDir, f));
        } catch {}
        try { unlinkSync(tempDir); } catch {}
      }
    } else {
      console.log(`  SKIP (not HTML): ${fix.from}`);
    }
  }
}

fixFiles();
console.log('\nDone fixing file structure');
