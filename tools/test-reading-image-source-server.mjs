import http from 'node:http';
import zlib from 'node:zlib';

const port = Number.parseInt(process.argv[2] ?? '18083', 10);
const baseIp = process.argv.find((value, index) => index > 0 && process.argv[index - 1] === '--base-ip')
  ?? '127.0.0.1';
const base = `http://${baseIp}:${port}`;
const slowMs = Number.parseInt(
  process.argv.find((value, index) => index > 0 && process.argv[index - 1] === '--slow-ms')
    ?? '15000',
  10);
const evidence = {
  requests: 0,
  authenticatedImages: 0,
  pngRequests: 0,
  jpegRequests: 0,
  webpRequests: 0,
  hugeRequests: 0,
  missingRequests: 0,
  corruptRequests: 0,
  slowRequests: 0,
  slowAbortedRequests: 0,
  rejectedImageRequests: 0,
  sourceAChapterLoads: 0,
  sourceBChapterLoads: 0,
  sourceBDetailLoads: 0,
};

const source = {
  bookSourceUrl: `${base}#reading-image-source`,
  bookSourceName: 'Reader 正文图片验收源',
  bookSourceGroup: 'Reader Acceptance',
  bookSourceType: 0,
  enabled: true,
  enabledExplore: false,
  enabledCookieJar: true,
  header: { Referer: `${base}/reader`, 'X-Reader-Image': 'allowed' },
  searchUrl: `${base}/search?key={{key}}`,
  ruleSearch: {
    bookList: 'li.book', name: '.name@text', author: '.author@text',
    bookUrl: '.detail@href',
  },
  ruleBookInfo: { name: 'h1@text', tocUrl: '.toc@href' },
  ruleToc: { chapterList: 'ol.toc li', chapterName: 'a@text', chapterUrl: 'a@href' },
  ruleContent: { content: '.content@html' },
};

// Second live HTTP source indexing the SAME book. It differs from the first
// only by the `X-Reader-Source: b` header it injects, which the handlers use
// to emit observably different title/body text so a completed source switch
// is verifiable on-screen and in the fixture log.
const sourceB = {
  bookSourceUrl: `${base}#reading-image-source-b`,
  bookSourceName: 'Reader 正文图片验收源 B',
  bookSourceGroup: 'Reader Acceptance',
  bookSourceType: 0,
  enabled: true,
  enabledExplore: false,
  enabledCookieJar: true,
  header: { Referer: `${base}/reader`, 'X-Reader-Image': 'allowed', 'X-Reader-Source': 'b' },
  searchUrl: `${base}/search?key={{key}}`,
  ruleSearch: source.ruleSearch,
  ruleBookInfo: source.ruleBookInfo,
  ruleToc: source.ruleToc,
  ruleContent: source.ruleContent,
};

function sourceVariant(request) {
  return request.headers['x-reader-source'] === 'b' ? 'b' : 'a';
}

function bookTitle(variant) {
  return variant === 'b' ? '图片验收书（源 B）' : '图片验收书';
}

function bodyMarker(variant) {
  return variant === 'b' ? '<p>〔来自源 B 的正文〕</p>' : '';
}

// Small valid format fixtures. The large PNG below is generated as a 1-bit
// grayscale image so its compressed wire size stays tiny while its intrinsic
// 6000x6000 dimensions exercise pre-decode downsampling.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAZAAAAEsCAIAAABi1XKVAAAD8ElEQVR4nO3UMQ0AIADAMEAI/kUhBgt8ZEmrYNfm2XsAFKzfAQCvDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLGBUXOnQA3CYTXFkAAAAAElFTkSuQmCC',
  'base64',
);
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAEsAZADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDh6KKK/Gj+bAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==',
  'base64',
);
const WEBP = Buffer.from('UklGRiYBAABXRUJQVlA4IBoBAAAwHQCdASqQASwBPjEYjESiIaEQFAAgAwS0t3C7sI9uA/AAAAtLZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk4UAAD+/+EzL//+TZfJsvk2X/Jsv//5glfkG65AAAAAAAAAAAAAAAAAAAA=', 'base64');
const HUGE_PNG = makeLargePng(6000, 6000);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name, data) {
  const type = Buffer.from(name, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}

function makeLargePng(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 1;
  header[9] = 0;
  const rowBytes = 1 + Math.ceil(width / 8);
  const pixels = Buffer.alloc(rowBytes * height);
  const compressed = zlib.deflateSync(pixels, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function cookies(request) {
  const values = new Map();
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0) values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return values;
}

function send(response, status, contentType, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': contentType, ...headers });
  response.end(body);
}

function admitImage(request, response) {
  const jar = cookies(request);
  const admitted = request.headers.referer === `${base}/reader` &&
    request.headers['x-reader-image'] === 'allowed' && jar.get('imageSession') === 'ready';
  if (!admitted) {
    evidence.rejectedImageRequests += 1;
    send(response, 403, 'text/plain; charset=utf-8', 'image header/cookie rejected');
    return false;
  }
  evidence.authenticatedImages += 1;
  return true;
}

if (process.argv.includes('--self-test')) {
  if (PNG[0] !== 0x89 || PNG.subarray(1, 4).toString('ascii') !== 'PNG' ||
    JPEG[0] !== 0xff || JPEG[1] !== 0xd8 ||
    WEBP.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    WEBP.subarray(8, 12).toString('ascii') !== 'WEBP' ||
    HUGE_PNG.readUInt32BE(16) !== 6000 || HUGE_PNG.readUInt32BE(20) !== 6000) {
    throw new Error('reading image fixture generation failed');
  }
  process.stdout.write(`reading image source fixture: PASS hugeWireBytes=${HUGE_PNG.length}\n`);
  process.exit(0);
}

const server = http.createServer((request, response) => {
  evidence.requests += 1;
  const requestUrl = new URL(request.url ?? '/', base);
  process.stdout.write(`${JSON.stringify({ method: request.method, path: requestUrl.pathname })}\n`);

  if (requestUrl.pathname === '/status') {
    send(response, 200, 'application/json; charset=utf-8', JSON.stringify(evidence));
    return;
  }
  if (requestUrl.pathname === '/reading-image-source.json') {
    send(response, 200, 'application/json; charset=utf-8', JSON.stringify(source, null, 2), {
      'Content-Disposition': 'attachment; filename="reading-image-source.json"',
    });
    return;
  }
  if (requestUrl.pathname === '/reading-image-source-b.json') {
    send(response, 200, 'application/json; charset=utf-8', JSON.stringify(sourceB, null, 2), {
      'Content-Disposition': 'attachment; filename="reading-image-source-b.json"',
    });
    return;
  }
  if (requestUrl.pathname === '/search') {
    send(response, 200, 'text/html; charset=utf-8',
      '<ul><li class="book"><span class="name">图片验收书</span>' +
      '<span class="author">Reader</span><a class="detail" href="/book/1">详情</a></li></ul>',
      { 'Set-Cookie': 'imageSession=ready; Path=/; HttpOnly; SameSite=Lax' });
    return;
  }
  if (requestUrl.pathname === '/book/1') {
    const variant = sourceVariant(request);
    if (variant === 'b') {
      evidence.sourceBDetailLoads += 1;
    }
    send(response, 200, 'text/html; charset=utf-8',
      `<article><h1>${bookTitle(variant)}</h1><a class="toc" href="/book/1/toc">目录</a></article>`);
    return;
  }
  if (requestUrl.pathname === '/book/1/toc') {
    send(response, 200, 'text/html; charset=utf-8',
      '<ol class="toc"><li><a href="/chapter-redirect/1">格式与失败</a></li>' +
      '<li><a href="/chapters/slow.html">取消慢图</a></li>' +
      '<li><a href="/chapters/good.html">双图完成</a></li>' +
      '<li><a href="/chapters/unread.html">未下载测试</a></li></ol>',
      { 'Set-Cookie': 'imageSession=ready; Path=/; HttpOnly; SameSite=Lax' });
    return;
  }
  if (requestUrl.pathname === '/chapter-redirect/1') {
    response.writeHead(302, { Location: '/chapters/volume/1.html' });
    response.end();
    return;
  }
  if (requestUrl.pathname === '/chapters/volume/1.html') {
    const variant = sourceVariant(request);
    if (variant === 'b') {
      evidence.sourceBChapterLoads += 1;
    } else {
      evidence.sourceAChapterLoads += 1;
    }
    send(response, 200, 'text/html; charset=utf-8',
      `<div class="content">${bodyMarker(variant)}<p>重定向后的相对 PNG。</p><img src="../../media/sample.png">` +
      '<p>JPEG 后的正文。</p><img src="/media/sample.jpg"><p>WebP 后的正文。</p>' +
      '<img src="/media/sample.webp"><p>超大图会预解码缩放。</p><img src="/media/huge.png">' +
      '<p>404 保留占位。</p><img src="/media/missing.png"><p>损坏图片保留占位。</p>' +
      '<img src="/media/corrupt.png"><p>所有失败块之后的文字仍须可见。</p></div>');
    return;
  }
  if (requestUrl.pathname === '/chapters/slow.html') {
    const variant = sourceVariant(request);
    if (variant === 'b') {
      evidence.sourceBChapterLoads += 1;
    } else {
      evidence.sourceAChapterLoads += 1;
    }
    send(response, 200, 'text/html; charset=utf-8',
      `<div class="content">${bodyMarker(variant)}<p>切章时必须取消下面的慢图。</p><img src="/media/slow.png">` +
      '<p>慢图后的文字。</p></div>');
    return;
  }
  if (requestUrl.pathname === '/chapters/good.html') {
    const variant = sourceVariant(request);
    if (variant === 'b') {
      evidence.sourceBChapterLoads += 1;
    } else {
      evidence.sourceAChapterLoads += 1;
    }
    send(response, 200, 'text/html; charset=utf-8',
      `<div class="content">${bodyMarker(variant)}<p>双图完整下载章节。</p><img src="/media/sample.png">` +
      '<p>第二张图。</p><img src="/media/sample.jpg"><p>双图完成尾文。</p></div>');
    return;
  }
  if (requestUrl.pathname === '/chapters/unread.html') {
    const variant = sourceVariant(request);
    if (variant === 'b') {
      evidence.sourceBChapterLoads += 1;
    } else {
      evidence.sourceAChapterLoads += 1;
    }
    send(response, 200, 'text/html; charset=utf-8',
      `<div class="content">${bodyMarker(variant)}<p>从未阅读的离线章节正文。</p></div>`);
    return;
  }
  if (requestUrl.pathname === '/media/slow.png') {
    // Slow image intentionally bypasses the auth gate: the app's
    // offline-download request path sends source headers but NOT the cookie
    // jar (observed cookie null), so gating would 403 before the stall. The
    // stall is the task-interruption vehicle; all other images stay gated.
    evidence.slowRequests += 1;
    const startedAt = Date.now();
    let timer;
    response.on('close', () => {
      const elapsed = Date.now() - startedAt;
      const finished = response.writableFinished;
      process.stdout.write(`${JSON.stringify({ slowImageClosed: true, finished, elapsedMs: elapsed })}\n`);
      if (!finished && elapsed < slowMs) {
        evidence.slowAbortedRequests = (evidence.slowAbortedRequests ?? 0) + 1;
        if (timer !== undefined) clearTimeout(timer);
      }
    });
    timer = setTimeout(() => {
      if (response.destroyed) return;
      send(response, 200, 'image/png', PNG);
    }, slowMs);
    return;
  }
  if (requestUrl.pathname.startsWith('/media/')) {
    process.stdout.write(`${JSON.stringify({
      image: requestUrl.pathname,
      referer: request.headers.referer ?? null,
      xReaderImage: request.headers['x-reader-image'] ?? null,
      cookie: request.headers.cookie ?? null,
    })}\n`);
    if (!admitImage(request, response)) return;
  }
  if (requestUrl.pathname === '/media/sample.png') {
    evidence.pngRequests += 1;
    send(response, 200, 'image/png', PNG);
    return;
  }
  if (requestUrl.pathname === '/media/sample.jpg') {
    evidence.jpegRequests += 1;
    send(response, 200, 'image/jpeg', JPEG);
    return;
  }
  if (requestUrl.pathname === '/media/sample.webp') {
    evidence.webpRequests += 1;
    send(response, 200, 'image/webp', WEBP);
    return;
  }
  if (requestUrl.pathname === '/media/huge.png') {
    evidence.hugeRequests += 1;
    send(response, 200, 'image/png', HUGE_PNG);
    return;
  }
  if (requestUrl.pathname === '/media/missing.png') {
    evidence.missingRequests += 1;
    send(response, 404, 'text/plain; charset=utf-8', 'missing image');
    return;
  }
  if (requestUrl.pathname === '/media/corrupt.png') {
    evidence.corruptRequests += 1;
    send(response, 200, 'image/png', Buffer.from('not a png'));
    return;
  }
  send(response, 404, 'text/plain; charset=utf-8', 'not found');
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`reading-image-source-server ready ${base}\n`);
});
