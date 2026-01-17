const path = require('path');
process.chdir(__dirname);

// Prefer standalone entry if present, fallback to normal Next server if not.
const standaloneEntry = path.join(__dirname, '.next', 'standalone', 'server.js');

try {
  require(standaloneEntry);
} catch (e) {
  // fallback: run next start style server (requires build present)
  const http = require('http');
  const { parse } = require('url');
  const next = require('next');

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOSTNAME || '0.0.0.0';
  const app = next({ dev: false, hostname: host, port });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    http.createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, host, (err) => {
      if (err) throw err;
      console.log(`> Next.js ready on http://${host}:${port}`);
    });
  }).catch((err) => {
    console.error('Failed to start Next.js:', err);
    process.exit(1);
  });
}
