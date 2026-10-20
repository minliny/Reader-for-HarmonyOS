import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"json-url-form-admission": {"description": "实际JSON dialog URL controlled draft/IME/本地选择/取消", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp,
  readerInteractiveSafeLeft, readerInteractiveSafeRight } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { resolveHorizontalFrame, SurfaceWidthSpec } = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');


const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const surfaceSource = readFileSync(file('features/common/ReaderDialogSurface.ets'), 'utf8');
const specSource = readFileSync(file('features/common/ReaderSurfaceSpecs.ets'), 'utf8');
const jsonSource = readFileSync(file('features/common/JsonImportDialog.ets'), 'utf8');
const indexSource = readFileSync(file('pages/Index.ets'), 'utf8');
const selectorSource = readFileSync(file('features/bookshelf/BookshelfGroupSelector.ets'), 'utf8');
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
const { owner: dialog } = createReaderBuilderProbe(jsonSource,
  ['build', 'formBody', 'localButton', 'submitOnlineImport'], {
  ...foundation.dependencies, ReaderDialogSurface: LiveSurfaceChild, DialogActionView,
  registerReaderFonts: () => {},
}, { ...foundation.hooks, allowEmptyBranchAdmission: true });
let dismissed = 0, selected = 0, imported = [];
Object.assign(dialog, { appThemeScheme: 'day', readerWindowMetricsRevision: 0,
  title: '导入 JSON', description: '支持选择本地 JSON 文件，或从在线链接下载后导入。',
  onDismiss: () => dismissed++, onSelectLocal: () => selected++,
  onImportOnline: url => imported.push(url),
  urlDraft: '', validationMessage: '' });
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
const localButton = dialogNodes.find(n => n.type === 'Text' && n.create === '选择本地 JSON 文件');
assert.ok(localButton, 'local-file action renders inside the body');
assert.ok(dialogNodes.indexOf(description) < dialogNodes.indexOf(localButton),
  'the description precedes the local-file action');
const urlLabel = dialogNodes.find(n => n.type === 'Text' && n.create === '在线链接');
const urlInput = dialogNodes.find(n => n.type === 'TextInput');
assert.ok(urlLabel && urlInput, 'URL form renders');
assert.ok(dialogNodes.indexOf(localButton) < dialogNodes.indexOf(urlLabel) && dialogNodes.indexOf(urlLabel) < dialogNodes.indexOf(urlInput),
  'the local-file action precedes the URL form, matching the original order');
assert.equal(typeof localButton.onClick, 'function');
const rawLinkNote = dialogNodes.find(n => n.type === 'Text' && n.create === 'GitHub 仓库文件请使用 Raw 链接；普通 blob 页面不是 JSON。');
assert.ok(rawLinkNote,'actual Raw-link note remains body content');
for (const [node, role] of [[urlLabel, 'TYPE_FORM_ACTION'], [urlInput, 'TYPE_FORM_URL_INPUT'],
  [localButton, 'TYPE_FORM_LABEL_ACTION']]) {
  const tuple = readerTypographyRoles[role];
  assert.deepEqual([node.fontFamily, node.fontSize, node.fontWeight, node.lineHeight],
    [tuple.fontFamily, tuple.fontSizeFp, tuple.fontWeight, tuple.lineHeightFp],
    `${role}: the normal URL/local-file control retains its original tuple and AUTO omissions`);
}

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


}
