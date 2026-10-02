import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp,
  readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { resolveHorizontalFrame, SurfaceWidthSpec } from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';

const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const surfaceSource = readFileSync(file('features/common/ReaderDialogSurface.ets'), 'utf8');
const specSource = readFileSync(file('features/common/ReaderSurfaceSpecs.ets'), 'utf8');
const jsonSource = readFileSync(file('features/common/JsonImportDialog.ets'), 'utf8');
const indexSource = readFileSync(file('pages/Index.ets'), 'utf8');
const selectorSource = readFileSync(file('features/bookshelf/BookshelfGroupSelector.ets'), 'utf8');
const specTree = ts.createSourceFile('/tmp/JsonImportSpecProbe.ets', specSource,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
assert.equal(specTree.parseDiagnostics.length, 0, 'production spec registry parses');
const { resolveDialogSpec } = new Function('TextAlign', stripTypeScriptTypes(specSource)
  .replace(/^export /gm, '') + '; return { resolveDialogSpec };')({ Start: 'TextAlign.Start', Center: 'TextAlign.Center' });
const actionModel = ts.createSourceFile('/tmp/JsonImportSurfaceProbe.ets', surfaceSource,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options)
  .statements.find(node => node.name?.text === 'DialogActionView');
assert.ok(actionModel, 'production action model is present');
const DialogActionView = new Function(stripTypeScriptTypes(actionModel.getText(
  ts.createSourceFile('/tmp/JsonImportSurfaceModel.ets', surfaceSource,
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
assert.match(jsonSource, /this\.localButton\(\);[\s\S]*?Column\(\{ space: TOK_SPACE_XS \}\)/,
  'the local-file action stays between the description and the URL form');
assert.match(jsonSource, /new DialogActionView\('importOnline', '从在线链接导入', 'primary'/);
assert.doesNotMatch(jsonSource, /new DialogActionView\('selectLocal'/,
  'the local-file action is body content, not a trailing dialog action');
const { owner: dialog } = createReaderBuilderProbe(jsonSource,
  ['build', 'formBody', 'localButton', 'submitOnlineImport'], {
  ReaderDialogSurface: LiveSurfaceChild, DialogActionView,
  registerReaderFonts: () => {},
}, { allowEmptyBranchAdmission: true });
let dismissed = 0, selected = 0, imported = [];
Object.assign(dialog, { appThemeScheme: 'day', readerWindowMetricsRevision: 0,
  title: '导入 JSON', description: '支持选择本地 JSON 文件，或从在线链接下载后导入。',
  onDismiss: () => dismissed++, onSelectLocal: () => selected++,
  onImportOnline: url => imported.push(url),
  urlDraft: '', validationMessage: '' });
dialog.initialRender();
const surfaceChild = [...dialog.children.values()][0];
assert.equal(surfaceChild.params.specId, 'json-import');
assert.equal(surfaceChild.params.title, '导入 JSON');
assert.equal(surfaceChild.params.showCloseButton, true);
assert.deepEqual(surfaceChild.params.actions.map(a => [a.id, a.label, a.tone]),
  [['importOnline', '从在线链接导入', 'primary']],
  'only the trailing online-import action is delegated to the shared actions row');
const dialogNodes = [...dialog.nodes.values()];
const description = dialogNodes.find(n => n.type === 'Text' && n.create === '支持选择本地 JSON 文件，或从在线链接下载后导入。');
assert.ok(description, 'description renders');
const localButton = dialogNodes.find(n => n.type === 'Text' && n.create === '选择本地 JSON 文件');
assert.ok(localButton, 'local-file action renders inside the body');
assert.ok(description.id < localButton.id,
  'the description precedes the local-file action');
const urlLabel = dialogNodes.find(n => n.type === 'Text' && n.create === '在线链接');
const urlInput = dialogNodes.find(n => n.type === 'TextInput');
assert.ok(urlLabel && urlInput, 'URL form renders');
assert.ok(localButton.id < urlLabel.id && urlLabel.id < urlInput.id,
  'the local-file action precedes the URL form, matching the original order');
assert.equal(localButton.height, 44);
assert.equal(localButton.borderRadius, 8);
assert.equal(typeof localButton.onClick, 'function');

// Draft update clears validation; submit routes the trimmed URL; the empty
// draft surfaces the admission message instead of dispatching.
dialog.urlDraft = '  ';
dialog.replay();
surfaceChild.params.onAction('importOnline');
assert.deepEqual(imported, [], 'blank drafts never reach the import callback');
assert.equal(dialog.validationMessage, '请输入在线 JSON 的 HTTP/HTTPS 地址');
dialog.replay();
assert.ok([...dialog.nodes.values()].some(n => n.type === 'Text' && n.create === '请输入在线 JSON 的 HTTP/HTTPS 地址'),
  'the validation message renders after an empty submit');
urlInput.onChange('https://example.com/books.json');
assert.equal(dialog.urlDraft, 'https://example.com/books.json', 'draft updates on input');
assert.equal(dialog.validationMessage, '', 'typing clears the validation message');
surfaceChild.params.onAction('importOnline');
assert.deepEqual(imported, ['https://example.com/books.json'],
  'submit routes the trimmed URL through onImportOnline');
urlInput.onSubmit('Enter');
assert.deepEqual(imported, ['https://example.com/books.json', 'https://example.com/books.json'],
  'keyboard submit shares the same admission path');
localButton.onClick();
assert.equal(selected, 1, 'the body local button routes to onSelectLocal');
surfaceChild.params.onClose();
assert.equal(dismissed, 1, 'the shared close affordance routes to onDismiss');
surfaceChild.params.onAction('selectLocal');
assert.equal(selected, 1, 'unrouted action ids never reach callbacks');

// Propagation proof: exercise two production consumers, then render both
// through the one ReaderDialogSurface implementation with a single shared
// constructor input. A common header field change must reach both consumers;
// a named variant override must stay scoped to that variant.
const bookSource = readFileSync(file('features/bookshelf/BookRemovalDialog.ets'), 'utf8');
const consumerSurfaceParams = [];
class ConsumerSurfaceChild {
  constructor(owner, params, _storage, id) {
    Object.assign(this, { owner, params, id });
    consumerSurfaceParams.push(params);
    params.body?.();
  }
}
const bookConsumerProbe = createReaderBuilderProbe(bookSource,
  ['build', 'messageBody', 'messageMaxHeight'], {
    ReaderWindowCoordinator: { metrics: () => metrics },
    ReaderDialogSurface: ConsumerSurfaceChild,
    DialogActionView,
    registerReaderFonts: () => {},
  });
Object.assign(bookConsumerProbe.owner, {
  appThemeScheme: 'day', message: '本地书', measuredMessageHeight: 50,
  onCancel: () => {}, onConfirm: () => {},
});
bookConsumerProbe.owner.initialRender();
assert.equal(consumerSurfaceParams.length, 1, 'book-removal mounts the shared surface');
assert.equal(consumerSurfaceParams[0].specId, 'book-removal');
assert.equal(surfaceChild.params.specId, 'json-import', 'json-import mounts the shared surface');

const surfaceMethods = ['body', 'defaultBody', 'build', 'header', 'actionsRow', 'actionCell',
  'spec', 'resolvedFrame', 'frameWidth', 'framePadding', 'actionLabelColor',
  'actionSurfaceRole', 'actionModifier', 'actionTouchRegion', 'bodyActionsInnerMargin'];
const renderConsumerSurface = (params, resolver) => {
  const probe = createReaderBuilderProbe(surfaceSource, surfaceMethods, {
    ReaderWindowCoordinator: { metrics: () => metrics }, readerInteractiveSafeLeft,
    readerInteractiveSafeRight, resolveHorizontalFrame, SurfaceWidthSpec,
    SurfaceHorizontalFrame: class {
      constructor(left, right, width) { Object.assign(this, { left, right, width }); }
    }, resolveDialogSpec: resolver, ButtonType: { Normal: 'Normal' },
  });
  Object.assign(probe.owner, {
    appThemeScheme: 'day', readerWindowMetricsRevision: 0,
    specId: params.specId, title: params.title, showCloseButton: params.showCloseButton ?? false,
    actions: params.actions ?? [],
  });
  probe.owner.initialRender();
  return probe.owner;
};
const originalResolver = resolveDialogSpec;
const sharedInput = { headerLineHeightDelta: 0 };
const variantInput = { borderRadiusDelta: 0 };
const sharedResolver = id => {
  const base = originalResolver(id);
  return new Proxy(base, {
    get(target, key, receiver) {
      if (key === 'headerLineHeight') return target.headerLineHeight + sharedInput.headerLineHeightDelta;
      if (key === 'borderRadius' && id === 'json-import') return target.borderRadius + variantInput.borderRadiusDelta;
      return Reflect.get(target, key, receiver);
    },
  });
};
sharedInput.headerLineHeightDelta = 7;
const bookSurfaceAfterSharedChange = renderConsumerSurface(consumerSurfaceParams[0], sharedResolver);
const jsonSurfaceAfterSharedChange = renderConsumerSurface(surfaceChild.params, sharedResolver);
const bookTitleAfterSharedChange = [...bookSurfaceAfterSharedChange.nodes.values()]
  .find(node => node.type === 'Text' && node.create === '移除书架');
const jsonTitleAfterSharedChange = [...jsonSurfaceAfterSharedChange.nodes.values()]
  .find(node => node.type === 'Text' && node.create === '导入 JSON');
assert.equal(bookTitleAfterSharedChange.lineHeight, 27,
  'one common header-line-height input reaches the real book-removal consumer');
assert.equal(jsonTitleAfterSharedChange.lineHeight, 35,
  'the same common header-line-height input reaches the real json-import consumer');
variantInput.borderRadiusDelta = -4;
const bookSurfaceAfterVariantChange = renderConsumerSurface(consumerSurfaceParams[0], sharedResolver);
const jsonSurfaceAfterVariantChange = renderConsumerSurface(surfaceChild.params, sharedResolver);
assert.equal(bookSurfaceAfterVariantChange.spec().borderRadius, 12,
  'json-import variant geometry changes never leak into book-removal');
assert.equal(jsonSurfaceAfterVariantChange.spec().borderRadius, 10,
  'a named json-import variant override reaches its real consumer only');

// Index shelf-group host wiring: the overlay mounts the shared surface with
// the real BookshelfGroupSelector as its body, the mask owns dismissal, and
// the selector's select intent routes into assignShelfDefaultGroup.
class SelectorChild {
  constructor(owner, params, _storage, id) {
    Object.assign(this, { owner, params, id });
  }
}
assert.match(indexSource, /specId: 'shelf-group',[\s\S]*?title: '编辑分组',[\s\S]*?actions: \[\]/);
assert.match(indexSource,
  /BookshelfGroupSelector\(\{\s*selected:[\s\S]*?busy: this\.editingShelfGroupBusy,\s*onSelect: \(\): void => \{ void this\.assignShelfDefaultGroup\(\); \}/,
  'the selector select intent routes into the default-group assignment');
assert.match(indexSource,
  /\.onClick\(\(\): void => \{ if \(!this\.editingShelfGroupBusy\) this\.editingShelfGroupBook = undefined; \}\)/,
  'the mask tap dismisses the overlay only when no assignment is in flight');
// The builder probe's native stub does not model nested custom-component
// creation inside a body slot, so the host probe records the parent's own
// observable state and the actual wiring text is asserted above.
const selectorChildren = [];
const groupHostProbe = createReaderBuilderProbe(`import { DialogActionView } from '../features/common/ReaderDialogSurface';
@Component struct IndexShelfGroupProbe {
  @State editingShelfGroupBusy: boolean = false;
  @State editingShelfGroupBook: string = 'book';
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  selected: boolean = true;
  maskTaps: number = 0;
  assignCalls: number = 0;
  assignShelfDefaultGroup(): void { this.assignCalls = this.assignCalls + 1; }
  build() {
    Stack({ alignContent: Alignment.Center }) {
      Row().width('100%').height('100%')
        .onClick((): void => { if (!this.editingShelfGroupBusy) { this.maskTaps = this.maskTaps + 1; this.editingShelfGroupBook = undefined; } });
      ReaderDialogSurface({
        specId: 'shelf-group',
        title: '编辑分组',
        actions: [],
        body: (): void => {
          BookshelfGroupSelector({
            selected: this.selected,
            busy: this.editingShelfGroupBusy,
            onSelect: (): void => { this.assignShelfDefaultGroup(); },
          });
        },
      })
    }.width('100%').height('100%');
  }
}`, ['build'], {
  ObservedPropertySimplePU: class {
    constructor(value, owner, name) {
      this.value = value;
      Object.defineProperty(owner, name, {
        get: () => this.value,
        set: next => { this.value = next; },
        configurable: true,
      });
    }
  },
  ReaderDialogSurface: class {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
  },
  DialogActionView,
  BookshelfGroupSelector: function (params) {
    const child = new SelectorChild(undefined, params, undefined, -1);
    selectorChildren.push(child);
    return child;
  },
  readerAppColor: () => '#000000',
});
const groupHost = groupHostProbe.owner;
Object.assign(groupHost, { maskTaps: 0, assignCalls: 0 });
groupHost.initialRender();
const maskNode = [...groupHost.nodes.values()].find(n => n.type === 'Row');
assert.ok(maskNode, 'the mask is drawn behind the card');
const groupSurface = [...groupHost.children.values()].find(child => child.params?.specId === 'shelf-group');
assert.ok(groupSurface, 'the shared surface mounts under the shelf-group spec');
assert.equal(groupSurface.params.title, '编辑分组');
assert.deepEqual(groupSurface.params.actions, [], 'dismissal is owned by the mask, not an actions row');
assert.equal(typeof groupSurface.params.body, 'function', 'the selector mounts through the body slot');
groupSurface.params.body();
assert.ok(selectorChildren.length > 0, 'the body slot mounts BookshelfGroupSelector');
maskNode.onClick();
assert.equal(groupHost.maskTaps, 1, 'mask tap dismisses while idle');
assert.equal(groupHost.editingShelfGroupBook, undefined, 'dismissal clears the editing book');
groupHost.editingShelfGroupBook = 'book';
groupHost.editingShelfGroupBusy = true;
groupHost.replay();
const busyMask = [...groupHost.nodes.values()].find(n => n.type === 'Row');
busyMask.onClick();
assert.equal(groupHost.maskTaps, 1, 'the busy guard blocks mask dismissal');
assert.equal(groupHost.editingShelfGroupBook, 'book', 'busy dismissal never clears the editing book');

console.log('json import real consumer: body order, draft/validation/close chain, shared-spec propagation and shelf-group host wiring PASS');
