import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { installedEtsCompiler } from '../../lib/ets-compiler-runtime.mjs';

const { ts, options } = installedEtsCompiler();
const sources = new Map();

function builder(file, name) {
  if (!sources.has(file)) {
    const source = readFileSync(new URL(`../../../entry/src/main/ets/${file}.ets`, import.meta.url), 'utf8');
    const tree = ts.createSourceFile(file + '.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, [], file);
    sources.set(file, tree);
  }
  const tree = sources.get(file);
  const owner = tree.statements.find(node => ts.isStructDeclaration(node) && node.name.text === file.split('/').at(-1));
  const method = owner?.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(tree) === name);
  assert.ok(method?.body, `${file}.${name}`);
  return method.body;
}

function modifiers(node) {
  const calls = new Map();
  while (ts.isPropertyAccessExpression(node.parent) && ts.isCallExpression(node.parent.parent) &&
      node.parent.parent.expression === node.parent) {
    calls.set(node.parent.name.text, node.parent.parent.arguments[0]);
    node = node.parent.parent;
  }
  return calls;
}

function one(root, predicate, label) {
  const matches = [];
  const visit = node => {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  assert.equal(matches.length, 1, label);
  return matches[0];
}

function isCall(node, name) {
  return (ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && node.expression.getText() === name;
}

function ancestors(node, root) {
  const result = [];
  for (let parent = node.parent; parent !== root; parent = parent.parent) {
    if (ts.isEtsComponentExpression(parent)) result.push(parent);
  }
  return result;
}

function noPassThrough(node) {
  const mode = modifiers(node).get('hitTestBehavior')?.getText();
  assert.doesNotMatch(mode ?? '', /HitTestMode\.(Transparent|Block)\b/u, node.getText().split('\n')[0]);
}

function verifyCarrier(node, { mode = 'HitTestMode.Default', touchable } = {}) {
  const attributes = modifiers(node);
  assert.equal(attributes.get('hitTestBehavior')?.getText() ?? null, mode);
  if (touchable !== undefined) assert.equal(attributes.get('touchable')?.getText(), touchable);
  if (touchable === 'false') assert.notEqual(attributes.get('clip')?.getText(), 'true');
  assert.equal(attributes.has('onTouch'), false, 'layout carrier leaves empty space available');
  assert.equal(attributes.has('onClick'), false, 'layout carrier stays nonclickable');
}

function verifyShield(node) {
  const attributes = modifiers(node);
  assert.equal(attributes.get('hitTestBehavior')?.getText(), 'HitTestMode.Default');
  assert.notEqual(attributes.get('touchable')?.getText(), 'false', 'the painted surface receives touches');
  const callback = attributes.get('onTouch');
  assert.ok(callback && ts.isArrowFunction(callback) && callback.parameters.length === 0 &&
    callback.type?.kind === ts.SyntaxKind.VoidKeyword && ts.isBlock(callback.body) &&
    callback.body.statements.length === 0, 'surface owns an empty touch handler');
  assert.equal(attributes.has('onClick'), false, 'touch shield stays nonclickable');
}

function surface(root, name, paint) {
  const types = Array.isArray(name) ? name : [name];
  return one(root, node => types.some(type => isCall(node, type)) &&
    (paint === undefined || [...modifiers(node).values()].some(arg => arg?.getText().includes(paint))),
    `${name} surface${paint ? ' for ' + paint : ''}`);
}

test('scaffold anchors the measured footer in a bottom-aligned, event-free carrier', () => {
  const root = builder('ui/layout/ReaderPageScaffold', 'build');
  const footerSlot = one(root, node => isCall(node, 'this.footer'), 'actual footer slot');
  const chain = ancestors(footerSlot, root);
  assert.equal(chain.length, 3, 'no full-height intermediate footer carrier');
  const [measurement, outer, page] = chain;
  assert.ok(outer && isCall(outer, 'Column') && page && isCall(page, 'Stack'));
  assert.equal(modifiers(outer).get('zIndex')?.getText(), '20');
  assert.equal(modifiers(outer).get('layoutGravity')?.getText(), 'LocalizedAlignment.BOTTOM');
  assert.equal(modifiers(outer).has('height'), false);
  assert.equal(modifiers(measurement).get('id')?.getText(), 'this.footerMeasurement.id');
  for (const paint of ['backgroundColor', 'backgroundEffect', 'attributeModifier']) {
    assert.equal(modifiers(measurement).has(paint), false, 'measured footer carrier has no paint');
  }
  verifyCarrier(outer, { touchable: "this.footerSurfaceValue() === 'solid'" });
  verifyCarrier(measurement, { touchable: 'false' });
});

for (const [file, name, type, paint] of [
  ['features/reading/ui/LocalBookDetail', 'actionSurface', 'Stack', 'floating-action-dock'],
  ['features/bookshelf/ui/BookshelfMultiSelectPage', 'removeBar', 'Column', 'app.surface.dock'],
  ['features/downloads/ui/SharedDownloadPage', 'selectionDock', 'Column', 'app.surface.dock'],
  ['features/reading/ui/ReaderDirectoryQuickActions', 'build', 'Row', 'app.navigation.floatingSurface'],
  ['ui/patterns/ReaderBottomTabBar', 'build', ['Row', 'Stack'], 'app.navigation.floatingSurface'],
  ['features/rss/ui/RssEntryDetailPage', 'bottomActions', 'Row'],
]) {
  test(`${file.split('/').at(-1)} contains touches on its footer surface without a click handler`, () => {
    const root = builder(file, name);
    const dock = surface(root, type, paint);
    verifyShield(dock);
    ancestors(dock, root).forEach(noPassThrough);
    if (file.endsWith('/ReaderBottomTabBar')) {
      const items = one(dock, node => isCall(node, 'this.tabItem'), 'actual tab item slot');
      const chain = ancestors(items, root);
      assert.ok(chain.includes(dock));
      chain.forEach(noPassThrough);
      chain.filter(node => node !== dock && isCall(node, 'Stack')).forEach(node => verifyCarrier(node));
    }
  });
}

test('download and source footer carriers preserve their modal exclusions and leave bare space available', () => {
  const download = builder('features/downloads/ui/SharedDownloadPage', 'fixedDock');
  verifyCarrier(surface(download, 'Column'), {
    mode: 'this.modalBlocking() ? HitTestMode.None : HitTestMode.Default', touchable: 'false',
  });
  verifyCarrier(surface(builder('features/downloads/ui/SharedDownloadPage', 'selectionDock'), 'Stack'), {
    mode: null, touchable: 'false',
  });
  const source = 'features/source/ui/SourceManagementPage';
  const carrier = surface(builder(source, 'pageFooter'), 'Column', 'reader-source-footer');
  verifyCarrier(carrier, {
    mode: 'this.groupOpen ? HitTestMode.None : HitTestMode.Default', touchable: 'false',
  });
  assert.equal(modifiers(carrier).has('backgroundColor'), false);
  verifyCarrier(surface(builder(source, 'bottomActionBar'), 'Flex'), { touchable: 'false' });
});

test('fixed manga directory chrome protects the toolbar and current chapter dock', () => {
  const file = 'features/reading/ui/BookDirectoryPage';
  for (const [name, call] of [
    ['mangaFooterSlot', 'this.mangaFixedFooter'],
    ['mangaFixedFooter', 'this.mangaCurrentFooter'],
    ['mangaCurrentFooter', 'ReaderDirectoryQuickActions'],
  ]) {
    const root = builder(file, name);
    const child = one(root, node => isCall(node, call), call);
    noPassThrough(child);
    ancestors(child, root).forEach(noPassThrough);
  }
  verifyShield(surface(builder(file, 'mangaToolbar'), 'Column', 'TOK_PAPER'));
});

test('scaffold header carriers and top bar skins prevent the analogous touch leak', () => {
  const root = builder('ui/layout/ReaderPageScaffold', 'build');
  const header = one(root, node => isCall(node, 'ReaderFixedHeaderHost'), 'actual fixed header host');
  verifyCarrier(ancestors(header, root)[0], { touchable: 'false' });
  verifyCarrier(surface(builder('ui/layout/ReaderFixedHeaderHost', 'build'), 'Column'), { touchable: '!this.style.transparent' });
  verifyCarrier(surface(builder('features/bookshelf/ui/BookshelfMultiSelectPage', 'selectionTopBar'), 'Column'), { touchable: 'false' });
  const back = 'ui/chrome/PageBackBar';
  verifyCarrier(surface(builder(back, 'build'), 'Stack'), { touchable: 'false' });
  const backSurface = surface(builder(back, 'panel'), 'Row', 'readerHeaderVeilMaterial');
  verifyShield(backSurface);
  assert.equal(modifiers(backSurface).get('touchable')?.getText(), "this.veil() || this.surface === 'solid'");
  const appSurface = surface(builder('ui/chrome/AppTopBar', 'build'), 'Row', 'readerHeaderVeilMaterial');
  verifyShield(appSurface);
  assert.equal(modifiers(appSurface).get('touchable')?.getText(), "this.floating || this.surface === 'solid'");
});

test('main tab appearance observes gestures on the positioned navigation surface', () => {
  const root = builder('app/navigation/ReaderNavigationAppearanceHost', 'build');
  const host = surface(root, 'Stack');
  const attributes = modifiers(host);
  assert.equal(attributes.get('hitTestBehavior')?.getText(), 'HitTestMode.Default');
  assert.equal(attributes.get('margin')?.getText(), '{ bottom: this.bottomInset }');
  assert.equal(attributes.get('translate')?.getText(), '{ x: this.translateX }');
  assert.match(attributes.get('onTouch')?.getText() ?? '', /this\.onTouchActivity\(event\)/u);
  assert.equal(attributes.has('onClick'), false);
  const shell = builder('features/shell/MainTabShell', 'bottomNavigation');
  const navigation = one(shell, node => isCall(node, 'ReaderBottomNavigation'), 'actual main tab footer');
  noPassThrough(navigation);
  ancestors(navigation, shell).forEach(noPassThrough);
  const appearance = builder('app/navigation/ReaderBottomNavigation', 'build');
  noPassThrough(one(appearance, node => isCall(node, 'ReaderNavigationAppearanceHost'), 'appearance host attachment'));
  const unified = builder('app/navigation/ReaderBottomNavigation', 'unifiedTabBar');
  noPassThrough(one(unified, node => isCall(node, 'ReaderBottomTabBar'), 'floating renderer attachment'));
});

test('manga reader chrome limits touch interception to the painted controls', () => {
  const file = 'features/manga/ui/MangaReadingSurface';
  const root = builder(file, 'readerChrome');
  const topControls = one(root, node => isCall(node, 'this.topControls'), 'manga top controls');
  const bottomControls = one(root, node => isCall(node, 'this.bottomControls'), 'manga bottom controls');
  const bottomChain = ancestors(bottomControls, root);
  assert.equal(bottomChain.length, 1, 'bottom control viewport has no full-height wrapper');
  const [bottomScroll] = bottomChain;
  assert.ok(isCall(bottomScroll, 'Scroll'));
  const attributes = modifiers(bottomScroll);
  assert.equal(attributes.get('width')?.getText(), 'this.dockWidth(insets)');
  assert.equal(attributes.get('height')?.getText(), 'this.bottomControlViewportHeight() - 12');
  assert.equal(attributes.get('hitTestBehavior')?.getText(), 'HitTestMode.Default');
  const topChain = ancestors(topControls, root);
  assert.equal(topChain.length, 1, 'top controls have one bounded layout carrier');
  verifyCarrier(topChain[0], { touchable: 'false' });
  verifyCarrier(surface(builder(file, 'topControls'), 'Column'), { touchable: 'false' });
  verifyShield(surface(builder(file, 'bottomControls'), 'Column', 'manga-dock'));
  verifyShield(surface(builder('ui/chrome/ReaderReadingTopBar', 'build'), 'Stack', 'readerHeaderVeilMaterial'));
});
