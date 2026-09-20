import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '..', 'output', 'publish');
// Explicit allowlist: never bundle .git, source data, handoff notes, or old studies.
const files = [
  'index.html', 'css/journey.css', 'js/journey.js', 'js/stage.js',
  'assets/stage/real.jpg', 'assets/stage/clay.jpg', 'assets/stage/felt.jpg',
  'assets/headshot.jpg', 'assets/Aryan-Mehta-Resume.pdf', 'assets/favicon.svg', 'assets/social-preview.png',
  'fonts/Prata-Regular.ttf', 'fonts/Caveat-wght.ttf', 'fonts/SpaceMono-Bold.ttf', 'fonts/Newsreader-Italic-wght.ttf',
  'fonts/source-sans-3-latin-wght-normal.woff2', 'fonts/SOURCE-SANS-LICENSE', 'fonts/NEWSREADER-LICENSE'
];
for (const file of files) {
  const target = resolve(output, file);
  await mkdir(dirname(target), { recursive: true });
  await cp(resolve(root, file), target);
}
await writeFile(resolve(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`);
console.log(`Publishing files prepared in ${output}`);
