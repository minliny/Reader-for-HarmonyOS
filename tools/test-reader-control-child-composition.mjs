import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles, readerMessageStyles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const definitions = {
  'search-recovery-row': { description: 'Actual recovery native minimum, text padding and role pay for the sibling Search message wrap.', resources: [] },
  'replace-toolbar-row': { description: 'Actual icon/gap/borders pay for each weighted native replacement toolbar child.', resources: [] },
  'auto-follow-row': { description: 'Actual follow Text, switch, margin, padding and border pay both native axes.', resources: [] },
};
const selected = selectContractCases(definitions);
if (selected.length > 0) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const uiPath = 'entry/src/main/ets/features/reading/ui/';
  const ui = name => read(uiPath + name);
  const searchGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSearchGeometry.ts');
  const replaceGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlReplaceGeometry.ts');
  const playbackGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
  const typography = selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets', import.meta.url),
    ['ReaderTextStyle', 'ReaderInheritedTextStyle']);
  const measure = pureModuleProbe(ui('ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets',
    { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
  const properties = createArkUIPropertyRuntimeProbe();
  const deps = { ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles, ...readerMessageStyles, ...typography, ...measure,
    ...searchGeometry, ...replaceGeometry, ...playbackGeometry, readerAppColor };
  const native = (source, names, dependencies = deps, hooks = {}) => createReaderBuilderProbe(source, names,
    dependencies, { ...properties.hooks, ...hooks });
  const pure = (name, exports, source = ui(name)) => pureModuleProbe(source, name, deps, exports);
  const nodes = (owner, type) => [...owner.nodes.values()].filter(node => node.type === type);
  const near = (actual, expected, why) => assert.ok(Math.abs(actual - expected) < 1e-7, `${why}: ${actual} / ${expected}`);
  const widths = width => ({ panelWidthVp: width + 26, quickContentWidthVp: width - 52, fullContentWidthVp: width });
  // A finite platform-metric seam, not a native layout or font-raster model.
  // Child requests are read independently from the real SDK-emitted Builders.
  function metricPort(scale) {
    const calls = [];
    const advance = options => [...options.textContent].reduce((sum, char) =>
      sum + (/\p{Script=Han}/u.test(char) ? 1 : .55), 0) * Number.parseFloat(options.fontSize) * scale;
    const line = options => Number.parseFloat(options.lineHeight ?? options.fontSize) * scale * (options.lineHeight ? 1 : 1.5);
    return { calls, advance, line, context: { px2vp: value => value, getMeasureUtils: () => ({
      measureText: options => Math.max(1, advance(options)),
      measureTextSize(options) {
        calls.push({ ...options });
        const natural = Math.max(1, advance(options));
        return { width: Math.min(natural, options.constraintWidth), height: line(options) *
          (options.maxLines === 1 ? 1 : Math.ceil(natural / options.constraintWidth)) };
      },
    }) } };
  }
  function assertRole(node, options, why) {
    assert.equal(node.fontFamily, options.fontFamily, why + ' family');
    assert.equal(node.fontSize, options.fontSize, why + ' size');
    assert.equal(node.fontWeight, options.fontWeight, why + ' explicit/inherited weight');
    assert.equal(node.lineHeight, options.lineHeight === undefined ? undefined : Number.parseFloat(options.lineHeight), why + ' explicit/inherited line');
  }

  for (const id of selected) {
    if (id === 'search-recovery-row') {
      const source = ui('ReaderControlSearchMinimum.ets');
      const actual = pure('ReaderControlSearchMinimum.ets', ['measureReaderSearchMinimum']);
      const messageClass = selectedProductionClasses(new URL('../' + uiPath + 'ReaderControlSearchContent.ets', import.meta.url),
        ['ReaderSearchMeasuredMessageFrame']);
      const actionSource = read('entry/src/main/ets/ui/feedback/ReaderRecoveryAction.ets');
      const Action = native(actionSource, ['build', 'appThemeScheme', 'variant', 'label', 'generation',
        'actionEnabled', 'isBusy', 'minimumWidth', 'focusId', 'onReconcile'], deps).Component;
      const makeRow = (profile, result) => {
        const owner = native(ui('ReaderControlSearchContent.ets'), ['loadMoreAction'],
          { ...deps, ...messageClass, ReaderRecoveryAction: Action },
          { mountChildren: true, childSources: { ReaderRecoveryAction: actionSource } }).owner;
        Object.assign(owner, { displayState: () => result, displayResults: () => result,
          displayedLoadMoreFailure: () => true, displayedResultScope: () => 17,
          loadMoreActionEnabled: () => true, performLoadMore() {}, appThemeScheme: 'day',
          frame: () => profile.frame, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }) });
        owner.loadMoreAction();
        const child = [...owner.children.values()].find(value => value instanceof Action);
        assert.ok(child, 'the actual Search row mounts the actual shared RecoveryAction');
        return { row: nodes(owner, 'Row')[0], message: nodes(owner, 'Text')[0],
          child, button: nodes(child, 'Button')[0], label: nodes(child, 'Text')[0] };
      };
      function verify(module, scale, width, retired) {
        const port = metricPort(scale);
        const result = { kind: 'results', results: [], hasMore: !retired, paginationRetired: retired, loadMoreError: 'failed' };
        const label = retired ? '重新搜索' : '重试';
        const message = retired ? '需重新搜索才能加载更多' : '后续结果加载失败';
        const facts = { query: '', title: '', snippet: '', message: '', hasResults: false, resultsMode: true, loading: false,
          loadMoreLabel: label, loadMoreMessage: message };
        const profile = module.measureReaderSearchMinimum(port.context, widths(width), facts);
        assert.ok(profile, 'actual Search profile');
        const endpoint = profile.full;
        const frame = searchGeometry.sampleReaderControlSearch(1, width, 666, endpoint.natural);
        const emitted = makeRow({ frame }, result);
        const actionMeasure = port.calls.find(call => call.textContent === label);
        const messageMeasure = port.calls.findLast(call => call.textContent === message);
        assertRole(emitted.label, actionMeasure, 'actual text recovery label');
        assertRole(emitted.message, messageMeasure, 'actual weighted message');
        assert.equal(emitted.message.layoutWeight, 1);
        assert.equal(emitted.message.constraintSize.minWidth, 0);
        assert.equal(emitted.row.create.space, 10);
        const padding = emitted.button.padding;
        const actualActionWidth = Math.max(emitted.button.constraintSize.minWidth,
          port.advance(actionMeasure) + padding.left + padding.right);
        near(endpoint.natural.loadMoreWidthVp, actualActionWidth, 'actual native recovery minimum and padding');
        const messageWidth = emitted.row.width - emitted.row.create.space - actualActionWidth;
        near(messageMeasure.constraintWidth, Math.max(1, messageWidth), 'remaining actual weighted lane');
        const actualMessageHeight = port.line(messageMeasure) * Math.ceil(port.advance(messageMeasure) / Math.max(1, messageWidth));
        assert.ok(emitted.row.height + 1e-7 >= actualMessageHeight, 'actual message wraps within the paid native row height');
        return { minimum: endpoint.minimum, height: emitted.row.height };
      }
      let samples = 0;
      for (const width of [320, 366]) for (const scale of [1, 1.3, 1.6, 2]) for (const retired of [false, true]) {
        verify(actual, scale, width, retired); samples++;
      }
      const scale = 1.4;
      const messageAdvance = 8 * 13 * scale;
      const oldActionWidth = 2 * 13 * scale + 4;
      const collisionWidth = messageAdvance + 10 + (oldActionWidth + 44) / 2 + 4;
      const collision = verify(actual, scale, collisionWidth, false);
      assert.equal(collision.minimum.fits, true, 'the narrow counterexample is an admitted complete Search profile');
      assert.ok(collision.height > 44, 'the real native minimum makes the message require a second paid line');
      const oldSource = source.replace('const recoveryNativeMinimumWidth = 44;', 'const recoveryNativeMinimumWidth = 30;');
      assert.notEqual(oldSource, source);
      const old = pure('ReaderControlSearchMinimum.ets', ['measureReaderSearchMinimum'], oldSource);
      assert.throws(() => verify(old, scale, collisionWidth, false), /actual native recovery minimum/, 'old thirty-vp accounting fails against the actual child');
      console.log(JSON.stringify({ kind: id, samples: samples + 1, oldProducerRejected: true, nativeLayout: 'NOT_RUN' }));
    }

    if (id === 'replace-toolbar-row') {
      const source = ui('ReaderControlReplaceMinimum.ets');
      const actual = pure('ReaderControlReplaceMinimum.ets', ['measureReaderControlReplaceMinimum']);
      function verify(module, scale, width) {
        const port = metricPort(scale);
        const profile = module.measureReaderControlReplaceMinimum(port.context, widths(width), '', '', '规则名', '原文 → 替换', '正文', '编辑规则', false);
        assert.ok(profile, 'actual replacement profile');
        const frame = replaceGeometry.sampleReaderControlReplace(1, width, 666, profile);
        const owner = native(ui('ReaderControlReplaceContent.ets'),
          ['ruleToolbar', 'toolbarButton', 'toolbarButtonWidth', 'toolbarButtonX'], deps).owner;
        Object.assign(owner, { frame: () => frame, state: { sessionKey: 'replacement' }, layer: '',
          fullInput: () => true, readyInput: () => true, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
          appThemeScheme: 'day', openEditor() {}, openImport() {}, perform() {} });
        owner.ruleToolbar();
        const buttons = nodes(owner, 'Button'), rows = nodes(owner, 'Row'), images = nodes(owner, 'Image'), labels = nodes(owner, 'Text');
        assert.equal(buttons.length, 3); assert.equal(rows.length, 3);
        const labelNames = ['新增规则', '导入', '导出'];
        for (let index = 0; index < 3; index++) {
          const button = buttons[index], row = rows[index], icon = images[index], label = labels[index];
          const textMeasure = port.calls.find(call => call.textContent === labelNames[index]);
          assertRole(label, textMeasure, 'actual toolbar label');
          assert.equal(icon.width, 20); assert.equal(icon.height, 20);
          assert.equal(row.create.space, 6); assert.equal(row.width, '100%');
          assert.equal(button.padding, 0); assert.equal(button.border.width, 1);
          const actualLabelLane = button.width - button.border.width * 2 - icon.width - row.create.space;
          assert.ok(actualLabelLane + .1 >= port.advance(textMeasure), 'actual bordered toolbar label fits its native content lane');
          assert.ok(button.position.x >= 0 && button.position.x + button.width <= frame.toolbar.width + 1e-7);
          assert.ok(button.position.y >= 0 && button.position.y + button.height <= frame.toolbar.height + 1e-7);
        }
        return profile.full.toolbarColumns;
      }
      let samples = 0;
      for (const width of [320, 366]) for (const scale of [1, 1.3, 1.6, 2]) { verify(actual, scale, width); samples++; }
      assert.equal(verify(actual, 1, 338), 3, 'the original default toolbar keeps its three native columns');
      const collisionWidth = 44 + (4 * 11 * 1.6 + 27) * 294 / 100.66;
      assert.equal(verify(actual, 1.6, collisionWidth), 1, 'a true border collision uses the existing stacked toolbar');
      const oldSource = source.replace('const toolbarHorizontalBorder = 2 * TOK_BORDER_W;', 'const toolbarHorizontalBorder = 0;');
      assert.notEqual(oldSource, source);
      assert.throws(() => verify(pure('ReaderControlReplaceMinimum.ets', ['measureReaderControlReplaceMinimum'], oldSource), 1.6, collisionWidth),
        /actual bordered toolbar label/, 'old omitted-border accounting fails against the real native children');
      console.log(JSON.stringify({ kind: id, samples: samples + 2, nativeButtons: (samples + 2) * 3, oldProducerRejected: true, nativeLayout: 'NOT_RUN' }));
    }

    if (id === 'auto-follow-row') {
      const source = ui('ReaderControlAutoPageMinimum.ets');
      const actual = pure('ReaderControlAutoPageMinimum.ets', ['measureReaderControlAutoPageMinimum']);
      const switchSource = ui('ReaderControlSwitchTrack.ets');
      const Switch = native(switchSource, ['build', 'appThemeScheme', 'value', 'trackWidth', 'trackHeight',
        'thumbSize', 'thumbInset', 'activeColor', 'inactiveColor', 'thumbColor'], deps).Component;
      function verify(module, scale, width) {
        const port = metricPort(scale);
        const profile = module.measureReaderControlAutoPageMinimum(port.context, widths(width), '未开始', '未设置');
        assert.ok(profile, 'actual AutoPage profile');
        const frame = profile.full;
        const owner = native(ui('ReaderControlAutoPageContent.ets'), ['followHighlightRow', 'sectionInnerWidth'],
          { ...deps, ReaderControlSwitchTrack: Switch }, { mountChildren: true, childSources: { ReaderControlSwitchTrack: switchSource } }).owner;
        Object.assign(owner, { frame: () => frame, textMetric: name => profile.fullText[name], minimumProfile: () => profile,
          appScheme: 'day', status: 'stopped', followHighlight: false, fullInput: () => true,
          fullOnlyScrollTranslation: () => 0, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }) });
        owner.followHighlightRow();
        const button = nodes(owner, 'Button')[0], label = nodes(owner, 'Text')[0];
        const child = [...owner.children.values()].find(value => value instanceof Switch);
        assert.ok(child, 'actual shared switch is mounted');
        const track = nodes(child, 'Stack')[0];
        const textMeasure = port.calls.findLast(call => call.textContent === '跟随高亮');
        assertRole(label, textMeasure, 'actual follow label');
        assert.equal(label.layoutWeight, 1); assert.equal(track.width, 44); assert.equal(track.height, 24);
        const childCarrier = nodes(owner, '__Common__').find(node => node.margin !== undefined);
        assert.equal(childCarrier.margin.left, 8);
        const pad = button.padding, border = button.border.width;
        const actualLabelLane = Math.min(label.constraintSize.maxWidth,
          Math.max(1, button.width - pad.left - pad.right - 2 * border - track.width - childCarrier.margin.left));
        near(textMeasure.constraintWidth, actualLabelLane, 'actual follow native label width');
        const actualLabelHeight = port.line(textMeasure) * Math.ceil(port.advance(textMeasure) / actualLabelLane);
        near(label.height, Math.max(13, actualLabelHeight), 'actual wrapped follow label height');
        const requiredRowHeight = Math.max(36, actualLabelHeight + pad.top + pad.bottom + 2 * border,
          track.height + pad.top + pad.bottom + 2 * border);
        near(button.height, requiredRowHeight, 'actual follow native vertical padding and border');
        return { height: button.height, fits: profile.minimum.full.fits };
      }
      let samples = 0;
      for (const width of [320, 366]) for (const scale of [1, 1.3, 1.6, 2]) { verify(actual, scale, width); samples++; }
      assert.equal(verify(actual, 1, 338).height, 38, 'the real twenty-four-vp switch plus native row chrome needs thirty-eight vp');
      const enlarged = verify(actual, 2, 338);
      assert.equal(enlarged.height, 40, 'two-times text pays both border pixels vertically');
      const oldSource = source.replace('const followBorder = 2 * TOK_BORDER_W;', 'const followBorder = 0;')
        .replace('const followSwitchWidth = 44;', 'const followSwitchWidth = 42;');
      assert.notEqual(oldSource, source);
      assert.throws(() => verify(pure('ReaderControlAutoPageMinimum.ets', ['measureReaderControlAutoPageMinimum'], oldSource), 2, 338),
        /actual follow native label width/, 'old border and forty-two-vp switch accounting fail against actual child requests');
      console.log(JSON.stringify({ kind: id, samples: samples + 2, oldProducerRejected: true, nativeLayout: 'NOT_RUN' }));
    }
    recordContractCasePass(id);
  }
}
