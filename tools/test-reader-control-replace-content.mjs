import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import * as morphScroll from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
import * as presentation from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
const motionDeps = { ...presentation, PathShape: class { commands(path) { this.path = path; return this; } } };
const motionProps = { fullContentHeight: 666, quickContentHeight: 190, getUIContext: () => ({ vp2px: n => n * 3 }) };
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe, readerBuilderSdkAvailable } from './lib/reader-control-builder-probe.mjs';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const stateModule = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const geometry = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets', import.meta.url), 'utf8');
// Execute the actual ordinary production methods. Only ArkUI rendering and
// lifecycle services are omitted; async callbacks stay explicitly controllable.
const methods = source.slice(source.indexOf('  private onSourceChanged()'), source.indexOf('  build()'));
assert.ok(methods.includes('private async perform('));
const Probe = new Function(...Object.keys(morphScroll), 'sampleReaderControlReplace', 'readerControlReplaceEndpoint',
  'createReaderControlReplaceDraft', 'errorMessageOf',
  `${stripTypeScriptTypes(`class Probe { ${methods} }`)}\nreturn Probe;`)(
    ...Object.values(morphScroll), geometry.sampleReaderControlReplace, geometry.readerControlReplaceEndpoint,
    stateModule.createReaderControlReplaceDraft, error => error.message);
const owner = new Probe();
const events = [];
Object.assign(owner, { state: { ...stateModule.createReaderControlReplaceState('A:open1'), status: 'ready' },
  motionProgress: 1, interactionEnabled: true, availableWidth: 338, availableHeight: 666,
  layer: '', localError: '', localPending: false, presentationRevision: 0, lastSessionKey: 'A:open1',
  scrollMotion: morphScroll.createReaderControlMorphScroll(), scroller: { scrollTo() {}, currentOffset: () => ({ yOffset: 0 }) }, onTemporaryLayerChange: active => events.push(active),
});
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject }; };
owner.openEditor();
assert.equal(owner.layer, 'editor', 'confirmed empty collection can Add');
let pending = deferred();
let run = owner.perform(() => pending.promise, true);
assert.equal(owner.localPending, true);
pending.reject(new Error('validation rejected'));
await run;
assert.equal(owner.layer, 'editor', 'failure must retain draft and allow repair/retry');
assert.equal(owner.localPending, false);
assert.equal(owner.localError, 'validation rejected');
pending = deferred();
run = owner.perform(() => pending.promise, true);
pending.resolve();
await run;
assert.equal(owner.layer, '', 'only confirmed success closes the editor');

owner.openEditor();
pending = deferred();
run = owner.perform(() => pending.promise, true);
owner.state = { ...owner.state, sessionKey: 'B:open2' };
owner.onSourceChanged();
owner.openEditor();
const bRevision = owner.presentationRevision;
pending.reject(new Error('late A failure'));
await run;
assert.equal(owner.presentationRevision, bRevision);
assert.equal(owner.layer, 'editor');
assert.equal(owner.localError, '', 'late old-book failure cannot replace new editor');

owner.dismissTemporaryLayer();
pending = deferred();
owner.onPreview = () => pending.promise;
run = owner.preview();
assert.equal(owner.localPending, true);
owner.motionProgress = .7;
owner.onMotionChanged();
pending.resolve({ before: 'old', after: 'new' });
await run;
assert.equal(owner.layer, '');
assert.equal(owner.previewResult, undefined, 'a dismissed preview cannot return into a reversed transition');
owner.motionProgress = 1;
owner.openEditor();
owner.state.writeUncertain = true;
assert.equal(owner.readyInput(), false, 'uncertain write disables resubmit');
let reloads = 0;
owner.onReload = async () => { reloads++; };
owner.reload();
await new Promise(resolve => setImmediate(resolve));
assert.equal(owner.layer, '', 'reload leaves potentially committed create draft for explicit review');
assert.equal(reloads, 1);
owner.state.writeUncertain = false;
owner.openImport();
assert.equal(owner.layer, 'import-confirm');
let imports = 0;
pending = deferred();
owner.onImport = () => { imports++; return pending.promise; };
assert.equal(imports, 0, 'opening the warning is not authority to choose or import a file');
run = owner.confirmImport();
assert.equal(imports, 1);
pending.reject(new Error('file import failed'));
await run;
assert.equal(owner.layer, 'import-confirm', 'failed import retains warning and retry feedback');
assert.equal(owner.localError, 'file import failed');
pending = deferred();
run = owner.confirmImport();
pending.resolve();
await run;
assert.equal(owner.layer, '', 'confirmed import closes temporary layer');
assert.equal(imports, 2);
owner.motionProgress = 0;
owner.openImport();
assert.equal(owner.layer, '', 'Full-only import is inaccessible from clipped Quick toolbar');
owner.motionProgress = 1;
owner.interactionEnabled = false;
assert.equal(owner.readyInput(), false);
assert.equal(owner.fullInput(), false);
// Shared scroll lifecycle/range/async coverage lives in test-reader-control-morph-scroll.mjs.
assert.match(source, /\.constraintSize\(\{ minHeight: this\.listContentMinHeight\(\) \}\)/);
assert.match(source, /\.onDidScroll\(\(\): void => this\.onFullDidScroll\(\)\)/);
// Capture the real third argument of every production textAction invocation.
// The simple balanced-call scanner does not reinterpret the predicates: each
// complete call is type-stripped and executed against the same stateful owner.
function actionCalls(text, method = 'textAction') {
  const calls = [];
  const marker = `this.${method}(`;
  let start = 0;
  while ((start = text.indexOf(marker, start)) >= 0) {
    let depth = 1, quote = '', end = start + marker.length;
    for (; end < text.length && depth > 0; end++) {
      const char = text[end];
      if (quote) {
        if (char === '\\') { end++; continue; }
        if (char === quote) quote = '';
      } else if (char === "'" || char === '"' || char === '`') quote = char;
      else if (char === '(') depth++;
      else if (char === ')') depth--;
    }
    assert.equal(depth, 0, 'textAction source call must be complete');
    calls.push(text.slice(start, end));
    start = end;
  }
  return calls;
}
const predicates = new Map();
owner.textAction = (label, action, enabled) => {
  assert.equal(typeof enabled, 'function', `${label} must pass live state, not a first-render boolean`);
  predicates.set(label, enabled);
};
owner.motionProgress = 0;
owner.interactionEnabled = true;
assert.equal(owner.emptyStateMessage(), '暂无替换规则，可展开后新增');
owner.state.status = 'ready';
owner.state.mutationPending = false;
owner.state.writeUncertain = false;
owner.state.canonicalReloadRequired = false;
owner.localPending = false;
for (const call of actionCalls(source)) {
  new Function(stripTypeScriptTypes(`${call};`)).call(owner);
}
assert.equal(predicates.size, 9, 'save now belongs to the fixed editor footer, whose actual SDK guards are checked below');
assert.equal(predicates.get('预览当前章节已保存规则')(), false);
assert.equal(predicates.get('预览效果')(), true);
owner.motionProgress = 1;
assert.equal(owner.emptyStateMessage(), '暂无替换规则，点击上方“新增规则”');
assert.equal(predicates.get('预览当前章节已保存规则')(), true,
  'the same predicate captured during Quick enables Full preview after morph');
assert.equal(predicates.get('预览效果')(), false);
assert.equal(predicates.get('完整管理')(), false);
for (const pendingKind of ['mutationPending', 'localPending']) {
  if (pendingKind === 'mutationPending') owner.state.mutationPending = true;
  else owner.localPending = true;
  for (const label of ['预览当前章节已保存规则', '确认删除', '选择文件并导入', '取消', '重新加载核对', '重试预览']) {
    assert.equal(predicates.get(label)(), false, `${label} disables immediately during ${pendingKind}`);
  }
  owner.state.mutationPending = false;
  owner.localPending = false;
  for (const label of ['预览当前章节已保存规则', '确认删除', '选择文件并导入', '取消', '重新加载核对', '重试预览']) {
    assert.equal(predicates.get(label)(), true, `${label} recovers after ${pendingKind}`);
  }
}
// Execute the actual Builder chain with a tiny Text sink. This verifies both
// attribute reevaluation and a stale click handler's dispatch-time recheck.
const actionMethod = source.slice(source.indexOf('  private textAction('), source.indexOf('  @Builder\n  private temporaryOverlay'));
let rendered;
const textSink = label => {
  rendered = { label };
  const chain = {};
  for (const name of ['fontFamily', 'fontSize', 'fontColor', 'textAlign', 'layoutWeight', 'height', 'padding', 'backgroundColor', 'borderRadius'])
    chain[name] = () => chain;
  chain.enabled = value => { rendered.enabled = value; return chain; };
  chain.onClick = callback => { rendered.click = callback; return chain; };
  return chain;
};
const BuilderProbe = new Function('readerAppColor', 'Text', 'TOK_READ_PRIMARY', 'TextAlign', 'TOK_READ_ACTIVE_SOFT',
  `${stripTypeScriptTypes(`class BuilderProbe { ${actionMethod} }`)}\nreturn BuilderProbe;`)(readerAppColor, textSink, '', { Center: 0 }, '');
const gate = predicates.get('预览当前章节已保存规则');
let clicks = 0;
owner.motionProgress = 0;
BuilderProbe.prototype.textAction.call(owner, 'full preview', () => clicks++, gate);
assert.equal(rendered.enabled, false);
owner.motionProgress = 1;
BuilderProbe.prototype.textAction.call(owner, 'full preview', () => clicks++, gate);
assert.equal(rendered.enabled, true);
const staleHandler = rendered.click;
owner.localPending = true;
staleHandler();
assert.equal(clicks, 0, 'a queued click cannot bypass newly pending state');
BuilderProbe.prototype.textAction.call(owner, 'full preview', () => clicks++, gate);
assert.equal(rendered.enabled, false);
owner.localPending = false;
owner.interactionEnabled = false;
staleHandler();
assert.equal(clicks, 0);
owner.interactionEnabled = true;
staleHandler();
assert.equal(clicks, 1);
// All five editor flags retain the same getter for repeated interactions,
// including pending -> retry; none close over the first boolean value.
owner.draft = stateModule.createReaderControlReplaceDraft();
const flags = new Map();
owner.editorFlag = (label, value, change) => {
  assert.equal(typeof value, 'function', `${label} is a live draft getter`);
  flags.set(label, { value, change });
};
for (const call of actionCalls(source, 'editorFlag')) new Function(stripTypeScriptTypes(`${call};`)).call(owner);
assert.equal(flags.size, 5);
for (const [label, flag] of flags) {
  const initial = flag.value();
  owner.changeEditorFlag(flag.value, flag.change);
  assert.equal(flag.value(), !initial, `${label}: first click`);
  owner.changeEditorFlag(flag.value, flag.change);
  assert.equal(flag.value(), initial, `${label}: second click restores the first value`);
  owner.localPending = true;
  owner.changeEditorFlag(flag.value, flag.change);
  assert.equal(flag.value(), initial, `${label}: pending blocks mutation`);
  owner.localPending = false;
  owner.changeEditorFlag(flag.value, flag.change);
  assert.equal(flag.value(), !initial, `${label}: after pending the next click remains live`);
}
const fields = new Map();
owner.editorText = (label, value, change) => {
  assert.equal(typeof value, 'function', `${label} is a live text getter`);
  fields.set(label, { value, change });
};
for (const call of actionCalls(source, 'editorText')) new Function(stripTypeScriptTypes(`${call};`)).call(owner);
assert.equal(fields.size, 8);
for (const [label, field] of fields) {
  field.change('41');
  assert.equal(field.value(), '41', `${label}: first edit reflected without recreating Builder arguments`);
  field.change('42');
  assert.equal(field.value(), '42', `${label}: second edit remains live`);
}
assert.match(source, /TextInput\(\{ text: value\(\), placeholder: '' \}\)/,
  'input keeps its live value getter while leaving the already-labelled placeholder empty');
assert.match(source, /ReaderControlSwitchTrack\(\{ value: value\(\) \}\)/);
assert.match(source, /\.onClick\(\(\): void => this\.changeEditorFlag\(value, change\)\)/);

// A stable ForEach key must not freeze the first Core DTO or its initial index.
const initialRule = { id: 10, name: 'before', isEnabled: true };
owner.state.rules = [initialRule, { id: 20, name: 'other' }];
let ruleGetter, indexGetter;
owner.ruleRow = (rule, index) => { ruleGetter = rule; indexGetter = index; };
for (const call of actionCalls(source, 'ruleRow')) new Function('rule', stripTypeScriptTypes(`${call};`)).call(owner, initialRule);
assert.equal(typeof ruleGetter, 'function');
assert.equal(typeof indexGetter, 'function');
assert.strictEqual(ruleGetter(), initialRule);
assert.equal(indexGetter(), 0);
let iconLabel, iconAvailable;
owner.ruleIcon = (_icon, label, _action, enabled) => { iconLabel = label; iconAvailable = enabled; };
for (const call of actionCalls(source, 'ruleIcon')) {
  new Function('rule', 'index', '$r', stripTypeScriptTypes(`${call};`)).call(owner, ruleGetter, indexGetter, value => value);
}
assert.equal(typeof iconLabel, 'function');
assert.equal(typeof iconAvailable, 'function');
const updatedRule = { id: 10, name: 'after', isEnabled: false };
owner.state.rules = [{ id: 20 }, { id: 30 }, { id: 40 }, updatedRule];
assert.strictEqual(ruleGetter(), updatedRule);
assert.equal(indexGetter(), 3, 'Quick accessibility follows current order, not the original first-row index');
assert.equal(ruleGetter().isEnabled, false, 'the persisted switch update renders via the same rule getter');
assert.equal(iconLabel(), '删除after', 'dynamic accessibility label follows canonical rename');
assert.equal(iconAvailable(), true);
const reusedMap = owner.cachedRulesById;
ruleGetter(); indexGetter(); ruleGetter();
assert.strictEqual(owner.cachedRulesById, reusedMap, 'lookup is rebuilt on business array changes, not per row/frame');
owner.state.rules = [{ id: 20 }];
assert.equal(indexGetter(), -1);
assert.equal(iconAvailable(), false, 'disposed/removed row cannot dispatch stale edit/delete');

// Mount the actual SDK-transformed row Builder once. Replaying its observers
// tests the native Text.fontSize binding, not just a geometry field or source
// string. User M-02 overrides the recovered text scale, not row geometry.
function checkMountedRuleTypography(componentSource = source) {
  const { owner: rowOwner } = createReaderBuilderProbe(componentSource,
    ['ruleRow', 'ruleIcon', 'scopeSummary', 'frame', 'fullInput', 'quickInput', 'readyInput', 'presentation', 'rowClip'],
    { ...geometry, ...morphScroll, ...motionDeps, FlexAlign: { Center: 'FlexAlign.Center' } });
  let rule = { id: 12, name: '规则名称', pattern: '原文', replacement: '替换', scope: '本书',
    scopeTitle: true, scopeContent: true, scopeSource: false, isRegex: false, isEnabled: true };
  let index = 0;
  Object.assign(rowOwner, { ...motionProps, state: { ...stateModule.createReaderControlReplaceState('font:1'), status: 'ready' },
    interactionEnabled: true, localPending: false, motionProgress: 0,
    availableWidth: 286, availableHeight: 190, scrollMotion: { ...morphScroll.createReaderControlMorphScroll(), fullScrollOffset: 80, nativeScrollOffset: 80 },
    cachedProgress: -1, cachedWidth: 0, cachedHeight: 0, cachedScrollOffset: 0 });
  rowOwner.ruleRow(() => rule, () => index);
  const name = [...rowOwner.nodes.values()].find(n => n.type === 'Text' && n.create === rule.name);
  assert.ok(name, 'real rule-name Text mounted');
  const outer = [...rowOwner.nodes.values()].find(n => n.type === 'Stack');
  assert.ok(outer, 'real row actor mounted');
  const nodeCount = rowOwner.nodes.size;
  for (const p of [0, .01, .25, .5, .9, 1, .9, .5, .25, .01, 0]) {
    rowOwner.motionProgress = p;
    rowOwner.availableWidth = 286 + 52 * p;
    rowOwner.availableHeight = 190 + 476 * p;
    rowOwner.replay();
    const frame = geometry.sampleReaderControlReplace(p, rowOwner.availableWidth, rowOwner.availableHeight, 80);
    assert.equal(name.fontSize, 12, `M-02 actual mounted rule-name Text stays 12 at p=${p}`);
    assert.equal(name.scale, undefined, 'fixed font cannot be undone by a text transform');
    assert.equal(name.height, 17, 'native text box is not vertically scaled');
    assert.equal(name.maxLines, 1);
    assert.deepEqual(name.position, { x: frame.rowPadding + frame.toggleWidth + 10, y: 5.5 + 5.5 * p });
    assert.equal(name.width, Math.max(0, frame.list.width - frame.rowPadding * 2 - frame.toggleWidth - 10 - 75 * p));
    assert.equal(outer.height, frame.rowHeight, 'source 28→77 row track remains live');
    assert.equal(outer.width, frame.list.width);
    assert.equal(outer.clip, false, 'no blanket layout clip');
    assert.equal(outer.clipShape.path, rowOwner.rowClip(index).path, 'approved source/Quick-window paint clip');
    assert.equal(outer.blur, undefined, 'row outline remains sharp');
    assert.equal(outer.scale, undefined, 'row transform must not scale native list text');
    assert.equal(rowOwner.nodes.size, nodeCount, 'form changes do not replace the row tree');
  }
  rule = { ...rule, name: '持久化后新名称', isEnabled: false, pattern: '新原文', replacement: '新替换' };
  rowOwner.replay();
  assert.equal(name.create, rule.name, 'same Text reads the latest canonical rule name');
  assert.equal(name.fontSize, 12);
  const child = [...rowOwner.children.values()].find(n => n.params.value === false);
  assert.ok(child, 'same row still updates the canonical enabled state');
  index = -1;
  rowOwner.replay();
  assert.equal(outer.accessibilityLevel, 'no-hide-descendants', 'removed rule remains inaccessible');
}
function checkMountedRuleListClip(componentSource = source) {
  // Wrap the exact production Scroll subtree in a test-only Builder so the
  // SDK executes its modifiers without cloning the surrounding page logic.
  const start = componentSource.indexOf('      Scroll(this.scroller) {');
  const end = componentSource.indexOf('      if (this.state.rules.length > 0', start);
  assert.ok(start >= 0 && end > start, 'real production RuleList subtree boundaries');
  const subtree = componentSource.slice(start, end);
  const probeSource = componentSource.replace('  build() {',
    `  @Builder\n  private ruleListClipProbe() {\n${subtree}\n  }\n  build() {`);
  const { owner: listOwner } = createReaderBuilderProbe(probeSource,
    ['ruleListClipProbe', 'ruleRow', 'ruleIcon', 'scopeSummary', 'frame', 'fullInput', 'quickInput', 'readyInput',
      'textAction', 'statusContent', 'emptyStateMessage', 'listContentMinHeight', 'onFullDidScroll', 'nativeScrollDelta', 'sharedScrollTranslation', 'fullOnlyScrollTranslation',
      'currentRule', 'currentRuleIndex', 'refreshRuleLookup', 'presentation', 'rowClip'],
    { ...geometry, ...morphScroll, ...motionDeps, FlexAlign: { Center: 'FlexAlign.Center' } });
  const rule = { id: 12, name: '规则名称', pattern: '原文', replacement: '替换', scope: '本书',
    scopeTitle: true, scopeContent: true, scopeSource: false, isRegex: false, isEnabled: true };
  Object.assign(listOwner, { ...motionProps, state: { ...stateModule.createReaderControlReplaceState('clip:1'), status: 'ready', rules: [rule] },
    interactionEnabled: true, localPending: false, localError: '', layer: '', motionProgress: 0,
    availableWidth: 286, availableHeight: 190, scrollMotion: { ...morphScroll.createReaderControlMorphScroll(), fullScrollOffset: 80, nativeScrollOffset: 80 }, scroller: {},
    cachedProgress: -1, cachedWidth: 0, cachedHeight: 0, cachedScrollOffset: 0 });
  listOwner.ruleListClipProbe();
  const list = [...listOwner.nodes.values()].find(n => n.type === 'Scroll');
  const row = [...listOwner.nodes.values()].find(n => n.type === 'Stack');
  assert.ok(list && row, 'real list Scroll and contained rule actor both mounted');
  for (const p of [0, .25, .5, 1, .5, 0]) {
    listOwner.motionProgress = p;
    listOwner.availableWidth = 286 + 52 * p;
    listOwner.availableHeight = 190 + 476 * p;
    listOwner.replay();
    const frame = listOwner.frame();
    assert.equal(list.clip, true, 'RuleList owns the source clipping boundary');
    assert.equal(row.clip, false, 'contained Rule actor must not duplicate parent clipping');
    assert.equal(list.height, frame.list.height);
    assert.equal(list.width, frame.list.width);
    assert.deepEqual(list.position, { x: frame.list.x, y: frame.list.y });
  }
}
if (readerBuilderSdkAvailable) {
  checkMountedRuleTypography();
  checkMountedRuleListClip();
  const mutate = (before, after) => {
    assert.ok(source.includes(before), `mutation must replace real production expression: ${before}`);
    return source.replace(before, after);
  };
  assert.throws(() => checkMountedRuleTypography(mutate('.fontSize(this.frame().nameSize)',
    '.fontSize(9 + 3 * this.frame().progress)')), /actual mounted rule-name Text stays 12/,
    'actual SDK observers reject reintroduced 9→12 font growth');
  assert.throws(() => checkMountedRuleTypography(mutate('.fontSize(this.frame().nameSize)',
    '.fontSize(this.frame().nameSize).scale({ x: 0.75 + 0.25 * this.frame().progress, y: 0.75 + 0.25 * this.frame().progress })')),
    /text transform/, 'a parent-approved font cannot conceal a glyph scale regression');
  assert.throws(() => checkMountedRuleTypography(mutate('.height(this.frame().rowHeight).clip(false)',
    '.height(this.frame().rowHeight).clip(true)')), /no blanket layout clip/,
    'actual SDK observers reject an extra per-row clipping boundary');
  assert.throws(() => checkMountedRuleListClip(mutate('      .clip(true);', '      .clip(false);')),
    /RuleList owns the source clipping boundary/, 'actual SDK observers reject a removed list clip');
  console.log('Replace actual SDK mounted rule font: fixed 12, preserved row tracks, parent-only clip, same rule identity and 4 mutations PASS');
} else console.log('Replace mounted typography check SKIP: actual ETS SDK unavailable');
console.log('PASS reader-control-replace-content: actual async production methods, confirmation/failure/retry, session and preview dismissal guards; NOT ArkUI pixel evidence');
await import('./test-reader-replace-editor-feedback.mjs');
