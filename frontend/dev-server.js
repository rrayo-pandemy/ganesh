const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.FRONTEND_HOST || '0.0.0.0';
const PORT = Number(process.env.FRONTEND_PORT || 8000);
const ROOT_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const clients = new Set();

function writeNoCacheHeaders(res, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

function broadcastReload(filePath) {
  const payload = `data: ${JSON.stringify({ type: 'reload', filePath, at: Date.now() })}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function injectReloadScript(html) {
  const reloadScript = `
<script>
(() => {
  const source = new EventSource('/__dev_events');
  source.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data || '{}');
      if (message.type === 'reload') {
        window.location.reload();
      }
    } catch (_error) {}
  };
  source.onerror = () => {
    source.close();
    setTimeout(() => window.location.reload(), 1500);
  };
})();
</script>`;

  if (html.includes('/__dev_events')) return html;
  if (html.includes('</body>')) return html.replace('</body>', `${reloadScript}\n</body>`);
  return `${html}\n${reloadScript}`;
}

function safeResolve(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const absolutePath = path.resolve(ROOT_DIR, `.${normalizedPath}`);

  if (!absolutePath.startsWith(ROOT_DIR)) return null;
  return absolutePath;
}

function serveFile(filePath, res) {
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      writeNoCacheHeaders(res, 'text/plain; charset=utf-8');
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    if (ext === '.html') {
      fs.readFile(filePath, 'utf8', (readError, html) => {
        if (readError) {
          writeNoCacheHeaders(res, 'text/plain; charset=utf-8');
          res.statusCode = 500;
          res.end('Error reading file');
          return;
        }

        writeNoCacheHeaders(res, contentType);
        res.end(injectReloadScript(html));
      });
      return;
    }

    writeNoCacheHeaders(res, contentType);
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    writeNoCacheHeaders(res, 'text/plain; charset=utf-8');
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  if (req.url === '/__dev_events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');
    clients.add(res);

    req.on('close', () => {
      clients.delete(res);
    });
    return;
  }

  const filePath = safeResolve(req.url);
  if (!filePath) {
    writeNoCacheHeaders(res, 'text/plain; charset=utf-8');
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  serveFile(filePath, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Frontend dev server running on http://localhost:${PORT}`);
  console.log(`Serving files from ${ROOT_DIR}`);
});

fs.watch(ROOT_DIR, { recursive: true }, (_eventType, changedPath) => {
  if (!changedPath) return;
  if (changedPath.includes('.git')) return;
  broadcastReload(changedPath.replace(/\\/g, '/'));
});
