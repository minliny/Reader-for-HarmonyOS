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
  const { createSearchResultContinuityProbe } = await import('./lib/search-result-continuity-probe.mjs');
  const { owner, runtime, data, observed, keys, rowKey, nativeChanges, selected, makeGroup, book, viewState,
    TouchType, SourceType, buttonElement, button, imageElement, image } = await createSearchResultContinuityProbe();
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
