// Selected search-panel controls only. No old list-header scenarios, gates,
// network, HAP, device, native painting or scrolling are executed here.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });

const sourcePaths = [
  'entry/src/main/ets/features/search/SearchPage.ets',
  'entry/src/main/ets/features/search/SearchSpinner.ets',
  'entry/src/main/ets/features/common/ReaderButton.ets',
  'entry/src/main/ets/features/common/ReaderSearchField.ets',
  'entry/src/main/ets/features/common/ReaderControlSpecs.ets',
  'entry/src/main/ets/features/common/ReaderTypography.ets',
  'tools/lib/reader-foundation-control-probe.mjs',
];
const source = Object.fromEntries(sourcePaths.map(path => [path,
  readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')]));
const sourceSha256 = Object.fromEntries(Object.entries(source).map(([path, text]) =>
  [path, createHash('sha256').update(text).digest('hex')]));
const receiptPath = new URL('./search-aligned-controls-result.json', import.meta.url);
const previous = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : { attempts: [] };
const passed = [], dimensions = [];
let stage = 'imports';

async function main() {
  const [{ compileTailConsumer }, { boundedMembers }, { foundationControls, foundationSpecs, readerFoundationTokens },
    { readerTypographyRoles }, { SearchViewState }, windowMetrics, { resolveOpenHarmonySdkRoot }] = await Promise.all([
    import('../../lib/foundation-tail-consumer-probe.mjs'),
    import('../../lib/bounded-surface-sdk-probe.mjs'),
    import('../../lib/reader-foundation-control-probe.mjs'),
    import('../../lib/reader-typography-probe.mjs'),
    import('../../../entry/src/main/ets/features/search/SearchViewState.ts'),
    import('../../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts'),
    import('../../lib/tool-environment.mjs'),
  ]);
  const common = path => source['entry/src/main/ets/features/common/' + path + '.ets'];
  const typography = common('ReaderTypography');
  const classText = typography.slice(typography.indexOf('export class ReaderTextStyle'),
    typography.indexOf('\nexport class ReaderInheritedTextStyle'));
  const ReaderTextStyle = new Function(stripTypeScriptTypes(classText).replace(/^export /gm, '') + ';return ReaderTextStyle;')();
  let fontScale = 1;
  let currentMetrics = windowMetrics.createDefaultReaderWindowMetrics();
  stage = 'compile actual shared controls';
  const specs = foundationSpecs({ ...readerTypographyRoles, ReaderTextStyle });
  const foundation = foundationControls({ specs, windowMetrics: () => ({ systemFontScale: fontScale }) });
  const enumSource = readFileSync(resolveOpenHarmonySdkRoot() + '/ets/component/enums.d.ts', 'utf8');
  const enumBlock = enumSource.match(/declare enum Alignment\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(enumBlock, 'the installed public SDK declares Alignment');
  const alignment = {}; let enumValue = 0;
  for (const member of enumBlock.replace(/\/\*[\s\S]*?\*\//g, '').split(',')) {
    const match = member.trim().match(/^(\w+)(?:\s*=\s*(\d+))?$/); if (!match) continue;
    if (match[2] !== undefined) enumValue = Number(match[2]);
    alignment[match[1]] = enumValue++;
  }
  assert.ok(Number.isFinite(alignment.End), 'End comes from the installed SDK instead of the permissive native proxy');
  assert.equal(alignment.CenterEnd, undefined, 'do not silently accept a nonexistent SDK Alignment member');
  const dependencies = { ...foundation.dependencies, ...readerTypographyRoles, ...readerFoundationTokens,
    ReaderTextStyle, FrameCallback: class {}, Alignment: alignment,
    ...windowMetrics,
    ReaderWindowCoordinator: { metrics: () => ({ ...currentMetrics, systemFontScale: fontScale }) },
  };
  const hooks = { ...foundation.hooks, ...foundation.properties.hooks,
    childSources: { ...foundation.hooks.childSources }, mountChildren: true, lifecycleChildren: true };
  const button = compileTailConsumer(common('ReaderButton'), boundedMembers(common('ReaderButton')), dependencies, hooks);
  dependencies.ReaderButton = button.Component;
  const fieldDefinition = common('ReaderSearchField');
  const field = compileTailConsumer(fieldDefinition, boundedMembers(fieldDefinition), dependencies, hooks);
  const spinnerDefinition = source['entry/src/main/ets/features/search/SearchSpinner.ets'];
  const spinner = compileTailConsumer(spinnerDefinition, boundedMembers(spinnerDefinition), dependencies, hooks);
  dependencies.SearchSpinner = spinner.Component;
  hooks.childSources.SearchSpinner = spinnerDefinition;
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
  const nodes = owner => walk(owner).flatMap(child => [...child.nodes.values()]);
  const fields = nodes;
  const scenario = (name, run) => { stage = name; run(); passed.push(name); console.log('PASS ' + name); };

  scenario('actual phone/wide actions retain width, leading call and end alignment in both busy states', () => {
    for (const [width, scale] of [[390, 1], [320, 1.6], [320, 3.2]]) {
      fontScale = scale;
      for (const wide of [false, true]) {
        const sizes = [];
        for (const busy of [false, true]) {
          let calls = 0;
          const owner = new button.Component(undefined, {
            specId: wide ? 'search-field-wide' : 'search-field-phone', label: busy ? '停止' : '搜索',
            isBusy: busy, actionEnabled: true, leading: () => calls++,
          });
          owner.aboutToAppear(); owner.initialRender();
          const all = nodes(owner), frame = all.find(node => node.type === 'Stack' && node.accessibilityRole);
          const row = all.find(node => node.type === 'Row');
          const label = all.find(node => node.type === 'Text' && node.create === (busy ? '停止' : '搜索'));
          assert.ok(frame && row && label);
          assert.equal(calls, 1, 'the actual leading Builder is invoked while idle too');
          assert.equal(frame.width, 46 + (wide ? 28 : 26) * scale);
          assert.equal(frame.height, 44 + 24 * (scale - 1));
          assert.equal(frame.create.alignContent, alignment.End);
          assert.equal(row.justifyContent, 'FlexAlign.End');
          assert.equal(label.fontWeight, 500);
          sizes.push([frame.width, frame.height]);
        }
        assert.deepEqual(sizes[0], sizes[1], 'stop/search cannot change the input allocation');
        dimensions.push({ viewportWidth: width, fontScale: scale, wide, action: sizes[0] });
      }
    }
  });

  scenario('actual bookPanel has 16/24 input and separate 44vp clear target; bookPage remains 14/21', () => {
    for (const [width, scale] of [[390, 1], [320, 1.6], [320, 3.2]]) {
      fontScale = scale;
      for (const variant of ['bookPanel', 'bookPage']) {
        const edits = [];
        const owner = new field.Component(undefined, { variant, text: '目标书', clearable: true,
          onTextChange: value => edits.push(value), focusOnAppear: false });
        owner.initialRender();
        const all = fields(owner), input = all.find(node => node.type === 'TextInput');
        const clear = all.find(node => node.accessibilityText === '清空搜索内容');
        assert.ok(input && clear);
        assert.equal(input.fontSize, variant === 'bookPanel' ? 16 : 14);
        assert.equal(input.lineHeight, variant === 'bookPanel' ? 24 : 21);
        assert.equal(input.halfLeading, variant === 'bookPanel');
        if (variant === 'bookPanel') {
          assert.equal(clear.type, 'Stack'); assert.equal(clear.width, 44);
          assert.equal(clear.height, 44 + 24 * (scale - 1));
          const image = all.find(node => node.type === 'Image' && node.accessibilityLevel === 'no');
          assert.equal(image.width, 14); assert.equal(image.height, 14);
        } else {
          assert.equal(clear.type, 'Image'); assert.equal(clear.width, 14); assert.equal(clear.height, 14);
          assert.equal(input.height, 44 + 21 * (scale - 1) - 2 * readerFoundationTokens.TOK_BORDER_W);
        }
        clear.onClick(); assert.deepEqual(edits, ['']);
        dimensions.push({ viewportWidth: width, fontScale: scale, variant,
          input: [input.fontSize, input.lineHeight, input.height], clear: [clear.width, clear.height] });
      }
    }
  });

  stage = 'compile selected production SearchPage methods';
  const selectedPageMembers = [
    'appThemeScheme', 'readerWindowMetricsRevision', 'presentation', 'viewState', 'resultNoticeFacts',
    'pageEpoch', 'pageMounted', 'isTablet', 'reduceMotion', 'spinnerRunKey', 'onRetry', 'onManageSources',
    'operation', 'retryOperation', 'isSweeping', 'searchControlHeight', 'searchFontScale',
    'captureSearchNoticeFacts', 'displayedSearchNoticeFacts', 'hasDisplayedSearchNotice', 'hasAnySearchNotice',
    'searchNoticeText', 'searchNoticeActionEnabled', 'searchNoticeOffersRetry', 'hasSearchNoticeRetry',
    'searchProgressRetryHandler', 'searchNoticeActionKey', 'searchProgressDetails', 'searchProgressNotice',
    'partialSearchFailure', 'searchFailureTitle', 'searchFailureMessage', 'searchErrorActions', 'searchActionLeading',
  ];
  const pageDefinition = source['entry/src/main/ets/features/search/SearchPage.ets'];
  const page = compileTailConsumer(pageDefinition, selectedPageMembers, { ...dependencies, SearchViewState }, hooks);
  function fixture({ partial = false, failed = 8, skipped = 7, busy = false, canRetry = true, kind = 'results' } = {}) {
    fontScale = 1;
    const owner = new page.Component(undefined, { isTablet: false, reduceMotion: false });
    owner.viewState.reset('目标书'); owner.pageMounted = true; owner.pageEpoch = 11;
    const books = Object.freeze([Object.freeze({ bookId: 'a', title: '目标书' })]);
    owner.visibleGroups = books;
    owner.presentation = { kind, keyword: '目标书', results: books, searching: busy,
      failedSourceCount: failed, skippedSourceCount: skipped, localSearchFailed: partial,
      localFailureMessage: '读取超时，请重试', operation: { generation: 3, canRetry, canCancel: busy } };
    const retries = [];
    owner.onRetry = () => retries.push('retry');
    return { owner, retries, books };
  }
  const retryChildren = owner => walk(owner).filter(child => child.specId === 'search-retry-progress');

  scenario('actual notice Builders expose a single recovery action and retain result identities', () => {
    for (const [partial, failed, skipped, expected] of [[true, 8, 7, 1], [false, 8, 7, 1], [false, 0, 7, 0]]) {
      const f = fixture({ partial, failed, skipped });
      f.owner.searchProgressDetails();
      assert.equal(retryChildren(f.owner).length, expected);
      assert.ok(nodes(f.owner).some(node => node.type === 'Text' && node.create === '已跳过 7 个近期不可用书源。'));
      assert.equal(f.owner.visibleGroups, f.books); assert.equal(f.owner.presentation.results, f.books);
      if (expected) {
        const child = retryChildren(f.owner)[0];
        nodes(child).find(node => typeof node.onClick === 'function').onClick();
        assert.deepEqual(f.retries, ['retry']);
      }
    }
    for (const partial of [false, true]) {
      const f = fixture({ kind: 'error', partial });
      f.owner.searchProgressDetails(); f.owner.searchErrorActions();
      assert.equal(retryChildren(f.owner).length, 1);
      assert.equal(walk(f.owner).filter(child => child.specId === 'search-error-retry').length, 0);
      assert.equal(walk(f.owner).filter(child => child.specId === 'search-error-source').length, 1);
      assert.equal(f.owner.searchFailureMessage(), '', 'details are not duplicated in the error body');
    }
    assert.match(pageDefinition, /actionContent:\s*\(\):\s*void\s*=>\s*\{\s*this\.searchErrorActions\(\);\s*\}/,
      'the shipping errorContent delegates its actual action slot to the exercised Builder');
    const plain = fixture({ kind: 'error', failed: 0, skipped: 0 }); plain.owner.searchErrorActions();
    assert.equal(walk(plain.owner).filter(child => child.specId === 'search-error-retry').length, 1,
      'an error without a prefix recovery action still retains its recovery path');
  });

  scenario('busy retry admission and old page/query/operation/fact callbacks reject before business dispatch', () => {
    const busy = fixture({ busy: true, canRetry: true });
    assert.equal(busy.owner.searchNoticeActionEnabled('failed'), false);
    busy.owner.searchProgressDetails();
    const child = retryChildren(busy.owner)[0]; assert.equal(child.actionEnabled, false);
    assert.equal(nodes(child).find(node => node.accessibilityRole).enabled, false);
    assert.equal(nodes(child).find(node => node.accessibilityRole).opacity, 0.4);
    busy.owner.searchProgressRetryHandler('failed')(); assert.deepEqual(busy.retries, []);
    for (const invalidate of [
      owner => { owner.pageMounted = false; }, owner => { owner.pageEpoch++; },
      owner => { owner.viewState.reset('新查询'); },
      owner => { owner.presentation = { ...owner.presentation, operation: { ...owner.operation(), generation: 4 } }; },
      owner => { owner.presentation = { ...owner.presentation, failedSourceCount: 0 }; },
      owner => { owner.presentation = { ...owner.presentation, operation: { ...owner.operation(), canRetry: false } }; },
      owner => { owner.presentation = { ...owner.presentation, operation: { ...owner.operation(), canCancel: true } }; },
    ]) {
      const f = fixture(), callback = f.owner.searchProgressRetryHandler('failed');
      invalidate(f.owner); callback(); assert.deepEqual(f.retries, []);
    }
    const terminal = fixture(); assert.equal(terminal.owner.searchNoticeActionEnabled('failed'), true);
    terminal.owner.searchProgressRetryHandler('failed')(); assert.deepEqual(terminal.retries, ['retry']);
    const skipped = fixture({ failed: 0 });
    assert.equal(skipped.owner.searchNoticeActionEnabled('skipped'), false);
    skipped.owner.searchProgressRetryHandler('skipped')(); assert.deepEqual(skipped.retries, []);
  });

  scenario('the actual page leading slot keeps native LoadingProgress geometry while idle and busy', () => {
    for (const busy of [false, true]) {
      const f = fixture({ busy }); f.owner.searchActionLeading();
      const all = nodes(f.owner), progress = all.find(node => node.type === 'LoadingProgress');
      const frame = all.find(node => node.type === 'Stack' && node.visibility);
      assert.ok(progress && frame); assert.equal(progress.width, 14); assert.equal(progress.height, 14);
      assert.equal(progress.enableLoading, busy);
      assert.equal(frame.width, 14); assert.equal(frame.height, 14);
      assert.equal(frame.visibility, busy ? 'Visibility.Visible' : 'Visibility.Hidden');
    }
  });

  stage = 'compile actual bounded header with option-scroll viewport policy';
  const headerMembers = ['appThemeScheme', 'readerWindowMetricsRevision', 'presentation', 'isTablet', 'filtersExpanded',
    'searchHeader', 'hasSearchSession', 'searchFilterMaxHeight', 'searchBarHeight', 'searchControlHeight',
    'searchStatsHeight', 'searchFontScale', 'searchOuterInset', 'searchResultWidth', 'searchActionWidth'];
  const header = compileTailConsumer(pageDefinition, headerMembers, dependencies, hooks);
  scenario('only expanded options get a bounded native Scroll using actual window/safe-area/keyboard policy', () => {
    for (const [height, keyboard, scale] of [[790, 0, 1], [650, 300, 1.6], [480, 200, 3.2]]) {
      fontScale = scale;
      currentMetrics = windowMetrics.createDefaultReaderWindowMetrics();
      currentMetrics.windowRect.width = scale === 1 ? 390 : 320;
      currentMetrics.windowRect.height = height;
      currentMetrics.keyboardInsets.bottom = keyboard;
      currentMetrics.systemInsets.top = 24; currentMetrics.systemInsets.bottom = 24;
      currentMetrics.systemFontScale = scale;
      for (const expanded of [false, true]) {
        const owner = new header.Component(undefined, { isTablet: false });
        owner.filtersExpanded = expanded; owner.presentation = { kind: 'results' };
        // These child Builders are explicit non-rendering ports. The tested
        // production parent still owns every actual Scroll/constraint node;
        // no search field, progress or notice is replaced by a local Scroll.
        const calls = [];
        for (const method of ['searchBar', 'filterProgressRow', 'groupScopeRow', 'contentTypeRow'])
          owner[method] = () => calls.push(method);
        owner.contentFrame = () => ({ width: currentMetrics.windowRect.width });
        owner.getUIContext = () => ({ px2vp: value => value,
          getMeasureUtils: () => ({ measureTextSize: () => ({ height: 18 * scale }) }) });
        owner.searchHeader();
        const scrolls = nodes(owner).filter(node => node.type === 'Scroll');
        assert.equal(scrolls.length, expanded ? 1 : 0);
        assert.deepEqual(calls, expanded ? ['searchBar', 'filterProgressRow', 'groupScopeRow', 'contentTypeRow'] :
          ['searchBar', 'filterProgressRow']);
        if (expanded) {
          assert.equal(scrolls[0].constraintSize.maxHeight, owner.searchFilterMaxHeight());
          assert.ok(scrolls[0].constraintSize.maxHeight >= 88);
          assert.equal(scrolls[0].scrollBar, 'BarState.Auto');
          if (keyboard > 0) {
            const withKeyboard = owner.searchFilterMaxHeight();
            currentMetrics.keyboardInsets.bottom = 0;
            assert.ok(owner.searchFilterMaxHeight() >= withKeyboard, 'keyboard cannot enlarge the option budget');
            currentMetrics.keyboardInsets.bottom = keyboard;
          }
          dimensions.push({ viewportHeight: height, keyboard, fontScale: scale,
            expandedOptionsMaxHeight: scrolls[0].constraintSize.maxHeight });
        }
      }
    }
  });
  return { selectedPageMembers, headerMembers, dimensions,
    sdkAlignmentSha256: createHash('sha256').update(enumSource).digest('hex'), sdkAlignmentEnd: alignment.End };
}

let outcome;
try {
  const detail = await main();
  outcome = { result: 'PASS', exitCode: 0, passed, ...detail };
} catch (error) {
  outcome = { result: 'FAIL', exitCode: 1, stage, passed,
    error: { name: error.name, message: error.message, stack: error.stack } };
  console.error(error.stack);
  process.exitCode = 1;
}
const attempt = { timestamp: new Date().toISOString(), ...outcome, sourceSha256,
  probeSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  evidence: 'actual installed ETS SDK lowering, shared modifiers, selected production methods and explicit business callbacks',
  notProven: 'native text measurement or pixel layout, physical overlap at viewport widths, animation, scrolling, HAP, device or user acceptance' };
writeFileSync(receiptPath, JSON.stringify({ attempts: [...previous.attempts, attempt], latest: attempt }, null, 2) + '\n');
console.log(JSON.stringify(attempt));
