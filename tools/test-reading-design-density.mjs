import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerDirectoryToolbarBudget } from '../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts';
import * as controlGeometry from '../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
for (const id of selectContractCases({ normal: { description: 'Independent normal directory header/tab paint recipes with separately paid44vp carriers and growing typography', resources: [] } })) {
  let scale = 1, collapsed = 0;
  const surface = pureModuleProbe(read('ui/foundation/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale', 'readerScaledControlHeight']);
  const measurement = pureModuleProbe(read('features/reading/ui/ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets', { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
  const context = { px2vp: n => n, getMeasureUtils: () => ({
    measureText: o => [...o.textContent].length * Number.parseFloat(o.fontSize) * scale,
    measureTextSize: o => ({ width: Math.min(o.constraintWidth, [...o.textContent].length * Number.parseFloat(o.fontSize) * scale), height: Number.parseFloat(o.lineHeight ?? o.fontSize) * scale })
  }) };
  const typographySource = read('ui/foundation/ReaderTypography.ets');
  const classes = pureModuleProbe(typographySource.slice(0, typographySource.indexOf('export const TYPE_')), 'ReaderTypographyClasses.ets', {}, ['ReaderInheritedTextStyle']);
  const deps = { ...classes, ...controlGeometry, ...readerTypographyRoles, ...readerFoundationTokens, ...measurement, ...surface, readerAppColor,
    readerWindowMetrics: () => ({ systemFontScale: scale }) };
  const { measureReaderControlMinimum } = pureModuleProbe(read('features/reading/ui/ReaderControlMinimumMeasurement.ets'), 'ReaderControlMinimumMeasurement.ets', deps, ['measureReaderControlMinimum']);
  const profile = () => measureReaderControlMinimum({ context, headerInter: false, title: '目录', identity: 'current', metricsRevision: 1,
    topBarHeightVp: 54, measureHomeForm: () => undefined }, 'directory', { panelWidthVp: 364, quickContentWidthVp: 286, fullContentWidthVp: 338 }, 'current',
    () => ({ module: 'directory', quick: { heightVp: 100, minWidthVp: 200, fits: true }, full: { heightVp: 200, minWidthVp: 200, fits: true } })).profile;
  for (scale of [1, 2]) {
    const minimum = profile();
    assert.equal(minimum.headerHeight, scale === 1 ? 44 : 50);
    const { owner } = createReaderBuilderProbe(read('features/reading/ui/ReaderControlPanel.ets'), ['controlHeader'], deps);
    Object.assign(owner, { appScheme: 'day', contentLocation: () => ({ module: 'directory' }), headerInter: () => false,
      headerFrame: () => ({ x: 0, y: 0, width: 338, height: minimum.headerHeight }), selectedMinimumProfile: () => minimum,
      headerIcon: () => 'directory-icon', contentTitle: () => '目录', collapseControl: () => collapsed++ });
    owner.controlHeader();
    const nodes = [...owner.nodes.values()];
    const button = nodes.find(n => n.type === 'Button');
    assert.equal(button.height, minimum.headerHeight); assert.ok(button.width >= 44);
    assert.deepEqual(button.position, { x: 338 - minimum.collapseWidth, y: 0 });
    const paint = nodes.find(n => n.type === 'Stack' && n.backgroundColor !== undefined);
    if (scale === 1) { assert.equal(paint.width, 40); assert.equal(paint.height, 26); }
    button.onClick();
  }
  assert.equal(collapsed, 2);
  const directory = pureModuleProbe(read('features/reading/ui/ReaderControlDirectoryMinimum.ets'), 'ReaderControlDirectoryMinimum.ets', {
    ...deps, readerDirectoryToolbarBudget
  }, ['measureReaderDirectoryMinimum']);
  for (scale of [1, 2]) {
    const result = directory.measureReaderDirectoryMinimum(context, { quickContentWidthVp: 286, fullContentWidthVp: 338 }, {
      tab: 'bookmarks', title: '', excerpt: '', currentTitle: '', currentPosition: '', hasRows: false, loading: false,
      message: '请稍后重试。', action: '重试', bookmarkError: true, catalogStatus: '', catalogAction: '' });
    // Approved reading-state recipe, independently assembled from typography
    // and literal padding/gaps, not the production directory formula.
    const extent = style => Number.parseFloat(style.lineHeightFp ?? style.fontSizeFp) * scale;
    const expected = extent(readerTypographyRoles.MESSAGE_TITLE) + 9 + extent(readerTypographyRoles.MESSAGE_BODY) + 23 +
      Math.max(44, extent(readerTypographyRoles.MESSAGE_ACTION) + 20) + 60;
    assert.equal(result.full.minimum.heightVp - result.full.listTopVp - 1, expected);
  }
  const accessibility = pureModuleProbe(read('ui/controls/ReaderActionAccessibility.ets'), 'ReaderActionAccessibility.ets', { AccessibilityRoleType: { BUTTON: 'button' } }, ['ReaderActionAccessibility', 'readerActionTouchRegion']);
  for (const progress of [0, 1]) {
    scale = 1;
    const { owner } = createReaderBuilderProbe(read('features/reading/ui/ReaderControlDirectoryContent.ets'), ['tabButton', 'tabHeight', 'value'], { ...deps, ...accessibility, DEBUG: false });
    Object.assign(owner, { progress, appThemeScheme: 'day', tab: 'directory', layoutPresentation: 7,
      selectedMinimum: () => undefined, fontScale: () => scale, tabWidth: () => 160,
      presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), tabsInteractive: () => true,
      currentContent: p => p === 7, onTabChange() {} });
    owner.tabButton('directory', '目录');
    const nodes = [...owner.nodes.values()];
    assert.equal(nodes.find(n => n.type === 'Button').height, 44);
    const paint = nodes.find(n => n.type === 'Stack');
    assert.equal(paint.height, progress === 0 ? 31 : 36);
  }
  recordContractCasePass(id);
}
