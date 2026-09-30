import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = resolve(repo, 'entry/src/main/ets/pages/Index.ets');
const source = readFileSync(indexPath, 'utf8');
const shell = readFileSync(resolve(repo, 'entry/src/main/ets/features/shell/ReaderShell.ets'), 'utf8');
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); };
const row = id => ({ sourceId: id, bookUrl: `/book/${id}`, bookName: '书名', sourceName: id });
let subscription;
let unsubscribeCount = 0;
const owner = { bookAcquisitions: () => ({ subscribe: callback => {
  subscription = callback;
  return () => { unsubscribeCount++; };
} }) };
const Index = productionMotionMethods(indexPath,
  ['startSourceDiscovery', 'stopSourceDiscovery', 'refreshSourceSwitch', 'retrySourceSwitch', 'isSourceSwitchActive'], {
    ReaderRuntimeOwner: { current: () => owner },
    sourceSwitchCandidateKey: (sourceId, bookId) => JSON.stringify([sourceId, bookId]),
    errorMessageOf: error => error.message, DOMAIN: 0, hilog: { warn() {} },
  });
const makePage = cached => {
  const rounds = [];
  const gateway = {
    loadCachedCandidates: async () => cached,
    refreshCandidates: (query, isCurrent, skip, onProgress) => new Promise((resolve, reject) => {
      rounds.push({ query, isCurrent, skip, onProgress, resolve, reject });
    }),
  };
  const page = Object.assign(new Index(), {
    detailBook: { sourceId: 'current', bookId: '/original' },
    detailReturnRoute: 'detail', navigationGeneration: 1,
    sourceSwitchVisible: true, sourceSwitchState: { kind: 'discovering' },
    sourceSwitchProbeQuery: () => ({ sourceId: 'current', bookId: '/original', bookName: '书名', author: '' }),
    knownSearchSourceCandidates: () => [], getSourceSwitchGateway: () => gateway,
    nextNavigationGeneration() { return ++this.navigationGeneration; },
  });
  return { page, rounds };
};

// Initial empty state becomes useful before the final request finishes.
{
  const { page, rounds } = makePage([]);
  page.startSourceDiscovery(1); await settle();
  assert.equal(page.sourceSwitchState.kind, 'discovering');
  const first = rounds[0];
  first.onProgress([row('slow')]);
  assert.equal(page.sourceSwitchState.refreshing, true);
  first.onProgress([row('fast'), row('slow')]);
  assert.deepEqual(page.sourceSwitchState.candidates.map(r => r.sourceId), ['fast', 'slow']);
  const beforeStop = unsubscribeCount;
  page.stopSourceDiscovery();
  assert.equal(unsubscribeCount, beforeStop + 1);
  assert.equal(first.isCurrent(), false);
  assert.equal(page.sourceSwitchState.stopped, true);
  assert.equal(page.sourceSwitchState.refreshing, false);
  first.onProgress([row('late')]);
  first.resolve({ kind: 'sources', candidates: [row('late')] });
  subscription({ reset: true, identities: [] });
  await settle();
  assert.deepEqual(page.sourceSwitchState.candidates.map(r => r.sourceId), ['fast', 'slow'],
    'stopping revokes late progress, final completion and acquisition subscriptions');
  page.refreshSourceSwitch(); await settle();
  assert.equal(page.sourceSwitchState.refreshing, true);
  assert.equal(page.sourceSwitchState.candidates.length, 2, 'refresh retains visible rows');
  rounds[1].onProgress([row('new')]);
  assert.deepEqual(page.sourceSwitchState.candidates.map(r => r.sourceId), ['new', 'fast', 'slow'],
    'a partial sweep preserves old visible identities until the complete final relation arrives');
  rounds[1].reject(Error('connection lost')); await settle();
  assert.equal(page.sourceSwitchState.candidates.length, 3,
    'a late refresh failure preserves newly discovered rows, not only the initial snapshot');
  assert.equal(page.sourceSwitchState.refreshError, 'connection lost');
}
{
  const { page, rounds } = makePage([]);
  page.startSourceDiscovery(1); await settle(); page.stopSourceDiscovery();
  assert.deepEqual(page.sourceSwitchState, { kind: 'empty', stopped: true });
  page.retrySourceSwitch(); await settle();
  assert.equal(rounds.length, 2);
  rounds[0].onProgress([row('obsolete')]);
  assert.equal(page.sourceSwitchState.kind, 'discovering');
  rounds[1].resolve({ kind: 'sources', candidates: [row('current-round')] }); await settle();
  assert.equal(page.sourceSwitchState.refreshing, false);
  assert.equal(page.sourceSwitchState.candidates[0].sourceId, 'current-round');
}
{
  const { page, rounds } = makePage([row('cached')]);
  page.startSourceDiscovery(1); await settle();
  assert.equal(rounds.length, 0, 'opening known cached sources must not launch a second full search');
  assert.equal(page.sourceSwitchState.candidates[0].sourceId, 'cached');
}
{
  const { page, rounds } = makePage([]);
  page.sourceSwitchState = { kind: 'failure', message: 'failed', transactionId: 'pending' };
  page.retrySourceSwitch(); await settle(); assert.equal(rounds.length, 0, 'pending transaction must be rolled back first');
  page.sourceSwitchState = { kind: 'failure', message: 'failed' };
  page.retrySourceSwitch(); await settle(); assert.equal(rounds.length, 1);
}
// Both production entry points own the same full-page component and callback.
assert.match(source, /onStopSourceSwitch: \(\): void => this\.stopSourceDiscovery\(\)/);
assert.match(source, /SourceSwitchPanel\(\{[\s\S]*?bookTitle: this\.detailBook\.title,[\s\S]*?onStop: \(\): void => this\.stopSourceDiscovery\(\)/);
assert.match(shell, /SourceSwitchPanel\(\{[\s\S]*?bookTitle: this\.bookTitle,[\s\S]*?currentChapterTitle: this\.directoryChapterTitle,[\s\S]*?onStop: \(\): void => this\.onStopSourceSwitch\(\)/);
assert.doesNotMatch(shell, /app\.ReaderShell\.build\.backgroundColor\.40FFFFFF/);
const pages = readFileSync(resolve(repo, 'entry/src/main/resources/base/profile/main_pages.json'), 'utf8');
assert.doesNotMatch(pages, /SourceSwitchDemo/);
console.log('Real source-switch page: progressive discovery, stop/retry ownership, partial failure and production entry wiring PASS');
