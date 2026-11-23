import assert from 'node:assert/strict';
import test from 'node:test';
import { admitReaderPublicSearchHttpFixtureRequest, readerPublicSearchHttpFixtureMode,
  READER_PUBLIC_SEARCH_DELAYED_URL, READER_PUBLIC_SEARCH_HTTP_503_URL, READER_PUBLIC_SEARCH_HTTP_503_BODY_URL,
} from '../../../entry/src/main/ets/app/diagnostics/ReaderPublicSearchHttpFixture.ts';
import {
  bindReaderNamedPublicStorage,
  buildReaderPublicFixtureDirectory,
  isReaderNamedPublicFixture,
  readerHostCacheDirectory,
  readerHostFilesDirectory,
  readerHostPreferencesName,
  READER_PUBLIC_FIXTURE_IDS,
  READER_PUBLIC_FIXTURE_PARAMETER,
  selectReaderPublicFixture,
} from '../../../entry/src/main/ets/app/diagnostics/ReaderPublicFixtureScope.ts';

const sandboxFilesDir = '/data/storage/el2/base/haps/entry/files';
const reservedFilesDir = '/data/storage/el4/base/haps/entry/files';
const reservedCacheDir = '/data/storage/el4/base/haps/entry/cache';

function fixtureWant(value) {
  return { [READER_PUBLIC_FIXTURE_PARAMETER]: value };
}

test('public fixture scope preserves a normal cold start without its explicit key', () => {
  for (const parameters of [undefined, {}, Object.create(fixtureWant('empty-shelf'))]) {
    assert.deepEqual(selectReaderPublicFixture(false, 'release', parameters), { kind: 'normal' });
    assert.deepEqual(selectReaderPublicFixture(true, 'debug', parameters), { kind: 'normal' });
  }
});

test('public fixture scope only accepts exact fixed fixture names in a debug cold start', () => {
  assert.deepEqual(READER_PUBLIC_FIXTURE_IDS, ['empty-shelf', 'empty-sources', 'single-reserved',
    'group-options-12', 'row-actions', 'row-detect-center', 'row-detect-edge', 'row-detect-center-v2', 'row-detect-edge-v2',
    'search-delayed', 'search-http-503', 'search-http-503-body',
    'import-research-center', 'import-research-edge', 'import-research-center-v2', 'import-research-edge-v2',
    'import-research-center-v3', 'import-research-edge-v3', 'all-disabled-layout', 'search-detail-scroll-corpus']);
  for (const id of READER_PUBLIC_FIXTURE_IDS) {
    assert.deepEqual(selectReaderPublicFixture(true, 'debug', fixtureWant(id)), { kind: 'fixture', id });
    const filesDir = isReaderNamedPublicFixture(id) ? reservedFilesDir : sandboxFilesDir;
    assert.equal(buildReaderPublicFixtureDirectory(filesDir, id), `${filesDir}/reader-public-ui-fixtures/${id}`);
    for (const [debug, mode] of [[false, 'release'], [false, 'debug'], [true, 'release']]) {
      assert.deepEqual(selectReaderPublicFixture(debug, mode, fixtureWant(id)), {
        kind: 'rejected', reason: 'debug-required',
      });
    }
  }
  for (const value of [undefined, null, true, ['empty-shelf'], ' empty-shelf', 'empty-shelf\n',
    'EMPTY-SHELF', 'empty-sources/', '/data/storage/el2/base/haps/entry/files', '../empty-shelf', 'twelve-sources']) {
    assert.deepEqual(selectReaderPublicFixture(true, 'debug', fixtureWant(value)), {
      kind: 'rejected', reason: 'invalid-selection',
    });
  }
});

test('public fixture scope rejects malformed context paths instead of falling back to real data', () => {
  for (const directory of ['', '/files', '/tmp/files', 'data/sandbox/files', '/data/sandbox/files/',
    '/data/sandbox/../files', '/data/./files', '/data//files', '/data/sandbox\\alternate/files',
    '/data/sandbox\u0000/files', '/data/sandbox/files\n', '/data/sandbox/cache']) {
    assert.equal(buildReaderPublicFixtureDirectory(directory, 'empty-shelf'), undefined);
  }
  assert.equal(buildReaderPublicFixtureDirectory(sandboxFilesDir, '../reader-core'), undefined);
});

test('named Source fixtures use distinct roots in writable EL4', () => {
  const named = READER_PUBLIC_FIXTURE_IDS.filter(isReaderNamedPublicFixture);
  for (const area of ['el2', 'el3', 'el5', 'fake-el4', 'el2/el4']) {
    for (const id of named) {
      assert.equal(buildReaderPublicFixtureDirectory(reservedFilesDir.replace('el4', area), id), undefined);
    }
  }
  assert.equal(new Set(named.map(id => buildReaderPublicFixtureDirectory(reservedFilesDir, id))).size, named.length);
});

test('named context reserves host files, cache, and recovery preferences for a single process scope', () => {
  assert.equal(readerHostFilesDirectory(reservedFilesDir), reservedFilesDir);
  assert.equal(readerHostCacheDirectory(reservedCacheDir), reservedCacheDir);
  assert.equal(readerHostPreferencesName(reservedFilesDir, 'reset_v1'), 'reset_v1');
  assert.throws(() => bindReaderNamedPublicStorage('single-reserved', sandboxFilesDir, reservedCacheDir));
  assert.throws(() => bindReaderNamedPublicStorage('single-reserved', reservedFilesDir, reservedFilesDir));
  bindReaderNamedPublicStorage('single-reserved', reservedFilesDir, reservedCacheDir);
  bindReaderNamedPublicStorage('single-reserved', reservedFilesDir, reservedCacheDir);
  assert.equal(readerHostFilesDirectory(reservedFilesDir), reservedFilesDir + '/reader-public-ui-fixtures/single-reserved');
  assert.equal(readerHostCacheDirectory(reservedCacheDir), reservedCacheDir + '/reader-public-ui-fixtures/single-reserved');
  assert.equal(readerHostPreferencesName(reservedFilesDir, 'reset_v1'), 'reader_fixture_single-reserved_reset_v1');
  assert.throws(() => bindReaderNamedPublicStorage('row-actions', reservedFilesDir, reservedCacheDir));
  assert.throws(() => readerHostFilesDirectory(sandboxFilesDir));
  assert.throws(() => readerHostCacheDirectory(reservedFilesDir));
  assert.throws(() => readerHostPreferencesName(sandboxFilesDir, 'reset_v1'));
});


test('public search fixture admits only its exact fixed unauthenticated HTTPS GET', () => {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  for (const [id, url] of [['search-delayed', READER_PUBLIC_SEARCH_DELAYED_URL],
    ['search-http-503', READER_PUBLIC_SEARCH_HTTP_503_URL],
    ['search-http-503-body', READER_PUBLIC_SEARCH_HTTP_503_BODY_URL]]) {
    const mode = readerPublicSearchHttpFixtureMode(id);
    const request = {url, method:'GET', headers:{'User-Agent':userAgent}, body:null,
      charset:'utf-8', usePlatformCookieJar:false, timeoutMs:15000};
    const admitted = admitReaderPublicSearchHttpFixtureRequest(mode, request);
    assert.deepEqual(admitted, {...request, followRedirects:false, maxRedirects:0, httpsOnly:true});
    assert.notEqual(admitted.headers, request.headers);
    for (const rejected of [
      {url: url + '?q=fixture'}, {url:url.replace('https:', 'http:')},
      {url:mode === 'delayed' ? READER_PUBLIC_SEARCH_HTTP_503_URL : READER_PUBLIC_SEARCH_DELAYED_URL},
      {method:'POST'}, {body:{text:'fixture'}}, {followRedirects:true}, {maxRedirects:1},
      {usePlatformCookieJar:true}, {session:{id:'fixture'}}, {retry:{maxAttempts:2}},
      {headers:{'User-Agent':userAgent, Cookie:'fixture'}},
      {headers:{'User-Agent':userAgent, Authorization:'fixture'}},
      {headers:{'User-Agent':userAgent, Host:'example.test'}},
      ...(mode === 'http-503-body' ? [
        {url:READER_PUBLIC_SEARCH_HTTP_503_URL},
        {url:'https://httpbingo.org/drip?numbytes=1&code=503&duration=0s&delay=0s'},
      ] : [{url:READER_PUBLIC_SEARCH_HTTP_503_BODY_URL}]),
    ]) assert.equal(admitReaderPublicSearchHttpFixtureRequest(mode, {...request,...rejected}), undefined);
  }
  for (const id of ['empty-sources', 'single-reserved', 'search-delayed/']) {
    assert.equal(readerPublicSearchHttpFixtureMode(id), undefined);
  }
});
