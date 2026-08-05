#!/usr/bin/env node
/**
 * Controllable HTTP server for the `http.execute` host acceptance suite
 * (docs/HTTP_EXECUTE_ACCEPTANCE.md). Records every request (method, URL,
 * headers, body) to stdout so the device/Host/Core behaviour can be checked
 * against what actually reached the wire.
 *
 * Usage:
 *   node tools/http-execute-test-server.js [PORT=8000]
 *
 * Endpoints:
 *   /echo                       200 JSON { method, url, headers, bodyBase64 }
 *   /redirect                   302 -> /final
 *   /redirect-loop              302 -> /redirect-loop (infinite, for hop cap)
 *   /redirect-depth?n=K         302 chain of length K, then /final
 *   /final                      200 html with a RELATIVE link
 *   /slow?ms=N                  responds after N ms (for the deadline case)
 *   /propfind                   answers PROPFIND (any method) with 207
 *   /gbk                        text/plain; charset=gbk with hardcoded GBK bytes
 */
'use strict';

const http = require('http');

const PORT = Number(process.argv[2] || process.env.PORT || 8000);
// "中文" encoded as GBK (D6 D0 / CE C4).
const GBK_BYTES = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);

function log(line) {
  // ISO timestamp so the observer can correlate request ordering with
  // Host host.complete / host.error timestamps.
  process.stdout.write(`${new Date().toISOString()} ${line}\n`);
}

const server = http.createServer((req, res) => {
  // Record whether the connection closed before the response finished. For a
  // cancelled in-flight request (`destroy()`), this logs finished=false and is
  // the evidence the Host actually aborted the socket rather than waiting.
  res.on('close', () => {
    log(`RES_CLOSE ${req.method} ${req.url} finished=${res.writableFinished}`);
  });
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const host = req.headers.host || `localhost:${PORT}`;
    let url;
    try {
      url = new URL(req.url, `http://${host}`);
    } catch (error) {
      log(`INVALID_URL ${req.method} ${req.url}`);
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('invalid url');
      return;
    }
    log(`REQ ${req.method} ${req.url} ctype=${req.headers['content-type'] || '-'} body=${body.toString('utf8').slice(0, 160)}`);
    const path = url.pathname;

    if (path === '/echo') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        method: req.method,
        url: req.url,
        headers: req.headers,
        bodyBase64: body.toString('base64'),
      }));
    } else if (path === '/redirect') {
      res.writeHead(302, { Location: '/final' });
      res.end();
    } else if (path === '/redirect-loop') {
      res.writeHead(302, { Location: '/redirect-loop' });
      res.end();
    } else if (path === '/redirect-depth') {
      const n = Number(url.searchParams.get('n') || 1);
      if (n <= 1) {
        res.writeHead(302, { Location: '/final' });
        res.end();
      } else {
        res.writeHead(302, { Location: `/redirect-depth?n=${n - 1}` });
        res.end();
      }
    } else if (path === '/final') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><a href="relative/next.html">next</a></body></html>');
    } else if (path === '/slow') {
      const ms = Number(url.searchParams.get('ms') || 10000);
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('slow done');
      }, ms);
    } else if (path === '/propfind') {
      res.writeHead(207, { 'Content-Type': 'application/xml' });
      res.end('<multistatus xmlns="DAV:"><response><status>HTTP/1.1 200 OK</status></response></multistatus>');
    } else if (path === '/gbk') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=gbk' });
      res.end(GBK_BYTES);
    } else {
      log(`MISS ${req.method} ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`not found: ${path}`);
    }
  });
});

server.listen(PORT, () => {
  log(`http-execute test server listening on http://0.0.0.0:${PORT}`);
});
