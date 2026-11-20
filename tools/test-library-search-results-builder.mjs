import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'retained-route': {
    description: 'Actual SDK search-results Builder lowering and retained shelf/search route branch, with old inline condition negative control',
    resources: [],
  },
});

for (const id of selected) {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { installedEtsCompiler, emitSdkProbe } = await import('./lib/ets-compiler-runtime.mjs');
  const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
  const { virtualFilePath } = await import('./lib/tool-environment.mjs');
  const compiler = installedEtsCompiler(), { ts, options } = compiler;
  const parse = source => ts.createSourceFile(virtualFilePath('SearchResultsBuilderProbe.ets'), source,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const source = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
  function routeInputs(definition) {
    const tree = parse(definition); assert.equal(tree.parseDiagnostics.length, 0);
    const index = tree.statements.find(node => node.name?.text === 'Index'); assert.ok(index);
    let slot;
    const visit = node => {
      if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) && node.expression?.getText(tree) === 'ReaderLibrarySearchSurface') {
        const property = node.arguments?.[0]?.properties?.find(value => value.name?.getText(tree) === 'results');
        if (property) { assert.equal(slot, undefined, 'one persistent-surface results slot'); slot = property.initializer; }
      }
      ts.forEachChild(node, visit);
    };
    visit(index); assert.ok(slot, 'actual persistent-surface results slot');
    const calls = [];
    const findCalls = node => { if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword) calls.push(node.expression.name.text); ts.forEachChild(node, findCalls); };
    findCalls(slot); assert.equal(calls.length, 1, 'results slot delegates to its actual Builder');
    const resultName = calls[0], results = index.members.find(node => node.name?.getText(tree) === resultName); assert.ok(results);
    calls.length = 0; findCalls(results.body); assert.equal(calls.length, 1, 'focused page Builder is an explicit mount port');
    return { resultName, pageName: calls[0], resultText: results.getText(tree), inlineBody: results.body.getText(tree), slot: slot.getText(tree), tree };
  }
  function bindCallback(expression, owner, scope = {}) {
    const output = emitSdkProbe('const retainedCallback = (' + expression + ');', {
      fileName: virtualFilePath('SearchRetainedCallback.ts'), compiler,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    });
    return new Function(...Object.keys(scope), output + ';return retainedCallback;').call(owner, ...Object.values(scope));
  }
  // This port records SDK-emitted observers and branch lifetime. Native drawing,
  // dependency selection and destruction remain outside its evidence scope.
  class View {
    constructor() { this.observers = []; this.branch = undefined; this.pageMounted = false; this.pageMounts = 0; }
    finalizeConstruction() {}
    observeComponentCreation2(callback) { this.observers.push(callback); callback(1, true); }
    ifElseBranchUpdateFunction(branch, callback) { if (branch === this.branch) return; this.branch = branch; this.pageMounted = false; callback(); }
    replay() { for (const observer of [...this.observers]) observer(1, false); }
  }
  function verifyRoute(definition) {
    const input = routeInputs(definition);
    class RouteView extends View {}
    RouteView.prototype[input.pageName] = function() { this.pageMounted = true; this.pageMounts++; };
    const fixture = '@Component struct SearchResultsBuilderProbe {\n' + input.resultText + '\n@Builder private ' + input.pageName + '() {}\nbuild() { Column() {} }\n}';
    const { Component: Owner } = createReaderComponentProbe(fixture, [input.resultName],
      { ViewPU: RouteView, If: { create() {}, pop() {} } }, { createGlobals: () => ({}) });
    function mount(expression) { const owner = new Owner(undefined, {}); owner.route = 'bookshelf'; bindCallback(expression, owner)(); return owner; }
    const active = mount(input.slot);
    assert.equal(active.pageMounted, false); assert.equal(active.observers.length, 1, 'idle shelf retains the generated route observer');
    active.route = 'search'; active.replay(); assert.equal(active.pageMounted, true, 'same mounted surface enters SearchPage');
    active.replay(); assert.equal(active.pageMounts, 1, 'unchanged route retains SearchPage');
    active.route = 'bookshelf'; active.replay(); assert.equal(active.pageMounted, false, 'leaving search removes its branch');
    active.route = 'search'; active.replay(); assert.equal(active.pageMounts, 2, 'later search opening has a fresh page');
    const old = mount('(): void => ' + input.inlineBody);
    old.route = 'search'; old.replay(); assert.equal(old.observers.length, 0, 'inline condition registers no reactive branch');
    assert.equal(old.pageMounted, false, 'inline slot reproduces missing SearchPage after route change');
    return input;
  }
  const input = verifyRoute(source), edits = [];
  const rename = node => { if (ts.isIdentifier(node) && node.text === input.resultName) edits.push({ start: node.getStart(input.tree), end: node.end }); ts.forEachChild(node, rename); };
  rename(input.tree); assert.ok(edits.length >= 2);
  let equivalent = source;
  for (const edit of edits.sort((a,b) => b.start - a.start)) equivalent = equivalent.slice(0,edit.start) + input.resultName + 'Equivalent' + equivalent.slice(edit.end);
  verifyRoute(equivalent);
  // Execute the actual Page-to-Card callback through installed SDK lowering.
  // The Card boundary records Props; ordinary selection/touch policy below is
  // selected from the real Card, not simulated selection logic.
  const { selectedProductionMethods, selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
  const pageFile = new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url);
  const pageSource = readFileSync(pageFile, 'utf8'), pageTree = parse(pageSource);
  const pageClass = pageTree.statements.find(node => node.name?.text === 'SearchPage');
  const cardClass = pageTree.statements.find(node => node.name?.text === 'SearchResultCard');
  const resultsMethod = pageClass.members.find(node => node.name?.getText(pageTree) === 'resultsContent');
  let cardCall;
  const findCard = node => {
    if (node.expression?.getText(pageTree) === 'SearchResultCard' && node.arguments?.length) cardCall = node;
    ts.forEachChild(node, findCard);
  };
  findCard(resultsMethod); assert.ok(cardCall);
  const props = cardCall.arguments[0].properties;
  const callback = props.find(node => node.name?.getText(pageTree) === 'onSelectResult').initializer.getText(pageTree);
  const cardDeclaration = pageSource;
  class CardPort { constructor(owner, params, _storage, id) { Object.assign(this, params, { owner, id }); } }
  const fixtureSource = `@Component struct RetainedSelectionProbe {
    @Builder private row() { SearchResultCard({ onSelectResult: ${callback} }); }
    build() { Column() {} }
  }`;
  const selectionProbe = createReaderComponentProbe(fixtureSource, ['row'], { SearchResultCard: CardPort },
    { childSources: { SearchResultCard: cardDeclaration } });
  const Page = selectedProductionMethods(pageFile, 'SearchPage', ['ownsSurface', 'ownsPageQuery']);
  const { ReaderLibrarySearchModel } = selectedProductionClasses(new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchModel.ets', import.meta.url), ['ReaderLibrarySearchModel']);
  const model = new ReaderLibrarySearchModel(); model.claim(41); model.activate(41);
  const navigations = [], owner = selectionProbe.owner;
  Object.assign(owner, { pageMounted: true, pageEpoch: 4, queryAtMount: 8, viewState: { pageRevision: 4, revision: 8, filterRevision: 0 },
    surfaceModel: model, surfaceOwner: 41, isPresentationCurrent: () => true, onSelectResult: (...args) => navigations.push(args),
    ownsSurface: Page.prototype.ownsSurface, ownsPageQuery: Page.prototype.ownsPageQuery });
  owner.row();
  const retainedCallback = [...owner.children.values()][0].onSelectResult;
  const { searchBookSnapshot } = await import('../entry/src/main/ets/features/search/SearchBookSnapshot.ts');
  const Card = selectedProductionMethods(pageFile, 'SearchResultCard', ['selectResult', 'captureSelection', 'displayBook', 'onCardTouch'], {
    searchBookSnapshot, SourceType: { TouchScreen: 'touch' }, TouchType: { Down: 'down', Up: 'up', Cancel: 'cancel' },
  });
  const book = { sourceId: 'source-a', bookId: 'book-a', title: '诡秘之主', author: '作者' };
  const card = Object.assign(new Card(), { mounted: true, selectionEpoch: 0, group: { book, variants: [book], coverUrl: '' },
    queryRevision: 8, displayRevision: 0, viewState: owner.viewState, onSelectResult: retainedCallback });
  const retainedRowClick = () => { card.onCardTouch('down'); card.selectResult('touch'); };
  model.suspend(); retainedRowClick(); assert.equal(navigations.length, 0, 'retained native selection policy cannot navigate after surface suspend');
  model.activate(41); retainedRowClick(); assert.equal(navigations.length, 1, 'active legitimate surface retains actual book selection');
  assert.equal(navigations[0][0].bookId, 'book-a');
  model.claim(42); model.activate(42); retainedRowClick(); assert.equal(navigations.length, 1, 'old Page owner cannot borrow a new active surface');
  model.claim(41); model.activate(41); owner.pageMounted = false; retainedRowClick(); assert.equal(navigations.length, 1, 'retired Page rejects retained Card callback');
  owner.pageMounted = true; owner.queryAtMount = 7; retainedRowClick(); assert.equal(navigations.length, 1, 'old query rejects retained callback');
  // Mutation control: the previous actual callback demonstrably navigates while suspended.
  const callbackText = 'const candidate = (' + callback + ');', callbackTree = ts.createSourceFile('SelectionFault.ts', callbackText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(callbackTree.parseDiagnostics.length, 0); let guard;
  const findGuard = node => { if (ts.isIfStatement(node) && ts.isCallExpression(node.expression) && ts.isPropertyAccessExpression(node.expression.expression) && node.expression.expression.name.text === 'ownsSurface') { assert.equal(guard, undefined); guard = node.expression; } ts.forEachChild(node, findGuard); };
  findGuard(callbackTree); assert.ok(guard);
  const mutated = callbackText.slice(0, guard.getStart(callbackTree)) + 'true' + callbackText.slice(guard.end);
  const faultTree = ts.createSourceFile('SelectionFault.ts', mutated, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const faultExpression = faultTree.statements[0].declarationList.declarations[0].initializer.getText(faultTree);
  const unguarded = bindCallback(faultExpression, owner);
  model.suspend(); unguarded(book, [book], ''); assert.equal(navigations.length, 2, 'removing the real admission gate exposes stale selection');
  // Execute the current Index admission expression and its actual identity
  // method, without tightening the general input/exit presentation contract.
  const indexFile = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
  const currentIndexSource = readFileSync(indexFile, 'utf8'), currentIndexTree = parse(currentIndexSource);
  const currentIndexClass = currentIndexTree.statements.find(node => node.name?.text === 'Index');
  const currentSearchSurface = currentIndexClass.members.find(node => node.name?.getText(currentIndexTree) === 'searchPageSurface');
  let indexSelection;
  const findSelection = node => {
    if (ts.isPropertyAssignment(node) && node.name.getText(currentIndexTree) === 'onSelectResult') indexSelection = node.initializer.getText(currentIndexTree);
    ts.forEachChild(node, findSelection);
  };
  findSelection(currentSearchSurface); assert.ok(indexSelection);
  const IndexMethods = selectedProductionMethods(indexFile, 'Index', ['isCurrentSearchPresentation']);
  const runtime = {}, host = {}, indexNavigations = [];
  const indexOwner = { route: 'search', navigationGeneration: 9, detailShelfAdmissionMount: 2, mountedRuntimeOwner: runtime,
    shelfReceiptRetired: false, searchHost: host, librarySearchMode: 'results', librarySearchModel: model,
    isCurrentRuntime: value => value === runtime, isCurrentSearchPresentation: IndexMethods.prototype.isCurrentSearchPresentation,
    onSearchResultSelected: (...args) => indexNavigations.push(args) };
  const indexCallback = bindCallback(indexSelection, indexOwner, { generation: 9, owner: runtime, mounting: 2, host });
  model.activate(41); indexCallback(book, [book], ''); assert.equal(indexNavigations.length, 1);
  indexOwner.librarySearchMode = 'idle'; indexCallback(book, [book], ''); assert.equal(indexNavigations.length, 1, 'Index refuses closing idle route even before model delivery');
  indexOwner.librarySearchMode = 'results'; model.suspend(); indexCallback(book, [book], ''); assert.equal(indexNavigations.length, 1, 'Index refuses suspended surface');
  model.activate(41); indexOwner.route = 'settings'; indexCallback(book, [book], ''); assert.equal(indexNavigations.length, 1, 'Index refuses actual settings route');
  // The closing journey must still settle after refusing a retained row.
  // Execute Index's real close and settle methods plus Surface's real native
  // transition completion, retaining only returnToBookshelf as a route port.
  const ExitIndex = selectedProductionMethods(indexFile, 'Index', ['backLibrarySearch', 'settleLibrarySearch']);
  const surfaceFile = new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets', import.meta.url);
  const SurfaceExit = selectedProductionMethods(surfaceFile, 'ReaderLibrarySearchSurface', ['completeTransition']);
  let bookshelfReturns = 0;
  Object.assign(indexOwner, { librarySearchIdentity: 12, librarySearchMode: 'results', route: 'search',
    backLibrarySearch: ExitIndex.prototype.backLibrarySearch, settleLibrarySearch: ExitIndex.prototype.settleLibrarySearch,
    returnToBookshelf() { bookshelfReturns++; this.route = 'bookshelf'; } });
  model.claim(41); model.activate(41); model.filtersExpanded = false;
  owner.queryAtMount = 8; owner.pageMounted = true; owner.onSelectResult = indexCallback;
  indexOwner.backLibrarySearch();
  assert.equal(indexOwner.librarySearchMode, 'idle'); assert.equal(model.interactive, false); assert.equal(indexOwner.route, 'search');
  retainedRowClick(); assert.equal(indexNavigations.length, 1, 'old Card click cannot hijack closing search');
  const exitSurface = Object.assign(new SurfaceExit(), { generation: 3, transitionKind: 'back', transitionDurationMs: 200,
    transitionStartedMs: 10, elapsed: 200, mode: 'idle', searchMounted: true, fieldFocused: false,
    activeIdentity: 12, identity: 12, activeNavigation: 9, navigationGeneration: 9, activeMounting: 2, mounting: 2,
    onSettled(mode, identity, generation, mounting) {
      if (indexOwner.isCurrentSearchPresentation(generation, runtime, mounting, host)) indexOwner.settleLibrarySearch(mode, identity);
    } });
  exitSurface.completeTransition();
  assert.equal(exitSurface.searchMounted, false); assert.equal(indexOwner.route, 'bookshelf');
  assert.equal(bookshelfReturns, 1, 'actual completion reaches bookshelf while the generic presentation guard remains permissive during closing');
  recordContractCasePass(id);
}
