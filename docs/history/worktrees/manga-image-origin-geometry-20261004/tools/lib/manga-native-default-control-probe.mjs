import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { mangaSurfaceSdkDependencies } from './manga-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { mangaUserError } from '../../entry/src/main/ets/features/manga/MangaUserError.ts';
import { readerBrightnessWindowValue } from '../../entry/src/main/ets/features/reading/ReaderBrightnessCurve.ts';

const require = createRequire(import.meta.url);
const sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdkRoot}/node_modules/typescript`);
const options = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
const normalize = value => (value ?? '').replace(/\s+/g, '');
const key = actor => JSON.stringify([actor.method, actor.kind, normalize(actor.argument)]);
export const mangaNativeDefaultKey = actor => key({ ...actor, argument: actor.argument ?? actor.text });
const fonts = ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing'];

/** Only the registered MangaReadingSurface actors are considered. Native
 * Slider/Blank are not typography exemptions: their actual AST, bounds,
 * branch/loop ownership and parent geometry have a separate finite proof. */
export function mangaNativeActors(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, 'actual manga native-default ETS AST');
  const attributes = new Map(), actors = [];
  const rootOf = node => { while (ts.isCallExpression(node) && node.expression?.expression) node = node.expression.expression; return node; };
  const modifiers = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const root = rootOf(node);
      if (!attributes.has(root.pos)) attributes.set(root.pos, {});
      attributes.get(root.pos)[node.expression.name.text] = node.arguments.map(arg => arg.getText(tree)).join(', ');
    }
    ts.forEachChild(node, modifiers);
  };
  modifiers(tree);
  const walk = node => {
    if (ts.isEtsComponentExpression(node) && ['Text', 'Button', 'Slider', 'Blank'].includes(node.expression.getText(tree))) {
      const kind = node.expression.getText(tree), attrs = attributes.get(node.pos) ?? {};
      if (['Slider', 'Blank'].includes(kind) || !fonts.some(property => property in attrs)) {
        const branches = [], parents = []; let method, loop;
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (ts.isMethodDeclaration(parent)) { method = parent.name.getText(tree); break; }
          if (ts.isIfStatement(parent)) branches.push({ guard: parent.expression.getText(tree),
            branch: parent.thenStatement.pos <= node.pos && node.end <= parent.thenStatement.end ? 'then' : 'else' });
          if ((ts.isCallExpression(parent) || ts.isEtsComponentExpression(parent)) && parent.expression.getText(tree) === 'LazyForEach')
            loop = { input: parent.arguments[0].getText(tree), key: parent.arguments[2].getText(tree) };
          if (ts.isEtsComponentExpression(parent)) parents.push({ kind: parent.expression.getText(tree),
            argument: parent.arguments[0]?.getText(tree) ?? '', attributes: attributes.get(parent.pos) ?? {} });
        }
        const children = [];
        if (node.body) {
          const child = value => { if (ts.isEtsComponentExpression(value)) children.push({ kind: value.expression.getText(tree),
            argument: value.arguments[0]?.getText(tree) ?? '', attributes: attributes.get(value.pos) ?? {} }); ts.forEachChild(value, child); };
          child(node.body);
        }
        actors.push({ kind, method, argument: node.arguments[0]?.getText(tree) ?? '', attributes: attrs, branches, parents,
          ...(loop ? { loop } : {}), ...(children.length ? { children } : {}) });
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(tree);
  return actors;
}

export function verifyMangaNativeActorContracts(source, contract) {
  assert.equal(contract.file, 'features/manga/MangaReadingSurface.ets');
  assert.equal(contract.component, 'MangaReadingSurface');
  assert.deepEqual(contract.budgets, { nativeGlyphFamilies: 4, nativeGlyphActors: 4, sliders: 2, blanks: 4 });
  return verifyFiniteActors(source, contract, { Text: 1, Button: 3, Slider: 2, Blank: 4 });
}

export function verifyMangaNativeIconContracts(source, contract) {
  assert.equal(contract.file, 'features/source/MangaSourceSwitchWindow.ets');
  assert.equal(contract.component, 'MangaSourceSwitchWindow');
  assert.deepEqual(contract.budgets, { iconButtons: 1, blanks: 1 });
  return verifyFiniteActors(source, contract, { Button: 1, Blank: 1 });
}

function verifyFiniteActors(source, contract, kinds) {
  const count = Object.values(kinds).reduce((sum, value) => sum + value, 0);
  const actors = mangaNativeActors(source, contract.file);
  assert.equal(actors.length, count, 'no missing or copied manga native-default/Slider/Blank actors');
  assert.equal(contract.consumers.length, count, 'finite manga contract cannot expand default permission');
  for (const [kind, size] of Object.entries(kinds)) {
    assert.equal(actors.filter(actor => actor.kind === kind).length, size, `actual bounded manga ${kind} actors`);
    assert.equal(contract.consumers.filter(actor => actor.kind === kind).length, size, `registered bounded manga ${kind} actors`);
  }
  const seen = new Set();
  for (const expected of contract.consumers) {
    const candidates = actors.filter(actor => key(actor) === key(expected));
    assert.equal(candidates.length, 1, `${expected.id}: exact unique actual actor`);
    const actor = candidates[0]; assert.ok(!seen.has(actor)); seen.add(actor);
    assert.deepEqual(actor.attributes, expected.requiredAttributes, `${expected.id}: exact native attributes and genuine AUTO omissions`);
    assert.deepEqual(actor.branches, expected.branches, `${expected.id}: exact actual branch ownership`);
    assert.deepEqual(actor.parents, expected.parents, `${expected.id}: actual parent layout/paint purpose`);
    assert.deepEqual(actor.loop, expected.loop, `${expected.id}: actual retained row scope/key`);
    assert.deepEqual(actor.children, expected.children, `${expected.id}: actual no-glyph Image child`);
    assert.equal('attributeModifier' in actor.attributes, false, 'no fake default modifier');
    for (const property of fonts) assert.equal(property in actor.attributes, false, 'native actors do not fabricate typography overrides');
  }
  return actors;
}

const tick = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; return { promise: new Promise((yes, no) => { resolve = yes; reject = no; }), resolve, reject }; };
const enumBoundary = name => new Proxy({}, { get: (_target, property) => `${name}.${String(property)}` });
const gestureBoundary = new Proxy({}, { get: () => () => {} });
const colors = ['paperColor', 'surfaceColor', 'inkColor', 'mutedColor', 'faintColor', 'lineColor', 'softSurfaceColor', 'greenColor', 'accentColor'];
const nodes = owner => [...owner.nodes.values()];
const buttonLabel = actor => Array.isArray(actor.createWithLabel) ? actor.createWithLabel[0] : actor.createWithLabel ?? actor.create;
function assertAuto(actor) {
  assert.ok(actor, 'real SDK emits expected native actor');
  for (const property of [...fonts, 'attributeModifier']) assert.equal(Object.hasOwn(actor, property), false, `actual native AUTO ${property}`);
}

/** Real installed SDK transforms unmodified production Builders and methods.
 * Only native scheduling/IO/gesture boundaries are supplied; row selection,
 * callback bodies, page bounds and asynchronous ownership guards execute
 * production code. This proves neither native layout nor compositor pixels. */
export async function verifyMangaNativeDefaultSdk(source, contract) {
  verifyMangaNativeActorContracts(source, contract);
  const dependencies = { ...mangaSurfaceSdkDependencies, ...readerTypographyRoles, mangaUserError, readerBrightnessWindowValue,
    hilog: { warn() {} },
    ...Object.fromEntries(['ImageFit', 'ScrollDirection', 'TouchType', 'GestureMode', 'SwipeDirection', 'Curve'].map(name => [name, enumBoundary(name)])),
    Gesture: gestureBoundary, GestureGroup: gestureBoundary, PinchGesture: gestureBoundary, SwipeGesture: gestureBoundary, TapGesture: gestureBoundary,
    // Execute the SDK's actual generated LazyForEach item closures once. No
    // retained native layout/removal or reactive reconciliation is simulated.
    LazyForEach: { create(_id, _owner, data, render, rowKey) {
      const keys = new Set();
      for (let index = 0; index < data.totalCount(); index++) {
        const row = data.getData(index), identity = rowKey(row, index);
        assert.ok(!keys.has(identity), 'actual keyed manga row'); keys.add(identity); render(row, index);
      }
    }, pop() {} },
    Toggle: gestureBoundary,
    globalThis: { ...mangaSurfaceSdkDependencies.globalThis, Gesture: gestureBoundary },
  };
  const actual = (names, state, extra = {}, definition = source) => {
    const probe = createReaderBuilderProbe(definition, [...new Set([...names, ...colors])], { ...dependencies, ...extra }, { componentName: 'MangaReadingSurface' });
    Object.assign(probe.owner, { backgroundPreference: 'paper', appThemeScheme: 'day', mounted: true, presentationGeneration: 0,
      viewportWidth: 390, viewportHeight: 844, zoom: 1, fitPreference: 'width', errorColor: '#f00', windowMetricsRevision: 0, ...state });
    return probe.owner;
  };
  const rows = [0, 1].map(ordinal => ({ ordinal, tileIndex: 0, key: `row-${ordinal}`, known: true,
    width: 390, height: 600, sourceHeight: 600 }));
  const data = { totalCount: () => rows.length, getData: index => rows[index], projection: { index: ordinal => ordinal } };
  const rowMethods = ['imageViewport', 'rowHasError', 'isPrimaryErrorRow', 'primaryErrorRowKey', 'requestedLast', 'rowRenderKey',
    'rowDisplayWidth', 'rowDisplayHeight', 'effectiveFit', 'imageError', 'displayError', 'retry'];
  {
    const retry = deferred(), calls = [], chapter = {};
    const controller = { chapter, tile: () => ({ error: 'MANGA_IMAGE_FAILED' }), visiblePages: () => [],
      retryTile: (...args) => { calls.push(['retry', ...args]); return retry.promise; } };
    const owner = actual(rowMethods, { data, controller, first: 0, last: 1, reportedErrorCodes: new Set(),
      error: 'MANGA_IMAGE_FAILED', horizontalScroller: {}, scroller: {}, updateViewport: async () => calls.push('viewport') });
    owner.imageViewport();
    const text = nodes(owner).filter(node => node.type === 'Text'), buttons = nodes(owner).filter(node => node.type === 'Button');
    assert.equal(text.length, 1, 'only primary failed row displays actual native error'); assertAuto(text[0]);
    assert.equal(text[0].create, mangaUserError('MANGA_IMAGE_FAILED')); assert.equal(text[0].maxLines, 4);
    assert.equal(buttons.length, 1, 'one actual retry command across adjacent errors'); assertAuto(buttons[0]);
    assert.equal(buttonLabel(buttons[0]), '重试');
    assert.equal(nodes(owner).filter(node => node.type === 'Blank').length, 1, 'adjacent failed row uses one real no-glyph placeholder');
    buttons[0].onClick(); assert.deepEqual(calls, [['retry', 0, 0]], 'native retry preserves captured row ordinal/tile');
    controller.chapter = {}; retry.resolve(); await tick();
    assert.deepEqual(calls, [['retry', 0, 0]], 'late retry cannot publish into a successor chapter');
  }
  {
    const calls = [], owner = actual(['topControls', 'iconAction', 'retryOpen', 'loginAndRetry', 'loginRequired', 'imageError', 'displayError'],
      { data, first: 0, error: 'READING_IMAGE_AUTH_REQUIRED', opened: false, offline: false, openingRetry: false,
        loggingIn: false, loginGeneration: 0, loginRequiredForControls: true, recovering: false, offlineProbeStatus: '', bookTitle: '', title: '第一话', reportedErrorCodes: new Set(),
        controller: { chapter: { manifest: { manifestVersion: 'm1' } }, tile: () => ({ error: 'READING_IMAGE_AUTH_REQUIRED' }), visiblePages: () => [], close: () => calls.push('close'), retryTile: async () => calls.push('retry') },
        open: async () => calls.push('open'), onLoginSource: async () => calls.push('login'), updateViewport: async () => calls.push('viewport') });
    owner.topControls();
    const buttons = nodes(owner).filter(node => node.type === 'Button'); assert.equal(buttons.length, 2);
    for (const actor of buttons) { assertAuto(actor); assert.equal(actor.height, 44); assert.equal(actor.enabled, true); }
    buttons.find(actor => buttonLabel(actor) === '重试').onClick(); await tick(); assert.deepEqual(calls, ['close', 'open']);
    buttons.find(actor => buttonLabel(actor) === '登录书源后重试').onClick(); await tick();
    assert.deepEqual(calls, ['close', 'open', 'login', 'retry', 'viewport']);
    owner.opened = true; buttons[0].onClick(); await tick(); assert.equal(calls.filter(value => value === 'open').length, 1, 'real opening admission rejects an already opened book');
    assert.equal(nodes(owner).filter(node => node.type === 'Blank' && node.width === 44).length, 1, 'real return-slot balancing blank');
  }
  const seekMethods = ['bottomControls', 'footerAction', 'pageOrdinal', 'seekPage', 'turnPage'];
  const seeking = (definition = source) => {
    const save = deferred(), visible = deferred(), calls = [], controller = { chapter: {}, totalPages: 3,
      setVisible: ordinal => { calls.push(['visible', ordinal]); return visible.promise; } };
    const owner = actual(seekMethods, { data, controller, opened: true, horizontal: false, displayedPage: 0,
      horizontalPage: 0, horizontalPageCount: 3, saveVisible: () => save.promise, notifyPublishedRows: value => calls.push(['rows', value]),
      restore: (...args) => calls.push(['restore', ...args]), interactiveInsets: () => ({ left: 0, right: 0 }),
      layoutGeneration: 0 }, {}, definition);
    owner.bottomControls(); const slider = nodes(owner).find(actor => actor.type === 'Slider'); assertAuto(slider);
    assert.deepEqual(slider.create, { value: 1, min: 1, max: 3, step: 1 }); assert.equal(slider.height, 24); assert.equal(slider.layoutWeight, 1); assert.equal(slider.enabled, true);
    return { owner, controller, slider, save, visible, calls };
  };
  {
    const f = seeking(); f.slider.onChange(2, 'SliderChangeMode.Moving'); await tick(); assert.deepEqual(f.calls, [], 'native moving drag does not seek');
    f.slider.onChange(2.4, 'SliderChangeMode.End'); f.save.resolve(); await tick();
    assert.deepEqual(f.calls, [['rows', false], ['visible', 1]], 'native ended drag maps one-based rounded value to current logical page');
    f.visible.resolve(); await tick(); assert.deepEqual(f.calls.at(-1), ['restore', 1, 0, 0]);
    for (const invalid of [NaN, 0, 4, Infinity]) { f.slider.onChange(invalid, 'SliderChangeMode.End'); await tick(); }
    assert.equal(f.calls.filter(value => value[0] === 'visible').length, 1, 'real seekPage bounds reject invalid native callback values');
  }
  for (const phase of ['save', 'visible']) for (const invalidate of [f => { f.owner.mounted = false; }, f => { f.owner.controller = {}; },
    f => { f.controller.chapter = {}; }, f => { f.owner.presentationGeneration++; }]) {
    const f = seeking(); f.slider.onChange(2, 'SliderChangeMode.End');
    if (phase === 'visible') { f.save.resolve(); await tick(); }
    invalidate(f); f.save.resolve(); f.visible.resolve(); await tick();
    assert.equal(f.calls.some(value => value[0] === 'restore'), false, `actual native page seek ${phase} fence rejects stale owner/chapter`);
    if (phase === 'save') assert.deepEqual(f.calls, [], 'late old native page callback cannot mutate successor viewport');
  }
  {
    const tree = ts.createSourceFile(contract.file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const method = tree.statements.find(node => node.name?.text === contract.component).members.find(node => node.name?.text === 'seekPage').getText(tree);
    const removed = source.replace(method, method.replace('this.controller !== controller || controller.chapter !== chapter || generation !== this.presentationGeneration', 'false'));
    assert.notEqual(removed, source); const f = seeking(removed); f.slider.onChange(2, 'SliderChangeMode.End'); f.controller.chapter = {};
    f.save.resolve(); f.visible.resolve(); await tick(); assert.ok(f.calls.some(value => value[0] === 'visible'), 'guard-removal control exposes unsafe successor-chapter publication');
  }
  {
    const calls = [], requests = [], owner = actual(['settingsPanel', 'sectionTitle', 'sheetChoice', 'choiceIcon', 'isSheetChoiceSelected', 'displayedBrightnessPercent', 'setBrightness'],
      { brightnessPercent: 10, brightnessOwner: 7, brightnessGeneration: 0, showPageNumbers: true },
      { ReaderWindowCoordinator: { brightness: () => ({ request: (...args) => { const task = deferred(); calls.push(args); requests.push(task); return task.promise; } }) } });
    owner.settingsPanel(); const slider = nodes(owner).find(actor => actor.type === 'Slider'); assertAuto(slider);
    assert.deepEqual(slider.create, { value: 20, min: 20, max: 100, step: 1 }); assert.equal(slider.width, '100%'); assert.equal(slider.height, 24);
    assert.equal(owner.brightnessPercent, 10, 'drawing min does not overwrite existing lower platform brightness');
    assert.equal(slider.accessibilityText, '阅读亮度'); slider.onChange(64);
    assert.deepEqual(calls, [[7, readerBrightnessWindowValue(64)]], 'real native brightness callback uses current window lease and actual curve');
    owner.brightnessOwner = 8; requests[0].reject(new Error('old lease')); await tick(); assert.equal(owner.error, undefined, 'late brightness failure cannot claim successor lease');
    owner.mounted = false; slider.onChange(80); assert.equal(calls.length, 1, 'retired surface cannot dispatch brightness');
  }
  {
    const owner = actual(['directoryTools'], { directoryQuery: '', directoryAscending: true }); owner.directoryTools();
    const blanks = nodes(owner).filter(node => node.type === 'Blank'); assert.equal(blanks.length, 1); assertAuto(blanks[0]);
    assert.equal(blanks[0].width, undefined, 'directory toolbar spacer retains native flexible width');
  }
  {
    const owner = actual(['chapterEndContent', 'chapterEndTypeLabel', 'chapterEndLabel', 'adjacentChapter', 'adjacentLabel', 'adjacentActionLabel', 'pageOrdinal'],
      { title: '第一话', horizontal: false, displayedPage: 2, horizontalPageCount: 3, controller: undefined,
        interactiveInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) }); owner.chapterEndContent();
    const blanks = nodes(owner).filter(node => node.type === 'Blank'); assert.equal(blanks.length, 1); assertAuto(blanks[0]);
    assert.equal(blanks[0].layoutWeight, 1, 'real chapter-end empty drawing actor consumes remaining column height above end card');
  }
  return { nativeGlyphActors: 4, sliders: 2, blanks: 4 };
}

export function verifyMangaNativeIconSdk(source, contract) {
  verifyMangaNativeIconContracts(source, contract);
  for (const [state, selectionPending, enabled] of [[{ kind: 'candidates' }, false, true],
    [{ kind: 'switching' }, false, false], [{ kind: 'candidates' }, true, false],
    [{ kind: 'failure', transactionId: 'pending-rollback' }, false, false]]) {
    const calls = [], { owner } = createReaderBuilderProbe(source,
      ['header', 'busy', 'rollbackRequired', 'isSweeping', 'requestRefresh'],
      { ...readerTypographyRoles, ButtonType: enumBoundary('ButtonType') }, { componentName: contract.component });
    Object.assign(owner, { state, selectionPending, appThemeScheme: 'day', onClose: () => calls.push('close'),
      onStop: () => calls.push('stop'), onRefresh: () => calls.push('refresh'), onRetry: () => calls.push('retry') });
    owner.header();
    const icon = nodes(owner).find(actor => actor.type === 'Button' && actor.accessibilityText === '返回'); assertAuto(icon);
    assert.equal(icon.width, 44); assert.equal(icon.height, 44); assert.equal(icon.enabled, enabled);
    const image = nodes(owner).find(actor => actor.type === 'Image'); assert.ok(image);
    assert.equal(image.create, 'app.media.source_switch_close'); assert.equal(image.width, 20); assert.equal(image.height, 20);
    const blank = nodes(owner).find(actor => actor.type === 'Blank'); assertAuto(blank); assert.equal(blank.layoutWeight, 1);
    if (enabled) { icon.onClick(); assert.deepEqual(calls, ['close'], 'actual native icon host forwards its real close action'); }
    // Programmatic native callbacks do not model platform disabled hit tests.
    // The adjacent refresh command itself retains its actual business guard.
    owner.requestRefresh(); assert.deepEqual(calls, enabled ? ['close', 'refresh'] : [], 'real header action keeps busy/rollback admission');
  }
  return { iconButtons: 1, blanks: 1 };
}
