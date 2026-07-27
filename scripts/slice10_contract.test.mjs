import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateReaderUITypedResult } from '../../Reader-UI/packages/reference/reader-ui-runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

test('Slice 10 admits only exact Core-backed or typed-schema verticals', async () => {
  const core = await source('entry/src/main/ets/bridge/CoreRuntime.ets');
  const policy = await source('entry/src/main/ets/ui/store/Slice10CapabilityPolicy.ets');
  for (const method of [
    'txt-toc-rule.create', 'txt-toc-rule.list', 'txt-toc-rule.update', 'txt-toc-rule.delete',
    'tts.config.get', 'tts.config.put', 'book.chapterReview',
  ]) {
    assert.ok(core.includes(`'${method}'`), `missing typed bridge for ${method}`);
  }
  assert.ok(core.includes('bookChapterReview(sourceId: string, bookId: string, reviewUrl: string'));
  assert.ok(core.includes("params['reviewUrl'] = normalizedReviewUrl"));
  assert.ok(core.includes('txt-toc-rule.update requires at least one changed field'));
  assert.match(policy, /id: 'chapter-reviews\.read'[\s\S]*TypedCommand[\s\S]*BridgeReady/);
  assert.match(policy, /id: 'rules\.txt-toc'[\s\S]*TypedCommand[\s\S]*BridgeReady/);
  assert.match(policy, /id: 'tts\.config'[\s\S]*TypedCommand[\s\S]*BridgeReady/);
});

test('Slice 10 keeps incomplete schema and Host capabilities fail-closed', async () => {
  const core = await source('entry/src/main/ets/bridge/CoreRuntime.ets');
  const policy = await source('entry/src/main/ets/ui/store/Slice10CapabilityPolicy.ets');
  const routeRegistry = await source('entry/src/main/ets/ui/router/ReaderCapabilityClosureRouteRegistry.ets');
  for (const id of ['reading.read-record', 'content.edit', 'cover.candidates', 'http-tts.metadata']) {
    assert.match(policy, new RegExp(`id: '${id.replaceAll('.', '\\.')}'[\\s\\S]*ExperimentalFailClosed`));
  }
  for (const id of ['rules.dictionary', 'cover.apply', 'chapter-reviews.write']) {
    assert.match(policy, new RegExp(`id: '${id.replaceAll('.', '\\.')}'[\\s\\S]*ContractMissingFailClosed`));
  }
  assert.match(policy, /id: 'http-tts\.playback'[\s\S]*HostBlockedFailClosed/);
  // No production convenience wrapper may bypass the admission table merely
  // because the current native branch happens to accept an untyped method.
  assert.equal(core.includes('async readRecord'), false);
  assert.equal(core.includes('async contentEdit'), false);
  assert.equal(core.includes('async httpTts'), false);
  assert.equal(core.includes('async searchCover'), false);
  for (const route of [
    'http-tts-management', 'http-tts-editor', 'http-tts-test',
    'content-edit', 'book-cover-change', 'book-cover-search',
    'chapter-reviews',
  ]) {
    assert.match(routeRegistry, new RegExp(`plannedRouteDefinition\\('${route}'`));
  }
});

test('Slice 10 review input stays fail-closed while bookmark manager uses live Core data', async () => {
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
  const routes = await source('entry/src/main/ets/ui/router/ReaderCapabilityClosureRouteRegistry.ets');
  assert.equal(effects.includes('bookChapterReview('), false);
  assert.equal(effects.includes('chapterReviewRequestIsCurrent'), false);
  assert.equal(renderer.includes("this.routeId === 'chapter-reviews'"), false);
  assert.match(routes, /plannedRouteDefinition\('chapter-reviews'/);
  assert.match(routes, /coreRouteDefinition\('bookmarks-manager'/);
  assert.ok(routes.includes("Slice10CapabilityPolicy.isProduction('reading.bookmarks')"));
  assert.ok(renderer.includes("this.routeId === 'bookmarks-manager'"));
  assert.ok(renderer.includes('DirectoryPanel()'),
    'bookmarks-manager renders the retained shared DirectoryPanel primitive (reading-page shell retired)');
  assert.ok(effects.includes("event.id === 'toc-bookmarks' || event.id === 'bookmarks-manager'"));
});

test('Slice 10 preserves existing production search, rules, switch and unique session', async () => {
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const reducer = await source('entry/src/main/ets/ui/store/ReaderReducer.ets');
  const policy = await source('entry/src/main/ets/ui/store/Slice10CapabilityPolicy.ets');
  const library = await source('entry/src/main/ets/ui/components/LibraryComponents.ets');
  for (const method of ['search.content', 'search.history.list', 'bookmark.list', 'replace-rule.list', 'change.bookSource']) {
    assert.ok((effects + await source('entry/src/main/ets/bridge/CoreRuntime.ets')).includes(`'${method}'`));
  }
  for (const id of ['reading.search-content', 'reading.bookmarks', 'reading.search-history',
    'reading.cache', 'rules.replace', 'source.switch', 'reader.session']) {
    assert.match(policy, new RegExp(`id: '${id.replaceAll('.', '\\.')}'[\\s\\S]*Production`));
  }
  assert.ok(reducer.includes("next.activeSession = 'tts'"));
  assert.ok(reducer.includes("next.activeSession = 'auto-page'"));
  assert.ok(effects.includes('manageSessionTransition'));
  assert.ok(library.includes('书源规则编辑未接入'));
});

test('Slice 10 cache and undo events use the exact Core dispatcher boundary', async () => {
  const service = await source('entry/src/main/ets/ui/store/CoreSlice10Service.ets');
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const coordinator = await source('entry/src/main/ets/ui/store/ReaderUIRuntimeShadowCoordinator.ets');
  assert.ok(service.includes('CoreRuntime.get().executeCoreMethod(method, params, timeoutMs)'));
  for (const method of ['cache.book.status', 'cache.book.prefetch', 'cache.clear', 'replace.undo']) {
    assert.ok(service.includes(`this.execute('${method}'`), `missing Slice 10 service method ${method}`);
    assert.ok(effects.includes(`ReaderEffects.runSlice10ContractCommand('${method}'`),
      `missing ReaderEffects route for ${method}`);
  }
  assert.ok(service.includes("params['sourceId'] = sourceId"));
  assert.ok(service.includes("params['bookId'] = bookId"));
  assert.ok(service.includes("params['chapterRange'] = chapterRange"));
  assert.ok(service.includes("params['scope'] = scope"));
  assert.ok(service.includes("params['undoToken'] = undoTokenValue"));
  assert.ok(service.includes("this.execute('replace.persist'"));
  assert.ok(service.includes('validateReaderUITypedResult('));
  assert.ok(service.includes('returned no result data'));
  assert.equal(effects.includes("getCoreAdapter().cacheClear('all')"), false);
  assert.ok(effects.includes("payload['scope'] = 'cache'"));
  assert.ok(effects.includes('ReaderEffects.slice10Core.replacePersistCreate(payload)'));
  assert.ok(effects.includes("type: 'core-slice10-undo-token-captured'"));
  assert.ok(coordinator.includes('private replaceRulePilotEnabled: boolean = false'));
});

test('Slice 10 generated result schemas reject nested and unknown-field drift', () => {
  const validStatus = {
    sourceId: 'source-live', bookId: 'book-live', tocAvailable: true, chapterCount: 1,
    chapters: [{
      chapterIndex: 0, title: 'Chapter', url: '/0', state: 'cached', cachedBytes: 12,
      attempts: 1, maxAttempts: 3,
    }],
    cachedCount: 1, queuedCount: 0, inProgressCount: 0, completedCount: 0,
    failedCount: 0, cancelledCount: 0, missingCount: 0,
    globalStats: {
      entryCount: 1, totalContentBytes: 12, queueEntryCount: 0, queuedCount: 0,
      inProgressCount: 0, completedCount: 0, failedCount: 0, cancelledCount: 0,
    },
  };
  validateReaderUITypedResult('reader.bookCache.open', 'cache.book.status', validStatus);
  assert.throws(() => validateReaderUITypedResult(
    'reader.bookCache.open', 'cache.book.status', { ...validStatus, fixtureOnly: true },
  ), /INVALID_TYPED_RESULT|unknown|not allowed/i);
  assert.throws(() => validateReaderUITypedResult(
    'reader.bookCache.open', 'cache.book.status', {
      ...validStatus, chapters: [{ ...validStatus.chapters[0], state: 'fixture-complete' }],
    },
  ), /INVALID_TYPED_RESULT|enum|allowed|one of/i);

  const validUndo = {
    transactionId: 'replace-1',
    revision: 'a'.repeat(64),
    operation: 'create', ruleId: 1, changed: true, undoneAt: 1700000001,
  };
  validateReaderUITypedResult('reader.replace.undo', 'replace.undo', validUndo);
  assert.throws(() => validateReaderUITypedResult(
    'reader.replace.undo', 'replace.undo', { ...validUndo, revision: 'short' },
  ), /INVALID_TYPED_RESULT|characters|length|pattern/i);
  assert.throws(() => validateReaderUITypedResult(
    'reader.replace.undo', 'replace.undo', {
      ...validUndo,
      restoredRule: {
        id: 1, name: 'r', pattern: 'a', replacement: 'b', scopeTitle: false,
        scopeContent: true, isEnabled: true, isRegex: false,
        timeoutMillisecond: 3000, order: 0, fixtureOnly: true,
      },
    },
  ), /INVALID_TYPED_RESULT|unknown|not allowed/i);

  const persistedRule = {
    id: 1, name: 'r', pattern: 'a', replacement: 'b', scopeTitle: false,
    scopeContent: true, isEnabled: true, isRegex: false,
    timeoutMillisecond: 3000, order: 0,
  };
  const validPersist = {
    operation: 'create',
    data: { rule: persistedRule },
    undoToken: {
      schemaVersion: 1, transactionId: 'replace-create-1', revision: 'b'.repeat(64),
      operation: 'create', ruleId: 1, issuedAt: 1700000000, expiresAt: 1700000300,
      after: persistedRule,
    },
  };
  validateReaderUITypedResult('reader.replace.create', 'replace.persist', validPersist);
  assert.throws(() => validateReaderUITypedResult(
    'reader.replace.create', 'replace.persist', {
      ...validPersist, undoToken: { ...validPersist.undoToken, revision: 'truncated' },
    },
  ), /INVALID_TYPED_RESULT|characters|length|pattern/i);
});

test('Slice 10 cache and undo commands have live visible UI projections', async () => {
  const state = await source('entry/src/main/ets/ui/store/ReaderUiState.ets');
  const reducer = await source('entry/src/main/ets/ui/store/ReaderReducer.ets');
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const resolver = await source('entry/src/main/ets/ui/store/ReaderSlice10LivePayloadResolver.ets');
  const adapter = await source('entry/src/main/ets/ui/router/ReaderUIScreenGraphButtonAdapter.ets');
  const routes = await source('entry/src/main/ets/ui/router/ReaderCapabilityClosureRouteRegistry.ets');
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
  const overlays = await source('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
  const replacePilot = await source('entry/src/main/ets/ui/store/ReaderReplaceRulePilotExecutor.ets');

  for (const field of [
    'coreSlice10Method', 'coreSlice10Loading', 'coreSlice10Result',
    'coreSlice10Error', 'lastUndoToken',
  ]) {
    assert.ok(state.includes(field), `ReaderUiState missing ${field}`);
    assert.ok(reducer.includes(field), `ReaderReducer missing ${field}`);
  }
  assert.ok(effects.includes("type: 'core-slice10-succeeded'"));
  assert.ok(effects.includes("type: 'core-slice10-failed'"));
  assert.equal(effects.includes('console.info(`ReaderEffects: ${method} completed`)'), false);

  assert.ok(resolver.includes('state.currentBook'));
  assert.ok(resolver.includes('state.activeReaderContentIdentity'));
  assert.ok(resolver.includes('state.chapterToc.length'));
  assert.ok(resolver.includes('state.lastUndoToken'));
  assert.equal(resolver.includes('src-001'), false);
  assert.equal(resolver.includes('bk-001'), false);
  assert.equal(resolver.includes('replace-42'), false);

  assert.ok(adapter.includes('settings-storage-clear-cache'));
  assert.equal(adapter.includes('download-task-detail-retry'), false);
  assert.equal(adapter.includes('reader_replace_apply_result-action-1'), false);
  assert.ok(adapter.includes('ReaderSlice10LivePayloadResolver'));
  assert.ok(renderer.includes('ReaderUiStore.snapshot()'));
  assert.match(routes, /plannedRouteDefinition\('download-task-detail'/);
  assert.doesNotMatch(routes, /coreRouteDefinition\('download-task-detail'/);

  assert.ok(overlays.includes("action: 'prefetch-current'"));
  assert.ok(overlays.includes("action: 'prefetch-next'"));
  assert.ok(overlays.includes("action: 'clear-book'"));
  assert.ok(overlays.includes('Core 状态 / 预取 / 按书清理'));
  assert.ok(overlays.includes('undoLastPersist'));
  assert.ok(overlays.includes('撤销上次新增'));
  assert.equal(overlays.includes('Core 阅读缓存 command 未接入'), false);

  assert.ok(replacePilot.includes("executeCoreMethod('replace.persist'"));
  assert.ok(replacePilot.includes("type: 'core-slice10-undo-token-captured'"));
});
