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
const evidence = {
  requests: 0,
  redirectInitials: 0,
  redirectFinals: 0,
  gbkPosts: 0,
  gbkRequestBodyBase64: [],
  post307Initials: 0,
  post307Finals: 0,
  post307FinalMethods: [],
  post307FinalBodyBase64: [],
  post307ProbeHeaderPresent: 0,
};

function resetEvidence() {
  for (const key of Object.keys(evidence)) {
    evidence[key] = Array.isArray(evidence[key]) ? [] : 0;
  }
}

function sourceSearchHtml(name = 'VM Boundary Book') {
  return '<ul class="results"><li class="book"><span class="name">' + name +
    '</span><span class="author">Reader</span><a class="detail" href="/source/book/1">detail</a></li></ul>';
}

function gbkSourceSearchHtml() {
  return Buffer.concat([
    Buffer.from('<ul class="results"><li class="book"><span class="name">', 'ascii'),
    GBK_BYTES,
    Buffer.from('</span><span class="author">Reader</span><a class="detail" href="/source/book/1">detail</a></li></ul>', 'ascii'),
  ]);
}

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
    const path = url.pathname;
    if (path === '/reset') {
      resetEvidence();
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('reset');
      return;
    }
    if (path === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(evidence));
      return;
    }

    evidence.requests += 1;
    log(`REQ ${JSON.stringify({
      method: req.method,
      path: req.url,
      contentType: req.headers['content-type'] || null,
      bodyBase64: body.toString('base64'),
      headerNames: Object.keys(req.headers).sort(),
    })}`);

    if (path === '/source/redirect/search') {
      evidence.redirectInitials += 1;
      res.writeHead(302, { Location: './final/search' });
      res.end();
    } else if (path === '/source/redirect/final/search') {
      evidence.redirectFinals += 1;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(sourceSearchHtml('VM Redirect Book'));
    } else if (path === '/source/gbk/search') {
      evidence.gbkPosts += 1;
      evidence.gbkRequestBodyBase64.push(body.toString('base64'));
      // The source descriptor declares GBK. Omit the response charset so the
      // production Host must apply the descriptor fallback instead of UTF-8.
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(gbkSourceSearchHtml());
    } else if (path === '/source/post307/search') {
      evidence.post307Initials += 1;
      res.writeHead(307, { Location: '../post307-final/search' });
      res.end();
    } else if (path === '/source/post307-final/search') {
      evidence.post307Finals += 1;
      evidence.post307FinalMethods.push(req.method || '');
      evidence.post307FinalBodyBase64.push(body.toString('base64'));
      if (req.headers['x-vm-probe'] === 'header-relative') {
        evidence.post307ProbeHeaderPresent += 1;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(sourceSearchHtml('VM 307 Book'));
    } else if (path === '/source/book/1') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<article><h1>VM Boundary Book</h1><ol class="toc"><li><a href="/source/chapter/1">Chapter</a></li></ol></article>');
    } else if (path === '/source/chapter/1') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<div class="content">VM boundary fixture text is deliberately longer than fifty characters so the production L5 parser accepts this controlled non-image chapter.</div>');
    } else if (path === '/echo') {
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
