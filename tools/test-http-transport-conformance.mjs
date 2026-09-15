import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vectorPath = resolve(repo, 'tools/fixtures/http-conformance/http-transport-v1.json');
const vectorBytes = readFileSync(vectorPath);
const vectorSha = createHash('sha256').update(vectorBytes).digest('hex');
assert.equal(vectorSha, 'ad87a5423ee60de43b7056e9fa2d6683302bb1b9378139dd271a7943b625c331');

const policySource = readFileSync(resolve(repo,
  'entry/src/main/ets/app/HttpTransportPolicy.ts'), 'utf8');
const executablePolicy = stripTypeScriptTypes(policySource);
const policyUrl = `data:text/javascript;base64,${Buffer.from(executablePolicy).toString('base64')}`;
const policy = await import(policyUrl);
const hostSource = readFileSync(resolve(repo,
  'entry/src/main/ets/app/HttpExecuteHost.ts'), 'utf8');

const fixture = JSON.parse(vectorBytes.toString('utf8'));
assert.equal(fixture.schemaVersion, 1);
assert.ok(fixture.cases.length >= 20);
let delegatedCharsetCases = 0;

for (const vector of fixture.cases) {
  const { input, expected } = vector;
  switch (vector.kind) {
    case 'redirectMethod': {
      const decision = policy.redirectMethodDecision(
        input.status, input.method, input.body !== null,
      );
      assert.deepEqual({
        method: decision.method,
        body: decision.keepBody ? input.body : null,
      }, expected, vector.id);
      break;
    }
    case 'resolveLocation':
      assert.equal(new URL(input.location, input.currentUrl).toString(), expected.url, vector.id);
      break;
    case 'redirectLimit':
      assert.equal(policy.allowNextRedirect(
        input.followRedirects, input.maxRedirects, input.observedHops,
      ), expected.allowNext, vector.id);
      break;
    case 'crossOriginHeaders': {
      const headers = {};
      for (const [name, value] of Object.entries(input.headers)) {
        if (input.sameOrigin || !policy.isCrossOriginSensitiveHeader(name)) {
          headers[name] = value;
        }
      }
      assert.deepEqual(headers, expected.headers, vector.id);
      break;
    }
    case 'cookieHop':
      assert.equal(policy.mergeCookieHeader(
        input.explicitCookie, input.jarCookie,
      ), expected.outboundCookie, vector.id);
      assert.deepEqual(policy.observedCookieNames(
        input.setCookie,
      ), expected.observedCookieNames, vector.id);
      break;
    case 'charsetEncode':
      delegatedCharsetCases += 1;
      assert.match(hostSource,
        /return encodeSharedText\(text, charset, MAX_REQUEST_BODY_BYTES\)\.buffer/,
        `${vector.id}: Harmony must delegate non-UTF-8 encoding to the shared Core`);
      break;
    case 'charsetDecode': {
      delegatedCharsetCases += 1;
      const text = new TextDecoder(input.charset === 'gb2312' ? 'gbk' : input.charset)
        .decode(Buffer.from(input.hex, 'hex'));
      assert.equal(text, expected.text, vector.id);
      assert.match(hostSource,
        /TextDecoder\.create\(candidate, \{ fatal: true \}\)/,
        `${vector.id}: Harmony must decode every candidate response charset strictly`);
      break;
    }
    case 'multipart': {
      const bytes = multipart(input);
      assert.equal(bytes.length, expected.bytes, vector.id);
      assert.equal(Buffer.from(bytes).toString('hex'), expected.hex, vector.id);
      assert.match(hostSource, /multipart\/form-data; boundary=/,
        `${vector.id}: production Host must publish the generated boundary`);
      break;
    }
    case 'retryBackoff':
      assert.equal(policy.retryBackoffMillis(
        input.baseMillis, input.attempt, input.maxMillis, input.remainingMillis,
      ), expected.millis, vector.id);
      break;
    case 'deadline':
      assert.equal(policy.httpDeadlineState(
        input.cancelled, input.nowMillis, input.deadlineAtMillis,
      ), expected.state, vector.id);
      break;
    default:
      assert.fail(`unknown HTTP conformance kind ${vector.kind}`);
  }
}

assert.equal(delegatedCharsetCases, 4);
assert.equal(policy.resolveResponseCharset(
  { 'Content-Type': 'text/html; charset=utf-8' }, 'GBK',
), 'utf-8', 'response header charset must win over the Core descriptor');
assert.equal(policy.resolveResponseCharset(
  { 'Content-Type': 'text/html' }, 'GBK',
), 'GBK', 'Core descriptor charset must fill a missing response charset');
assert.equal(policy.resolveResponseCharset(
  {}, 'Big5',
), 'Big5', 'Core descriptor charset must fill a missing Content-Type');
assert.equal(policy.resolveResponseCharset(
  {}, undefined,
), 'utf-8', 'UTF-8 remains the final default');
assert.equal(policy.normalizeCharsetLabel('gb2312'), 'gbk',
  'the legacy gb2312 label must map onto the platform-supported gbk superset');
assert.equal(policy.normalizeCharsetLabel(' GBK '), 'GBK',
  'other labels pass through trimmed and case-preserved');
assert.equal(policy.resolveResponseCharset(
  { 'Content-Type': 'text/html; charset=GB2312' }, undefined,
), 'gbk', 'a gb2312 response header must normalize to gbk');
assert.equal(policy.resolveResponseCharset(
  {}, 'gb2312',
), 'gbk', 'a gb2312 Core descriptor must normalize to gbk');
assert.match(hostSource, /decodeTextStrictly\(/,
  'production Host must decode through the strict multi-candidate path');
assert.match(hostSource, /normalizeCharsetLabel\(/,
  'production Host must normalize charset labels before decoding');
assert.match(hostSource, /redirectMethodDecision\(/);
assert.match(hostSource, /allowNextRedirect\(/);
assert.match(hostSource, /isCrossOriginSensitiveHeader\(/);
assert.match(hostSource, /mergeCookieHeader\(/);
assert.match(hostSource, /retryBackoffMillis\(/);
assert.match(hostSource,
  /resolveResponseCharset\(response\.headers, requestCharset\)/,
  'production Host must use the Core descriptor charset only for text responses');
assert.match(hostSource, /MAX_REQUEST_HEADERS/,
  'HTTP headers must have an explicit count/size guard');
assert.match(hostSource, /MAX_HEADER_VALUE_LENGTH[\s\S]*assertNoCrLf\(raw, `header \$\{key\}`\)/,
  'HTTP header values must be bounded and reject control-line injection');
assert.match(hostSource, /MAX_MULTIPART_FILES[\s\S]*totalDataBytes[\s\S]*MAX_REQUEST_BODY_BYTES - bytes\.length/,
  'multipart wire arrays must be bounded before Uint8Array construction');
assert.match(hostSource, /MAX_MULTIPART_METADATA_CHARS[\s\S]*totalMetadataBytes/,
  'multipart metadata must be bounded before string/chunk construction');
assert.match(hostSource, /MAX_FORM_FIELDS[\s\S]*MAX_FORM_FIELD_CHARS[\s\S]*encodedBytes/,
  'form requests must cap field count, individual size, and aggregate encoded bytes');
assert.match(hostSource, /body\.kind === 'form'[\s\S]*bytes\.length > MAX_REQUEST_BODY_BYTES/,
  'form payloads must enforce the final wire-size limit before dispatch');

// -- P1-5 private-network SSRF guard -------------------------------------------
// The shared byte judge: private, loopback, link-local, non-canonical numeric
// hosts, and IPv6 forms are rejected; public literals and domains pass.
const privateTargets = [
  '127.0.0.1', '127.8.8.8', '10.1.2.3', '172.16.0.1', '172.31.255.255',
  '192.168.1.1', '169.254.169.254', '0.0.0.0', '0.1.2.3',
  '100.64.0.1', '100.127.255.254', '192.0.0.1', '192.0.2.1',
  '198.18.0.1', '198.19.255.254', '198.51.100.1', '203.0.113.1',
  '224.0.0.1', '239.255.255.255', '240.0.0.1', '255.255.255.255',
  '010.0.0.1', '127.1', '2130706433',
  '::1', '::', 'fe80::1', 'febf::1', 'fc00::1', 'fd12:3456::1',
  'fec0::1', 'ff02::1', '2001:db8::1',
  '::808:808', '64:ff9b::808:808', '64:ff9b:1::808:808',
  '2002:0808:0808::1', '2001:0:4136:e378:8000:63bf:3fff:fdd2',
  '::ffff:7f00:1', '::ffff:a00:1', '::ffff:6440:1', '::FFFF:10.9.8.7',
];
for (const target of privateTargets) {
  assert.equal(policy.isPrivateNetworkTarget(target), true, `must reject ${target}`);
}
const publicTargets = [
  '8.8.8.8', '1.1.1.1', '172.32.0.1', '172.15.0.1', '192.169.0.1',
  '169.255.1.1', 'example.org', 'source-a.example',
  '::ffff:808:808', '2001:4860:4860::8888',
];
for (const target of publicTargets) {
  assert.equal(policy.isPrivateNetworkTarget(target), false, `must allow ${target}`);
}
assert.equal(policy.httpUrlHostname('https://Source-A.example:8443/p?q=1#f'), 'source-a.example');
assert.equal(policy.httpUrlHostname('http://user:pass@10.0.0.1/x'), '10.0.0.1');
assert.equal(policy.httpUrlHostname('http://[::1]:8080/x'), '::1');
assert.equal(policy.httpUrlHostname('ftp://source-a.example/'), undefined);
assert.equal(policy.httpUrlHostname('http:///no-host'), undefined);
assert.equal(policy.httpsUrlHostname('https://source-a.example/path'), 'source-a.example');
assert.equal(policy.httpsUrlHostname('http://source-a.example/path'), undefined);
assert.equal(policy.redactedHttpUrl('https://user:secret@source-a.example:8443/private?token=x#y'),
  'https://source-a.example/…');
assert.equal(policy.redactedHttpUrl('file:///private/path'), '[invalid-url]');
// Both enforcement points run the same shared judge: the Host execution entry
// plus every redirect hop, and the source import gate.
assert.match(hostSource, /prepareNetworkTarget\(requestUrl\)/,
  'the request execution entry must run the private-target gate');
assert.match(hostSource, /this\.rejectPrivateNetworkUrl\(nextUrl\)/,
  'every redirect hop target must run the private-target gate');
assert.match(hostSource, /isPrivateNetworkTarget/,
  'the Host must judge through the shared HttpTransportPolicy function');

console.log(`http transport conformance: PASS (${fixture.cases.length} vectors, ${vectorSha})`);

function multipart(input) {
  const chunks = [];
  for (const [name, value] of Object.entries(input.fields)) {
    chunks.push(Buffer.from(`--${input.boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
    chunks.push(Buffer.from(value, 'utf8'));
    chunks.push(Buffer.from('\r\n'));
  }
  for (const file of input.files) {
    chunks.push(Buffer.from(`--${input.boundary}\r\n`));
    chunks.push(Buffer.from(
      `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\n`,
    ));
    chunks.push(Buffer.from(`Content-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(Buffer.from(file.hex, 'hex'));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${input.boundary}--\r\n`));
  return Buffer.concat(chunks);
}
