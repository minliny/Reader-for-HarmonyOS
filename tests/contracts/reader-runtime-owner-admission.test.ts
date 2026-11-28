import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderPublicFixtureBridge } from '../../entry/src/main/ets/app/ReaderPublicFixtureBridge.ts';
import { ReaderMangaProbeRegistry } from '../../entry/src/main/ets/app/ReaderMangaProbeRegistry.ts';
import type { ReaderPublicFixtureScope } from '../../entry/src/main/ets/app/diagnostics/ReaderPublicFixtureScope.ts';
import type { MangaOfflineProbeSnapshot } from '../../entry/src/main/ets/app/MangaOfflineNetworkProbe.ts';
import type { MangaPlatformObserver } from '../../entry/src/main/ets/platform/reading-resources/MangaPlatformObservation.ts';

test('only a verified fixture belonging to the current owner enables its HTTP adapter', () => {
  const fixture: ReaderPublicFixtureScope = { kind: 'fixture', id: 'search-delayed' };
  const files = '/data/storage/el4/base/files';
  let current = false;
  const bridge = new ReaderPublicFixtureBridge(fixture, () => current);
  assert.equal(bridge.searchHttpReady(), false);
  assert.equal(bridge.dataDirectory('/data/storage/el2/base/files'), undefined);
  assert.equal(bridge.dataDirectory(files), files + '/reader-public-ui-fixtures/search-delayed');
  assert.equal(bridge.allowsBundledSources(), false);
  assert.throws(() => bridge.confirmSearchHttp(fixture), /PUBLIC_SEARCH_HTTP_FIXTURE_NOT_CURRENT/);
  current = true;
  assert.throws(() => bridge.confirmSearchHttp({ ...fixture }), /PUBLIC_SEARCH_HTTP_FIXTURE_NOT_CURRENT/);
  assert.equal(bridge.searchHttpReady(), false);
  bridge.confirmSearchHttp(fixture);
  assert.equal(bridge.searchHttpReady(), true);
  current = false;
  assert.equal(bridge.searchHttpReady(), false);

  current = true;
  const emptyShelf: ReaderPublicFixtureScope = { kind: 'fixture', id: 'empty-shelf' };
  const unverified = new ReaderPublicFixtureBridge(emptyShelf, () => current);
  assert.equal(unverified.allowsBundledSources(), true);
  assert.throws(() => unverified.confirmSearchHttp(emptyShelf), /PUBLIC_SEARCH_HTTP_FIXTURE_NOT_CURRENT/);
  const normal = new ReaderPublicFixtureBridge(undefined, () => current);
  assert.equal(normal.dataDirectory(files), files + '/reader-core');
  assert.equal(normal.searchHttpReady(), false);
  assert.equal(normal.allowsBundledSources(), true);
});

test('the offline probe tracks the exact sent request and keeps progress writes alive after release', () => {
  const scope = { sourceId: 'source', bookId: 'book' };
  const events: string[] = [];
  const snapshots: MangaOfflineProbeSnapshot[] = [];
  const registry = new ReaderMangaProbeRegistry(() => assert.fail('offline probe cannot mount the body sampler'),
    (label, state) => {
      assert.equal(label, 'MANGA_OFFLINE_PROBE %{public}s');
      const observed = JSON.parse(state) as MangaOfflineProbeSnapshot;
      events.push('publish:' + observed.pendingRequests);
      snapshots.push(observed);
    }, scope);
  const probe = registry.network!;
  registry.bindReadingBody();
  assert.equal(registry.beginRequest('manga.entry.get', { ...scope, bookId: 'foreign' },
    () => assert.fail('foreign request must bypass diagnostic send'), {}, 30000), undefined);
  const body = registry.beginRequest('manga.entry.get', scope,
    () => { events.push('send'); return 41; }, { timeoutMs: 200 }, 30000)!;
  assert.equal(body.requestId, 41);
  assert.deepEqual(events, ['publish:0', 'send', 'publish:1']);
  assert.equal(body.waitOptions().timeoutMs, 200);
  assert.equal(body.waitOptions().shouldCancel?.(), false);
  assert.doesNotThrow(() => probe.beforeCoreHttp(42));
  assert.throws(() => probe.beforeCoreHttp(41), /MANGA_OFFLINE_PROBE_HTTP_BLOCKED/);
  let cancelled = false;
  const progress = registry.beginRequest('reading.progress.update', scope,
    () => 43, { shouldCancel: () => cancelled }, 30000)!;
  assert.equal(progress.waitOptions().timeoutMs, 30000);
  const completed = registry.beginRequest('manga.chapter.get', scope, () => 44, {}, 30000)!;
  completed.settle();
  assert.equal(snapshots.at(-1)?.pendingRequests, 2);
  probe.release('runtime-close');
  assert.equal(body.waitOptions().shouldCancel?.(), true);
  assert.equal(progress.waitOptions().shouldCancel?.(), false);
  cancelled = true;
  assert.equal(progress.waitOptions().shouldCancel?.(), true);
  assert.equal(snapshots.at(-1)?.reason, 'runtime-close');
  body.settle();
  progress.settle();
});

test('conflicting exact or selection scopes create no manga probe and never resolve the body sampler', () => {
  const scope = { sourceId: 'source', bookId: 'book' };
  const noBody = () => assert.fail('unconfigured probe cannot mount the body sampler');
  const noLog = () => assert.fail('unconfigured probe cannot publish');
  const conflicts = [
    new ReaderMangaProbeRegistry(noBody, noLog, scope, scope),
    new ReaderMangaProbeRegistry(noBody, noLog, scope, undefined, 'reading'),
  ];
  for (const registry of conflicts) {
    registry.bindReadingBody();
    assert.equal(registry.network, undefined);
    assert.equal(registry.readingSamplingEnabled(), false);
  }
});

test('reading samples follow deferred display work and retire on overlap without changing image results', async () => {
  const scope = { sourceId: 'source', bookId: 'book' };
  let observer: MangaPlatformObserver | undefined;
  let detached = 0;
  let stateReads = 0;
  const registry = new ReaderMangaProbeRegistry(() => ({
    attachDiagnosticObserver: (attach, debug, mode) => {
      assert.equal(debug, true);
      assert.equal(mode, 'debug');
      observer = attach;
      return () => { observer = undefined; detached += 1; };
    },
    diagnosticState: () => {
      stateReads += 1;
      return { files: 0, leases: 0, writes: 0, removals: 0, reads: 0 };
    },
  }), () => {}, undefined, scope);
  registry.bindReadingBody();
  const probe = registry.network!;
  probe.select(scope.sourceId, scope.bookId, true);
  const snapshot = (): MangaOfflineProbeSnapshot => JSON.parse(probe.snapshot()) as MangaOfflineProbeSnapshot;
  const sample = (): void => observer?.({ stage: 'body', event: 'open', resource: 'source' });
  sample();
  assert.equal(snapshot().bodySourceOpens, 0);
  const drain = Promise.withResolvers<void>();
  assert.equal(await registry.observeReadingImageWork(scope.sourceId, scope.bookId, true, async () => {
    sample();
    return 'display';
  }, () => drain.promise), 'display');
  sample();
  assert.equal(snapshot().bodySourceOpens, 2);
  assert.equal(stateReads, 1);
  drain.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(stateReads, 2);
  sample();
  assert.equal(snapshot().bodySourceOpens, 2);

  const trailing = Promise.withResolvers<void>();
  await registry.observeReadingImageWork(scope.sourceId, scope.bookId, true, async () => {}, () => trailing.promise);
  assert.equal(await registry.observeReadingImageWork(scope.sourceId, 'foreign', false, async () => 'foreign'), 'foreign');
  assert.equal(snapshot().reason, 'body-scope-overlap');
  assert.equal(snapshot().coverageIncomplete, true);
  assert.equal(detached, 1);
  trailing.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(detached, 1);
});
