import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep) || relative.split(/[\\/]/).some(part => part.startsWith('.') || part.startsWith('_')) || !mime[extname(path)]) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Aryan portfolio: http://127.0.0.1:${port}`));
