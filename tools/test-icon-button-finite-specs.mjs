import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"icon-current-admission": {"description": "实际icon公开Props/name/eligible/retired与当前parent callback", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createHash } = await import('node:crypto');
const { createRequire } = await import('node:module');
const { iconButtonControls, iconButtonSource, iconButtonSpecSource } = await import('./lib/reader-icon-button-probe.mjs');
const { readerFoundationTokens, foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const readerFontFamilies = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { createDefaultReaderWindowMetrics, readerInteractiveSafeLeft, readerInteractiveSafeRight } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');


const read = file => readFileSync(file, 'utf8'), root = 'entry/src/main/ets/features/';
const before = read('tools/fixtures/icon-button-family/ReaderIconButton.before.ets');
const golden = JSON.parse(read('tools/fixtures/icon-button-family/original-consumers.json'));
const approved = JSON.parse(read('tools/fixtures/icon-button-family/approved-bookshelf-manga-20261005.json'));
const searchScale = JSON.parse(read('tools/fixtures/design/search-system-font-scale-successor-20261015.json'));
const retiredBookshelfIconSite = 'bookshelf/BookshelfShell.ets';
const retiredSearchPageIconSite = 'search/SearchPage.ets';
const retiredIconSites = new Set([retiredBookshelfIconSite, retiredSearchPageIconSite]);
const consumerMethods = [...golden.methods.filter(row => row.file !== approved.file), approved]
  .filter(row => !retiredIconSites.has(row.file));

const sdk = resolveEtsLoaderRoot();
const req = createRequire(import.meta.url), ts = req(sdk + '/node_modules/typescript'), options = req(sdk + '/lib/ets_checker.js').compilerOptions;
const syntax = req(sdk + '/lib/validate_ui_syntax.js');
const parse = source => ts.createSourceFile(virtualFilePath('IconConsumer.ets'), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const ids = ['toolbar-standard', 'toolbar-wide', 'navigation-back', 'toolbar-compact'];
const tuples = [[44, 24, 22], [44, 44, 22], [32, 20, 16], [44, 20, 22]];
const expected = { 'discover/DiscoverPage.ets': ['toolbar-standard'],
  'source/SourceManagementPage.ets': ['toolbar-compact'] };
const labels = { 'discover/DiscoverPage.ets': ['刷新'],
  'source/SourceManagementPage.ets': ['书源工具'] };
const semanticAttributes = new Set(['enabled', 'focusable', 'accessibilityText', 'accessibilityRole']);
const physical = node => Object.fromEntries(['type', 'create', 'width', 'height', 'borderRadius', 'backgroundColor'].filter(key => Object.hasOwn(node, key)).map(key => [key, node[key]]));
const metrics = createDefaultReaderWindowMetrics();

function iconInputs(source) {
  const tree = parse(source); assert.equal(tree.parseDiagnostics.length, 0);
  const inputs = [];
  const visit = node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && node.expression.getText(tree) === 'ReaderIconButton') inputs.push(node.arguments[0]);
    ts.forEachChild(node, visit);
  }; visit(tree); return { tree, inputs };
}
function verifyConsumer(source, file) {
  const { tree, inputs } = iconInputs(source);
  assert.equal(inputs.length, expected[file].length, 'every actual declaration remains present');
  for (const [i, input] of inputs.entries()) {
    assert.ok(ts.isObjectLiteralExpression(input), 'actual icon props object');
    assert.deepEqual(input.properties.map(p => p.name.getText(tree)).sort(),
      (file.startsWith('discover/') ? ['accessibilityLabel', 'actionEnabled', 'icon', 'onTap', 'specId'] :
        ['accessibilityLabel', 'icon', 'onTap', 'specId']), 'no free icon appearance input');
    assert.equal(input.properties.find(p => p.name.getText(tree) === 'specId').initializer.text, expected[file][i], 'exact finite real consumer');
    assert.equal(input.properties.find(p => p.name.getText(tree) === 'accessibilityLabel').initializer.text, labels[file][i]);
    if (file.startsWith('discover/')) assert.equal(input.properties.find(p => p.name.getText(tree) === 'actionEnabled').initializer.getText(tree), '!this.presentation.loading', 'actual business busy source');
  }
}
function minimalSurfaceActor(tree, owner, memberName, marker) {
  const method = owner?.members.find(node => node.name?.getText(tree) === memberName);
  assert.ok(method, 'current production search surface owns ' + memberName);
  const candidates = [];
  const visit = node => {
    const text = node.getText(tree);
    if (text.startsWith('Stack(') && text.includes(marker) && text.includes('.onClick(')) candidates.push(node);
    ts.forEachChild(node, visit);
  };
  visit(method);
  assert.ok(candidates.length > 0, 'current surface actor remains present: ' + memberName);
  const shortest = Math.min(...candidates.map(node => node.getText(tree).length));
  const exact = candidates.filter(node => node.getText(tree).length === shortest);
  assert.equal(exact.length, 1, 'one minimal current surface actor: ' + memberName);
  return exact[0].getText(tree);
}
function verifyShelfSurfaceActors(source) {
  const tree = parse(source);
  assert.equal(tree.parseDiagnostics.length, 0);
  const owner = tree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface');
  const more = minimalSurfaceActor(tree, owner, 'bar', ".accessibilityText('更多')");
  const leading = minimalSurfaceActor(tree, owner, 'bar', ".accessibilityText(this.presentedSearch() ? '返回' : '搜索书籍')");
  for (const [name, text] of [['More', more], ['Search/Back', leading]]) {
    assert.match(text, /\.width\(44\)\.height\(44\)\.borderRadius\(14\)/, 'finite 44vp ' + name + ' target');
  }
  assert.match(more, /\.focusable\(this\.mode === 'idle' && this\.transitionKind === 'none'\)/,
    'More is focusable only in the settled idle shelf');
  assert.match(more, /\.onClick\(this\.moreAction\(this\.identity, this\.navigationGeneration, this\.mounting, this\.moreIdentity\)\)/,
    'More retains the full presented identity and Shell-owned callback');
  assert.match(leading, /\.focusable\(true\)/, 'current leading Search/Back remains focusable');
  assert.match(leading, /\.onClick\(this\.leadingAction\(this\.identity, this\.navigationGeneration, this\.mounting\)\)/,
    'leading Search/Back retains the full presented identity');
  return { more, leading };
}
const shellSource = read(root + retiredBookshelfIconSite), searchPageSource = read(root + retiredSearchPageIconSite),
  searchSurfaceSource = read(root + 'search/ReaderLibrarySearchSurface.ets');
assert.doesNotMatch(shellSource, /ReaderIconButton|floating-more/, 'BookshelfShell no longer owns a floating ReaderIconButton');
assert.equal(iconInputs(shellSource).inputs.length, 0, 'retired shelf icon declaration cannot return');
assert.doesNotMatch(searchPageSource, /ReaderIconButton|navigation-back/, 'SearchPage no longer owns a navigation-back ReaderIconButton');
assert.equal(iconInputs(searchPageSource).inputs.length, 0, 'retired search back declaration cannot return');
const surfaceActors = verifyShelfSurfaceActors(searchSurfaceSource);
const brokenSize = searchSurfaceSource.replace(surfaceActors.more, surfaceActors.more.replace('.width(44)', '.width(45)'));
assert.notEqual(brokenSize, searchSurfaceSource);
assert.throws(() => verifyShelfSurfaceActors(brokenSize), /finite 44vp More target/, 'current More target rejects a non-44vp width');
const brokenBinding = searchSurfaceSource.replace(surfaceActors.more, surfaceActors.more.replace(
  '.onClick(this.moreAction(this.identity, this.navigationGeneration, this.mounting, this.moreIdentity))',
  '.onClick(this.moreOpenAction(this.moreIdentity))'));
assert.notEqual(brokenBinding, searchSurfaceSource);
assert.throws(() => verifyShelfSurfaceActors(brokenBinding), /full presented identity/, 'current More rejects a captured or incomplete binding');
const brokenLeading = searchSurfaceSource.replace(surfaceActors.leading, surfaceActors.leading.replace(
  '.onClick(this.leadingAction(this.identity, this.navigationGeneration, this.mounting))',
  '.onClick(this.onBack)'));
assert.notEqual(brokenLeading, searchSurfaceSource);
assert.throws(() => verifyShelfSurfaceActors(brokenLeading), /leading Search\/Back retains/, 'current leading actor rejects a captured or incomplete binding');
for (const frozen of consumerMethods) {
  const source=read(root+frozen.file);
  verifyConsumer(source, frozen.file);
  for (const property of ['boxSize', 'iconSize', 'radius']) {
    const { tree: t, inputs } = iconInputs(source);
    for (const input of inputs) {
      const negative = source.slice(0, input.getStart(t) + 1) + property + ': 99,' + source.slice(input.getStart(t) + 1);
      assert.throws(() => verifyConsumer(negative, frozen.file), /no free icon appearance input/, 'literal99 cannot return at any remaining actual declaration');
    }
  }
}
assert.doesNotMatch(iconButtonSource, /@Prop\s+(?:boxSize|iconSize|radius)\s*:/, 'remove all free producer fields');
let comparisons = 0;
assert.throws(() => iconButtonControls().resolveReaderIconButtonSpec('private99'), /Unknown ReaderIconButton specification/);
{
  const actual = iconButtonControls();
  const invalid = new actual.icon.Component(undefined, { icon: 'actual-icon', specId: 'private99' });
  assert.throws(() => invalid.initialRender(), /Unknown ReaderIconButton specification/, 'invalid variant is rejected at actual native rendering');
}
for (const accessibilityLabel of [undefined, '', '   ']) {
  const actual = iconButtonControls(); let calls = 0;
  const params = { icon: 'anonymous-icon', onTap: () => calls++ };
  if (accessibilityLabel !== undefined) params.accessibilityLabel = accessibilityLabel;
  const actor = new actual.icon.Component(undefined, params); actor.aboutToAppear(); actor.initialRender();
  const hit = actual.nodes(actor).find(n => n.onClick);
  assert.equal(hit.enabled, false); assert.equal(hit.focusable, false); hit.onClick(); assert.equal(calls, 0, 'unnamed actual icon fails closed');
}
{
  // Guard-removal control uses the whole production component and actual SDK.
  // Native disabled attributes do not replace handler admission for retained
  // physical callbacks. No alternate touch/click implementation is introduced.
  const removed = iconButtonSource.replace('if (this.canAct()) this.onTap();', 'this.onTap();');
  assert.notEqual(removed, iconButtonSource);
  for (const source of [iconButtonSource, removed]) {
    const actual = iconButtonControls({ source }); let calls = 0;
    const actor = new actual.icon.Component(undefined, { icon: 'icon', accessibilityLabel: '当前动作', actionEnabled: false, onTap: () => calls++ });
    actor.aboutToAppear(); actor.initialRender(); const hit = actual.nodes(actor).find(n => n.onClick);
    hit.onClick(); actor.aboutToDisappear(); hit.onClick();
    assert.equal(calls, source === iconButtonSource ? 0 : 2, 'disabled/retired guard removal exposes real callback violation');
  }
}

function parent(file, { legacy = false, scheme = 'day', specSource = iconButtonSpecSource, allowNewSearchActor = false } = {}) {
  const p = iconButtonControls({ source: legacy ? before : iconButtonSource, specSource }), base = foundationControls({});
  p.hooks.allowEmptyBranchAdmission = allowNewSearchActor;
  Object.assign(p.dependencies, base.dependencies, readerFoundationTokens, readerTypographyRoles, readerFontFamilies,
    { ReaderIconButton: p.icon.Component, resolveReaderIconButtonSpec: p.resolveReaderIconButtonSpec, readerAppColor,
      ReaderWindowCoordinator: { metrics: () => metrics }, readerInteractiveSafeLeft, readerInteractiveSafeRight, bookshelfTemporaryGeneration: 0 });
  const sources = { AppTopBar: read(root + 'common/AppTopBar.ets'), PageBackBar: read(root + 'common/PageBackBar.ets'), ReaderSearchField: read(root + 'common/ReaderSearchField.ets') };
  Object.assign(p.hooks.childSources, base.hooks.childSources, sources);
  for (const name of ['AppTopBar', 'PageBackBar']) syntax.builderParamObjectCollection.set(name, new Set(['trailing']));
  for (const [name, source] of Object.entries(sources)) p.dependencies[name] = p.consumer(source, boundedMembers(source)).constructor;
  const frozen = consumerMethods.find(row => row.file === file), live = read(root + file);
  let source = live;
  if (legacy) {
    const tree = parse(live), owner = tree.statements.find(ts.isStructDeclaration), member = owner.members.find(n => n.name?.text === frozen.name);
    source = live.slice(0, member.getStart(tree)) + frozen.source + live.slice(member.end);
  }
  const names = [frozen.name];
  const owner = p.consumer(source, names); let tap = 0;
  Object.assign(owner, { appThemeScheme: scheme, onSearchRequested: () => tap++, onRefresh: () => tap++, onBack: () => tap++, onOpenTools: () => tap++,
    mounted: true, temporaryBackIdentity: 'bookshelf:1', navigationGeneration: 1, moreMenuVisible: false,
    focusInputOnAppear: false, keyword: '原草稿', viewState: { keywordDraft: '原草稿' }, isTablet: false,
    presentation: { kind: 'initial', loading: false }, isSweeping: () => false, canSubmit: () => true, contentFrame: () => ({ width: 330 }), submitSearch() {}, searchActionLeading() {}, onStop() {} });
  owner[frozen.name](); const actors = p.walk(owner).filter(c => c instanceof p.icon.Component);
  assert.equal(actors.length, expected[file].length, 'actual parent→native child at all authored sites');
  return { p, owner, actors, tap: () => tap };
}
for (const file of Object.keys(expected)) for (const scheme of ['day', 'night']) {
  const next=parent(file,{scheme});
  for (let i = 0; i < next.actors.length; i++) {

    const event = next.p.nodes(next.actors[i]).find(n => n.onClick); event.onClick();
    assert.equal(event.accessibilityText, labels[file][i]); assert.equal(event.accessibilityRole, 'AccessibilityRoleType.BUTTON');
    assert.equal(event.enabled, true); assert.equal(event.focusable, true);
    assert.equal(next.tap(), 1, file + ': actual original business callback');
    comparisons++;
  }
}
{
  const current = parent('discover/DiscoverPage.ets'), actor = current.actors[0], hit = current.p.nodes(actor).find(n => n.onClick);
  current.owner.presentation = { kind: 'loading', loading: true };
  current.owner.replay(); current.p.properties.flush();
  assert.equal(current.p.walk(current.owner).filter(c => c instanceof current.p.icon.Component)[0], actor, 'real busy projection retains the shared icon');
  assert.equal(hit.enabled, false); assert.equal(hit.focusable, false); hit.onClick(); assert.equal(current.tap(), 0, 'loading business fact blocks fresh or retained click');
  current.owner.presentation = { kind: 'ready', loading: false };
  current.owner.replay(); current.p.properties.flush();
  assert.equal(hit.enabled, true); assert.equal(hit.focusable, true); hit.onClick(); assert.equal(current.tap(), 1, 'settled current fact permits refresh');
}
const changed = iconButtonSpecSource.replace('boxSize: 44, iconSize: 24, radius: 22', 'boxSize: 46, iconSize: 26, radius: 23');
assert.notEqual(changed, iconButtonSpecSource);
for (const file of Object.keys(expected)) {
  const current = parent(file, { specSource: changed });
  for (const actor of current.actors) {
    const image = current.p.nodes(actor).find(n => n.type === 'Image'), hit = current.p.nodes(actor).find(n => n.onClick);
    assert.equal(image.width, actor.specId === 'toolbar-standard' ? 26 : current.p.resolveReaderIconButtonSpec(actor.specId).iconSize);
    assert.equal(hit.width, actor.specId === 'toolbar-standard' ? 46 : current.p.resolveReaderIconButtonSpec(actor.specId).boxSize);
  }
}
console.log(`PASS F01 actual SDK: ${comparisons} original/current day/night native comparisons across two retained ReaderIconButton sites; the retired BookshelfShell and SearchPage icons are absent, while the current search-surface Search/Back and More actors retain 44vp targets, names, admission and full presented callback identity. Exact names/role/focus, real loading/retained eligibility, unnamed and guard-removal negatives, same-spec propagation/variant isolation, retained Props, original callbacks, 6 literal99 consumer negatives and removed free inputs. ArkUI native scheduling/device remain separate.`);

}
