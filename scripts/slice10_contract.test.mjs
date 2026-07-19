import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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
  assert.ok(renderer.includes('ReaderDirectoryPanel({ standalone: true })'));
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
    'rules.replace', 'source.switch', 'reader.session']) {
    assert.match(policy, new RegExp(`id: '${id.replaceAll('.', '\\.')}'[\\s\\S]*Production`));
  }
  assert.ok(reducer.includes("next.activeSession = 'tts'"));
  assert.ok(reducer.includes("next.activeSession = 'auto-page'"));
  assert.ok(effects.includes('manageSessionTransition'));
  assert.ok(library.includes('书源规则编辑未接入'));
});
