import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { sourceLoginPageUrl } from '../entry/src/main/ets/app/SourceLoginPageProjection.ts';
import { httpUrlHostname, isPrivateNetworkTarget } from '../entry/src/main/ets/platform/network/HttpTransportPolicy.ts';

const app = new URL('../entry/src/main/ets/app/', import.meta.url);
const read = name => readFileSync(new URL(name, app), 'utf8');
// The historical source was withdrawn from the curated bundle. Keep the exact
// imported login fixture from fff3ec5b to exercise its compatibility projection.
const legacySource = JSON.parse(readFileSync(new URL('./fixtures/source-login-66shuba-legacy.json', import.meta.url), 'utf8'));
const original = JSON.stringify(legacySource);

// Execute the actual Owner method and actual ArkWeb queue/URL admission. Only
// native browser run is a seam; this probe does not claim an authenticated site.
const sdk = resolveEtsLoaderRoot();
const ts = createRequire(import.meta.url)(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile('ReaderRuntimeOwner.ts', read('ReaderRuntimeOwner.ts'), ts.ScriptTarget.Latest, true);
assert.equal(tree.parseDiagnostics.length, 0);
const declaration = tree.statements.find(node => node.name?.text === 'ReaderRuntimeOwner');
const method = declaration.members.find(node => node.name?.text === 'openSourceLogin');
assert.ok(method, 'production Owner login method must exist');
const executorCode = stripTypeScriptTypes(read('../platform/network/ArkWebExecutor.ts')
  .replace(/^import[\s\S]*?;\n/gm, '')).replace(/^export /gm, '');
const generations = [];
const Executor = new Function('httpUrlHostname', 'isPrivateNetworkTarget', 'CookieSessionStore',
  executorCode + ';return ArkWebExecutor;')(httpUrlHostname, isPrivateNetworkTarget, {
    instance: { sessionGeneration(profileId) { generations.push(profileId); return 7; } },
  });
const executor = new Executor();
const jobs = [];
executor.run = async job => { jobs.push(job); return {}; };
const Runtime = new Function('ArkWebExecutor', 'sourceLoginPageUrl',
  stripTypeScriptTypes(`class ReaderRuntimeOwner { ${method.getText(tree)} }`) + ';return ReaderRuntimeOwner;')(
  { instance: executor }, sourceLoginPageUrl);
const owner = new Runtime();

await owner.openSourceLogin(legacySource.sourceId, legacySource.loginUrl, legacySource.bookSourceName);
assert.equal(jobs[0].document.url, 'https://66shuba.com/login');
assert.equal(jobs[0].profileId, legacySource.sourceId, 'primary login keeps the source-owned cookie jar');
assert.equal(jobs[0].cookieGeneration, 7);
assert.equal(jobs[0].interactive, true, 'existing user-operated browser path is retained');
assert.equal(jobs[0].presentationTitle, '66书吧-起点 · 登录 / 验证');
assert.equal(JSON.stringify(legacySource), original, 'the projected login leaves the imported source unchanged');

await owner.openSourceLogin('https://66shuba.com', legacySource.loginUrl, legacySource.bookSourceName);
assert.equal(jobs.at(-1).document.url, 'https://66shuba.com/login');
assert.equal(jobs.at(-1).profileId, 'https://66shuba.com', 'original imported source identity keeps its own jar');
await assert.rejects(owner.openSourceLogin('different-source', legacySource.loginUrl, legacySource.bookSourceName),
  /webview document URL must use http or https on a public host/,
  'the same script under an unknown source identity is not adapted');

for (const url of ['https://public.example/login?mode=manual', 'http://public.example/login']) {
  assert.equal(sourceLoginPageUrl('ordinary-source', url), url, 'ordinary URL is unchanged');
  await owner.openSourceLogin('ordinary-source', url, 'Ordinary');
  assert.equal(jobs.at(-1).document.url, url);
  assert.equal(jobs.at(-1).profileId, 'ordinary-source');
}

const rejected = [
  'function login(){java.startBrowserAwait("https://public.example/login", "Unknown");}',
  legacySource.loginUrl.replace('https://66shuba.com/login', 'https://other.example/login'),
  legacySource.loginUrl.replace("source.setVariable('1');", "source.setVariable('2');"),
  legacySource.loginUrl + '\n',
  'file:///tmp/login.html',
  'http://127.0.0.1/login',
];
const admitted = jobs.length;
for (const loginUrl of rejected) {
  assert.equal(sourceLoginPageUrl(legacySource.sourceId, loginUrl), loginUrl, 'unknown/changed script is not interpreted');
  await assert.rejects(owner.openSourceLogin(legacySource.sourceId, loginUrl, legacySource.bookSourceName),
    /webview document URL must use http or https on a public host/);
}
assert.equal(jobs.length, admitted, 'rejected documents never enter the browser queue');
assert.deepEqual(generations, [legacySource.sourceId, 'https://66shuba.com', 'ordinary-source', 'ordinary-source']);
assert.equal(executor.jobs.size, 0, 'completed jobs use the existing queue cleanup');
console.log('PASS source primary login: complete real script, same cookie profile, ordinary URLs, changed/unknown script rejection');
