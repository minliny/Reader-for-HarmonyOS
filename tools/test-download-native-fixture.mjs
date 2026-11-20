import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'initializer-safety': 'Actual SDK SharedDownloadPage initializer, exact debug and parent/shared checked font gates. No injected managing/detail state.',
  'no-business': 'Typed in-memory text/manga chapter and policy samples; no Entry or runtime Core/Host/network/file port, scale setter or substituted font.',
  'callback-retire': 'Actual initializer callbacks and bridge: memory/log-only actions, current generation/read target validation, stale callback and cleanup retirement, actual area separate from system scale.',
});
if (selected.length) {
  const productionRoot = new URL('../entry/src/main/ets/', import.meta.url).href;
  const resolver = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(productionRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  try {
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
  const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
  const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { createDownloadBookView, projectDownloadBookAvailability, downloadChapterStateLabel } =
    await import('../entry/src/main/ets/features/downloads/SharedDownloadProjection.ts');
  const { readerPageAreaLength } = await import('../entry/src/main/ets/features/common/ReaderPageShell.ts');
  const file = new URL('../entry/src/main/ets/pages/ReaderDownloadStructureFixture.ets', import.meta.url);
  const source = readFileSync(file, 'utf8');
  const actor = readFileSync(new URL('../entry/src/main/ets/features/downloads/SharedDownloadPage.ets', import.meta.url), 'utf8');
  const stateActor = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderPageState.ets', import.meta.url), 'utf8');
  const require = createRequire(import.meta.url), componentMap = require(resolveEtsLoaderRoot() + '/lib/component_map.js');
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
  function compile(body) {
    const ids = componentMap.ID_ATTRS, saved = new Map(ids); ids.clear();
    try { return body(); } finally { ids.clear(); for (const [key, value] of saved) ids.set(key, value); }
  }
  function fixture({ debug = true, mode = 'debug', parentFonts = true, fonts = () => Promise.resolve(true) } = {}) {
    const sdk = createArkUIPropertyRuntimeProbe(), children = [], actions = [], bridges = [], events = []; let fontCalls = 0, backs = 0;
    class Child { constructor(owner, params, _storage, id) { this.owner = owner; this.params = params; this.id = id; children.push(this); } updateStateVars(params) { Object.assign(this.params, params); } }
    class StateChild { constructor(owner, params, _storage, id) { this.owner = owner; this.params = params; this.id = id; } updateStateVars(params) { Object.assign(this.params, params); } }
    const { owner: page } = compile(() => createReaderComponentProbe(source, builderComponentMembers(source), {
      ...sdk.sdk, DEBUG: debug, BUILD_MODE_NAME: mode, SharedDownloadPage: Child, ReaderPageState: StateChild,
      createDownloadBookView, projectDownloadBookAvailability, downloadChapterStateLabel, readerPageAreaLength,
      ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1.6 }) },
      prepareSharedDownloadFonts: () => { fontCalls++; return fonts(); },
      hilog: { info(_domain, _tag, _format, payload) { events.push(JSON.parse(payload)); } },
    }, { ...sdk.hooks, childSources: { SharedDownloadPage: actor, ReaderPageState: stateActor } }));
    Object.assign(page, { fontsReady: parentFonts, onAction: action => actions.push(action), onBack: () => backs++,
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
        for (const field of ['managing', 'detailKey', 'sheet', 'fontsReady', 'initialViewState']) assert(!Object.hasOwn(params, field), `${field} is owned by actual page UI`);
        assert.deepEqual(Object.keys(params).sort(), ['books','error','loading','onBack','onIntent','onOpenBook','onReadTarget','onRefresh','onTemporaryBackBridge','onViewStateChanged','pendingMessage','presentationIdentity','storagePolicy','storageSummary'].sort());
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
    assert.equal(tree.parseDiagnostics.length, 0, 'whole fixture parses');
    const allowedImports = new Set(["../../../../build/default/generated/profile/default/BuildProfile","@kit.PerformanceAnalysisKit","../features/downloads/SharedDownloadPage","../features/downloads/SharedDownloadProjection","../features/common/ReaderFonts","../features/common/ReaderPageState","../features/common/ReaderPageShell","../app/ReaderWindowCoordinator"]);
    const imports = tree.statements.filter(ts.isImportDeclaration).filter(node => node.importClause?.isTypeOnly !== true).map(node => node.moduleSpecifier.text);
    assert.deepEqual(imports.filter(value => !allowedImports.has(value)), [], 'only explicit fixture UI/log/geometry/font imports');
    const forbidden = [];
    const visit = node => {
      if (ts.isSpreadAssignment(node)) forbidden.push('object-spread');
      if (ts.getAllDecorators(node).some(decorator => { const expression = decorator.expression; return (ts.isCallExpression(expression) ? expression.expression : expression).getText(tree) === 'Entry'; })) forbidden.push('Entry');
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
        if (['registerFont','saveBookSourceJson','openInteractive','showAlertDialog'].includes(name) || (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'AppStorage' && ['set','setOrCreate','delete','clear'].includes(name))) forbidden.push(name);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.deepEqual(forbidden, [], 'no Entry, direct writes/login/alert, font replacement or ArkTS object spread');
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
    old.onRefresh(); old.onOpenBook(book); old.onReadTarget({sourceId:book.sourceId,bookId:book.bookId,chapterIndex:2,chapterId:book.chapters[2].chapterId});
    old.onIntent({action:'download',scope:'chapters',books:[{sourceId:book.sourceId,bookId:book.bookId,chapterIndices:[2]}]});
    old.onIntent({action:'configureStorage',scope:'storage',books:[],cacheLimitMb:512,cleanupAfterDays:3});
    assert.equal(f.actions.length,5); assert.equal(f.page.storagePolicy.capacityBytes,536870912); assert.equal(f.page.books[0].state,'downloaded');
    old.onOpenBook({...book,sourceId:'not-fixture'}); old.onReadTarget({sourceId:book.sourceId,bookId:book.bookId,chapterIndex:2,chapterId:'wrong'});
    old.onIntent({action:'deleteLocal',scope:'books',books:[{sourceId:'not-fixture',bookId:book.bookId}]}); assert.equal(f.actions.length,5);
    const view = {query:'memory',type:'all',state:'all',sourceId:'all',sort:'recent',direction:'desc',listScroll:72,chapterScroll:33,detailKey:book.key};
    old.onViewStateChanged(view); assert.deepEqual(f.page.lastViewState,view); assert.equal(f.actions.length,5);
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
  const cases={'initializer-safety':initializerSafety,'no-business':noBusiness,'callback-retire':callbackRetire};
  for(const id of selected){await cases[id]();recordContractCasePass(id);}
  } finally { resolver.deregister(); }
}
