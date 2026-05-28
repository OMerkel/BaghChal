// Minimal static-file HTTP server used by Playwright's webServer.
// No dependencies – uses only Node built-in modules.
// Usage:  node tests/server.js

import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // src/
const PORT = 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webapp': 'application/x-web-app-manifest+json',
};

createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  const filePath = join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) {
      const index = join(filePath, 'index.html');
      const data = await readFile(index);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
      return;
    }
    const data = await readFile(filePath);
    const mime = MIME[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
});
