import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'lazy-row-object-link': {
    description: 'The actual lazy search row passes its retained Observed group through an SDK-recognized ObjectLink initializer; shorthand regression is diagnosed',
    resources: [],
  },
  'retained-group-updates': {
    description: 'Actual search groups and datasource update an SDK ObjectLink row in place; old-query image, visibility and pressed-selection callbacks lose authority',
    resources: [],
  },
});

for (const id of selected) {
  if (id === 'retained-group-updates') {
    await retainedGroupUpdates();
    recordContractCasePass(id);
    continue;
  }
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { virtualFilePath } = await import('./lib/tool-environment.mjs');
  const { ts, options, require, root } = installedEtsCompiler();
  const syntax = require(`${root}/lib/validate_ui_syntax.js`);
  const ui = require(`${root}/lib/process_ui_syntax.js`);
  const utils = require(`${root}/lib/utils.js`);
  const main = require(`${root}/main.js`);
  const compiler = require(`${root}/lib/process_component_class.js`);
  const source = readFileSync(new URL('../entry/src/main/ets/features/search/ui/SearchPage.ets', import.meta.url), 'utf8');
  const parse = text => ts.createSourceFile(virtualFilePath('SearchResultObjectLinkProbe.ets'), text,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const tree = parse(source);
  const parent = tree.statements.find(node => node.name?.text === 'SearchPage');
  const card = tree.statements.find(node => node.name?.text === 'SearchResultCard');
  assert.ok(parent && card, 'actual production parent and row exist');
  const builder = parent.members.find(node => node.name?.text === 'resultsContent');
  let lazy;
  const findLazy = node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) && node.expression.getText(tree) === 'LazyForEach') lazy = node;
    ts.forEachChild(node, findLazy);
  };
  findLazy(builder);
  assert.ok(lazy, 'actual results builder contains its native lazy collection');
  // Lower the exact item builder in isolation. LazyForEach's collection
  // prepass belongs to the full frontend; it is not the binding under test.
  const item = lazy.arguments[1].body.statements[0];
  const current = item.getText(tree);
  const fields = card.members.filter(ts.isPropertyDeclaration);
  syntax.componentCollection.customComponents.add('SearchResultCard');
  syntax.observedClassCollection.add('SearchBookGroup');
  syntax.propertyCollection.set('SearchResultCard', new Set(fields.map(node => node.name.getText(tree))));
  for (const [decorator, collection] of [['ObjectLink', syntax.objectLinkCollection], ['Prop', syntax.propCollection],
    ['State', syntax.stateCollection], ['StorageLink', syntax.storageLinkCollection]]) {
    collection.set('SearchResultCard', new Set(fields.filter(node => ts.getAllDecorators(node).some(tag =>
      tag.expression.getText(tree).split('(')[0] === decorator)).map(node => node.name.getText(tree))));
  }
  syntax.regularCollection.set('SearchResultCard', new Set(fields.filter(node => ts.getAllDecorators(node).length === 0)
    .map(node => node.name.getText(tree))));
  main.partialUpdateConfig.partialUpdateMode = true;
  require(`${root}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add('lazyRow');
  function compile(body) {
    const fixture = parse(`@Component struct SearchResultObjectLinkProbe {
      private resultDataSource: SearchResultDataSource = new SearchResultDataSource();
      @Builder private lazyRow(group: SearchBookGroup) { ${body} }
      build() { Column() {} }
    }`);
    assert.deepEqual(fixture.parseDiagnostics, [], 'production lazy subtree parses');
    utils.storedFileInfo.setCurrentArkTsFile();
    syntax.componentCollection.currentClassName = 'SearchResultObjectLinkProbe';
    syntax.regularCollection.set('SearchResultObjectLinkProbe', new Set(['resultDataSource']));
    ui.transformLog.sourceFile = fixture;
    const diagnostics = [];
    let emitted;
    const result = ts.transform(fixture, [context => file => {
      ui.contextGlobal = context;
      emitted = compiler.processComponentClass(file.statements[0], context, diagnostics, false);
      return file;
    }]);
    result.dispose();
    let retainedInput;
    const findInput = node => {
      if (!node) return;
      if (ts.isNewExpression(node) && node.expression.getText(fixture) === 'SearchResultCard') {
        retainedInput = node.arguments[1].properties.find(property => property.name?.getText(fixture) === 'group');
      }
      ts.forEachChild(node, findInput);
    };
    findInput(emitted);
    return { diagnostics, retainedInput };
  }
  const actual = compile(current);
  const bindingDiagnostics = values => values.filter(value => /ObjectLink|property 'group'/.test(value.message));
  assert.deepEqual(actual.diagnostics, [], 'real SDK accepts the actual parent-to-row binding without other diagnostics');
  assert.ok(actual.retainedInput && ts.isIdentifier(actual.retainedInput.initializer) &&
    actual.retainedInput.initializer.text === 'group', 'transformed child receives the same retained object without cloning');
  const shorthand = current.replace('group: group,', 'group,');
  assert.notEqual(shorthand, current, 'negative control restores only the shorthand initializer');
  const old = compile(shorthand);
  assert.ok(bindingDiagnostics(old.diagnostics).some(value => /regular/.test(value.message)),
    'real SDK diagnoses the previous shorthand as a regular-to-ObjectLink assignment');
  recordContractCasePass(id);
}

async function retainedGroupUpdates() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { bookTitleAuthorKey, bookAuthorLabel } = await import('../entry/src/main/ets/app/library/BookAuthorMetadata.ts');
  const { bookIntroText } = await import('../entry/src/main/ets/app/library/BookIntroText.ts');
  const { readerMediaIdentity } = await import('../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
  const { SearchViewState } = await import('../entry/src/main/ets/features/search/presentation/SearchViewState.ts');
  const { searchBookSnapshot } = await import('../entry/src/main/ets/features/search/presentation/SearchBookSnapshot.ts');
  const { SEARCH_RESULT_GEOMETRY } = await import('../entry/src/main/ets/features/search/ui/SearchResultGeometry.ts');
  const { ts, options, require, root } = installedEtsCompiler();
  const source = readFileSync(new URL('../entry/src/main/ets/features/search/ui/SearchPage.ets', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('SearchPage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const groupNode = tree.statements.find(node => node.name?.text === 'SearchBookGroup');
  const dataNode = tree.statements.find(node => node.name?.text === 'SearchResultDataSource');
  const pageNode = tree.statements.find(node => node.name?.text === 'SearchPage');
  const cardNode = tree.statements.find(node => node.name?.text === 'SearchResultCard');
  const keyMethods = ['resultGroupKey', 'normalizedBookKey'].map(name =>
    pageNode.members.find(node => node.name?.text === name).getText(tree)).join('\n');
  const emitted = ts.transpileModule(`${groupNode.getText(tree).replace(/^@Observed\s*/, '')}\n${dataNode.getText(tree)}\nclass RowKeys { ${keyMethods} }`, {
    fileName: 'RetainedSearchGroups.ts', reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  });
  assert.deepEqual(emitted.diagnostics, [], 'actual group, datasource and row key methods emit without diagnostics');
  const { SearchBookGroup, SearchResultDataSource, RowKeys } = new Function('bookTitleAuthorKey', 'readerMediaIdentity', 'DataOperationType',
    `${emitted.outputText};return { SearchBookGroup, SearchResultDataSource, RowKeys };`)(bookTitleAuthorKey, readerMediaIdentity,
      { ADD: 'add', DELETE: 'delete', CHANGE: 'change', RELOAD: 'reload', MOVE: 'move' });
  const book = (sourceId, intro, searchRequestId = 'query-1') => ({ sourceId, bookId: sourceId,
    groupKey: 'retained-book', title: '同一本书', author: '作者', sourceName: sourceId,
    coverUrl: `https://example.test/${sourceId}.jpg`, intro, searchRequestId, category: 'novel' });
  const makeGroup = (books, inBookshelf = false) => {
    const next = new SearchBookGroup(books[0], 1, inBookshelf);
    for (const candidate of books.slice(1)) next.admit(candidate, inBookshelf);
    return next;
  };
  const runtime = createArkUIPropertyRuntimeProbe();
  const original = makeGroup([book('a', '初始简介')]);
  const observed = runtime.sdk.ObservedObject.createNew(original, undefined);
  const data = new SearchResultDataSource();
  data.replace([observed]);
  const nativeChanges = [];
  data.registerDataChangeListener({ onDatasetChange: operations => nativeChanges.push(...operations) });
  const keys = new RowKeys();
  const rowKey = keys.resultGroupKey(observed.book);
  const syntax = require(`${root}/lib/validate_ui_syntax.js`);
  syntax.observedClassCollection.add('SearchBookGroup');
  const viewState = new SearchViewState();
  viewState.reset('第一轮');
  const TouchType = { Down: 'down', Up: 'up', Cancel: 'cancel' };
  const SourceType = { TouchScreen: 'touchscreen', Keyboard: 'keyboard' };
  const members = cardNode.members.filter(node => node.name).map(node => node.name.getText(tree));
  const { owner } = createReaderBuilderProbe(cardNode.getText(tree), members, {
    ...runtime.sdk, SynchedPropertyNesedObjectPU: runtime.sdk.SynchedPropertyNestedObjectPU,
    SearchViewState, searchBookSnapshot, SEARCH_RESULT_GEOMETRY, bookIntroText, bookAuthorLabel, TouchType, SourceType,
  }, { ...runtime.hooks, allowEmptyBranchAdmission: true });
  owner.updateStateVars({ group: observed, queryRevision: viewState.revision, cardWidth: 350 });
  owner.viewState = viewState;
  const selected = [];
  owner.onSelectResult = (...selection) => selected.push(selection);
  owner.aboutToAppear();
  owner.initialRender();
  // Native focus IDs are attributes and can overwrite the record's `id`.
  // Physical retention belongs to the SDK observer-map key.
  const [buttonElement, button] = [...owner.nodes].find(([, node]) => node.type === 'Button' && node.onClick);
  const [imageElement, image] = [...owner.nodes].find(([, node]) => node.type === 'Image');
  assert.ok(button && image, 'actual native row and cover actors are mounted');
  const oldVisibility = button.onVisibleAreaChange[1];
  const oldImageError = image.onError;
  const sameRow = () => {
    assert.equal(data.getData(0), observed, 'same-key updates retain the actual SDK Observed object');
    assert.equal(keys.resultGroupKey(observed.book), rowKey, 'actual production lazy-row key remains stable');
    assert.equal(owner.nodes.get(buttonElement), button, 'the native row actor remains mounted');
    assert.equal(owner.nodes.get(imageElement), image, 'the admitted cover actor remains mounted');
    assert.deepEqual(nativeChanges, [], 'metadata-only enrichment does not invalidate LazyForEach children');
  };
  data.replace([makeGroup([book('a', '补充简介'), book('b', '另一个来源')], true)], new Set([rowKey]));
  runtime.flush();
  sameRow();
  assert.equal(owner.displaySourceCount(), 2, 'source enrichment crosses the actual ObjectLink');
  assert.equal(owner.displayInBookshelf(), true, 'bookshelf update reaches the actual displayed-fact owner');
  assert.ok([...owner.nodes.values()].some(node => node.type === 'Text' && node.create === '补充简介'), 'native metadata observer receives the enriched intro');
  assert.ok([...owner.nodes.values()].some(node => node.type === 'Text' && node.create === '发现 2 个来源'), 'native source-count text updates');
  assert.ok([...owner.nodes.values()].some(node => node.type === 'Text' && node.create === '已在书架'), 'actual shelf marker is admitted');
  data.replace([makeGroup([book('a', '再次补充'), book('b', '另一个来源')], true)], new Set([rowKey]));
  runtime.flush();
  sameRow();
  assert.ok([...owner.nodes.values()].some(node => node.type === 'Text' && node.create === '再次补充'));
  owner.onCardTouch(TouchType.Down);
  const previousSelection = owner.pressedSelection;
  assert.ok(previousSelection, 'actual touch owner captures the first-query identity');
  viewState.reset('第二轮');
  data.replace([makeGroup([book('a', '新查询简介', 'query-2'), book('b', '新查询候选', 'query-2')], true)], new Set([rowKey]));
  owner.updateStateVars({ group: observed, queryRevision: viewState.revision, cardWidth: 350 });
  runtime.flush();
  sameRow();
  assert.equal(owner.pressedSelection, undefined, 'query change retires the prior physical press');
  const currentFacts = owner.displayedFacts;
  const currentCover = observed.coverUrl;
  oldVisibility(true, 1);
  oldImageError({});
  button.onClick({ source: SourceType.TouchScreen });
  runtime.flush();
  assert.equal(owner.displayedFacts, currentFacts, 'old-query visibility callback cannot replace current displayed facts');
  assert.equal(owner.displayVisible, false, 'old-query visibility callback cannot claim the current row');
  assert.equal(observed.coverUrl, currentCover, 'old-query image callback cannot reject the reused current URL');
  assert.deepEqual(selected, [], 'a retired touch cannot select the new query occupant');
  button.onClick({ source: SourceType.Keyboard });
  assert.equal(selected.length, 1, 'current keyboard selection remains usable');
  assert.equal(selected[0][0].searchRequestId, 'query-2');
  owner.displayVisibilityHandler()(true, 1);
  assert.equal(owner.displayVisible, true, 'current-query visibility callback retains authority');
  image.onError({});
  runtime.flush();
  assert.equal(observed.coverUrl, 'https://example.test/b.jpg', 'current-query image failure can advance to its same-group candidate');
  console.log('PASS actual SDK retained-group metadata/source/shelf updates and old-query callback authority');
}
