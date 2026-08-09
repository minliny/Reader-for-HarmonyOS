import http from 'node:http';

const port = Number.parseInt(process.argv[2] ?? '18082', 10);
const evidence = {
  requests: 0,
  bootstrapLoads: 0,
  authenticatedSearches: 0,
  loginPageLoads: 0,
  loginCookieSearches: 0,
  missingCookieFailures: 0,
};

const loginSourceFixture = {
  bookSourceUrl: `http://127.0.0.1:${port}#arkweb-login-source`,
  bookSourceName: 'ArkWeb 登录源',
  bookSourceGroup: 'Reader Acceptance',
  bookSourceType: 0,
  enabled: true,
  enabledExplore: false,
  enabledCookieJar: true,
  loginUrl: `http://127.0.0.1:${port}/login`,
  searchUrl: `@js:java.webView(null, "http://127.0.0.1:${port}/bootstrap", "document.title"); "http://127.0.0.1:${port}/search?key=" + encodeURIComponent(key)`,
  ruleSearch: {
    bookList: 'li.book',
    name: '.name@text',
    author: '.author@text',
    bookUrl: '.detail@href',
    checkKeyWord: 'ArkWeb',
  },
  ruleBookInfo: { name: 'h1@text', tocUrl: '' },
  ruleToc: { chapterList: 'ol.toc li', chapterName: 'a@text', chapterUrl: 'a@href' },
  ruleContent: { content: '.content@html' },
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

function requireArkWebCookie(response, jar, route) {
  if (jar.get('webtoken') === 'arkweb-ready' && jar.get('logintoken') === 'user-complete') {
    return true;
  }
  evidence.missingCookieFailures += 1;
  send(response, 401, `missing ArkWeb cookie for ${route}`);
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

  if (requestUrl.pathname === '/status') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(evidence));
    return;
  }
  if (requestUrl.pathname === '/arkweb-login-source.json') {
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="arkweb-login-source.json"',
    });
    response.end(JSON.stringify(loginSourceFixture, null, 2));
    return;
  }
  if (requestUrl.pathname === '/bootstrap') {
    evidence.bootstrapLoads += 1;
    send(response, 200,
      '<!doctype html><html><head><title>ArkWeb Ready</title></head>' +
      '<body><main id="ready">background executor ready</main></body></html>',
      { 'Set-Cookie': 'webtoken=arkweb-ready; Path=/; HttpOnly; SameSite=Lax' });
    return;
  }
  if (requestUrl.pathname === '/login') {
    evidence.loginPageLoads += 1;
    send(response, 200,
      '<!doctype html><html><head><title>Reader Source Login</title></head><body>' +
      '<main><h1>ArkWeb 登录验收</h1><button id="login" style="font-size:40px;padding:24px" ' +
      'onclick="document.cookie=\'logintoken=user-complete; Path=/; SameSite=Lax\';' +
      'document.title=\'Login Complete\';this.textContent=\'登录已完成\'">授权登录</button>' +
      '</main></body></html>');
    return;
  }
  if (requestUrl.pathname === '/search') {
    if (!requireArkWebCookie(response, jar, 'search')) return;
    evidence.authenticatedSearches += 1;
    evidence.loginCookieSearches += 1;
    send(response, 200,
      '<ul class="results"><li class="book"><span class="name">ArkWeb Book</span>' +
      '<span class="author">Reader</span><a class="detail" href="/book/1">detail</a></li></ul>');
    return;
  }
  if (requestUrl.pathname === '/book/1') {
    if (!requireArkWebCookie(response, jar, 'detail/toc')) return;
    send(response, 200,
      '<article><h1>ArkWeb Book</h1><ol class="toc"><li>' +
      '<a href="/chapter/1">ArkWeb Chapter</a></li></ol></article>');
    return;
  }
  if (requestUrl.pathname === '/chapter/1') {
    if (!requireArkWebCookie(response, jar, 'content')) return;
    send(response, 200,
      '<div class="content">ArkWeb authenticated content remains longer than fifty characters and proves the WebView cookie joined the normal production HTTP reading chain.</div>');
    return;
  }
  send(response, 404, 'not found');
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`arkweb-source-server ready http://127.0.0.1:${port}\n`);
});
