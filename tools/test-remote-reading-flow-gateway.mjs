import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertRemoteReadingHostRequirements,
  classifyRemoteReadingCommandFailure,
  createRemoteReadingIdentity,
  decodeRemoteReadingVariables,
  encodeRemoteReadingVariables,
  mergeRemoteReadingVariables,
  RemoteReadingGatewayError,
  remoteReadingHostCapabilitySnapshot,
} from '../entry/src/main/ets/features/reading/RemoteReadingContract.ts';

assert.deepEqual(createRemoteReadingIdentity('source-a', '/book/42'), {
  sourceId: 'source-a',
  bookId: '/book/42',
});
assert.throws(
  () => createRemoteReadingIdentity('local', 'book-42'),
  (error) => error instanceof RemoteReadingGatewayError && error.code === 'invalidInput',
  'the remote gateway must never absorb local-book identities',
);

const capabilityById = new Map(
  remoteReadingHostCapabilitySnapshot().map((fact) => [fact.id, fact]),
);
assert.equal(capabilityById.get('httpExecute')?.status, 'verifiedVm');
assert.equal(capabilityById.get('httpExecute')?.attemptable, true);
assert.equal(capabilityById.get('responseCharsetDecoding')?.status, 'verifiedVm');
for (const verified of ['platformCookieJar', 'session', 'redirectFinalUrl']) {
  assert.equal(capabilityById.get(verified)?.status, 'verifiedVm', `${verified} must expose its VM proof`);
  assert.equal(capabilityById.get(verified)?.attemptable, true);
}
assert.equal(capabilityById.get('nonUtf8RequestBody')?.status, 'registeredUnverified');
assert.equal(capabilityById.get('nonUtf8RequestBody')?.attemptable, true);
assert.doesNotThrow(() => assertRemoteReadingHostRequirements(['httpExecute']));
assert.doesNotThrow(() => assertRemoteReadingHostRequirements([
  'platformCookieJar', 'session', 'nonUtf8RequestBody', 'redirectFinalUrl',
]));

assert.deepEqual(decodeRemoteReadingVariables(undefined, 'optional', true), []);
assert.deepEqual(decodeRemoteReadingVariables({ token: 'old', page: '1' }, 'detail'), [
  { name: 'page', value: '1' },
  { name: 'token', value: 'old' },
]);
assert.throws(
  () => decodeRemoteReadingVariables({ token: 42 }, 'detail'),
  (error) => error instanceof RemoteReadingGatewayError && error.code === 'invalidResponse',
);
const merged = mergeRemoteReadingVariables(
  [{ name: 'token', value: 'search' }, { name: 'book', value: '42' }],
  [{ name: 'token', value: 'chapter' }, { name: 'chapter', value: '7' }],
);
assert.deepEqual(merged, [
  { name: 'book', value: '42' },
  { name: 'chapter', value: '7' },
  { name: 'token', value: 'chapter' },
]);
assert.deepEqual(encodeRemoteReadingVariables(merged), {
  book: '42',
  chapter: '7',
  token: 'chapter',
});

for (const [message, capability] of [
  ['http.execute: usePlatformCookieJar is not supported by this Host', 'platformCookieJar'],
  ['http.execute: session is not supported by this Host', 'session'],
  ['http.execute: non-UTF-8 request charset is not supported: GBK', 'nonUtf8RequestBody'],
]) {
  const error = classifyRemoteReadingCommandFailure('chapter.content', new Error(message));
  assert.equal(error.code, 'unsupportedHostCapability');
  assert.equal(error.command, 'chapter.content');
  assert.equal(error.capability, capability);
}
const transportError = classifyRemoteReadingCommandFailure('book.toc', new Error('network down'));
assert.equal(transportError.code, 'commandFailed');
assert.equal(transportError.command, 'book.toc');

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gateway = readFileSync(
  resolve(repo, 'entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts'),
  'utf8',
);
const localGatewayLeak =
  /from\s+['"][^'"]*LocalReadingFlowGateway|new\s+LocalReadingFlowGateway|LOCAL_SOURCE_ID|sourceId:\s*['"]local['"]/;
assert.doesNotMatch(gateway, localGatewayLeak,
  'remote reading must not reuse or impersonate the local gateway');

const openStart = gateway.indexOf('async openSession(');
const chapterStart = gateway.indexOf('async loadChapter(', openStart);
assert.ok(openStart >= 0 && chapterStart > openStart, 'openSession must remain present');
const openSession = gateway.slice(openStart, chapterStart);
const detailRequest = openSession.indexOf("this.request('book.detail'");
const tocRequest = openSession.indexOf("this.request('book.toc'");
assert.ok(detailRequest >= 0, 'openSession must call book.detail');
assert.ok(tocRequest > detailRequest, 'book.toc must follow validated book.detail');
assert.match(openSession, /bookUrl:\s*seed\.detailUrl/,
  'the gateway must use the exact admitted detail URL rather than infer one from local state');
assert.match(openSession, /book:\s*baseBook/);
assert.match(openSession, /mergeRemoteReadingVariables\(searchVariables, detailVariables\)/,
  'search and detail continuation variables must survive into book.toc');
assert.match(openSession, /variables:\s*encodeRemoteReadingVariables\(continuationVariables\)/);
assert.match(openSession, /detailResult\.data\['sourceId'\]\s*!==\s*identity\.sourceId/);
assert.match(openSession, /book\.detail returned a mismatched bookId/);

const progressStart = gateway.indexOf('async loadProgress(', chapterStart);
assert.ok(progressStart > chapterStart, 'loadChapter must remain present');
const loadChapter = gateway.slice(chapterStart, progressStart);
assert.match(loadChapter, /this\.request\('chapter\.content'/);
assert.match(loadChapter, /Promise<ReadingSessionChapter>/,
  'remote acquisition must materialize the canonical reading-session chapter');
assert.match(loadChapter, /chapterTitle:\s*selected\.title/);
assert.match(loadChapter, /chapterIndex:\s*selected\.index/);
assert.match(loadChapter, /chapterUrl:\s*selected\.url/);
assert.match(loadChapter, /mergeRemoteReadingVariables\(session\.continuationVariables, selected\.variables\)/);
assert.match(loadChapter, /typeof result\.data\['content'\] !== 'string'/,
  'structured JS results must not be stringified into fake reader text');
assert.match(loadChapter, /via !== 'rule' && via !== 'js' && via !== 'cache'/,
  'canonical cache hits must remain an admitted chapter acquisition path');
assert.match(loadChapter, /materializeReadingDocument\(/,
  'remote and local bodies must enter the shared reading-document projection');
assert.match(loadChapter, /chapterResponseBaseUrl\(result\.data\) \?\? selected\.url/,
  'relative body images must prefer the exact Host finalUrl after redirects');
assert.match(loadChapter, /images:\s*document\.images/,
  'body images must stay on the canonical reading-session chapter model');
assert.match(loadChapter, /contentVersion:\s*document\.contentVersion/,
  'the shared projection must version text together with materialized image dimensions');
assert.match(loadChapter, /extractionVia:\s*via/,
  'source diagnostics remain acquisition metadata on the canonical chapter');
assert.doesNotMatch(gateway, /export type RemoteReadingChapter/,
  'remote acquisition must not create a second reader chapter model');

for (const command of [
  'reading.progress.get',
  'reader.location.resolve',
  'reading.progress.update',
]) {
  assert.ok(gateway.includes(`'${command}'`), `${command} must remain source-scoped in the gateway`);
}
assert.match(gateway, /sourceId:\s*identity\.sourceId,\s*\n\s*bookId:\s*identity\.bookId/,
  'progress and chapter requests must retain the exact remote composite key');

console.log('remote reading flow gateway contract: PASS');
