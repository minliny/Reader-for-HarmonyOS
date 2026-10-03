import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';

// Actual installed SDK compiler/property methods/native attribute calls. No
// Core transport, write receipt, geometry renderer or replacement presenter.
const read = file => readFileSync(new URL('../entry/src/main/ets/features/' + file, import.meta.url), 'utf8');
const pageSource = read('bookshelf/BookshelfPage.ets');
const listSource = read('bookshelf/ShelfBookListDetails.ets');
const projectionSource = read('bookshelf/ShelfBookPresentation.ts');
const frozenGrid = readFileSync(new URL('./fixtures/design/shelf-progress-grid-baseline.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(sdk + '/node_modules/typescript');
const options = require(sdk + '/lib/ets_checker.js').compilerOptions;
const parse = text => ts.createSourceFile('ShelfProgress.ets', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
function constants(text, names, dependencies = {}) {
  const tree = parse(text);
  const declarations = tree.statements.filter(ts.isVariableStatement).flatMap(statement =>
    [...statement.declarationList.declarations].filter(declaration => names.includes(declaration.name.getText(tree)))
      .map(declaration => `const ${declaration.getText(tree)};`));
  assert.equal(declarations.length, names.length);
  return new Function(...Object.keys(dependencies), stripTypeScriptTypes(declarations.join('\n')) + `; return {${names.join(',')}};`)(...Object.values(dependencies));
}
const geometry = constants(pageSource, ['PHONE_BOOK_WIDTH', 'PHONE_BOOK_HEIGHT_RATIO', 'TABLET_BOOK_WIDTH',
  'TABLET_BOOK_HEIGHT_RATIO', 'PHONE_LIST_COVER_WIDTH', 'PHONE_LIST_COVER_HEIGHT', 'TABLET_LIST_COVER_WIDTH', 'TABLET_LIST_COVER_HEIGHT']);
const tokens = constants(read('common/ReaderTokens.ets'), ['TOK_SPACE_XS', 'TOK_SPACE_CONTROL_INLINE']);
function projection(text) {
  return new Function(stripTypeScriptTypes(text).replace(/^import .*;$/gm, '').replace(/^export /gm, '') + ';return ShelfBookPresentation;')();
}
const positiveRule = projectionSource.replace('Math.floor(value)', 'Math.ceil(value)');
const gridOnlyRule = projectionSource.replace("variant === 'grid-caption' ? '' : '未读'", "variant === 'grid-caption' ? '网格零态探针' : '未读'");
assert.notEqual(positiveRule, projectionSource); assert.notEqual(gridOnlyRule, projectionSource);
let writes = 0;
const forbiddenTransport = { request() { writes++; assert.fail('display must never dispatch'); } };
const textNodes = owner => [...owner.nodes.values()].filter(n => n.type === 'Text');
function grid(text, Projection, book, tablet = false, scheme = 'day') {
  const old = text.includes('private shelfProgressText(');
  const names = ['projectionGridDetails', 'gridProgressLabel', 'gridBookCardHeight', ...(old ? ['shelfProgressText'] : [])];
  // Geometry remains the actual production methods/constants. Only the
  // window's resolved content width is a controlled Phone/Tablet input.
  const methods = ['shelfBookCardWidth', 'bookCardWidth', 'bookCardHeight'];
  const declaration = parse(pageSource).statements.find(ts.isStructDeclaration);
  const complete = text.replace(/build\(\) \{ Column\(\) \{\} \}/, methods.map(name =>
    declaration.members.find(m => m.name?.getText(parse(pageSource)) === name)?.getText(parse(pageSource))).join('\n') + '\nbuild() { Column() {} }');
  const selected = old ? complete : pageSource;
  const { owner } = createReaderBuilderProbe(selected, [...names, ...methods], { ...geometry, ...tokens,
    ShelfBookPresentation: Projection, runtime: forbiddenTransport });
  Object.assign(owner, { appThemeScheme: scheme, viewMode: 'cover', viewSwitchGridContentOpacity: 1,
    shelfContentWidth: wide => wide ? 650 : 326 });
  owner.projectionGridDetails(book, tablet);
  return owner;
}
function list(Projection, book, scheme = 'day') {
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(listSource, ['appThemeScheme', 'book', 'statusPill', 'build'],
    { ...properties.sdk, ShelfBookPresentation: Projection, runtime: forbiddenTransport },
    { ...properties.hooks, initialParams: { book } });
  owner.appThemeScheme = scheme; owner.initialRender();
  return { owner, properties };
}
const row = progress => Object.freeze({ sourceId: 'online', bookId: 'progress-book', title: '原书名', author: '原作者',
  sourceName: '原书源', lastChapter: '原最新章', ...(progress === undefined ? {} : { readProgress: progress }) });
const cases = [
  [undefined, 0, '未读', ''], [0, 0, '未读', ''], [1, .01, '已读 <1%', '已读 <1%'],
  [99, .99, '已读 <1%', '已读 <1%'], [100, 1, '已读 1%', '已读 1%'],
  [1234, 12.34, '已读 12%', '已读 12%'], [10000, 100, '已读 100%', '已读 100%'],
  [10100, 100, '已读 100%', '已读 100%'], [-1, 0, '未读', ''],
  [NaN, 0, '未读', ''], [Infinity, 0, '未读', ''], [-Infinity, 0, '未读', ''],
];
for (const [input, percent, label, caption] of cases) {
  const book = row(input);
  assert.equal(ShelfBookPresentation.progressPercent(book), percent);
  assert.equal(ShelfBookPresentation.progress(book), label);
  assert.equal(ShelfBookPresentation.progress(book, 'grid-caption'), caption);
  const g = grid(pageSource, ShelfBookPresentation, book), l = list(ShelfBookPresentation, book).owner;
  assert.deepEqual(textNodes(g).map(n => n.create), ['原书名', '原作者', ...(caption ? [caption] : [])]);
  assert.ok(textNodes(l).some(n => n.create === label));
  assert.equal([...l.nodes.values()].find(n => n.type === 'Progress').create.value, percent);
  const unreadHeight = g.gridBookCardHeight(row(0), false);
  assert.equal(g.gridBookCardHeight(book, false) - unreadHeight, caption ? 18 : 0,
    'actual Grid visibility and its measured height consume the same variant');
  assert.equal(book.readProgress, input, 'display keeps the original Core-owned fact');
}
// Compare actual frozen/current native tuples, including omitted attributes,
// not a hand-written layout model. Legal inputs retain the existing effect.
for (const scheme of ['day', 'night']) for (const tablet of [false, true]) for (const value of [0, 1, 1234, 10000]) {
  const book = row(value), before = grid(frozenGrid, ShelfBookPresentation, book, tablet, scheme), after = grid(pageSource, ShelfBookPresentation, book, tablet, scheme);
  assert.deepEqual([...after.nodes.values()], [...before.nodes.values()], 'original actual Grid native tuples');
  assert.equal(after.gridBookCardHeight(book, tablet), before.gridBookCardHeight(book, tablet), 'original actual measured height');
}
// One real shared-spec edit reaches both actual consumers; a named variant
// edit reaches only its Grid consumer. Mutations are isolated in this test.
const shared = projection(positiveRule), gridVariant = projection(gridOnlyRule);
assert.equal(textNodes(grid(pageSource, shared, row(1234))).at(-1).create, '已读 13%');
assert.ok(textNodes(list(shared, row(1234)).owner).some(n => n.create === '已读 13%'));
assert.equal(textNodes(grid(pageSource, gridVariant, row(0))).at(-1).create, '网格零态探针');
assert.ok(textNodes(list(gridVariant, row(0)).owner).some(n => n.create === '未读'));
const old = grid(frozenGrid, shared, row(1234));
assert.equal(textNodes(old).at(-1).create, '已读 12%', 'old duplicate formatter is a real non-propagation negative control');
assert.equal(textNodes(grid(frozenGrid, ShelfBookPresentation, row(Infinity))).at(-1).create, '已读 Infinity%',
  'frozen old implementation actually reproduces the nonfinite divergence');
// Mount the actual List component through the actual BookshelfPage call and
// run real SDK one-way Prop updates. Keep the already-mounted child/nodes.
{
  const properties = createArkUIPropertyRuntimeProbe();
  const child = createReaderBuilderProbe(listSource, ['appThemeScheme', 'book', 'statusPill', 'build'],
    { ...properties.sdk, ShelfBookPresentation }, properties.hooks);
  const names = ['projectionListDetails', 'projectionListDetailsWidth', 'listCoverWidth', 'listCoverHeight',
    'bookActionPresentationHandler', 'isShelfPresentationCurrent', 'presentBookActionSheet'];
  const parent = createReaderBuilderProbe(pageSource, names, { ...properties.sdk, ...geometry, ...tokens,
    ShelfBookListDetails: child.Component, ShelfBookPresentation, runtime: forbiddenTransport },
    { ...properties.hooks, childSources: { ShelfBookListDetails: listSource }, mountChildren: true });
  const book = { ...row(1) };
  Object.assign(parent.owner, { appThemeScheme: 'day', viewMode: 'list', viewSwitchListContentOpacity: 1,
    shelfContentWidth: () => 326, mounted: true, navigationGeneration: 7, books: [book], actionSheetRevision: 0 });
  parent.owner.projectionListDetails(book, false);
  const actualChild = [...parent.owner.children.values()][0];
  const label = textNodes(actualChild).find(n => n.create === '已读 <1%');
  const bar = [...actualChild.nodes.values()].find(n => n.type === 'Progress');
  const more = [...parent.owner.nodes.values()].find(n => n.type === 'Stack' && n.onClick);
  assert.ok(label); assert.equal(bar.create.value, .01); assert.equal(actualChild.book.bookId, book.bookId);
  book.readProgress = 8765; parent.owner.replay(); properties.flush();
  assert.equal(textNodes(actualChild).find(n => n.create === '已读 87%'), label, 'Prop update retains the original label actor');
  assert.equal([...actualChild.nodes.values()].find(n => n.type === 'Progress'), bar);
  assert.equal(bar.create.value, 87.65); assert.equal([...parent.owner.children.values()][0], actualChild);
  more.onClick(); assert.equal(parent.owner.actionBook, book, 'current More callback retains original entity');
  parent.owner.actionBook = undefined; parent.owner.navigationGeneration = 8; more.onClick();
  assert.equal(parent.owner.actionBook, undefined, 'old physical callback cannot borrow a new navigation');
  parent.owner.navigationGeneration = 7; parent.owner.mounted = false; more.onClick();
  assert.equal(parent.owner.actionBook, undefined, 'retired page callback remains rejected');
}
assert.equal(writes, 0);
assert.doesNotMatch(pageSource, /private shelfProgressText\(/, 'the old complete formatter was deleted');
console.log('PASS I03: 12 actual Grid/List states; 16 frozen Grid tuple/height comparisons; shared propagation and variant isolation; real child Props/retained callbacks; zero writes. SDK logic/attributes only, not OS/pixels.');
