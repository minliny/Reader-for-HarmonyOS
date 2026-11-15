import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'initializer-safety': 'Actual SDK SharedDownloadPage initializer, exact debug and parent/shared checked font gates, normal public initial view. Management and modal state remain owned by the page.',
  'no-business': 'Typed in-memory text/manga chapter and policy samples; no Entry or runtime Core/Host/network/file port, scale setter or substituted font.',
  'callback-retire': 'Actual initializer callbacks and bridge: memory/log-only actions, current generation/read target validation, stale callback and cleanup retirement, actual area separate from system scale.',
  'state-samples': 'Actual ten public input projections, default and restored query/detail views, one pending refresh/recovery and coalesced chapter read with generation/retirement guards.',
});
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createDownloadBookView, projectDownloadBookAvailability, downloadChapterStateLabel, filterDownloadBooks } =
    await import('../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts');
  const { readerPageAreaLength } = await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
  const file = new URL('../entry/src/main/ets/pages/ReaderDownloadStructureFixture.ets', import.meta.url);
  const source = readFileSync(file, 'utf8');
  const { selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { DOWNLOAD_FIXTURE_SCENARIOS } = selectedProductionValues(file, ['DOWNLOAD_FIXTURE_SCENARIOS']);
  const actor = readFileSync(new URL('../entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets', import.meta.url), 'utf8');
  const stateActor = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderPageState.ets', import.meta.url), 'utf8');
  const require = createRequire(import.meta.url), componentMap = require(resolveEtsLoaderRoot() + '/lib/component_map.js');
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
  function compile(body) {
    const ids = componentMap.ID_ATTRS, saved = new Map(ids); ids.clear();
    try { return body(); } finally { ids.clear(); for (const [key, value] of saved) ids.set(key, value); }
  }
  function fixture({ debug = true, mode = 'debug', parentFonts = true, fonts = () => Promise.resolve(true), scenario = 'content' } = {}) {
    const sdk = boundedSurfaceSdk(), children = [], actions = [], bridges = [], events = []; let fontCalls = 0, backs = 0;
    class Child { constructor(owner, params, _storage, id) { this.owner = owner; this.params = params; this.id = id; children.push(this); } updateStateVars(params) { Object.assign(this.params, params); } }
    class StateChild { constructor(owner, params, _storage, id) { this.owner = owner; this.params = params; this.id = id; } updateStateVars(params) { Object.assign(this.params, params); } }
    const { owner: page } = compile(() => createReaderBuilderProbe(source, boundedMembers(source), {
      ...sdk.deps, DEBUG: debug, BUILD_MODE_NAME: mode, SharedDownloadPage: Child, ReaderPageState: StateChild,
      createDownloadBookView, projectDownloadBookAvailability, downloadChapterStateLabel, readerPageAreaLength,
      ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1.6 }) },
      prepareSharedDownloadFonts: () => { fontCalls++; return fonts(); },
      hilog: { info(_domain, _tag, _format, payload) { events.push(JSON.parse(payload)); } },
    }, { ...sdk.hooks, childSources: { ...sdk.childSources, SharedDownloadPage: actor, ReaderPageState: stateActor } }));
    Object.assign(page, { fontsReady: parentFonts, scenario, onAction: action => actions.push(action), onBack: () => backs++,
      onTemporaryBackBridge: (handler, identity) => bridges.push({ handler, identity }) });
    return { page, children, actions, bridges, events, sdk, fontCalls: () => fontCalls, backs: () => backs, props: () => children.at(-1)?.params };
  }
  async function initializerSafety() {
    for (const [debug, mode, parentFonts, allowed] of [
      [true, 'debug', true, true], [false, 'debug', true, false], [true, 'release', true, false], [true, 'debug', false, false],
    ]) {
      const f = fixture({ debug, mode, parentFonts }); f.page.aboutToAppear(); await tick(); f.page.initialRender();
      assert.equal(f.children.length, allowed ? 1 : 0); assert.equal(f.fontCalls(), allowed ? 1 : 0);
      if (allowed) {
        const params = f.props(); assert.equal(params.books.length, 12); assert(params.presentationIdentity.startsWith('download-fixture-'));
        for (const field of ['managing', 'detailKey', 'sheet', 'fontsReady']) assert(!Object.hasOwn(params, field), `${field} is owned by actual page UI`);
        assert.deepEqual(params.initialViewState, {query:'',type:'all',state:'all',sourceId:'all',sort:'recent',direction:'desc',detailKey:''});
        assert.deepEqual(Object.keys(params).sort(), ['books','error','loading','onBack','onIntent','onOpenBook','onReadTarget','onRefresh','onTemporaryBackBridge','onViewStateChanged','batchRecovery','isOpeningCurrent','onRefreshStorage','presentationIdentity','storagePolicy','storageSummary','initialViewState','onRefreshBatchRecovery'].sort());
      }
    }
    const gate = deferred(), f = fixture({ fonts: () => gate.promise }); f.page.aboutToAppear(); f.page.initialRender(); assert.equal(f.children.length, 0);
    gate.resolve(true); await tick(); f.page.initialRender(); assert.equal(f.children.length, 1); assert(f.events.some(event => event.kind === 'fonts-checked'));
    const falseReady = fixture({ fonts: () => Promise.resolve(false) }); falseReady.page.aboutToAppear(); await tick(); falseReady.page.initialRender(); assert.equal(falseReady.children.length, 0); assert.equal(falseReady.page.fontFailed, true);
    const failure = fixture({ fonts: () => Promise.reject(Error('checked load failed')) }); failure.page.aboutToAppear(); await tick(); assert.equal(failure.page.fontFailed, true); failure.page.initialRender(); assert.equal(failure.children.length, 0);
    const first = deferred(), second = deferred(); let calls = 0;
    const retired = fixture({ fonts: () => ++calls === 1 ? first.promise : second.promise }); retired.page.aboutToAppear(); retired.page.aboutToDisappear(); retired.page.aboutToAppear();
    first.resolve(true); await tick(); assert.equal(retired.page.downloadFontsReady, false); second.resolve(true); await tick(); assert.equal(retired.page.downloadFontsReady, true);
  }
  async function noBusiness() {
    const { ts, options } = installedEtsCompiler();
    const tree = ts.createSourceFile('ReaderDownloadStructureFixture.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const imports = tree.statements.filter(ts.isImportDeclaration).filter(node => node.importClause?.isTypeOnly !== true).map(node => node.moduleSpecifier.text);
    assert(!imports.some(path => /Gateway|SourceHost|DownloadHost|RuntimeOwner|Network|HTTP|FilePicker|FileIO/.test(path)), imports.join(','));
    assert(!source.includes('@Entry')); assert(!source.includes('AppStorage.set')); assert(!source.includes('registerFont('));
    const f = fixture(); f.page.aboutToAppear(); await tick(); f.page.initialRender(); const p = f.props();
    assert.deepEqual(new Set(p.books.map(book => book.contentKind)), new Set(['novel', 'manga']));
    assert.deepEqual(new Set(p.books.map(book => book.state)), new Set(['downloaded', 'none', 'downloading']));
    const states = new Set(p.books.flatMap(book => book.chapters.map(chapter => chapter.queueState)));
    for (const state of ['completed','missing','queued','paused','inProgress','cached','failed','cancelled','unknown']) assert(states.has(state), state);
    for (const book of p.books) {
      assert(book.sourceId.endsWith('.example.invalid')); assert.equal(book.coverUrl, undefined); assert(book.title.length > 30); assert.equal(book.chapters.length, 18);
      assert.equal(book.key, JSON.stringify([book.sourceId,book.bookId]));
      for (const chapter of book.chapters) assert.equal(chapter.key, JSON.stringify([book.sourceId,book.bookId,chapter.index]));
    }
    assert.deepEqual(p.storagePolicy, {capacityBytes:2147483648,expiryDays:7});
  }
  async function callbackRetire() {
    const f = fixture(); f.page.aboutToAppear(); await tick(); f.page.initialRender(); const old = f.props(), book = old.books[0];
    old.onOpenBook(book); old.onReadTarget({sourceId:book.sourceId,bookId:book.bookId,chapterIndex:2,chapterId:book.chapters[2].chapterId});
    old.onIntent({action:'download',scope:'chapters',books:[{sourceId:book.sourceId,bookId:book.bookId,chapterIndices:[2]}]});
    old.onIntent({action:'configureStorage',scope:'storage',books:[],cacheLimitMb:512,cleanupAfterDays:3});
    old.onRefresh();
    assert.equal(f.actions.length,5); assert.equal(f.page.storagePolicy.capacityBytes,536870912); assert.equal(f.page.books[0].state,'downloaded');
    const beforePartial=f.actions.length;
    old.onIntent({action:'configureStorage',scope:'storage',books:[],cacheLimitMb:768});
    assert.equal(f.page.storagePolicy.capacityBytes,805306368);assert.equal(f.page.storagePolicy.expiryDays,3);
    old.onIntent({action:'configureStorage',scope:'storage',books:[],cleanupAfterDays:9});
    assert.equal(f.page.storagePolicy.capacityBytes,805306368);assert.equal(f.page.storagePolicy.expiryDays,9);
    assert.equal(f.actions.length,beforePartial+2,'current selectors preserve the unchanged policy field');

    old.onOpenBook({...book,sourceId:'not-fixture'}); old.onReadTarget({sourceId:book.sourceId,bookId:book.bookId,chapterIndex:2,chapterId:'wrong'});
    old.onIntent({action:'deleteLocal',scope:'books',books:[{sourceId:'not-fixture',bookId:book.bookId}]}); assert.equal(f.actions.length,beforePartial+2);
    const view = {query:'memory',type:'all',state:'all',sourceId:'all',sort:'recent',direction:'desc',listScroll:72,chapterScroll:33,detailKey:book.key};
    old.onViewStateChanged(view); assert.deepEqual(f.page.lastViewState,view); assert.equal(f.actions.length,beforePartial+2);
    let consumes=0; old.onTemporaryBackBridge(()=>{consumes++;return true;},'real-page-bridge');
    const published=f.bridges.at(-1); assert.equal(published.handler(),true); old.onBack(); assert.equal(consumes,2); assert.equal(f.backs(),0);
    old.onTemporaryBackBridge(()=>false,'current-page-bridge'); old.onTemporaryBackBridge(undefined,'real-page-bridge'); assert.equal(f.page.childBackIdentity,'current-page-bridge');
    old.onBack(); assert.equal(f.backs(),1); assert.equal(f.actions.at(-1),'download-fixture:back-to-menu');
    f.page.observeArea(f.page.fixtureGeneration,{width:'300vp',height:'700vp'}); const observation=f.events.findLast(event=>event.kind==='actual-area'); assert.equal(observation.actualWidthVp,300); assert.equal(observation.systemFontScale,1.6);
    f.page.aboutToDisappear(); const count=f.actions.length; assert.equal(f.bridges.at(-1).handler,undefined); assert.equal(published.handler(),false);
    old.onRefresh(); old.onOpenBook(book); old.onBack(); old.onIntent({action:'cleanup',scope:'storage',books:[]}); old.onTemporaryBackBridge(()=>true,'retired');
    assert.equal(f.actions.length,count); assert.equal(f.backs(),1);
    f.page.aboutToAppear(); await tick(); f.page.initialRender(); const next=f.props(); next.onTemporaryBackBridge(()=>true,'next'); old.onTemporaryBackBridge(undefined,'next'); assert.equal(f.page.childBackIdentity,'next');
    f.page.fontsReady=false; f.page.onParentFontsChanged(); assert.equal(f.page.downloadFontsReady,false); assert.equal(f.page.consumeBack(),false); next.onRefresh(); assert.equal(f.actions.length,count);
  }
  async function stateSamples() {
    assert.equal(DOWNLOAD_FIXTURE_SCENARIOS.length, 9);
    for (const scenario of ['content', ...DOWNLOAD_FIXTURE_SCENARIOS.map(item => item.value)]) {
      const f = fixture({ scenario }); f.page.aboutToAppear(); await tick(); f.page.initialRender();
      const ports = f.props(), books = ports.books;
      const empty = ['loading','empty','read-error'].includes(scenario);
      assert.equal(books.length, empty ? 0 : 12);
      assert.equal(ports.loading, ['loading','pending'].includes(scenario));
      assert.equal(ports.error.length > 0, ['read-error','retained-error'].includes(scenario));
      const recovery = ['recovery','pending'].includes(scenario);
      assert.equal(ports.batchRecovery.visible, recovery);
      assert.equal(ports.batchRecovery.canRetry, recovery);
      assert.equal(ports.batchRecovery.generation, recovery ? f.page.fixtureGeneration : 0);
      assert.equal(ports.initialViewState.query, scenario === 'filtered-empty' ? 'fixture-no-matching-book' : '');
      if (scenario === 'filtered-empty') assert.deepEqual(filterDownloadBooks(books, ports.initialViewState), []);
      if (scenario.startsWith('chapter-')) {
        assert.equal(ports.initialViewState.detailKey, books[0].key);
        assert.equal(books[0].projectionStatus, scenario === 'chapter-error' ? 'unavailable' : 'unloaded');
        assert.equal(books[0].chapters.length, 0);
        assert.equal(books[0].downloadError, undefined, 'a projection error never creates a task failure');
        if (scenario === 'chapter-error') {
          assert.ok(books[0].projectionError.startsWith('内存夹具：'));
          ports.onOpenBook(books[0]); ports.onOpenBook(books[0]);
          assert.equal(f.actions.length, 1); assert.equal(f.page.pendingBookReads.size, 1);
          assert.equal(f.page.books, books, 'pending chapter read supplies no fabricated projection result');
        }
      }
      if (scenario === 'read-error') {
        ports.onRefresh(); ports.onRefresh();
        assert.equal(f.page.loading, true); assert.equal(f.page.error, '');
        assert.equal(f.actions.length, 1); assert.equal(f.page.books, books);
      }
      if (recovery) {
        ports.onRefreshBatchRecovery(ports.batchRecovery.generation - 1); assert.equal(f.actions.length, 0);
        ports.onRefreshBatchRecovery(ports.batchRecovery.generation);
        ports.onRefreshBatchRecovery(ports.batchRecovery.generation);
        assert.equal(f.page.loading, true); assert.equal(f.actions.length, scenario === 'recovery' ? 1 : 0);
        assert.equal(f.page.recovery, ports.batchRecovery, 'refresh keeps the original unresolved facts');
      }
      f.page.observeArea(f.page.fixtureGeneration, {width:366,height:168});
      const event = f.events.at(-1);
      assert.equal(event.scenario, scenario); assert.equal(event.bookCount, books.length);
      assert.equal(event.loading, f.page.loading); assert.equal(event.recoveryVisible, recovery);
      f.page.aboutToDisappear(); const count = f.actions.length;
      ports.onRefresh(); ports.onRefreshBatchRecovery(ports.batchRecovery.generation);
      if (books.length) ports.onOpenBook(books[0]);
      assert.equal(f.actions.length, count, 'retired callbacks cannot refresh the next scene');
    }
  }
  const cases={'initializer-safety':initializerSafety,'no-business':noBusiness,'callback-retire':callbackRetire,'state-samples':stateSamples};
  for(const id of selected){await cases[id]();recordContractCasePass(id);}
}
