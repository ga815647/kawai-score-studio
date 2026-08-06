import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const host = '127.0.0.1';
const port = 4173;
const root = resolve('dist');
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
]);

function requestPath(url = '/') {
  const pathname = new URL(url, `http://${host}:${port}`).pathname;
  const relative = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname)).replace(/^[/\\]+/, '');
  const filePath = resolve(join(root, relative));
  if (filePath !== root && !filePath.startsWith(`${root}/`)) throw new Error('Path traversal');
  return filePath;
}

const server = createServer(async (request, response) => {
  try {
    const filePath = requestPath(request.url);
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error('Not a file');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': mime.get(extname(filePath)) ?? 'application/octet-stream',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, host, () => console.log(`Serving dist at http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
