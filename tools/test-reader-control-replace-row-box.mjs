import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const definitions = {
  'replace-row-content-box': {
    description: 'Actual Quick and Full replacement rows pay native borders before their name, metadata, switch and trailing action boxes.',
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
  const uiPath = '../entry/src/main/ets/features/reading/ui/';
  const read = name => readFileSync(new URL(uiPath + name, import.meta.url), 'utf8');
  const contentSource = read('ReaderControlReplaceContent.ets');
  const minimumSource = read('ReaderControlReplaceMinimum.ets');
  const geometrySource = read('ReaderControlReplaceGeometry.ts');
  const geometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlReplaceGeometry.ts');
  const actorGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts');
  const classes = selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets', import.meta.url),
    ['ReaderTextStyle']);
  const measurement = pureModuleProbe(read('ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets',
    { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
  const properties = createArkUIPropertyRuntimeProbe();
  const dependencies = { ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles, ...classes,
    ...measurement, ...actorGeometry, ...geometry, readerAppColor };
  const producer = source => pureModuleProbe(source, 'ReaderControlReplaceMinimum.ets', dependencies,
    ['measureReaderControlReplaceMinimum']);
  const sampler = source => pureModuleProbe(source, 'ReaderControlReplaceGeometry.ts', dependencies,
    ['sampleReaderControlReplace']);
  const currentProducer = producer(minimumSource);
  const switchSource = read('ReaderControlSwitchTrack.ets');
  const Switch = createReaderBuilderProbe(switchSource,
    ['build', 'appThemeScheme', 'value', 'trackWidth', 'trackHeight', 'thumbSize', 'thumbInset',
      'activeColor', 'inactiveColor', 'thumbColor'], dependencies, properties.hooks).Component;
  const nodes = (owner, type) => [...owner.nodes.values()].filter(node => node.type === type);
  const near = (actual, expected, why) => assert.ok(Math.abs(actual - expected) < 1e-7,
    `${why}: ${actual} / ${expected}`);

  // A finite platform text seam. Actual SDK Builders supply all native row,
  // border and child dimensions. This does not implement a native solver.
  function metrics(scale) {
    const advance = options => [...options.textContent].reduce((sum, char) =>
      sum + (/\p{Script=Han}/u.test(char) ? 1 : .55), 0) * Number.parseFloat(options.fontSize) * scale;
    return { px2vp: value => value, getMeasureUtils: () => ({
      measureText: advance,
      measureTextSize(options) {
        const width = Math.max(1, advance(options));
        const line = Number.parseFloat(options.lineHeight ?? options.fontSize) * scale * (options.lineHeight ? 1 : 1.5);
        return { width: Math.min(width, options.constraintWidth), height: line *
          (options.maxLines === 1 ? 1 : Math.ceil(width / options.constraintWidth)) };
      },
    }) };
  }

  const rule = { id: 17, name: '替换规则', isEnabled: true, pattern: '原文', replacement: '替换',
    scope: '全部书籍', scopeTitle: false, scopeContent: true, scopeSource: false, isRegex: false };
  function profileAt(scale, width, module = currentProducer) {
    const profile = module.measureReaderControlReplaceMinimum(metrics(scale), {
      panelWidthVp: width + 26, quickContentWidthVp: width - 52, fullContentWidthVp: width,
    }, '', '', rule.name, '原文 → 替换', '全部书籍 · 正文 纯文本', '编辑替换规则', false);
    assert.ok(profile, 'actual replacement producer returns both endpoint profiles');
    return profile;
  }

  function verify(scale, width, progress, { module = currentProducer, sample = geometry.sampleReaderControlReplace,
    source = contentSource, requirePaidProducer = true } = {}) {
    const profile = profileAt(scale, width, module);
    const actualWidth = progress === 0 ? width - 52 : width;
    const frame = sample(progress, actualWidth, progress === 0 ? 190 : 666, profile);
    const owner = createReaderBuilderProbe(source, ['ruleRow', 'ruleIcon', 'scopeSummary'],
      { ...dependencies, ReaderControlSwitchTrack: Switch },
      { ...properties.hooks, mountChildren: true, childSources: { ReaderControlSwitchTrack: switchSource } }).owner;
    Object.assign(owner, { state: { sessionKey: 'row-owner' }, layer: '', appThemeScheme: 'day',
      frame: () => frame, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
      readyInput: () => true, fullInput: () => progress === 1, quickInput: () => progress === 0,
      rowClip: () => undefined, currentRule: value => value, openEditor() {}, askDelete() {}, perform() {} });
    owner.ruleRow(() => rule, () => 0);
    const outer = nodes(owner, 'Stack').find(node => node.border?.width === readerFoundationTokens.TOK_BORDER_W);
    const inner = nodes(owner, 'Stack').find(node => node !== outer);
    assert.ok(outer && inner, 'actual bordered outer row and its actual inner painting Stack mount');
    const border = outer.border.width;
    near(profile.rowBorderWidth, border, 'prepared profile style is the actual native border');
    near(inner.width, outer.width - border * 2, 'inner Stack width pays both native border edges');
    near(inner.height, outer.height - border * 2, 'inner Stack height pays both native border edges');
    const name = nodes(owner, 'Text').find(node => node.create === rule.name);
    const meta = nodes(owner, 'Column')[0];
    const toggle = nodes(owner, 'Button').find(node => node.width === frame.toggleWidth);
    const trailing = nodes(owner, 'Row').find(node => node.width === 93);
    assert.ok(name && meta && toggle && trailing, 'actual name, metadata, switch carrier and two-action carrier mount');
    assert.equal(name.maxLines, 1);
    assert.equal(name.textOverflow.overflow, 'TextOverflow.Ellipsis');
    assert.ok(name.position.x >= 0 && name.position.x + name.width <= inner.width + 1e-7,
      'name horizontal lane stays inside the actual bordered content box');
    assert.ok(name.position.y >= -1e-7 && name.position.y + name.height <= inner.height + 1e-7,
      'name vertical lane stays inside the actual bordered content box');
    near(toggle.height, inner.height, 'switch carrier uses the bordered inner height');
    assert.equal(toggle.padding, 0);
    const track = [...owner.children.values()].find(child => child instanceof Switch);
    assert.ok(track, 'actual shared SwitchTrack mounts in the actual rule row');
    assert.equal(nodes(track, 'Stack')[0].height, frame.toggleHeight);
    assert.ok(frame.toggleHeight <= toggle.height, 'actual switch paint fits its carrier');
    near(name.position.y + name.height / 2, progress === 0 ? inner.height / 2 : 11 + name.height / 2,
      'Quick name is centered in the inner box and Full keeps its original top offset');
    if (progress === 1) {
      assert.ok(meta.position.y + meta.height <= inner.height + 1e-7,
        'Full name and metadata natural height pays the native borders');
      assert.ok(meta.position.x + meta.width <= inner.width + 1e-7);
      near(trailing.position.y + trailing.height / 2, inner.height / 2,
        'Full trailing44 carrier is centered in the actual inner row');
      assert.ok(trailing.position.x + trailing.width <= inner.width + 1e-7);
      assert.ok(trailing.position.y >= 0 && trailing.position.y + trailing.height <= inner.height + 1e-7);
      const actionButtons = nodes(owner, 'Button').filter(node => node.width === 44 && node.height === 44);
      assert.equal(actionButtons.length, 2, 'both original edit/delete44 carriers remain');
    } else {
      assert.equal(trailing.opacity, 0, 'Full-only actions keep their original hidden Quick projection');
      assert.equal(trailing.hitTestBehavior, 'HitTestMode.None');
      assert.equal(meta.opacity, 0, 'Full-only metadata keeps its original hidden Quick projection');
    }
    if (requirePaidProducer) {
      const q = profile.quick, f = profile.full;
      assert.ok(q.rowHeight >= q.nameHeight + border * 2, 'Quick producer pays native border around natural name');
      assert.ok(f.rowHeight >= 11 + f.nameHeight + 4 + f.metaHeight + border * 2,
        'Full producer pays native border around natural name and metadata');
    }
    return { profile, frame };
  }

  let samples = 0;
  for (const scale of [1, 1.3, 1.6, 2]) for (const width of [230, 286, 338]) {
    for (const progress of [0, 1]) {
      verify(scale, width, progress);
      samples++;
    }
  }
  const ordinary = profileAt(1, 338);
  assert.equal(ordinary.quick.rowHeight, 28, 'original default Quick outer row remains28');
  assert.equal(ordinary.full.rowHeight, 77, 'original default Full outer row remains77');
  for (const profile of [undefined, { quick: ordinary.quick, full: ordinary.full }]) {
    for (const progress of [0, .25, .5, .75, 1]) {
      const frame = geometry.sampleReaderControlReplace(progress, 338, 666, profile);
      assert.ok(Number.isFinite(frame.nameY) && Number.isFinite(frame.rowInnerHeight));
      near(frame.rowInnerHeight, frame.rowHeight - 2, 'legacy absent style facts retain the actual one-vp border default');
    }
  }

  const oldQuick = minimumSource.replace('Math.max(28, nameHeight + TOK_BORDER_W * 2)', 'Math.max(28, nameHeight)');
  assert.notEqual(oldQuick, minimumSource);
  assert.throws(() => verify(2, 338, 0, { module: producer(oldQuick) }), /name vertical lane|Quick producer pays/);
  const oldFull = minimumSource.replace('11 + nameHeight + 4 + metaHeight + TOK_BORDER_W * 2', '11 + nameHeight + 4 + metaHeight');
  assert.notEqual(oldFull, minimumSource);
  assert.throws(() => verify(2, 338, 1, { module: producer(oldFull) }), /Full name and metadata|Full producer pays/);
  const oldCenter = geometrySource.replace('- rowBorderWidth * 2 - (q?.nameHeight ?? 17)', '- (q?.nameHeight ?? 17)');
  assert.notEqual(oldCenter, geometrySource);
  assert.throws(() => verify(2, 338, 0, { sample: sampler(oldCenter).sampleReaderControlReplace }), /name vertical lane|Quick name is centered/);
  const oldInner = contentSource.replace('}.width(Math.max(0, this.frame().list.width - TOK_BORDER_W * 2)).height(this.frame().rowInnerHeight)',
    '}.width(this.frame().list.width).height(this.frame().rowHeight)');
  assert.notEqual(oldInner, contentSource);
  assert.throws(() => verify(1, 338, 1, { source: oldInner }), /inner Stack width pays/);
  console.log(JSON.stringify({ kind: id, samples, defaultRows: [28, 77], nativeRowBorder: 1,
    realChild: 'ruleRow→ReaderControlSwitchTrack and edit/delete Buttons',
    rejectedOldQuickProducer: true, rejectedOldFullProducer: true, rejectedOldQuickCenter: true,
    rejectedOldInnerStack: true, legacyProfiles: 10,
    boundary: 'Actual SDK declarations and controlled text extents. Native layout/glyph/hit NOT_RUN.' }));
  recordContractCasePass(id);
}
