#!/usr/bin/env node

import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { pathToFileURL } from 'node:url';

const basePath = '/dav/m5';
const directory = '/ReaderBackup/ReaderHarmony';
const routedDirectory = `${basePath}${directory}`;
const maxBodyBytes = 70 * 1024 * 1024;
function safeEqual(left, right) {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sendJson(response, status, body) {
  const encoded = Buffer.from(`${JSON.stringify(body)}\n`, 'utf8');
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': encoded.length,
    connection: 'close',
  });
  response.end(encoded);
}

function sendEmpty(response, status, headers = {}) {
  response.writeHead(status, { 'content-length': '0', connection: 'close', ...headers });
  response.end();
}

function xmlEscape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function multistatusBody(files) {
  const resources = [
    `<d:response><d:href>${xmlEscape(`${routedDirectory}/`)}</d:href>` +
      '<d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>' +
      '<d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>',
  ];
  for (const [path, body] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    resources.push(
      `<d:response><d:href>${xmlEscape(`${basePath}${path}`)}</d:href>` +
        `<d:propstat><d:prop><d:getcontentlength>${body.length}</d:getcontentlength>` +
        `<d:getetag>${xmlEscape(etag(body))}</d:getetag>` +
        '</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>',
    );
  }
  return Buffer.from(
    '<?xml version="1.0" encoding="utf-8"?>' +
      `<d:multistatus xmlns:d="DAV:">${resources.join('')}</d:multistatus>`,
    'utf8',
  );
}

async function readBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBodyBytes) {
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function etag(body) {
  return body === undefined ? undefined : `"${crypto.createHash('sha256').update(body).digest('hex')}"`;
}

export async function startWebdavProductTestServer({ host = '127.0.0.1', port = 0, user = 'reader',
  password = 'm5-pass', seedCount = 5, tls } = {}) {
  const expectedAuthorization = `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;

  const files = new Map();
  for (let index = 0; index < seedCount; index += 1) {
    const timestamp = `${1700000000000 + index}`;
    const checksum = `${index + 1}`.repeat(12);
    files.set(
      `${directory}/reader-storage-${timestamp}-${checksum}.reader-backup.json`,
      Buffer.from('{"seed":true}', 'utf8'),
    );
  }

  const counters = {
    requests: 0,
    authenticatedRequests: 0,
    unauthorizedRequests: 0,
    propfind: 0,
    mkcol: 0,
    put: 0,
    get: 0,
    delete: 0,
    notFound: 0,
  };
  let uploadedBodySha256 = '';
  let uploadedBytes = 0;
  let uploadedBodyContainsPlaintextMarker = false;
  const requests = [];
  let expired = false;
  let transformRead = body => body;

  function sanitizedStatus() {
    return {
      fixture: 'reader-webdav-product-v1',
      basePath,
      directory,
      counters: { ...counters },
      fileCount: files.size,
      fileNames: [...files.keys()].map((path) => path.split('/').at(-1)).sort(),
      uploadedBytes,
      uploadedBodySha256,
      uploadedBodyContainsPlaintextMarker,
    };
  }

  const handler = async (request, response) => {
    counters.requests += 1;
    const parsed = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (request.method === 'GET' && parsed.pathname === '/status') {
      sendJson(response, 200, sanitizedStatus());
      return;
    }

    const authorization = request.headers.authorization ?? '';
    if (expired || !safeEqual(authorization, expectedAuthorization)) {
      counters.unauthorizedRequests += 1;
      sendEmpty(response, 401, { 'www-authenticate': 'Basic realm="Reader M5 fixture"' });
      return;
    }
    counters.authenticatedRequests += 1;

    if (!parsed.pathname.startsWith(routedDirectory)) {
      counters.notFound += 1;
      sendEmpty(response, 404);
      return;
    }
    const relativePath = parsed.pathname.slice(basePath.length).replace(/\/+$/, '');
    requests.push({ method: request.method, path: relativePath, condition: request.headers['if-none-match'] });

    if (request.method === 'MKCOL' && relativePath === directory) {
      counters.mkcol += 1;
      sendEmpty(response, 405);
      return;
    }
    if (request.method === 'PROPFIND' && relativePath === directory) {
      counters.propfind += 1;
      const body = multistatusBody(files);
      response.writeHead(207, {
        'content-type': 'application/xml; charset=utf-8',
        'content-length': body.length,
        connection: 'close',
      });
      response.end(body);
      return;
    }
    if (request.method === 'PUT' && relativePath.endsWith('.reader-backup.json')) {
      counters.put += 1;
      try {
        const body = await readBody(request);
        if (request.headers['if-none-match'] === '*' && files.has(relativePath)) {
          sendEmpty(response, 412);
          return;
        }
        if (request.headers['if-match'] !== undefined && request.headers['if-match'] !== etag(files.get(relativePath))) {
          sendEmpty(response, 412);
          return;
        }
        files.set(relativePath, body);
        uploadedBytes = body.length;
        uploadedBodySha256 = crypto.createHash('sha256').update(body).digest('hex');
        uploadedBodyContainsPlaintextMarker = body.includes('M5_VM_PLAINTEXT_SOURCE_MARKER');
        sendEmpty(response, 201, { etag: etag(body) });
      } catch (error) {
        sendEmpty(response, error instanceof Error && error.message === 'BODY_TOO_LARGE' ? 413 : 400);
      }
      return;
    }
    if (request.method === 'GET' && relativePath.endsWith('.reader-backup.json')) {
      counters.get += 1;
      const original = files.get(relativePath);
      const body = original === undefined ? undefined : transformRead(original);
      if (body === undefined) {
        counters.notFound += 1;
        sendEmpty(response, 404);
        return;
      }
      response.writeHead(200, {
        'content-type': 'application/json',
        etag: etag(body),
        'content-length': body.length,
        connection: 'close',
      });
      response.end(body);
      return;
    }
    if (request.method === 'DELETE' && relativePath.endsWith('.reader-backup.json')) {
      counters.delete += 1;
      const deleted = files.delete(relativePath);
      sendEmpty(response, deleted ? 204 : 404);
      return;
    }

    counters.notFound += 1;
    sendEmpty(response, 404);
  };

  const server = tls === undefined ? http.createServer(handler) : https.createServer(tls, handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return {
    port: server.address().port, basePath, directory, requests,
    status: sanitizedStatus,
    expireAuthorization(value) { expired = value; },
    changeRead(transform) { transformRead = transform; },
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const fixture = await startWebdavProductTestServer({
    host: process.env.READER_WEBDAV_FIXTURE_HOST ?? '0.0.0.0',
    port: Number.parseInt(process.env.READER_WEBDAV_FIXTURE_PORT ?? '18085', 10),
    user: process.env.READER_WEBDAV_FIXTURE_USER ?? 'reader',
    password: process.env.READER_WEBDAV_FIXTURE_PASSWORD ?? 'm5-pass',
  });
  const ready = { ready: true, port: fixture.port, basePath, directory };
  process.stdout.write(`${JSON.stringify(ready)}\n`);
  process.on('SIGINT', () => fixture.close());
  process.on('SIGTERM', () => fixture.close());
}
