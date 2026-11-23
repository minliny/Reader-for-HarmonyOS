import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const definitions = {
  'private-text-content-box': {
    description: 'Actual Appearance theme actions and TTS format/manage native Buttons pay their fixed Text content inside real borders.',
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
  const sourceRoot = '../entry/src/main/ets/features/reading/ui/';
  const read = name => readFileSync(new URL(sourceRoot + name, import.meta.url), 'utf8');
  const appearanceSource = read('ReaderControlAppearanceContent.ets');
  const appearanceMinimumSource = read('ReaderControlAppearanceMinimum.ets');
  const overlaySource = read('ReaderTtsConfigOverlay.ets');
  const appearanceState = await import('../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts');
  const appearanceStyle = await import('../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceStyle.ts');
  const appearanceGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceGeometry.ts');
  const renderStyle = await import('../entry/src/main/ets/features/reading/ui/ReaderAppearanceRenderStyle.ts');
  const classes = selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets', import.meta.url),
    ['ReaderTextStyle']);
  const measurement = pureModuleProbe(read('ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets',
    { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
  const dependencies = { ...readerFoundationTokens, ...readerTypographyRoles, ...classes, ...measurement,
    ...appearanceState, ...appearanceStyle, ...appearanceGeometry, readerAppColor };
  const exports = ['measureReaderControlAppearanceMinimum', 'readerControlAppearanceMinimumFacts',
    'readerControlAppearanceThemeActionLabel'];
  const minimum = source => pureModuleProbe(source, 'ReaderControlAppearanceMinimum.ets', dependencies, exports);
  const nodes = (owner, type) => [...owner.nodes.values()].filter(node => node.type === type);
  const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual}/${expected}`);

  // This controlled platform seam supplies text extents. SDK lowering emits
  // the actual parent/child attributes. It does not solve native layout.
  function metrics(scale) {
    const calls = [];
    const advance = options => [...options.textContent].reduce((sum, character) =>
      sum + (/\p{Script=Han}/u.test(character) ? 1 : .55), 0) * Number.parseFloat(options.fontSize) * scale;
    const lineHeight = options => Number.parseFloat(options.lineHeight ?? options.fontSize) * scale *
      (options.lineHeight ? 1 : 1.5);
    return { calls, context: { px2vp: value => value, getMeasureUtils: () => ({
      measureText: advance,
      measureTextSize(options) {
        calls.push({ ...options });
        const natural = advance(options);
        return { width: Math.min(natural, options.constraintWidth),
          height: lineHeight(options) * (options.maxLines === 1 ? 1 : Math.ceil(natural / options.constraintWidth)) };
      },
    }) } };
  }

  function verifyTheme(scale, width, activeTheme, day, source = appearanceSource, producer = appearanceMinimumSource) {
    const platform = metrics(scale);
    const measured = minimum(producer);
    const snapshot = { ...appearanceState.createDefaultReaderAppearanceSnapshot(), activeTheme };
    const order = appearanceState.normalizeReaderAppearanceFontOrder(snapshot.fontOrder);
    const fonts = order.map(font => ({ label: renderStyle.readerAppearanceFontSlotLabel(snapshot, font),
      family: renderStyle.readerAppearanceFontSlotFamily(snapshot, font) }));
    const facts = measured.readerControlAppearanceMinimumFacts({ snapshot, fonts, chineseConversionMode: 'none' });
    const widths = { panelWidthVp: width + 26, quickContentWidthVp: width - 52, fullContentWidthVp: width };
    const profile = measured.measureReaderControlAppearanceMinimum(platform.context, widths, facts)?.profile;
    assert.ok(profile);
    const frame = appearanceGeometry.sampleReaderControlAppearance(1, width, 600, facts.themes.length, fonts.length, profile);
    const owner = createReaderBuilderProbe(source, ['themeAction', 'defaultThemeActionLabel'],
      { ...dependencies, ...measured }).owner;
    Object.assign(owner, { appThemeScheme: 'day', motionProgress: 1, displaySnapshot: () => snapshot,
      minimumProfile: () => profile, frame: () => frame, actorPosition: actor => ({ x: actor.x, y: actor.y }),
      presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), fullInput: () => true, requestDefaultTheme() {} });
    owner.themeAction(day);
    const button = nodes(owner, 'Button')[0];
    const text = nodes(owner, 'Text')[0];
    const border = button.border.width;
    near(button.width, 74, 'authored outer action width');
    near(text.width, button.width - border * 2, 'theme Text pays both horizontal border edges');
    near(text.height, button.height - border * 2, 'theme Text pays both vertical border edges');
    assert.ok(button.position.x + button.width <= width, 'both actual action boxes remain in the full viewport');
    const extent = measurement.measureReaderControlText(platform.context, text.create,
      readerTypographyRoles.TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE, text.width, 'wrap');
    assert.ok(extent.heightVp <= text.height, 'measured wrapped glyph height fits the actual inner Text request');
    assert.equal(text.maxLines, undefined, 'existing wrapped-text policy remains');
    assert.equal(text.fontFamily, readerTypographyRoles.TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE.fontFamily);
    assert.equal(text.fontSize, readerTypographyRoles.TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE.fontSizeFp);
    if (scale === 1) near(button.height, 28, 'default outer action paint height');
    const actor = day ? frame.themeDayAction : frame.themeNightAction;
    near(actor.height, button.height, 'same producer height feeds action geometry');
    assert.ok(frame.divider.y >= actor.y + actor.height + 9, 'divider follows actual outer action height');
    return { button, text };
  }

  function verifyConfiguration(scale, width, busy, source = overlaySource) {
    const platform = metrics(scale);
    const owner = createReaderBuilderProbe(source, ['managerForm', 'formatChoice', 'formatActionHeight'], dependencies).owner;
    Object.assign(owner, { appThemeScheme: 'day', metricsRevision: 1, busy,
      getUIContext: () => platform.context, panelWidth: () => width,
      draftName: '', draftUrl: '', draftApiKey: '', draftVoice: '', draftFormat: 'mp3', errorText: '' });
    owner.managerForm();
    const form = nodes(owner, 'Column').find(node => node.id === 'reader-tts-manager-form');
    const row = nodes(owner, 'Row').find(node => node.create?.space === 8);
    const buttons = nodes(owner, 'Button').filter(node => node.layoutWeight === 1);
    assert.equal(buttons.length, 3, 'actual managerForm emits all format Buttons');
    const outerWidth = (width - form.padding.left - form.padding.right - row.create.space * 2) / buttons.length;
    for (const [index, label] of ['MP3', 'WAV', 'PCM'].entries()) {
      const button = buttons[index];
      const text = nodes(owner, 'Text').find(node => node.create === label);
      assert.equal(button.layoutWeight, 1);
      assert.equal(text.width, '100%', 'format width is relative to the Button content box');
      near(text.height, button.height - button.border.width * 2, 'format Text pays both vertical border edges');
      const extent = measurement.measureReaderControlText(platform.context, label,
        readerTypographyRoles.TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL, outerWidth - button.border.width * 2);
      assert.ok(extent.heightVp <= text.height, 'format natural font extent fits its inner height at the current scale');
      assert.ok(extent.singleLineWidthVp <= outerWidth - button.border.width * 2, 'format label fits actual weighted inner width');
      assert.equal(button.enabled, !busy);
    }
    const formatMeasure = platform.calls.find(call => call.textContent === 'MP3');
    near(formatMeasure.constraintWidth, outerWidth - buttons[0].border.width * 2,
      'format producer measures the actual weighted Button content width');

    const picker = createReaderBuilderProbe(source, ['configurationBody', 'configurationStatus'], dependencies).owner;
    Object.assign(picker, { manager: false, choices: [], showManage: true, busy, errorText: '', appThemeScheme: 'day',
      statusMessage: () => '', onManage() {}, selectionId: 'current' });
    picker.configurationBody();
    const manageButton = nodes(picker, 'Button')[0];
    const manageText = nodes(picker, 'Text')[0];
    near(manageText.height, manageButton.height - manageButton.border.width.top,
      'manage Text pays its only top border');
    assert.equal(manageText.width, '100%');
    const manageExtent = measurement.measureReaderControlText(platform.context, manageText.create,
      readerTypographyRoles.TYPE_READER_TTS_CONFIG_BUILD_LABEL, width);
    assert.ok(manageExtent.heightVp <= manageText.height, 'manage natural font height remains paid at2x');
    assert.ok(manageExtent.singleLineWidthVp <= width, 'manage label fits its actual picker width');
    assert.equal(manageButton.height, 44);
    assert.equal(manageButton.enabled, !busy);
  }

  let themeButtons = 0;
  let configurationSamples = 0;
  for (const scale of [1, 1.3, 1.6, 2]) {
    for (const width of [220, 1104 / 3.5, 320, 366]) {
      for (const activeTheme of ['day', 'night']) for (const day of [true, false]) {
        verifyTheme(scale, width, activeTheme, day);
        themeButtons++;
      }
      for (const busy of [false, true]) {
        verifyConfiguration(scale, width, busy);
        configurationSamples++;
      }
    }
  }
  const oldTheme = appearanceSource.replace('.width(Math.max(0, 74 - TOK_BORDER_W * 2))\n      .height(Math.max(0, (this.minimumProfile()?.themeActionHeight ?? 28) - TOK_BORDER_W * 2))',
    '.width(74).height(this.minimumProfile()?.themeActionHeight ?? 28)');
  assert.notEqual(oldTheme, appearanceSource);
  assert.throws(() => verifyTheme(1, 320, 'day', true, oldTheme), /horizontal border/);
  const oldMinimum = appearanceMinimumSource.replace('Math.ceil(action.heightVp) + TOK_BORDER_W * 2', 'Math.ceil(action.heightVp)');
  assert.notEqual(oldMinimum, appearanceMinimumSource);
  assert.throws(() => verifyTheme(2, 320, 'day', false, appearanceSource, oldMinimum), /wrapped glyph height/);
  const oldFormat = overlaySource.replace('.height(Math.max(0, this.formatActionHeight() - 1))', '.height(this.formatActionHeight())');
  assert.notEqual(oldFormat, overlaySource);
  assert.throws(() => verifyConfiguration(1, 320, false, oldFormat), /format Text pays/);
  const oldManage = overlaySource.replace("Text('管理在线 TTS').width('100%').height(43.5)", "Text('管理在线 TTS').width('100%').height(44)");
  assert.notEqual(oldManage, overlaySource);
  assert.throws(() => verifyConfiguration(1, 320, false, oldManage), /manage Text pays/);
  console.log(JSON.stringify({ kind: id, themeButtons, configurationSamples, formatButtons: configurationSamples * 3,
    manageButtons: configurationSamples, rejectedOldConsumers: 3, rejectedMissingBorderProducer: 1,
    actualBuilders: ['Appearance.themeAction', 'TtsConfig.managerForm→formatChoice', 'TtsConfig.configurationBody'],
    boundary: 'Actual SDK parent/child declarations and production measurement with controlled text extents; Native layout/glyph/events NOT_RUN' }));
  recordContractCasePass(id);
}
