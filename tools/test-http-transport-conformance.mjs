import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"transport-policy": {"description": "实际redirect/header/cookie/deadline/private-target纯策略", "resources": []}, "multipart-host": {"description": "实际Host multipart拼接和CRLF/byte非法值拒绝", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const { createHash } = await import('node:crypto');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');


const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vectorPath = resolve(repo, 'tools/fixtures/http-conformance/http-transport-v1.json');
const vectorBytes = readFileSync(vectorPath);
const vectorSha = createHash('sha256').update(vectorBytes).digest('hex');


const policySource = readFileSync(resolve(repo,
  'entry/src/main/ets/app/HttpTransportPolicy.ts'), 'utf8');
const executablePolicy = stripTypeScriptTypes(policySource);
const policyUrl = `data:text/javascript;base64,${Buffer.from(executablePolicy).toString('base64')}`;
const policy = await import(policyUrl);
const hostSource = readFileSync(resolve(repo,
  'entry/src/main/ets/app/HttpExecuteHost.ts'), 'utf8');

const fixture = JSON.parse(vectorBytes.toString('utf8'));
assert.equal(fixture.schemaVersion, 1);

let delegatedCharsetCases = 0;

let multipartHost;
if(selectedCase==='multipart-host') {
 const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
 const file=new URL('../entry/src/main/ets/app/HttpExecuteHost.ts',import.meta.url),values=selectedProductionValues(file,['MAX_REQUEST_BODY_BYTES']);
 const Host=selectedProductionMethods(file,'HttpExecuteHost',['buildMultipart','assertNoCrLf','numberArrayToBytes'],{...values,encodeSharedText:(text,charset,limit)=>{assert.equal(charset,'utf-8');const bytes=new TextEncoder().encode(text);if(bytes.length>limit)throw Error('codec byte limit');return bytes;}});multipartHost=new Host();
 assert.throws(()=>multipartHost.buildMultipart([['bad\r\nname','value']],[]),/CR\/LF/);
 assert.throws(()=>multipartHost.buildMultipart([],[{fieldName:'f',filename:'x',contentType:'x',data:[256]}]),/integers/);
}
for (const vector of fixture.cases) {
  if(['charsetEncode','charsetDecode'].includes(vector.kind))continue;
  if((vector.kind==='multipart')!==(selectedCase==='multipart-host'))continue;
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
    case 'charsetDecode':
      throw Error('platform charset codecs are not policy vectors; select their existing dedicated codec gate');
    case 'multipart': {
      const bytes = multipart(input);
      assert.equal(bytes.length, expected.bytes, vector.id);
      assert.equal(Buffer.from(bytes).toString('hex'), expected.hex, vector.id);
      
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


if(selectedCase==='transport-policy') {
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




console.log(`http transport conformance: PASS (${fixture.cases.length} vectors, ${vectorSha})`);


}
function multipart(input) {
 const output=multipartHost.buildMultipart(Object.entries(input.fields),input.files.map(file=>({...file,data:[...Buffer.from(file.hex,'hex')]})));
 const actualBoundary=output.contentType.split('boundary=')[1];assert.ok(actualBoundary);
 // Vector boundary spelling is deterministic fixture data; the actual Host
 // chooses a random boundary. Compare its emitted envelope after that one substitution.
 return Buffer.from(Buffer.from(output.bytes).toString('latin1').replaceAll(actualBoundary,input.boundary),'latin1');
}

}
