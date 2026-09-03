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
      const text = new TextDecoder(input.charset).decode(Buffer.from(input.hex, 'hex'));
      assert.equal(text, expected.text, vector.id);
      assert.match(hostSource,
        /TextDecoder\.create\(responseCharset, \{ fatal: true \}\)/,
        `${vector.id}: Harmony must decode the declared response charset strictly`);
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
assert.match(hostSource, /redirectMethodDecision\(/);
assert.match(hostSource, /allowNextRedirect\(/);
assert.match(hostSource, /isCrossOriginSensitiveHeader\(/);
assert.match(hostSource, /mergeCookieHeader\(/);
assert.match(hostSource, /retryBackoffMillis\(/);
assert.match(hostSource,
  /resolveResponseCharset\(\s*response\.headers,\s*binaryBody \? undefined : requestCharset,\s*\)/,
  'production Host must use the Core descriptor charset only for text responses');

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
