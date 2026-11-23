import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'directory-metadata': 'Actual directory bookmark read and current title/excerpt projections preserve independent TOC display facts through async completion and owner retirement.',
  'tts-error-lease': 'Actual TTS error projection during a next-chapter await preserves the current nonzero position lease and original supersession fences.',
});
if (selected.length === 0) process.exit(0);

const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { ts, options } = installedEtsCompiler();
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const localPath = 'features/reading/ui/LocalReadingExperience.ets';
const entryPath = 'features/reading/presentation/ReadingEntryPresentation.ets';
const mergePath = 'features/reading/presentation/ReaderControlBookmarkLoad.ts';
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function parse(source) {
  const tree = ts.createSourceFile('ProjectionSource.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  return tree;
}

function methods(source, names, dependencies = {}) {
  const tree = parse(source);
  const members = names.map(name => {
    const matches = tree.statements.filter(node => node.members)
      .flatMap(node => [...node.members]).filter(node => ts.isMethodDeclaration(node) && node.name?.getText(tree) === name);
    assert.equal(matches.length, 1, 'exact production method ' + name);
    assert.ok(!ts.getAllDecorators(matches[0]).some(d => d.getText(tree) === '@Builder'));
    return matches[0].getText(tree);
  });
  return pureModuleProbe(`class ProjectionReceiver { ${members.join('\n')} }`,
    'ProjectionReceiver.ets', dependencies, ['ProjectionReceiver']).ProjectionReceiver;
}

function expression(source, marker, dependencies = {}, methodName) {
  const tree = parse(source), matches = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === marker) matches.push(node.initializer);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === marker) matches.push(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  const scope = methodName ? tree.statements.filter(node => node.members).flatMap(node => [...node.members])
    .find(node => node.name?.getText(tree) === methodName) : tree;
  assert.ok(scope, 'exact production method context');
  visit(scope);
  assert.equal(matches.length, 1, 'one exact production projection expression ' + marker);
  return pureModuleProbe(`function project() { return ${matches[0].getText(tree)}; }`,
    'ProjectionExpression.ets', dependencies, ['project']).project;
}

const metadata = entry => ({ displayTitle: entry.displayTitle, isVip: entry.isVip,
  isPay: entry.isPay, contextTitle: entry.contextTitle });
const row = (index = 0) => ({ index, title: `raw ${index}`, displayTitle: `第${index + 1}话`,
  isVip: true, isPay: false, contextTitle: '第一卷', level: 2,
  downloadState: 'completed', navigable: true, bookmarks: [] });

async function directoryMetadata(mergeSource = read(mergePath), entrySource = read(entryPath), localSource = read(localPath),
  prefetchSource = read('features/reading/application/ReadingPrefetchHost.ts'),
  flowSource = read('features/reading/application/ReadingSessionFlowGateway.ts')) {
  const merge = pureModuleProbe(mergeSource, 'ReaderControlBookmarkLoad.ts', {},
    ['mergeReaderControlBookmarkProjection', 'loadReaderControlBookmarkProjection']);
  const { mangaDirectoryDisplay } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryDisplay.ts');
  const Entry = methods(entrySource, ['applyDirectoryProjection', 'replaceOwnedDirectoryEntries'], { LOCAL_SOURCE_ID: 'local' });
  const entry = Object.assign(new Entry(), { book: { sourceId: 'source', bookId: 'book', title: 'Book', author: 'Author' },
    toc: [row()], scopeId: 7 });
  const initial = structuredClone(entry.toc);
  let calls = 0;
  entry.applyDirectoryProjection([{ ...row(), title: 'converted raw', displayTitle: 'stale projection', isPay: true }], undefined);
  assert.deepEqual(metadata(entry.toc[0]), metadata(initial[0]), 'title-only projection preserves independent current display facts');
  assert.equal(entry.toc[0].title, 'converted raw');
  assert.equal(entry.toc[0].downloadState, 'completed');
  assert.notEqual(entry.toc, initial);

  // Use the public Host load entry, actual Gateway bookmark parser and actual
  // Entry commit receiver. RPC and the Runtime-current predicate are finite.
  const resolution = registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
      throw error;
    }
  } });
  try {
    const { ReaderDirectoryHost } = await import('../entry/src/main/ets/features/reading/application/ReaderDirectoryHost.ts');
    const { LocalReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts');
    const pending = deferred();
    let entered;
    const started = new Promise(done => { entered = done; });
    const rpc = { async request(method) {
      assert.equal(method, 'bookmark.list'); calls += 1; entered();
      await pending.promise;
      return { data: { bookmarks: [] } };
    } };
    const gateway = new LocalReadingFlowGateway(rpc);
    const host = new ReaderDirectoryHost({ gateway, ownsRuntime: () => true });
    const delivered = [];
    const receiver = { replaceDirectory(scope, entries) { delivered.push({ scope, entries }); } };
    const binding = { book: entry.book, current: () => true, currentEntries: () => entry.toc,
      emitEntries: entries => entry.replaceOwnedDirectoryEntries(entries, () => receiver) };
    const run = host.load(binding);
    await started;
    entry.toc = [{ ...entry.toc[0], displayTitle: '当前确认显示标题', isPay: true, contextTitle: '第二卷' }];
    const latest = structuredClone(entry.toc);
    pending.resolve(); await run;
    assert.equal(calls, 1);
    assert.deepEqual(metadata(entry.toc[0]), metadata(latest[0]), 'bookmark-only read preserves latest owner display facts');
    assert.equal(mangaDirectoryDisplay(entry.toc[0]).title, '当前确认显示标题');
    assert.equal(mangaDirectoryDisplay(entry.toc[0]).statusText, 'VIP · 已购');
    assert.equal(delivered.length, 1); assert.equal(delivered[0].scope, 7);
    assert.deepEqual(entry.toc[0].bookmarks, []);
  } finally { resolution.deregister(); }

  const current = [row()];
  const projected = [{ ...row(), displayTitle: 'stale', isVip: false, contextTitle: 'stale', bookmarks: [{ time: 1 }] }];
  const merged = merge.mergeReaderControlBookmarkProjection(current, projected);
  assert.deepEqual(metadata(merged[0]), metadata(current[0]), 'bookmark merge changes bookmarks alone');
  assert.deepEqual(merged[0].bookmarks, [{ time: 1 }]);
  assert.deepEqual(current[0].bookmarks, []);
  assert.throws(() => merge.mergeReaderControlBookmarkProjection(current, [projected[0], projected[0]]), /duplicate/);
  assert.throws(() => merge.mergeReaderControlBookmarkProjection(current, [{ ...projected[0], bookmarks: undefined }]), /incomplete/);
  const legacy = { index: 1, title: 'legacy', downloadState: 'unknown' };
  assert.deepEqual(merge.mergeReaderControlBookmarkProjection([legacy], [{ ...legacy, bookmarks: [] }]), [{ ...legacy, bookmarks: [] }]);
  for (const ending of ['retired', 'catalog-grown']) {
    const pending = deferred(); let live = true, committed = 0, entries = [row()];
    const run = merge.loadReaderControlBookmarkProjection({ isCurrent: () => live, currentEntries: () => entries,
      read: () => pending.promise, commit: () => { committed += 1; } });
    if (ending === 'retired') live = false;
    else entries = [row(), { ...row(1), bookmarks: undefined }];
    pending.resolve([row()]);
    await assert.rejects(run, ending === 'retired' ? /superseded/ : /incomplete/);
    assert.equal(committed, 0);
  }

  const Local = methods(localSource, ['controlDirectorySourceEntries', 'controlDirectoryEntries']);
  const local = Object.assign(new Local(), { directoryEntries: [row()], tocEntries: [{ ...row(), title: 'converted', level: 3 }],
    entryCatalogPending: false });
  const source = local.controlDirectorySourceEntries();
  assert.deepEqual(metadata(source[0]), metadata(local.directoryEntries[0]), 'control title join preserves parent display facts');
  assert.equal(source[0].title, 'converted'); assert.equal(source[0].level, 3);
  local.chapter = { chapterIndex: 0, content: 'known excerpt', sourceId: 'local', bookId: 'book', contentVersion: 1 };
  local.chapterLayoutMap = { scalarCount: () => 13, containsScalar: () => true, utf16ForScalar: value => value };
  local.bookmarkMatchesCurrentChapter = () => true; local.bookmarkExcerptCache = new Map();
  source[0].bookmarks = [{ time: 1, chapterIndex: 0, chapterOffset: 0, content: 'user note', chapterTitle: 'chapter' }];
  const enriched = local.controlDirectoryEntries();
  assert.deepEqual(metadata(enriched[0]), metadata(source[0]), 'excerpt projection preserves independent display facts');
  assert.equal(enriched[0].bookmarks[0].content, 'user note');
  assert.equal(enriched[0].bookmarks[0].bookText, 'known excerpt');
  const retained = expression(localSource, 'retainedToc').call({ tocEntries: source });
  assert.deepEqual(metadata(retained[0]), metadata(source[0]), 'retained content TOC preserves display metadata');
  assert.equal(retained[0].bookmarks, undefined, 'original content-position lease excludes bookmark annotations');
  const remote = [{ ...row(), url: 'https://source/chapter' }];
  const remoteToc = expression(localSource, 'this.admitTocEntries', { session: { entries: remote } }, 'onRemoteCatalogChanged').call({});
  assert.deepEqual(metadata(remoteToc[0]), metadata(remote[0]), 'catalog admission preserves confirmed remote metadata');
  assert.equal(remoteToc[0].navigable, true); assert.equal(remoteToc[0].level, remote[0].level);
  const { sameRemoteSessionEvidence } = pureModuleProbe(
    read('features/reading/application/RemoteReadingEvidence.ts'), 'RemoteReadingEvidence.ts', {}, ['sameRemoteSessionEvidence']);
  const Prefetch = methods(prefetchSource, ['publish'], { sameRemoteSessionEvidence });
  const prefetch = new Prefetch();
  const session = { identity: { sourceId: 'source', bookId: 'book' }, catalogVersion: 'catalog', contextVersion: 'context' };
  let latest = [row()], published = 0;
  const lease = { displayedSession: () => session, directory: () => latest,
    projected: entries => { latest = entries; published += 1; } };
  prefetch.publish([{ ...row(), downloadState: 'failed', displayTitle: 'stale read' }], session, () => true, lease);
  assert.deepEqual(metadata(latest[0]), metadata(row()), 'offline-only prefetch projection preserves current display metadata');
  assert.equal(latest[0].downloadState, 'failed'); assert.equal(published, 1);
  prefetch.publish([{ ...row(), downloadState: 'queued' }], session, () => false, lease);
  prefetch.publish([{ ...row(), downloadState: 'queued' }], { ...session, catalogVersion: 'other' }, () => true, lease);
  assert.equal(published, 1, 'retired or different-session prefetch cannot publish');

  const Flow = methods(flowSource, ['loadToc', 'loadTocProjection', 'hasPendingSourceSwitch', 'assertBook', 'configureDocuments'],
    { readReadingCatalog: async () => undefined });
  for (const fromCurrentSession of [true, false]) {
    const inputs = [{ ...row(), url: 'https://source/chapter' }, { ...row(1), url: 'https://source/group', navigable: false }];
    const flow = Object.assign(new Flow(), { sourceId: 'source', bookId: 'book', source: { kind: 'remote' },
      runtimeOwner: { hasCurrentCatalogProjection: () => fromCurrentSession },
      ensureRemoteSession: async () => ({ ...session, entries: inputs }),
      remote: { loadCachedTocProjection: async () => inputs },
    });
    const toc = await flow.loadToc('book', () => true);
    assert.deepEqual(metadata(toc.entries[0]), metadata(inputs[0]), 'normal reading catalog preserves remote display facts');
    assert.equal(toc.entries[0].level, inputs[0].level); assert.equal(toc.entries[1].navigable, false);
  }
  const Candidate = methods(read('features/manga/presentation/MangaSourceSwitchPresentation.ets'),
    ['presentMangaSourceSwitchSelection']);
  const original = { sourceId: 'old-source', bookId: 'old-book' };
  const target = { contentKind: 'manga', identity: { sourceId: 'new-source', bookId: 'new-book' },
    entries: [{ ...row(), url: 'chapter' }, { ...row(1), url: 'heading', navigable: false }] };
  const candidate = Object.assign(new Candidate(), { ports: { scene: () => ({ book: original }) } });
  candidate.presentMangaSourceSwitchSelection(original, { sourceId: 'new-source', bookUrl: 'new-book' },
    { targetSession: target, fromSourceId: 'old-source', fromBookId: 'old-book', expectedFrom: { epoch: 1, revision: 2 } },
    () => true, () => {});
  assert.deepEqual(metadata(candidate.selection.entries[0]), metadata(target.entries[0]), 'manga candidate preserves display facts');
  assert.equal(candidate.selection.entries[1].navigable, false);

  const fixtureData = pureModuleProbe(read('pages/ReaderDirectoryStructureFixtureData.ts'), 'DirectoryFixtureData.ts', {},
    ['readerDirectoryFixtureEntries', 'readerDirectoryFixtureCopyEntry', 'ReaderDirectoryFixturePort']);
  const Fixture = methods(read('pages/ReaderDirectoryStructureFixture.ets'), ['resetFixture'], fixtureData);
  const fixture = Object.assign(new Fixture(), { presentation: 0, closeOfflineOwner() {}, initialRequestedControlHeight: () => 0,
    admitted: () => true, mode: 'manga', sourceSwitchCandidate: true, controlMinimumRevision: 0,
    identity: () => ({ sourceId: 'fixture', bookId: 'book' }), openingIdentity: () => 'same', record() {} });
  fixture.resetFixture();
  const samples = fixtureData.readerDirectoryFixtureEntries(true);
  assert.deepEqual(fixture.entries.map(metadata), samples.map(metadata), 'candidate fixture preserves actual confirmed sample display facts');
  assert.ok(fixture.entries.every(entry => entry.downloadState === 'unknown' && entry.bookmarks === undefined));
  return { publicHostReads: calls, sameTypeProjectionPoints: 10, legacyInputs: true, supersededReadsRejected: true };


}

async function ttsErrorLease(localSource = read(localPath)) {
  const { ReaderTtsPageFollow } = await import('../entry/src/main/ets/features/reading/ui/ReaderTtsPageFollow.ts');
  const { createReaderTtsState } = await import('../entry/src/main/ets/features/reading/application/ReaderTtsState.ts');
  const Local = methods(localSource, ['logTtsFailure', 'notifyTtsPreferencePending', 'loadNextTtsChapter'], { hilog: { error() {} } });
  const results = [];
  for (const ending of ['current', 'new-position', 'retired']) {
    const pending = deferred();
    const original = { ...createReaderTtsState(true), status: 'playing', sessionGeneration: 4,
      utteranceGeneration: 5, positionGeneration: 9, audioStarted: true, chapterIndex: 0, chapterKey: 'chapter0',
      contentVersion: 1, totalSlices: 2, sliceIndex: 1, charStart: 4, charEnd: 8 };
    let live = true, admitted = 0, notices = 0;
    const local = Object.assign(new Local(), { sourceId: 'local', bookId: 'book', lifecycleToken: 3,
      ttsState: structuredClone(original), ttsTimerMode: 'off', ttsPageFollow: new ReaderTtsPageFollow(),
      ttsFollowScope: () => ({ sourceId: 'local', bookId: 'book', lifecycleToken: 3 }),
      isSessionActive: token => live && token === 3, isUnknownCatalogEdge: () => false,
      adjacentChapterIndex: () => 1, loadSessionChapter: () => pending.promise,
      admitChapterContentVersion() { admitted += 1; }, chapterWindow: { admitNeighbour() {} },
      ttsChapterRef: chapter => ({ sourceId: 'local', bookId: 'book', chapterIndex: chapter.chapterIndex }),
      ttsPreferencesGateway: { writeFacts: () => ({ pendingReconciliation: true }) },
      setReaderPreferenceNotice() { notices += 1; },
    });
    const next = local.loadNextTtsChapter({ sourceId: 'local', bookId: 'book', chapterIndex: 0 }, 3);
    local.notifyTtsPreferencePending(new Error('preference ACK unavailable'), () => true);
    assert.deepEqual(JSON.parse(JSON.stringify({ ...local.ttsState, errorMessage: undefined })),
      JSON.parse(JSON.stringify({ ...original, errorMessage: undefined })),
      'message-only projection preserves complete TTS state');
    assert.equal(notices, 1); assert.equal(local.ttsState.errorMessage, 'preference ACK unavailable');
    if (ending === 'new-position') local.ttsState.positionGeneration += 1;
    if (ending === 'retired') live = false;
    pending.resolve({ chapterIndex: 1, content: 'next actual chapter', contentVersion: 2 });
    const value = await next;
    if (ending === 'current') {
      assert.equal(value?.chapter.chapterIndex, 1, 'valid next chapter survives independent preference failure');
      assert.equal(value.content, 'next actual chapter'); assert.equal(admitted, 1);
    } else { assert.equal(value, undefined); assert.equal(admitted, 0); }
    results.push(ending);
  }
  return { results, originalPositionGeneration: 9, audioStartedPreserved: true,
    boundary: 'Actual LRE error and next-chapter methods plus production follow lease. Chapter transport and preference notice endpoint are finite. Coordinator audio/device execution remains separate evidence.' };
}

for (const id of selected) {
  let result;
  if (id === 'directory-metadata') {
    result = await directoryMetadata();
    const merge = read(mergePath);
    const negative = merge.replace('next.push({ ...entry, bookmarks:',
      'next.push({ index: entry.index, title: entry.title, level: entry.level, downloadState: entry.downloadState, navigable: entry.navigable, bookmarks:');
    assert.notEqual(negative, merge);
    await assert.rejects(() => directoryMetadata(negative), /bookmark merge changes bookmarks alone/);
    const entry = read(entryPath), local = read(localPath);
    const removeMetadata = source => source.replaceAll(/\s*displayTitle: (entry|item)\.displayTitle, isVip: \1\.isVip, isPay: \1\.isPay,\s*contextTitle: \1\.contextTitle,/g, '');
    assert.notEqual(removeMetadata(entry), entry);
    await assert.rejects(() => directoryMetadata(merge, removeMetadata(entry)), /title-only projection preserves/);
    assert.notEqual(removeMetadata(local), local);
    await assert.rejects(() => directoryMetadata(merge, entry, removeMetadata(local)), /preserves (parent|independent|display|confirmed)/);
    const prefetch = read('features/reading/application/ReadingPrefetchHost.ts');
    const oldPrefetch = prefetch.replace('{ ...prior, downloadState: entry.downloadState }',
      '{ index: prior.index, title: prior.title, level: prior.level, navigable: prior.navigable, bookmarks: prior.bookmarks, downloadState: entry.downloadState }');
    assert.notEqual(oldPrefetch, prefetch);
    await assert.rejects(() => directoryMetadata(merge, entry, local, oldPrefetch), /offline-only prefetch projection preserves/);
    const flow = read('features/reading/application/ReadingSessionFlowGateway.ts');
    assert.notEqual(removeMetadata(flow), flow);
    await assert.rejects(() => directoryMetadata(merge, entry, local, prefetch, removeMetadata(flow)), /normal reading catalog preserves/);

  } else {
    result = await ttsErrorLease();
    const source = read(localPath);
    const negative = source.replace('      positionGeneration: current.positionGeneration,\n      audioStarted: current.audioStarted,\n', '');
    assert.notEqual(negative, source);
    await assert.rejects(() => ttsErrorLease(negative), /message-only projection preserves complete TTS state/);
  }
  console.log(JSON.stringify({ case: id, result, negativeControlsRejected: true }));
  recordContractCasePass(id);
}
