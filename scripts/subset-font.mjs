import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import subsetFont from 'subset-font';

const root = new URL('../', import.meta.url);
const source = new URL('assets/fonts/genshin.ttf', root);
const output = new URL('src/assets/fonts/genshin-subset.woff2', root);
const textExtensions = new Set(['.astro', '.ts', '.js']);

async function collectText(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const text = await Promise.all(
    entries.map(async (entry) => {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) return collectText(file);
      if (!textExtensions.has(extname(entry.name)) || entry.name.endsWith('.test.ts')) return '';
      return readFile(file, 'utf8');
    }),
  );
  return text.join('\n');
}

const ascii = Array.from({ length: 95 }, (_, index) => String.fromCodePoint(index + 32)).join('');
const text = await collectText(new URL('src/', root));
const characters = [...new Set(ascii + text)].sort().join('');
const original = await readFile(source);
const subset = await subsetFont(original, characters, { targetFormat: 'woff2' });
await mkdir(new URL('.', output), { recursive: true });
await writeFile(output, subset);

const formatSize = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
console.log(
  `Font subset: ${formatSize(original.length)} → ${formatSize(subset.length)} ` +
    `(${(100 - (subset.length / original.length) * 100).toFixed(1)}% smaller, ${characters.length} requested characters)`,
);
