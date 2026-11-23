import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles, readerMessageStyles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const definitions = {
  'service-manage-border': {
    description: 'Actual TTS service-card manage Button pays its configured border in the captured-facts geometry and complete native Row composition.',
    resources: [],
  },
};

for (const id of selectContractCases(definitions)) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
        return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const root = '../entry/src/main/ets/features/reading/ui/';
  const read = name => readFileSync(new URL(root + name, import.meta.url), 'utf8');
  const source = read('ReaderControlTtsContent.ets');
  const minimumSource = read('ReaderControlTtsMinimum.ets');
  const state = await import('../entry/src/main/ets/features/reading/application/ReaderTtsState.ts');
  const options = await import('../entry/src/main/ets/features/reading/presentation/ReaderTtsConfigOptions.ts');
  const geometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
  const actor = await import('../entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts');
  const classes = selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets', import.meta.url),
    ['ReaderTextStyle', 'ReaderInheritedTextStyle']);
  const measure = pureModuleProbe(read('ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets',
    { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
  const deps = { ...readerFoundationTokens, ...readerTypographyRoles, ...readerMessageStyles,
    ...classes, ...measure, ...state, ...options, ...geometry, ...actor, readerAppColor };
  const pure = text => pureModuleProbe(text, 'ReaderControlTtsMinimum.ets', deps,
    ['readerControlTtsMinimumFacts', 'measureReaderTtsMinimum']);
  const current = pure(minimumSource);
  const signatures = pureModuleProbe(read('ReaderControlMinimumMeasurement.ets'), 'ReaderControlMinimumMeasurement.ets', {},
    ['readerControlModuleFactsGeometryKey']);
  const nodes = (owner, type) => [...owner.nodes.values()].filter(node => node.type === type);
  const near = (actual, expected, why) => assert.ok(Math.abs(actual - expected) < 1e-8, `${why}: ${actual}/${expected}`);

  function platform(scale) {
    const calls = [];
    const advance = options => [...options.textContent].reduce((sum, character) =>
      sum + (/\p{Script=Han}/u.test(character) ? 1 : .55), 0) * Number.parseFloat(options.fontSize) * scale;
    const line = options => Number.parseFloat(options.lineHeight ?? options.fontSize) * scale *
      (options.lineHeight ? 1 : 1.5);
    return { calls, context: { px2vp: value => value, getMeasureUtils: () => ({
      measureText: advance,
      measureTextSize(options) {
        calls.push({ ...options });
        const width = advance(options);
        return { width: Math.min(width, options.constraintWidth),
          height: line(options) * (options.maxLines === 1 ? 1 : Math.ceil(width / options.constraintWidth)) };
      },
    }) } };
  }

  function facts(configured) {
    return current.readerControlTtsMinimumFacts({ state: state.createReaderTtsState(true),
      timerMode: 'off', timerMinutes: 0, timerSeconds: 0, failurePolicy: 'stop', allowMixing: false,
      engine: 'system', httpEngines: configured ? [{ id: 1, name: 'Current service' }] : [],
      voiceOptions: [], language: 'zh-CN', person: 0, ratePreview: -1, serviceTab: 'online' });
  }

  function check(scale, width, configured, busy, producer = minimumSource, legacy = false) {
    const metric = platform(scale);
    const snapshot = facts(configured);
    if (legacy) delete snapshot.manageBorderWidth;
    const module = pure(producer);
    const profile = module.measureReaderTtsMinimum(metric.context,
      { panelWidthVp: width + 26, quickContentWidthVp: width - 52, fullContentWidthVp: width }, snapshot);
    assert.ok(profile);
    const owner = createReaderBuilderProbe(source, ['onlineServiceInfoRow', 'manageConfigured'], deps).owner;
    // Opposite live engines are deliberate. All passive manage paint must
    // continue to use its accepted facts; busy still has its live owner.
    Object.assign(owner, { appScheme: 'day', httpEngines: configured ? [] : [{}],
      displayedFacts: () => legacy ? undefined : snapshot, textMinimum: () => profile.fullText,
      fullInput: () => true, serviceBusy: busy, configFocusId: 'current', openConfiguration() {} });
    if (legacy) owner.httpEngines = configured ? [{}] : [];
    owner.onlineServiceInfoRow();
    const button = nodes(owner, 'Button')[0];
    const row = nodes(owner, 'Row').find(node => node.create?.space === 6);
    const image = nodes(owner, 'Image')[0];
    const text = nodes(owner, 'Text').find(node => node.create === snapshot.manageLabel);
    assert.ok(button && row && image && text);
    const border = configured ? .5 : 0;
    near(button.border.width, border, 'native border follows the accepted facts');
    const reserve = button.padding.left + button.padding.right + row.create.space + image.width + border * 2;
    near(reserve, configured ? 39 : 38, 'independently summed actual Row deductions');
    const textWidth = button.width - reserve;
    const usedReserve = legacy ? 39 : reserve;
    const measuredCall = metric.calls.findLast(call => call.textContent === snapshot.manageLabel && call.maxLines === undefined);
    assert.ok(measuredCall, 'actual serviceAction wrapped measurement is emitted');
    near(measuredCall.constraintWidth, Math.max(1, button.width - usedReserve),
      'producer measures the real accepted content width');
    const extent = measure.measureReaderControlText(metric.context, snapshot.manageLabel,
      readerTypographyRoles.TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE, textWidth, 'wrap');
    assert.ok(extent.heightVp <= button.height - border * 2,
      'actual native Button inner height pays the actual residual-width text wrap');
    const natural = measure.measureReaderControlText(metric.context, snapshot.manageLabel,
      readerTypographyRoles.TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE, width);
    if (scale === 1 && width >= 320) near(button.width, natural.singleLineWidthVp + usedReserve,
      'uncapped width includes precisely its own branch border');
    assert.equal(button.enabled, !busy);
    assert.equal(button.backgroundColor, readerAppColor(configured ? 'app.control.paint.1A2F6373' : 'TOK_TTS_TEAL', 'day'));
    assert.equal(text.fontColor, readerAppColor(configured ? 'TOK_TTS_TEAL' : 'app.control.paint.FFFAF4', 'day'));
    assert.equal(button.accessibilityText, configured ? '已配置在线 TTS，编辑服务信息' : '立即配置在线 TTS');
    assert.ok(JSON.stringify(image.create).includes(configured ? 'reader_appearance_make_chevron' : 'reader_tts_configure_chevron'));
    return snapshot;
  }

  let samples = 0;
  for (const scale of [1, 1.3, 1.6, 2]) for (const width of [220, 1104 / 3.5, 320, 366]) {
    for (const configured of [false, true]) for (const busy of [false, true]) {
      check(scale, width, configured, busy);
      samples++;
    }
  }
  check(2, 320, false, false, minimumSource, true);
  check(2, 320, true, false, minimumSource, true);
  const base = facts(true);
  const changed = { ...base, manageBorderWidth: 0 };
  assert.notEqual(signatures.readerControlModuleFactsGeometryKey({ module: 'tts', tts: base }),
    signatures.readerControlModuleFactsGeometryKey({ module: 'tts', tts: changed }),
    'border-only facts changes participate in the actual geometry signature');
  const oldWidth = minimumSource.replace('manage.singleLineWidthVp + manageHorizontalReserve', 'manage.singleLineWidthVp + 38');
  assert.notEqual(oldWidth, minimumSource);
  assert.throws(() => check(1, 366, true, false, oldWidth), /uncapped width/);
  const oldResidual = minimumSource.replace('text.manageButtonWidth - manageHorizontalReserve', 'text.manageButtonWidth - 38');
  assert.notEqual(oldResidual, minimumSource);
  assert.throws(() => check(2, 220, true, false, oldResidual), /real accepted content width/);
  console.log(JSON.stringify({ kind: id, samples, configuredStates: 2, legacyCases: 2,
    oldConfiguredWidthRejected: true, oldResidualMeasureRejected: true, geometrySignature: 'actual border-only key change',
    actualBuilder: 'Tts.onlineServiceInfoRow', rawSuccessorStyleIsolation: true,
    boundary: 'Actual SDK Row/Button/Text declarations and production facts/measurer with controlled font extents; Native glyph/layout/events NOT_RUN' }));
  recordContractCasePass(id);
}
