import http from 'node:http';

const port = Number.parseInt(process.argv[2] ?? '18084', 10);
const baseIp = process.argv.find((value, index) => index > 0 && process.argv[index - 1] === '--base-ip')
  ?? '127.0.0.1';
const slowMs = Number.parseInt(
  process.argv.find((value, index) => index > 0 && process.argv[index - 1] === '--slow-ms')
    ?? '25000',
  10,
);
const base = `http://${baseIp}:${port}`;
let online = true;
const evidence = {
  requests: 0,
  searches: 0,
  sourceADetailLoads: 0,
  sourceBDetailLoads: 0,
  sourceAChapterLoads: 0,
  sourceBChapterLoads: 0,
  slowTextRequests: 0,
  slowTextAbortedRequests: 0,
  offlineRejectedRequests: 0,
};

function resetEvidence() {
  online = true;
  for (const key of Object.keys(evidence)) evidence[key] = 0;
}

function source(variant) {
  return {
    bookSourceUrl: `${base}#reading-text-${variant}`,
    bookSourceName: `Reader 纯文字验收源 ${variant.toUpperCase()}`,
    bookSourceGroup: 'Reader Acceptance',
    bookSourceType: 0,
    enabled: true,
    enabledExplore: false,
    searchUrl: `${base}/text/search?key={{key}}`,
    header: { 'X-Reader-Source': variant },
    ruleSearch: {
      bookList: 'li.book', name: '.name@text', author: '.author@text', bookUrl: '.detail@href',
    },
    ruleBookInfo: { name: 'h1@text', tocUrl: '.toc@href' },
    ruleToc: { chapterList: 'ol.toc li', chapterName: 'a@text', chapterUrl: 'a@href' },
    ruleContent: { content: '.content@html' },
  };
}

function send(response, status, body, contentType = 'text/html; charset=utf-8', headers = {}) {
  response.writeHead(status, { 'Content-Type': contentType, ...headers });
  response.end(body);
}

function variantOf(request) {
  return request.headers['x-reader-source'] === 'b' ? 'b' : 'a';
}

function body(variant, label) {
  const marker = variant === 'b' ? '〔纯文字源 B〕' : '〔纯文字源 A〕';
  return `<div class="content"><p>${marker}${label}。这是受控纯文字章节，正文长度超过五十个字符，用于验证离线读取、任务取消、缓存清理和跨章节换源，而不触发任何图片路径。</p></div>`;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', base);
  if (requestUrl.pathname === '/reset') {
    resetEvidence();
    send(response, 200, 'reset', 'text/plain; charset=utf-8');
    return;
  }
  if (requestUrl.pathname === '/status') {
    send(response, 200, JSON.stringify({ online, ...evidence }), 'application/json; charset=utf-8');
    return;
  }
  if (requestUrl.pathname === '/mode') {
    online = requestUrl.searchParams.get('online') !== '0';
    send(response, 200, JSON.stringify({ online }), 'application/json; charset=utf-8');
    return;
  }
  if (requestUrl.pathname === '/reading-text-sources.json') {
    send(response, 200, JSON.stringify([source('a'), source('b')], null, 2),
      'application/json; charset=utf-8', {
        'Content-Disposition': 'attachment; filename="reading-text-sources.json"',
      });
    return;
  }

  evidence.requests += 1;
  process.stdout.write(`${JSON.stringify({ method: request.method, path: requestUrl.pathname,
    source: variantOf(request), online })}\n`);
  if (!online) {
    evidence.offlineRejectedRequests += 1;
    send(response, 503, 'fixture offline', 'text/plain; charset=utf-8');
    return;
  }

  const variant = variantOf(request);
  if (requestUrl.pathname === '/text/search') {
    evidence.searches += 1;
    send(response, 200,
      '<ul><li class="book"><span class="name">VM 纯文字书</span>' +
      '<span class="author">Reader</span><a class="detail" href="/text/book/1">详情</a></li></ul>');
    return;
  }
  if (requestUrl.pathname === '/text/book/1') {
    if (variant === 'b') evidence.sourceBDetailLoads += 1;
    else evidence.sourceADetailLoads += 1;
    send(response, 200,
      '<article><h1>VM 纯文字书</h1><a class="toc" href="/text/book/1/toc">目录</a></article>');
    return;
  }
  if (requestUrl.pathname === '/text/book/1/toc') {
    send(response, 200,
      '<ol class="toc"><li><a href="/text/chapter/offline">离线文字</a></li>' +
      '<li><a href="/text/chapter/slow">慢正文中断</a></li>' +
      '<li><a href="/text/chapter/missing">未下载文字</a></li>' +
      '<li><a href="/text/chapter/clear">缓存清理文字</a></li></ol>');
    return;
  }
  if (requestUrl.pathname === '/text/chapter/slow') {
    evidence.slowTextRequests += 1;
    let finished = false;
    request.on('close', () => {
      if (!finished) evidence.slowTextAbortedRequests += 1;
      process.stdout.write(`${JSON.stringify({ slowTextClosed: true, finished })}\n`);
    });
    setTimeout(() => {
      finished = true;
      if (variant === 'b') evidence.sourceBChapterLoads += 1;
      else evidence.sourceAChapterLoads += 1;
      send(response, 200, body(variant, '慢正文完成'));
    }, slowMs);
    return;
  }
  const labels = new Map([
    ['/text/chapter/offline', '离线文字已缓存'],
    ['/text/chapter/missing', '未下载章节只允许在线读取'],
    ['/text/chapter/clear', '缓存清理前正文'],
  ]);
  const label = labels.get(requestUrl.pathname);
  if (label !== undefined) {
    if (variant === 'b') evidence.sourceBChapterLoads += 1;
    else evidence.sourceAChapterLoads += 1;
    send(response, 200, body(variant, label));
    return;
  }
  send(response, 404, 'not found', 'text/plain; charset=utf-8');
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`reading-text-source-server ready ${base}\n`);
});
