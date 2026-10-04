import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { iconButtonControls, iconButtonSource, iconButtonSpecSource } from './lib/reader-icon-button-probe.mjs';
import { readerFoundationTokens, foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { createDefaultReaderWindowMetrics, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const read = file => readFileSync(file, 'utf8'), root = 'entry/src/main/ets/features/';
const before = read('tools/fixtures/icon-button-family/ReaderIconButton.before.ets');
const golden = JSON.parse(read('tools/fixtures/icon-button-family/original-consumers.json'));
assert.equal(createHash('sha256').update(before).digest('hex'), golden.iconSourceSha256, 'immutable original component');
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const req = createRequire(import.meta.url), ts = req(sdk + '/node_modules/typescript'), options = req(sdk + '/lib/ets_checker.js').compilerOptions;
const syntax = req(sdk + '/lib/validate_ui_syntax.js');
const parse = source => ts.createSourceFile('/tmp/IconConsumer.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const ids = ['toolbar-standard', 'toolbar-wide', 'navigation-back', 'toolbar-compact'];
const tuples = [[44, 24, 22], [44, 44, 22], [32, 20, 16], [44, 20, 22]];
const expected = { 'bookshelf/BookshelfShell.ets': ['toolbar-standard', 'toolbar-wide'],
  'discover/DiscoverPage.ets': ['toolbar-standard'], 'search/SearchPage.ets': ['navigation-back'], 'source/SourceManagementPage.ets': ['toolbar-compact'] };
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
    assert.deepEqual(input.properties.map(p => p.name.getText(tree)).sort(), ['icon', 'onTap', 'specId'], 'no free icon appearance input');
    assert.equal(input.properties.find(p => p.name.getText(tree) === 'specId').initializer.text, expected[file][i], 'exact finite real consumer');
  }
}
function noIconGeometry(source) {
  source = '@Component struct OriginalBuilderWitness {\n' + source + '\n}';
  const { tree, inputs } = iconInputs(source);
  for (const input of inputs.reverse()) {
    const originalInputs = input.properties.filter(property => !['boxSize', 'iconSize', 'radius', 'specId'].includes(property.name.getText(tree)));
    source = source.slice(0, input.getStart(tree)) + '{' + originalInputs.map(property => property.getText(tree)).join(',') + '}' + source.slice(input.end);
  }
  return ts.createPrinter({ removeComments: true }).printFile(parse(source));
}
for (const frozen of golden.methods) {
  assert.equal(createHash('sha256').update(frozen.source).digest('hex'), frozen.sha256);
  const source = read(root + frozen.file), tree = parse(source), owner = tree.statements.find(ts.isStructDeclaration);
  const current = owner.members.find(n => ts.isMethodDeclaration(n) && n.name.text === frozen.name).getText(tree);
  assert.equal(noIconGeometry(current), noIconGeometry(frozen.source), 'all original Builder layout/state/callbacks unchanged: ' + frozen.file);
  verifyConsumer(source, frozen.file);
  for (const property of ['boxSize', 'iconSize', 'radius']) {
    const { tree: t, inputs } = iconInputs(source);
    for (const input of inputs) {
      const negative = source.slice(0, input.getStart(t) + 1) + property + ': 99,' + source.slice(input.getStart(t) + 1);
      assert.throws(() => verifyConsumer(negative, frozen.file), /no free icon appearance input/, 'literal99 cannot return at any of five actual declarations');
    }
  }
}
assert.doesNotMatch(iconButtonSource, /@Prop\s+(?:boxSize|iconSize|radius)\s*:/, 'remove all free producer fields');
let comparisons = 0;
for (const [i, id] of ids.entries()) for (const scheme of ['day', 'night']) {
  const ColorMetrics = { resourceColor(value) {
    if (value === readerAppColor('TOK_ACCENT', scheme)) return { red: 244, green: 139, blue: 19 };
    return { blendColor(overlay) { return { color: `native-blend:${value}:${overlay.alpha}` }; } };
  }, rgba(_red, _green, _blue, alpha) { return { alpha }; } };
  const current = iconButtonControls({ ColorMetrics }), legacy = iconButtonControls({ source: before, ColorMetrics }); let taps = 0;
  const next = new current.icon.Component(undefined, { icon: 'actual-icon', specId: id, onTap: () => taps++ });
  const old = new legacy.icon.Component(undefined, { icon: 'actual-icon', boxSize: tuples[i][0], iconSize: tuples[i][1], radius: tuples[i][2], onTap: () => taps++ });
  next.appThemeScheme = scheme; old.appThemeScheme = scheme; next.initialRender(); old.initialRender();
  assert.deepEqual(current.nodes(next).map(physical), legacy.nodes(old).map(physical), id + ': exact original normal nodes and AUTO');
  assert.deepEqual(next.attributeCalls.map(({ property, args }) => ({ property, args: args.map(v => typeof v === 'function' ? 'actual-callback' : v) })).filter(c => c.property !== 'attributeModifier'),
    old.attributeCalls.map(({ property, args }) => ({ property, args: args.map(v => typeof v === 'function' ? 'actual-callback' : v) })).filter(c => c.property !== 'attributeModifier'), id + ': original native setter presence');
  // These are the modifiers constructed by the shipping native Stack, not a
  // replacement click/touch algorithm. ArkUI still owns state dispatch.
  const modifier = next.attributeCalls.find(c => c.property === 'attributeModifier').args[0];
  const originalModifier = old.attributeCalls.find(c => c.property === 'attributeModifier').args[0];
  const attributes = () => ({ calls: [], backgroundColor(value) { this.calls.push(['backgroundColor', value]); return this; },
    borderRadius(value) { this.calls.push(['borderRadius', value]); return this; } });
  for (const transition of ['applyPressedAttribute', 'applyNormalAttribute', 'applyDisabledAttribute']) {
    const actual = attributes(), original = attributes(); modifier[transition](actual); originalModifier[transition](original);
    assert.deepEqual(actual.calls, original.calls, id + ': exact original pressed/release/cancel/disabled recipe');
    assert.equal(actual.calls.at(-1)[1], transition === 'applyPressedAttribute' ? 12 : tuples[i][2]);
  }
  const hit = current.nodes(next).find(n => n.onClick); hit.onClick(); assert.equal(taps, 1);
  next.boxSize = 99; next.iconSize = 99; next.radius = 99; next.replay();
  assert.deepEqual(current.nodes(next).map(physical), legacy.nodes(old).map(physical), 'obsolete dynamic setters cannot alter actual geometry');
  current.update(next, { icon: 'changed-icon', specId: id });
  assert.equal(current.nodes(next).find(n => n.type === 'Image').create, 'changed-icon', 'retained real icon Prop update');
  current.update(next, { icon: 'changed-icon', specId: 'navigation-back' });
  assert.equal(current.nodes(next).find(n => n.type === 'Image').width, 20); assert.equal(hit.width, 32);
  comparisons++;
}
assert.throws(() => iconButtonControls().resolveReaderIconButtonSpec('private99'), /Unknown ReaderIconButton specification/);
{
  const actual = iconButtonControls();
  const invalid = new actual.icon.Component(undefined, { icon: 'actual-icon', specId: 'private99' });
  assert.throws(() => invalid.initialRender(), /Unknown ReaderIconButton specification/, 'invalid variant is rejected at actual native rendering');
}

function parent(file, { legacy = false, scheme = 'day', specSource = iconButtonSpecSource } = {}) {
  const p = iconButtonControls({ source: legacy ? before : iconButtonSource, specSource }), base = foundationControls({});
  Object.assign(p.dependencies, base.dependencies, readerFoundationTokens, readerTypographyRoles,
    { ReaderIconButton: p.icon.Component, resolveReaderIconButtonSpec: p.resolveReaderIconButtonSpec, readerAppColor,
      ReaderWindowCoordinator: { metrics: () => metrics }, readerInteractiveSafeLeft, readerInteractiveSafeRight, bookshelfTemporaryGeneration: 0 });
  const sources = { AppTopBar: read(root + 'common/AppTopBar.ets'), PageBackBar: read(root + 'common/PageBackBar.ets'), ReaderSearchField: read(root + 'common/ReaderSearchField.ets') };
  Object.assign(p.hooks.childSources, base.hooks.childSources, sources);
  for (const name of ['AppTopBar', 'PageBackBar']) syntax.builderParamObjectCollection.set(name, new Set(['trailing']));
  for (const [name, source] of Object.entries(sources)) p.dependencies[name] = p.consumer(source, boundedMembers(source)).constructor;
  const frozen = golden.methods.find(row => row.file === file), live = read(root + file);
  let source = live;
  if (legacy) {
    const tree = parse(live), owner = tree.statements.find(ts.isStructDeclaration), member = owner.members.find(n => n.name?.text === frozen.name);
    source = live.slice(0, member.getStart(tree)) + frozen.source + live.slice(member.end);
  }
  const names = [frozen.name]; if (file.startsWith('bookshelf/')) names.push('moreOpenAction');
  const owner = p.consumer(source, names); let tap = 0;
  Object.assign(owner, { appThemeScheme: scheme, onSearchRequested: () => tap++, onRefresh: () => tap++, onBack: () => tap++, onOpenTools: () => tap++,
    mounted: true, temporaryBackIdentity: 'bookshelf:1', navigationGeneration: 1, moreMenuVisible: false,
    focusInputOnAppear: false, keyword: '原草稿', viewState: { keywordDraft: '原草稿' }, isTablet: false,
    presentation: { kind: 'initial' }, isSweeping: () => false, canSubmit: () => true, contentFrame: () => ({ width: 330 }), submitSearch() {}, searchActionLeading() {}, onStop() {} });
  owner[frozen.name](); const actors = p.walk(owner).filter(c => c instanceof p.icon.Component);
  assert.equal(actors.length, expected[file].length, 'actual parent→native child at all authored sites');
  return { p, owner, actors, tap: () => tap };
}
for (const file of Object.keys(expected)) for (const scheme of ['day', 'night']) {
  const old = parent(file, { legacy: true, scheme }), next = parent(file, { scheme });
  for (let i = 0; i < next.actors.length; i++) {
    assert.deepEqual(next.p.nodes(next.actors[i]).map(physical), old.p.nodes(old.actors[i]).map(physical), file + ': actual parent/native original tuple');
    const event = next.p.nodes(next.actors[i]).find(n => n.onClick); event.onClick();
    if (file.startsWith('bookshelf/') && i === 1) {
      assert.equal(next.owner.moreMenuVisible, true); next.owner.moreMenuVisible = false;
      next.owner.temporaryBackIdentity = 'bookshelf:2'; event.onClick(); assert.equal(next.owner.moreMenuVisible, false, 'old physical More preserves captured identity refusal');
    } else assert.equal(next.tap(), 1, file + ': actual original business callback');
    comparisons++;
  }
}
const changed = iconButtonSpecSource.replace('boxSize: 44, iconSize: 24, radius: 22', 'boxSize: 46, iconSize: 26, radius: 23');
assert.notEqual(changed, iconButtonSpecSource);
for (const file of Object.keys(expected)) {
  const current = parent(file, { specSource: changed });
  for (const actor of current.actors) {
    const image = current.p.nodes(actor).find(n => n.type === 'Image'), hit = current.p.nodes(actor).find(n => n.onClick);
    assert.equal(image.width, actor.specId === 'toolbar-standard' ? 26 : tuples[ids.indexOf(actor.specId)][1]);
    assert.equal(hit.width, actor.specId === 'toolbar-standard' ? 46 : tuples[ids.indexOf(actor.specId)][0]);
  }
}
console.log(`PASS F01 actual SDK: ${comparisons} original/current four-spec and five-site day/night native comparisons; same-spec propagation/variant isolation, retained Props, original callbacks/old More identity, 15 literal99 consumer negatives and removed free inputs. ArkUI native scheduling/device remain separate.`);
