import http from 'node:http';

const port = Number.parseInt(process.argv[2] ?? '18080', 10);
let aInitialized = false;
const evidence = {
  requests: 0,
  aFirstBootstraps: 0,
  aCleanBootstraps: 0,
  aCleanupLeakFailures: 0,
  aPersistentReused: 0,
  aMissingPersistentAfterBootstrap: 0,
  bIsolationPasses: 0,
  bLeakFailures: 0,
};

function cookies(request) {
  const parsed = new Map();
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    parsed.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return parsed;
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  response.end(body);
}

function requireCookie(response, jar, name, value, route) {
  if (jar.get(name) === value) return true;
  send(response, 412, `missing ${name} for ${route}`);
  return false;
}

const server = http.createServer((request, response) => {
  evidence.requests += 1;
  const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  const jar = cookies(request);
  process.stdout.write(`${JSON.stringify({
    method: request.method,
    path: requestUrl.pathname,
    cookies: [...jar.keys()].sort(),
  })}\n`);

  if (requestUrl.pathname === '/health') {
    send(response, 200, 'ok');
    return;
  }
  if (requestUrl.pathname === '/status') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ aInitialized, ...evidence }));
    return;
  }
  if (requestUrl.pathname === '/reset') {
    aInitialized = false;
    for (const key of Object.keys(evidence)) evidence[key] = 0;
    send(response, 200, 'reset');
    return;
  }
  if (requestUrl.pathname === '/reset-a') {
    aInitialized = false;
    send(response, 200, 'source A reset without clearing evidence');
    return;
  }

  if (requestUrl.pathname === '/a/search') {
    if (aInitialized && jar.get('persist') !== 'a-persistent') {
      evidence.aMissingPersistentAfterBootstrap += 1;
      send(response, 428, 'persistent cookie was not restored');
      return;
    }
    if (aInitialized) {
      evidence.aPersistentReused += 1;
    } else {
      if (jar.has('sid') || jar.has('persist')) {
        evidence.aCleanupLeakFailures += 1;
      } else {
        evidence.aCleanBootstraps += 1;
      }
      aInitialized = true;
      evidence.aFirstBootstraps += 1;
    }
    send(response, 200,
      '<ul class="results"><li class="book"><span class="name">Cookie A</span>' +
      '<span class="author">Reader</span><a class="detail" href="/a/book/1">detail</a></li></ul>',
      { 'Set-Cookie': [
        'sid=a-session; Path=/a; HttpOnly; SameSite=Lax',
        'persist=a-persistent; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax',
      ] });
    return;
  }
  if (requestUrl.pathname === '/a/book/1') {
    if (!requireCookie(response, jar, 'sid', 'a-session', 'a detail/toc') ||
      !requireCookie(response, jar, 'persist', 'a-persistent', 'a detail/toc')) return;
    send(response, 200,
      '<article><h1>Cookie A</h1><ol class="toc"><li>' +
      '<a href="/a/chapter/1">A Chapter</a></li></ol></article>');
    return;
  }
  if (requestUrl.pathname === '/a/chapter/1') {
    if (!requireCookie(response, jar, 'sid', 'a-session', 'a content') ||
      !requireCookie(response, jar, 'persist', 'a-persistent', 'a content')) return;
    send(response, 200,
      '<div class="content">Cookie A content remains longer than fifty characters so L5 validates the same source session across every production request.</div>');
    return;
  }

  if (requestUrl.pathname === '/b/search') {
    if (jar.has('sid') || jar.has('persist')) {
      evidence.bLeakFailures += 1;
      send(response, 409, 'source A cookie leaked into source B');
      return;
    }
    evidence.bIsolationPasses += 1;
    send(response, 200,
      '<ul class="results"><li class="book"><span class="name">Cookie B</span>' +
      '<span class="author">Reader</span><a class="detail" href="/b/book/1">detail</a></li></ul>',
      { 'Set-Cookie': 'sid=b-session; Path=/b; HttpOnly; SameSite=Strict' });
    return;
  }
  if (requestUrl.pathname === '/b/book/1') {
    if (!requireCookie(response, jar, 'sid', 'b-session', 'b detail/toc') ||
      jar.has('persist')) return;
    send(response, 200,
      '<article><h1>Cookie B</h1><ol class="toc"><li>' +
      '<a href="/b/chapter/1">B Chapter</a></li></ol></article>');
    return;
  }
  if (requestUrl.pathname === '/b/chapter/1') {
    if (!requireCookie(response, jar, 'sid', 'b-session', 'b content') ||
      jar.has('persist')) return;
    send(response, 200,
      '<div class="content">Cookie B content is also longer than fifty characters and proves its isolated source session completed the production chain.</div>');
    return;
  }

  send(response, 404, 'not found');
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`cookie-session-server ready http://127.0.0.1:${port}\n`);
});
