import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'floating-tab': {
    description: 'Actual SDK bottom/rail labels use centred single-line text and growable containers; floating paper is opaque in Day/Night',
    resources: [],
  },
  'shelf-capsules': {
    description: 'Actual SDK shelf filter chips/update badges own centred containers, one CJK face and explicit line heights; callbacks preserved',
    resources: [],
  },
};
const source = file => readFileSync(new URL(`../entry/src/main/ets/${file}`, import.meta.url), 'utf8');

for (const id of selectContractCases(cases)) {
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
  const { createReaderComponentProbe: createReaderBuilderProbe } = await import('./lib/reader-component-probe.mjs');
  if (id === 'floating-tab') {
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
    const tokens = await import('../entry/src/main/ets/features/common/ReaderLayoutTokens.ts');
    const { isReaderMainTabEnabled } = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
    const scaling = pureModuleProbe(source('features/common/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {}, ['readerScaledControlHeight']);
    const heights = pureModuleProbe(source('features/common/ReaderFloatingBarMetrics.ts'), 'ReaderFloatingBarMetrics.ts',
      { ...tokens, ...scaling }, ['readerMainTabItemHeight', 'readerFloatingTabBarHeight']);
    const navigation = pureModuleProbe(source('features/shell/MainNavigationSpec.ts'), 'MainNavigationSpec.ts',
      { ...heights, isReaderMainTabEnabled }, ['MAIN_TABS', 'MAIN_TAB_RAIL_ITEM_GAP', 'MAIN_TAB_RAIL_PADDING', 'MAIN_TAB_RAIL_WIDTH', 'mainTabRailHeight']);
    class RaisedSurfacePort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
    const definition = source('features/shell/MainTabBar.ets');
    const verify = (text, fontScale) => {
      const events = [], properties = createArkUIPropertyRuntimeProbe();
      const { owner } = createReaderBuilderProbe(text, builderComponentMembers(text, 'MainTabBar'), {
        ...properties.sdk, ...navigation, ...heights, readerAppColor, ...readerTypographyRoles, TOK_BORDER_W: 1, TOK_SPACE_XS: 8,
        TOK_RADIUS_PILL: 999, ReaderRaisedSurface: RaisedSurfacePort,
        ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: fontScale }) },
      }, { ...properties.hooks, childSources: { ReaderRaisedSurface: source('features/common/ReaderRaisedSurface.ets') } });
      Object.assign(owner, { current: 'bookshelf', appThemeScheme: 'day', readerWindowMetricsRevision: 1,
        bottomBarFrame: () => ({ width: 196 }), bottomInset: () => 15, bottomBarTranslateX: () => 0, tabIcon: () => {},
        onSelect: key => events.push(['select', key]), onCurrentTap: key => events.push(['current', key]) });
      owner.bottomBar(); owner.verticalRail();
      for (const scheme of ['day', 'night']) {
      owner.appThemeScheme = scheme;
      owner.replay();
      const nodes = [...owner.nodes.values()];
      const tabs = nodes.filter(n => n.type === 'Text');
      assert.equal(tabs.length, 4, 'both bottom and rail render each current product tab');
      for (const tab of tabs) {
        assert.equal(tab.width, '100%');
        assert.equal(tab.textAlign, 'TextAlign.Center');
        assert.equal(tab.maxLines, 1);
        assert.equal(tab.fontFamily, readerTypographyRoles.TYPE_MAIN_TAB_LABEL.fontFamily);
      }
      const paper = nodes.find(n => n.type === 'Row' && n.backgroundColor === readerAppColor('app.navigation.floatingSurface', scheme));
      assert.ok(paper, 'actual bottom-bar paint node');
      assert.equal(paper.backgroundColor, readerAppColor('app.navigation.floatingSurface', scheme));
      assert.equal(paper.backgroundColor.slice(1, 3), 'FF', 'moving covers never show through the navigation paper');
      assert.ok(paper.constraintSize.minHeight >= 68);
      assert.ok(paper.constraintSize.minHeight >= 30 + 2 + tokens.MAIN_TAB_LABEL_LINE_HEIGHT * fontScale + 16,
        'actual scale input reserves the icon, label and bar padding');
      assert.equal(paper.height, undefined, 'larger text may grow the capsule');
      const controls = nodes.filter(n => n.type === 'Column' && n.accessibilityText);
      assert.equal(controls.length, 4);
      assert.ok(controls.every(n => n.justifyContent === 'FlexAlign.Center' &&
        n.alignItems === 'HorizontalAlign.Center' && n.height === undefined));
      for (const control of controls) {
        assert.ok(control.constraintSize.minHeight >= 30 + 2 + tokens.MAIN_TAB_LABEL_LINE_HEIGHT * fontScale);
        control.onClick();
      }
      assert.deepEqual(events.splice(0), [['current', 'bookshelf'], ['select', 'settings'], ['current', 'bookshelf'], ['select', 'settings']]);
      }
    };
    for (const scale of [1, 1.3, 1.6, 2]) {
      verify(definition, scale);
      verify(definition.replaceAll('tabItem', 'sharedTabContent'), scale);
    }
    assert.throws(() => verify(definition.replace('.textAlign(TextAlign.Center)', '.textAlign(TextAlign.Start)'), 1),
      /TextAlign/, 'losing the actual label alignment still fails');
  }
  if (id === 'shelf-capsules') {
    const { selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
    const { ReaderActionAccessibility } = selectedProductionClasses(new URL('../entry/src/main/ets/features/common/ReaderActionAccessibility.ets', import.meta.url),
      ['ReaderActionAccessibility'], { AccessibilityRoleType: { BUTTON: 'AccessibilityRoleType.BUTTON' } });
    const coverVisual = await import('../entry/src/main/ets/features/bookshelf/BookshelfCoverVisual.ts');
    const page = source('features/bookshelf/BookshelfPage.ets');
    for (const [dimension, value, label] of [
      ['content', 'all', '全部'], ['content', 'text', '小说'], ['content', 'manga', '漫画'],
      ['source', 'all', '全部'], ['source', 'local', '本地'], ['source', 'online', '在线'],
    ]) for (const selected of [false, true]) {
      let received;
      const { owner } = createReaderBuilderProbe(page, ['filterChip'], {
        readerAppColor, ReaderActionAccessibility, ...readerTypographyRoles, TOK_BORDER_W: 1, TOK_SPACE_XS: 8,
      });
      Object.assign(owner, { appThemeScheme: 'day', isFilterSelected: () => selected,
        selectFilter: (...args) => { received = args; } });
      owner.filterChip(dimension, value, label);
      for (const scheme of ['day', 'night']) {
        owner.appThemeScheme = scheme; owner.replay();
        const nodes = [...owner.nodes.values()];
        const text = nodes.find(n => n.type === 'Text');
        const frame = nodes.find(n => n.type === 'Row');
        assert.equal(text.create, label);
        assert.equal(text.fontFamily, readerTypographyRoles.TYPE_SHELF_FILTER_LABEL.fontFamily);
        assert.equal(text.lineHeight, 18);
        assert.equal(text.textAlign, 'TextAlign.Center');
        assert.equal(text.maxLines, 1);
        assert.equal(text.backgroundColor, undefined, 'the centred frame owns the outline');
        assert.equal(frame.justifyContent, 'FlexAlign.Center');
        assert.equal(frame.alignItems, 'VerticalAlign.Center');
        assert.equal(frame.borderRadius, 999);
        assert.equal(frame.height, undefined, 'caption line and symmetric padding own capsule height');
        assert.equal(frame.padding.top, frame.padding.bottom);
        assert.equal(text.fontColor, readerAppColor(selected ? 'TOK_ON_PRIMARY' : 'TOK_INK', scheme));
        frame.onClick(); assert.deepEqual(received, [dimension, value]);
      }
    }
    for (const count of [1, 999]) {
      const { owner } = createReaderBuilderProbe(page, ['projectionBookCoverLayer'], {
        readerAppColor, ...coverVisual, ...readerTypographyRoles,
      }, { childSources: { NoCoverCover: source('features/bookshelf/NoCoverCover.ets') } });
      Object.assign(owner, { appThemeScheme: 'day', viewSwitchGridContentOpacity: 1,
        hasCover: () => true, shelfBookCardWidth: () => 100, bookCardHeight: () => 150,
        projectionCoverRadius: () => 12, projectionCoverLayerOpacity: () => 1 });
      owner.projectionBookCoverLayer({ unreadCount: count, coverUrl: '/cover.jpg' }, false, false, 0);
      const nodes = [...owner.nodes.values()];
      const text = nodes.find(n => n.type === 'Text');
      const frame = nodes.find(n => n.type === 'Row');
      assert.equal(text.create, `更新 ${count} 章`);
      assert.equal(text.fontFamily, readerTypographyRoles.TYPE_SHELF_UPDATE_BADGE.fontFamily);
      assert.equal(text.lineHeight, 16);
      assert.equal(text.textAlign, 'TextAlign.Center');
      assert.equal(text.maxLines, 1);
      assert.equal(frame.justifyContent, 'FlexAlign.Center');
      assert.equal(frame.alignItems, 'VerticalAlign.Center');
      assert.equal(frame.padding.top, frame.padding.bottom);
      assert.equal(frame.align, 'Alignment.TopEnd', 'the capsule keeps the original cover corner placement');
    }
  }
  recordContractCasePass(id);
}
