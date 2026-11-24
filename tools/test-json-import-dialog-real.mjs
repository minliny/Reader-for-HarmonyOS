import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"json-url-form-admission": {"description": "实际JSON dialog URL controlled draft/IME/本地选择/取消", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync, writeFileSync } = await import('node:fs');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/ui/SourceSwitchVisual.ts');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { readerEditingSdk } = await import('./lib/reader-editing-sdk-probe.mjs');
const { boundedMembers, readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerTypographyRoles, readerMessageStyles } = await import('./lib/reader-typography-probe.mjs');
const { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp,
  readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeTop, readerInteractiveSafeBottom } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const { resolveHorizontalFrame, SurfaceWidthSpec } = await import('../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts');


const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const surfaceSource = readFileSync(file('ui/surfaces/ReaderDialogSurface.ets'), 'utf8');
const specSource = readFileSync(file('ui/surfaces/ReaderSurfaceSpecs.ets'), 'utf8');
const jsonSource = readFileSync(file('app/composition/JsonImportDialog.ets'), 'utf8');
const indexSource = readFileSync(file('pages/Index.ets'), 'utf8');
const selectorSource = readFileSync(file('features/bookshelf/ui/BookshelfGroupSelector.ets'), 'utf8');
const specTree = ts.createSourceFile(virtualFilePath('JsonImportSpecProbe.ets'), specSource,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
assert.equal(specTree.parseDiagnostics.length, 0, 'production spec registry parses');
const { resolveDialogSpec } = new Function('TextAlign', 'SOURCE_SWITCH_VISUAL', stripTypeScriptTypes(specSource)
  .replace(/^import[^;]+;\s*/gm, '').replace(/^export /gm, '') + '; return { resolveDialogSpec };')({ Start: 'TextAlign.Start', Center: 'TextAlign.Center' }, SOURCE_SWITCH_VISUAL);
const actionModel = ts.createSourceFile(virtualFilePath('JsonImportSurfaceProbe.ets'), surfaceSource,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options)
  .statements.find(node => node.name?.text === 'DialogActionView');
assert.ok(actionModel, 'production action model is present');
const DialogActionView = new Function(stripTypeScriptTypes(actionModel.getText(
  ts.createSourceFile(virtualFilePath('JsonImportSurfaceModel.ets'), surfaceSource,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options)))
  .replace(/^export /, '') + '; return DialogActionView;')();
syntax.componentCollection.customComponents.add('ReaderDialogSurface');
syntax.propCollection.set('ReaderDialogSurface', new Set(
  [...surfaceSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(match => match[1])));
syntax.builderParamObjectCollection.set('ReaderDialogSurface', new Set(
  [...surfaceSource.matchAll(/@BuilderParam\s*(\w+)\s*:/g)].map(match => match[1])));
syntax.componentCollection.customComponents.add('BookshelfGroupSelector');
syntax.propCollection.set('BookshelfGroupSelector', new Set(
  [...selectorSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(match => match[1])));

const metrics = new ReaderWindowMetricsSnapshot();
metrics.windowRect = new ReaderRectVp(0, 0, 390, 844);

// Real JsonImportDialog probe: the production struct is exercised through the
// SDK-emitted observer closures with the shared surface mounted as its child.
class LiveSurfaceChild {
  constructor(owner, params, _storage, id) {
    Object.assign(this, { owner, params, id });
    params.body();
  }
  updateStateVars(params) {
    Object.assign(this.params, params);
    this.params.body();
  }
}
const foundation=foundationControls();
const jsonMembers = ['editingHost', 'editingScroll', 'editingScroller', 'build', 'formBody', 'localButton', 'submitOnlineImport', 'focusScopeKey', 'localFocusKey',
  'safeTop', 'availableHeight', 'inputIsCurrent', 'restoreFocusAction', 'updateUrlDraft'];
const jsonDependencies = { ...readerEditingSdk(), ...readerMessageStyles, readerWindowMetrics: () => metrics, readerInteractiveSafeTop, readerInteractiveSafeBottom, readerPageAreaLength: value => Number.parseFloat(value) };
const { owner: dialog } = createReaderBuilderProbe(jsonSource,
  jsonMembers, {
  ...foundation.dependencies, ...jsonDependencies, ReaderDialogSurface: LiveSurfaceChild, DialogActionView,
  registerReaderFonts: () => {},
}, { ...foundation.hooks, allowEmptyBranchAdmission: true });
let dismissed = 0, selected = 0, imported = [];
Object.assign(dialog, { appThemeScheme: 'day', readerWindowMetricsRevision: 0,
  title: '导入 JSON', description: '支持选择本地 JSON 文件，或从在线链接下载后导入。',
  onDismiss: () => dismissed++, onSelectLocal: () => selected++,
  onImportOnline: url => imported.push(url),
  urlDraft: '', validationMessage: '', mounted: true, urlInputRevision: 0, hostHeight: 844, hostOriginY: 0, openingId: 1 });
dialog.initialRender();
const surfaceChild = [...dialog.children.values()].find(child=>child instanceof LiveSurfaceChild);
assert.equal(surfaceChild.params.specId, 'json-import');
assert.equal(surfaceChild.params.title, '导入 JSON');
assert.equal(surfaceChild.params.showCloseButton, true);
assert.deepEqual(surfaceChild.params.actions.map(a => [a.id, a.label, a.tone]),
  [['importOnline', '从在线链接导入', 'primary']],
  'only the trailing online-import action is delegated to the shared actions row');
const dialogNodes = foundation.orderedNodes(dialog);
const description = dialogNodes.find(n => n.type === 'Text' && n.create === '支持选择本地 JSON 文件，或从在线链接下载后导入。');
assert.ok(description, 'description renders');
const localLabel = dialogNodes.find(n => n.type === 'Text' && n.create === '选择本地 JSON 文件');
const localButton = dialogNodes.find(n => n.type === 'Button' && n.accessibilityText === '选择本地 JSON 文件');
assert.ok(localButton, 'local-file action renders inside the body');
assert.ok(dialogNodes.indexOf(description) < dialogNodes.indexOf(localLabel),
  'the description precedes the local-file action');
const urlLabel = dialogNodes.find(n => n.type === 'Text' && n.create === '在线链接');
const urlInput = dialogNodes.find(n => n.type === 'TextInput');
assert.ok(urlLabel && urlInput, 'URL form renders');
assert.ok(dialogNodes.indexOf(localLabel) < dialogNodes.indexOf(urlLabel) && dialogNodes.indexOf(urlLabel) < dialogNodes.indexOf(urlInput),
  'the local-file action precedes the URL form, matching the original order');
assert.equal(typeof localButton.onClick, 'function');
const rawLinkNote = dialogNodes.find(n => n.type === 'Text' && n.create === 'GitHub 仓库文件请使用 Raw 链接；普通 blob 页面不是 JSON。');
assert.ok(rawLinkNote,'actual Raw-link note remains body content');
for (const [node, role] of [[urlLabel, 'TYPE_FORM_ACTION'], [urlInput, 'TYPE_FORM_URL_INPUT']]) {
  const tuple = readerTypographyRoles[role];
  assert.deepEqual([node.fontFamily, node.fontSize, node.fontWeight, node.lineHeight],
    [tuple.fontFamily, tuple.fontSizeFp, tuple.fontWeight, tuple.lineHeightFp],
    `${role}: the normal URL/local-file control retains its original tuple and AUTO omissions`);
}

const localPaint = dialogNodes.find(node => node.type === 'Row' && node.borderRadius === 999 && node.scale !== undefined);
assert.equal(localPaint.constraintSize.minHeight, 44, 'frozen JSON local action has its own 44vp dialog paint');
assert.equal(localLabel.fontSize, 13);
assert.equal(localLabel.fontFamily, readerTypographyRoles.TYPE_FORM_LABEL_ACTION.fontFamily);
assert.equal(localButton.constraintSize.minHeight, 44);

// Draft update clears validation; submit routes the trimmed URL; the empty
// draft surfaces the admission message instead of dispatching.
dialog.urlDraft = '  ';
foundation.flush(dialog);
surfaceChild.params.onAction('importOnline');
assert.deepEqual(imported, [], 'blank drafts never reach the import callback');
assert.equal(dialog.validationMessage, '请输入在线 JSON 的 HTTP/HTTPS 地址');
foundation.flush(dialog);
assert.ok(foundation.nodes(dialog).some(n => n.type === 'Text' && n.create === '请输入在线 JSON 的 HTTP/HTTPS 地址'),
  'the validation message renders after an empty submit');
urlInput.onChange('file:///books.json');
surfaceChild.params.onAction('importOnline');
assert.deepEqual(imported, [], 'non-HTTP drafts never reach the import callback');
assert.equal(dialog.urlDraft, 'file:///books.json', 'invalid submission preserves the entered URL');
assert.equal(dialog.validationMessage, '请使用以 http:// 或 https:// 开头的 JSON 链接');
urlInput.onChange('  https://example.com/books.json  ');
assert.equal(dialog.urlDraft, '  https://example.com/books.json  ', 'draft updates on input');
assert.equal(dialog.validationMessage, '', 'typing clears the validation message');
surfaceChild.params.onAction('importOnline');
assert.deepEqual(imported, ['https://example.com/books.json'],
  'submit routes the trimmed URL through onImportOnline');
assert.equal(dialog.urlDraft, '  https://example.com/books.json  ', 'dispatch does not erase or rewrite the controlled draft');
urlInput.onSubmit('Enter');
assert.deepEqual(imported, ['https://example.com/books.json', 'https://example.com/books.json'],
  'keyboard submit shares the same admission path');
localButton.onClick();
assert.equal(selected, 1, 'the body local button routes to onSelectLocal');
surfaceChild.params.onClose();
assert.equal(dismissed, 1, 'the shared close affordance routes to onDismiss');
surfaceChild.params.onAction('selectLocal');
assert.equal(selected, 1, 'unrouted action ids never reach callbacks');


// The actual dialog, header and action Native Buttons share one bounded
// document. This geometry layer uses the current host and IME snapshot.
const realControls = foundationControls({ windowMetrics: () => metrics });
const { readerActionIcon } = pureModuleProbe(readFileSync(file('ui/foundation/ReaderActionIconResources.ets'), 'utf8'),
  'ReaderActionIconResources.ets', { $r: value => value }, ['readerActionIcon']);
const surfaceDeps = { ...realControls.dependencies, ...readerTypographyRoles, ...readerMessageStyles, readerActionIcon,
  resolveDialogSpec, readerSurfaceElevation: readerSurfaceSpecsForProbe().readerSurfaceElevation,
  readerWindowMetrics: () => metrics, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  SurfaceWidthSpec, resolveHorizontalFrame, ReaderPressFeedback: productionReaderPressFeedback(),
  readerAppColor: (await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts')).readerAppColor,
};
const surfaceHooks = { ...realControls.hooks, childSources: { ...realControls.hooks.childSources,
  ReaderDialogSurface: surfaceSource }, allowEmptyBranchAdmission: true };
const Surface = createReaderBuilderProbe(surfaceSource, boundedMembers(surfaceSource), surfaceDeps, surfaceHooks).Component;
for (const scale of [1, 1.45, 2, 3]) for (const ime of [0, 180]) {
  metrics.windowRect = new ReaderRectVp(0, 0, 320, 360);
  metrics.systemInsets = new ReaderInsetsVp(0, 24, 0, 16);
  metrics.keyboardInsets = new ReaderInsetsVp(0, 0, 0, ime);
  metrics.systemFontScale = scale;
  const geometryMembers = [...jsonMembers, 'urlDraft', 'validationMessage', 'hostHeight', 'hostOriginY', 'readerWindowMetricsRevision'];
  const live = createReaderBuilderProbe(jsonSource, geometryMembers,
    { ...realControls.dependencies, ...jsonDependencies, ReaderDialogSurface: Surface, DialogActionView }, surfaceHooks).owner;
  Object.assign(live, { appThemeScheme: 'day', mounted: true, openingId: 2, readerWindowMetricsRevision: 1,
    hostHeight: 360, hostOriginY: 0, title: '导入 JSON', description: '选择本地文件或从在线链接导入。', urlDraft: 'https://example.test/a.json',
    validationMessage: '在线链接暂时无法读取，请核对地址。'.repeat(30), urlInputRevision: 0,
    onDismiss() {}, onSelectLocal() {}, onImportOnline() {} });
  live.initialRender();
  const all = realControls.nodes(live), scroll = all.find(node => node.type === 'Scroll');
  assert.equal(scroll.height, (ime > 0 ? 180 : 344) - 24, 'IME and safe bounds use one measured host intersection');
  for (const label of ['关闭', '选择本地 JSON 文件', '从在线链接导入'])
    assert.ok(all.some(node => node.type === 'Button' && (node.accessibilityText === label ||
      realControls.nodes(live).some(text => text.type === 'Text' && text.create === label))), `${label} exists inside current document`);
  const close = all.find(node => node.type === 'Button' && node.accessibilityText === '关闭');
  assert.ok(close.height >= 44 && close.constraintSize.minWidth >= 44, 'shared close button pays both native hit dimensions');
  assert.ok(all.some(node => node.type === 'Stack' && node.width === 32 && node.height === 32 &&
    node.borderRadius === 16 && node.hitTestBehavior === 'HitTestMode.None'), 'close paint is a passive 32vp capsule');
  assert.ok(all.some(node => node.type === 'Image' && node.create === readerActionIcon('close', 'day') &&
    node.width === 15 && node.height === 15), 'close uses the generated vector at its frozen size');
  assert.ok(all.some(node => node.type === 'Text' && node.create === live.validationMessage), 'full long validation remains scrollable');
  const root = all.find(node => node.type === 'Stack' && typeof node.onAreaChange === 'function');
  root.onAreaChange({}, { width: 320, height: 150, globalPosition: { x: 0, y: 0 } });
  live.replay(); realControls.properties.flush();
  assert.ok(realControls.nodes(live).some(node => node.type === 'Scroll' && node.height === 126), 'same opening resize updates the viewport');
  assert.equal(live.urlDraft, 'https://example.test/a.json');
  const oldCloseSource = surfaceSource.replace('.constraintSize({ minWidth: 52 }).height(readerScaledControlHeight(44,', '.width(52).height(readerScaledControlHeight(36,');
  if (scale === 1 && ime === 0) {
    const OldSurface = createReaderBuilderProbe(oldCloseSource, boundedMembers(oldCloseSource), surfaceDeps, surfaceHooks).Component;
    const oldClose = new OldSurface(undefined, { specId: 'json-import', title: '导入 JSON', showCloseButton: true, body() {} });
    oldClose.initialRender();
    assert.throws(() => assert.ok(realControls.nodes(oldClose).find(node => node.type === 'Button' && node.accessibilityText === '关闭').height >= 44), /AssertionError/, 'old Native close36 rejected');
  }
  const old = jsonSource.replace('Scroll(this.editingScroller) {', 'Column() {');
  assert.notEqual(old, jsonSource);
  const before = createReaderBuilderProbe(old, geometryMembers,
    { ...realControls.dependencies, ...jsonDependencies, ReaderDialogSurface: Surface, DialogActionView }, surfaceHooks).owner;
  Object.assign(before, { appThemeScheme: 'day', mounted: true, openingId: 3, readerWindowMetricsRevision: 1,
    hostHeight: 360, hostOriginY: 0, title: '导入 JSON', description: '', urlDraft: '', validationMessage: '', urlInputRevision: 0,
    onDismiss() {}, onSelectLocal() {}, onImportOnline() {} });
  before.initialRender();
  assert.throws(() => assert.ok(realControls.nodes(before).some(node => node.type === 'Scroll')), /AssertionError/, 'historical unbounded Column rejected');
}
const receiptPath = process.env.READER_JSON_DIALOG_RECEIPT_PATH;
if (receiptPath) writeFileSync(receiptPath, JSON.stringify({
  command: { entry: 'tools/test-json-import-dialog-real.mjs', cases: ['json-url-form-admission'] }, result: 'PASS',
  contexts: { width: 320, height: 360, fontScales: [1, 1.45, 2, 3], keyboardInsets: [0, 180], sameOpeningResizedHeight: 150 },
  checked: ['actual body/header/actions Native SDK assembly and 32vp close vector in independent hit region', 'controlled URL admission and local/close dispatch', 'long validation whole-document Scroll', 'same opening resize preserves URL', 'old unbounded Column mutation rejected'],
  completeInputManifest: process.env.READER_LAYOUT_TRACE_OUTPUT ?? 'NOT_RECORDED',
  boundary: 'Actual installed ETS observers and Native node modifiers. Platform IME scheduling, pixels, pointer, focus and user acceptance NOT_RUN.',
}, null, 2) + '\n');


}
