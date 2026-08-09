import http from 'node:http';
import zlib from 'node:zlib';

const port = Number.parseInt(process.argv[2] ?? '18083', 10);
const base = `http://127.0.0.1:${port}`;
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
  rejectedImageRequests: 0,
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
    bookUrl: '.detail@href', checkKeyWord: '图片验收',
  },
  ruleBookInfo: { name: 'h1@text', tocUrl: '.toc@href' },
  ruleToc: { chapterList: 'ol.toc li', chapterName: 'a@text', chapterUrl: 'a@href' },
  ruleContent: { content: '.content@html' },
};

// Small valid format fixtures. The large PNG below is generated as a 1-bit
// grayscale image so its compressed wire size stays tiny while its intrinsic
// 6000x6000 dimensions exercise pre-decode downsampling.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP8z8AARAwMDAwMDAwAAAwBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//9k=',
  'base64',
);
const WEBP = Buffer.from('UklGRkoAAABXRUJQVlA4ID4AAADQAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64');
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
  if (requestUrl.pathname === '/search') {
    send(response, 200, 'text/html; charset=utf-8',
      '<ul><li class="book"><span class="name">图片验收书</span>' +
      '<span class="author">Reader</span><a class="detail" href="/book/1">详情</a></li></ul>',
      { 'Set-Cookie': 'imageSession=ready; Path=/; HttpOnly; SameSite=Lax' });
    return;
  }
  if (requestUrl.pathname === '/book/1') {
    send(response, 200, 'text/html; charset=utf-8',
      '<article><h1>图片验收书</h1><a class="toc" href="/book/1/toc">目录</a></article>');
    return;
  }
  if (requestUrl.pathname === '/book/1/toc') {
    send(response, 200, 'text/html; charset=utf-8',
      '<ol class="toc"><li><a href="/chapter-redirect/1">格式与失败</a></li>' +
      '<li><a href="/chapters/slow.html">取消慢图</a></li></ol>');
    return;
  }
  if (requestUrl.pathname === '/chapter-redirect/1') {
    response.writeHead(302, { Location: '/chapters/volume/1.html' });
    response.end();
    return;
  }
  if (requestUrl.pathname === '/chapters/volume/1.html') {
    send(response, 200, 'text/html; charset=utf-8',
      '<div class="content"><p>重定向后的相对 PNG。</p><img src="../../media/sample.png">' +
      '<p>JPEG 后的正文。</p><img src="/media/sample.jpg"><p>WebP 后的正文。</p>' +
      '<img src="/media/sample.webp"><p>超大图会预解码缩放。</p><img src="/media/huge.png">' +
      '<p>404 保留占位。</p><img src="/media/missing.png"><p>损坏图片保留占位。</p>' +
      '<img src="/media/corrupt.png"><p>所有失败块之后的文字仍须可见。</p></div>');
    return;
  }
  if (requestUrl.pathname === '/chapters/slow.html') {
    send(response, 200, 'text/html; charset=utf-8',
      '<div class="content"><p>切章时必须取消下面的慢图。</p><img src="/media/slow.png">' +
      '<p>慢图后的文字。</p></div>');
    return;
  }
  if (requestUrl.pathname.startsWith('/media/') && !admitImage(request, response)) return;
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
  if (requestUrl.pathname === '/media/slow.png') {
    evidence.slowRequests += 1;
    setTimeout(() => send(response, 200, 'image/png', PNG), 15000);
    return;
  }
  send(response, 404, 'text/plain; charset=utf-8', 'not found');
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`reading-image-source-server ready ${base}\n`);
});
