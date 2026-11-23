import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';

const definitions = {
  'home-composition': {
    description: 'Actual complete SDK Home Column/card/rows/action/short-lane declarations independently pay borders and cannot fill past the Scroll viewport',
    resources: [],
  },
  'pixel-height-payment': {
    description: 'Shared Quick/Full height pays outward requirements within inward physical capacity, with actual Home Scroll overflow declaration',
    resources: [],
  },
};

function homeComposition(source, geometry, control) {
  const start = source.indexOf('        Scroll() { this.homeContent(); }', source.indexOf('private controlContent()'));
  const finish = source.indexOf(';', source.indexOf('.enableScrollInteraction', start)) + 1;
  const statement = source.slice(start, finish);
  const names = ['regressionHome', 'measureHomeForm', 'homeContent', 'chapterProgress', 'chapterRow', 'progressRow',
    'quickActionPanel', 'quickAction', 'shortWindowActions', 'homeChapterCardHeight', 'homeContentMinimumHeight',
    'homeMetric', 'homeProfileMetric', 'presentedHomeChapterTitle', 'presentedHomeTotalChapters'];
  function render(text, scale, viewport, topBarVisible) {
    const candidate = text.replace('  @Builder\n  private controlContent() {',
      `  @Builder\n  private regressionHome() { ${statement} }\n  @Builder\n  private controlContent() {`);
    const owner = createReaderBuilderProbe(candidate, names, {
      ...control, ...readerFoundationTokens, ...readerTypographyRoles,
      readerControlExtentFits: geometry.readerControlExtentFits,
      ScrollDirection: { Horizontal: 'horizontal' }, sourceSwitchTriggerFocusId: () => 'source-trigger',
      measureReaderControlText(_context, value, style) {
        return { heightVp: (style === readerTypographyRoles.TYPE_READER_CONTROL_CHAPTER_TITLE ? 34 :
          style === readerTypographyRoles.TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL ? 12.5 : 13) * scale,
        singleLineWidthVp: Math.min(80, Math.max(1, [...value].length * 6 * scale)), fitsWidth: true };
      },
    }).owner;
    Object.assign(owner, { chapterTitle: 'Chapter One', totalChapters: 1, minimumIdentity: '', appScheme: 'day',
      currentLayout: () => ({ topBarVisible, quickPanelHeight: viewport + 140 }),
      frame: () => ({ progress: 0, content: { width: 264, height: viewport } }),
      selectedMinimumProfile: () => undefined, progressInputEnabled: () => true, canStepChapter: () => true,
      controlActionScope: () => 'current', controlActionHandler: callback => callback,
      progressChangeHandler: () => () => {}, effectiveProgressPercent: () => 0, quickActionIcon: icon => icon,
      shortWindowActionInput: () => true, isLocalBook: () => true, readerMorePopupOptions: () => ({}),
      onPreviousChapter() {}, onNextChapter() {}, onExitReading() {}, onSourceSwitch() {}, setMoreMenuVisible() {},
      promoteSearch() {}, promoteAutoPage() {}, onOpenReplace() {},
    });
    const profile = owner.measureHomeForm(264);
    owner.selectedMinimumProfile = () => ({ quick: profile, full: profile });
    owner.regressionHome();
    const nodes = [...owner.nodes.values()];
    const scroll = nodes.find(node => node.type === 'Scroll');
    const column = nodes.find(node => node.type === 'Column' && node.create?.space === 6);
    const card = nodes.find(node => node.type === 'Column' && node.border?.width === 1);
    const chapter = nodes.find(node => node.type === 'Row' && node.padding?.top === 10);
    const progress = nodes.find(node => node.type === 'Row' && node.padding?.top === 6);
    const actions = nodes.find(node => node.type === 'Row' && node.border?.width === 1);
    const slider = nodes.find(node => node.type === 'Slider');
    const short = nodes.filter(node => node.type === 'Scroll').at(1);
    assert.ok(scroll && column && card && chapter && progress && actions && slider,
      'actual Scroll→Home Column→framed Card/real Rows/Slider and framed quick actions all emit');
    const border = card.border.width * 2;
    const shortHeight = topBarVisible ? 0 : short.height;
    const gapCount = topBarVisible ? 1 : 2;
    const natural = card.height + actions.height + column.create.space * gapCount + shortHeight;
    const required = chapter.height + progress.height + border + actions.height + column.create.space * gapCount + shortHeight;
    assert.ok(card.height + 1e-10 >= chapter.height + progress.height + border,
      'real card content pays child rows plus both native border sides');
    assert.ok(chapter.height - chapter.padding.top >= profile.chapterTitleHeight,
      'chapter row pays its actual top padding and declared title height');
    assert.ok(progress.height - progress.padding.top >= slider.height,
      'progress row pays its actual top padding and44 slider height');
    assert.ok(Math.abs(owner.homeContentMinimumHeight() - required) < 1e-9,
      'producer/fallback minimum agrees with independently summed emitted children, borders and Column spacing');
    assert.equal(geometry.readerControlExtentFits(natural, viewport), geometry.readerControlExtentFits(required, viewport),
      'real Home native declaration sum cannot exceed a viewport that pays its natural minimum');
    assert.equal(scroll.enableScrollInteraction, !geometry.readerControlExtentFits(natural, viewport),
      'actual Scroll predicate agrees with actual emitted parent-child composition');
    assert.equal(scroll.scrollBar, undefined, 'outer Scroll keeps its original default scrollbar');
    assert.ok(actions.height - actions.border.width * 2 >= 55.438 + profile.actionLabelHeight - 13,
      'quick action frame pays its real button height inside native borders');
    if (!topBarVisible) {
      assert.equal(shortHeight, 44); assert.equal(short.scrollBar, 'BarState.Off');
      assert.equal(required - profile.minimumHeight, 50, 'third child44 and second Column gap6 pay exactly50');
    }
    return { owner, profile, viewport, natural, required, cardHeight: card.height, cardBorder: border,
      chapterHeight: chapter.height, progressHeight: progress.height, actionHeight: actions.height, gapCount,
      shortHeight, scrollEnabled: scroll.enableScrollInteraction };
  }
  const samples = [];
  for (const scale of [1, 1.3, 1.6, 2]) for (const topBar of [true, false]) {
    for (const viewport of [120, 657 / 3.5, 190, 270, 666]) samples.push(render(source, scale, viewport, topBar));
  }
  const normal = render(source, 1, 190, true);
  assert.equal(normal.natural, 190, 'default190 viewport preserves its complete authored arrangement without extra.001');
  const current = render(source, 1, 657 / 3.5, true);
  assert.equal(current.scrollEnabled, false);
  const begin = source.indexOf('  private homeChapterCardHeight(): number {');
  const end = source.indexOf('\n  @Builder\n  private chapterProgress()', begin);
  const oldCard = `  private homeChapterCardHeight(): number {
    return Math.max(this.homeMetric('chapterRowHeight', 54) + this.homeMetric('progressHeight', 50),
      Math.min(READER_CONTROL_HOME_TOP_ROW_HEIGHT, this.frame().content.height) +
      (READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT + READER_CONTROL_HOME_QUICK_ACTION_HEIGHT + READER_CONTROL_HOME_SECTION_GAP - READER_CONTROL_HOME_TOP_ROW_HEIGHT) -
      this.homeMetric('actionHeight', READER_CONTROL_HOME_QUICK_ACTION_HEIGHT) - READER_CONTROL_HOME_SECTION_GAP);
  }
`;
  const oldConsumer = source.slice(0, begin) + oldCard + source.slice(end);
  assert.throws(() => render(oldConsumer, 1, 190, true), /native declaration sum cannot exceed/,
    'old viewport+.001 consumer fails the independently emitted native child sum');
  assert.throws(() => render(oldConsumer, 1, 650 / 3.5, true), /real card content pays/,
    'old card child overflow matches the installed449 native counterexample');
  const missingBorder = source.replace('minimumHeight: chapterHeight + progressHeight + TOK_BORDER_W * 2 + actionHeight',
    'minimumHeight: chapterHeight + progressHeight + actionHeight');
  assert.notEqual(missingBorder, source);
  assert.throws(() => render(missingBorder, 1, 657 / 3.5, true), /independently summed emitted children/,
    'omitting parent border from the producer is rejected by actual child declarations');
  console.log(JSON.stringify({ kind: 'home-composition', samples: samples.length, defaultViewport190: normal.natural,
    currentMinimum: current.required, currentCardHeight: current.cardHeight, currentPaidContent: current.viewport,
    cardBorder: current.cardBorder, shortLane: 50, oldViewportPlusPoint001Rejected: true, oldUnpaidBorderRejected: true,
    nativeLayoutAndRaster: 'NOT_RUN' }));
}

for (const id of selectContractCases(definitions)) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const geometry = await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
  const metricsApi = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const control = await import('../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts');
  const motion = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
  const root = '../entry/src/main/ets/features/reading/ui/';
  const read = name => readFileSync(new URL(root + name, import.meta.url), 'utf8');
  const geometrySource = read('ReaderLayoutGeometry.ts');
  const panelSource = read('ReaderControlPanel.ets');
  const deps = { ...metricsApi, ...control, ...motion };
  if (id === 'home-composition') {
    homeComposition(panelSource, geometry, control);
    recordContractCasePass(id);
    continue;
  }
  const height = pureModuleProbe(geometrySource, 'ReaderLayoutGeometry.ts', deps,
    ['controlHeightWithin', 'pixelWithin']);
  const near = (actual, expected, text) => assert.ok(Math.abs(actual - expected) < 1e-9, `${text}: ${actual}/${expected}`);
  const density = 3.5;

  const home = createReaderBuilderProbe(panelSource, ['measureHomeForm'], {
    ...control, ...readerFoundationTokens, ...readerTypographyRoles,
    measureReaderControlText(_context, text, style) {
      return { heightVp: style === readerTypographyRoles.TYPE_READER_CONTROL_CHAPTER_TITLE ? 34 :
        style === readerTypographyRoles.TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL ? 12.5 : 13,
      singleLineWidthVp: Math.min(80, Math.max(1, [...text].length * 6)), fitsWidth: true };
    },
  }).owner;
  Object.assign(home, { chapterTitle: 'Chapter One', totalChapters: 1 });
  const homeProfile = home.measureHomeForm(264);
  near(homeProfile.minimumHeight, 187.438, 'actual Home producer minimum includes the card native borders');

  // Keep the exact shipping Scroll statement. The fixture supplies only its
  // business content slot and already-committed frame/profile metric ports.
  const begin = panelSource.indexOf('        Scroll() { this.homeContent(); }', panelSource.indexOf('private controlContent()'));
  const end = panelSource.indexOf(';', panelSource.indexOf('.enableScrollInteraction', begin)) + 1;
  const scrollStatement = panelSource.slice(begin, end);
  assert.ok(scrollStatement.includes('readerControlExtentFits'));
  const homeMinimumMethod = panelSource.slice(panelSource.indexOf('  private homeContentMinimumHeight(): number {'),
    panelSource.indexOf('\n  private homeChapterCardHeight()', panelSource.indexOf('  private homeContentMinimumHeight(): number {')));
  const scaffold = statement => `@Component export struct PixelHomeScroll {
    @Builder private homeContent() {}
    ${homeMinimumMethod}
    build() { ${statement} }
  }`;
  function nativeScroll(capacity, required, statement = scrollStatement) {
    const sdk = boundedSurfaceSdk();
    const source = scaffold(statement);
    const owner = sdk.consumer(source, ['build', 'homeContent', 'homeContentMinimumHeight'], {
      ...control, readerControlExtentFits: geometry.readerControlExtentFits,
    });
    Object.assign(owner, { frame: () => ({ content: { width: 264, height: capacity } }),
      homeMetric: () => required, currentLayout: () => ({ topBarVisible: true }) });
    owner.initialRender();
    const scroll = [...owner.nodes.values()].find(node => node.type === 'Scroll');
    assert.ok(scroll); assert.equal(scroll.scrollBar, undefined, 'the existing default scrollbar is retained');
    return scroll;
  }

  const quickRequired = homeProfile.minimumHeight + 140;
  const paidQuick = height.controlHeightWithin(quickRequired, quickRequired, 700, density);
  near(paidQuick, 1147 / density, 'physical height rounds measured requirement outward');
  assert.equal(nativeScroll(paidQuick - 140, homeProfile.minimumHeight).enableScrollInteraction, false);
  const oldQuick = height.pixelWithin(quickRequired, 0, 700, density);
  near(oldQuick, 1146 / density, 'old nearest-height counterexample');
  const oldStatement = scrollStatement.replace('!readerControlExtentFits(this.homeContentMinimumHeight(), this.frame().content.height)',
    'this.frame().content.height < this.homeContentMinimumHeight()');
  assert.equal(nativeScroll(oldQuick - 140, homeProfile.minimumHeight, oldStatement).enableScrollInteraction, true,
    'old exact production Scroll predicate exposes the false overflow');
  assert.equal(nativeScroll(oldQuick - 140, homeProfile.minimumHeight).enableScrollInteraction, true,
    'new fit comparison does not conceal the real old underpayment');
  assert.equal(nativeScroll(100, homeProfile.minimumHeight).enableScrollInteraction, true, 'true short viewport remains scrollable');
  assert.equal(nativeScroll(250, 400).enableScrollInteraction, true, 'true enlarged-content overflow remains scrollable');
  assert.equal(geometry.readerControlExtentFits(100 + Number.EPSILON * 100, 100), true,
    'only arithmetic precision is ignored');
  assert.equal(geometry.readerControlExtentFits(100.0000000001, 100), false, 'a genuine small deficit remains unpaid');
  assert.equal(geometry.readerControlExtentFits(100.009, 100), false, 'the former .01vp allowance is removed');

  let thresholdSamples = 0;
  for (const scale of [1, 2, 3.5, 4]) {
    const edge = 1140 / scale;
    for (const required of [edge - 1e-6, edge, edge + Number.EPSILON * edge, edge + 1e-10, edge + 1e-6]) {
      const paid = height.controlHeightWithin(required, required, edge + 2 / scale, scale);
      assert.equal(geometry.readerControlExtentFits(required, paid), true);
      near(paid * scale, Math.round(paid * scale), 'height ends on a physical pixel');
      const capped = height.controlHeightWithin(required, required, edge - .1 / scale, scale);
      assert.ok(capped <= edge - .1 / scale + Number.EPSILON * edge * 4);
      assert.equal(geometry.readerControlExtentFits(required, capped), false, 'inward cap preserves real overflow');
      thresholdSamples++;
    }
  }

  function metrics(width, height, scale = density) {
    const value = metricsApi.createDefaultReaderWindowMetrics();
    value.windowRect.width = width; value.windowRect.height = height; value.densityPixels = scale;
    return value;
  }
  function candidate(widths, module, quick = homeProfile.minimumHeight, full = 200) {
    const chrome = { topBarVisible: true, topBarHeightVp: 54, quickReserveVp: 140, fullReserveVp: 60,
      navigationHeightVp: 80, headerHeightVp: 18, brightnessAutoHeightVp: 20, brightnessAutoWidthVp: 20 };
    const shell = { minimum: { module: 'home', quick: { heightVp: quick, minWidthVp: 100, fits: true },
      full: { heightVp: full, minWidthVp: 100, fits: true } }, chrome };
    return { widths, key: module + ':same-shell', minimum: { module,
      quick: { heightVp: quick, minWidthVp: 100, fits: true }, full: { heightVp: full, minWidthVp: 100, fits: true } },
    chrome, sharedShell: shell };
  }
  const modules = ['directory', 'search', 'tts', 'autoPage', 'appearance', 'settings', 'replace'];
  let moduleLayouts = 0;
  for (const [width, windowHeight] of [[390, 844], [366, 844], [366, 270], [844, 390], [800, 960]]) {
    const environment = metrics(width, windowHeight);
    const widths = geometry.readerControlCandidateWidths(width, windowHeight, false, environment)[0];
    for (const contentScale of [1, 2]) {
    let reference;
    for (const module of modules) {
      const input = candidate(widths, module, homeProfile.minimumHeight * contentScale, 200 * contentScale);
      const layout = geometry.resolveReaderControlLayout(width, windowHeight, false, environment, 0, [input]);
      const box = [layout.fullPanelWidth, layout.quickPanelHeight, layout.fullPanelHeight];
      if (reference === undefined) reference = box;
      else assert.deepEqual(box, reference, 'all seven module consumers share physical Quick/Full payment');
      assert.ok(layout.quickPanelHeight <= layout.fullPanelHeight);
      assert.ok(layout.fullPanelTop + layout.fullPanelHeight + Math.max(20, layout.dockBottomGap) <= windowHeight + 1e-9);
      assert.equal(layout.quickMinimumFits,
        geometry.readerControlExtentFits(input.minimum.quick.heightVp, layout.contentBudget.quickContentHeightVp));
      assert.equal(layout.fullMinimumFits,
        geometry.readerControlExtentFits(input.minimum.full.heightVp, layout.contentBudget.fullContentHeightVp));
      if (geometry.readerControlExtentFits(input.minimum.quick.heightVp + input.chrome.quickReserveVp, layout.fullPanelHeight)) {
        assert.equal(layout.quickMinimumFits, true, 'a physically payable Quick requirement must fit its committed content capacity');
      }
      if (geometry.readerControlExtentFits(input.minimum.full.heightVp + input.chrome.fullReserveVp, layout.fullPanelHeight)) {
        assert.equal(layout.fullMinimumFits, true, 'a physically payable Full requirement must fit its committed content capacity');
      }
      near(layout.quickPanelHeight * density, Math.round(layout.quickPanelHeight * density), 'shared Quick height is pixel-paid in either orientation');
      const bounds = motion.readerControlMotionBounds(layout.fullPanelWidth, layout.fullPanelHeight,
        layout.dockBottomGap, layout.quickPanelHeight, layout.contentBudget);
      for (const p of [0, .5, 1]) {
        const frame = motion.sampleReaderControlMotion({ visibilityProgress: 1, expansionProgress: p }, bounds);
        near(frame.shell.height, layout.quickPanelHeight + (layout.fullPanelHeight - layout.quickPanelHeight) * p,
          'morph retains the same single Quick/Full endpoint interpolation');
        near(frame.content.height, layout.contentBudget.quickContentHeightVp +
          (layout.contentBudget.fullContentHeightVp - layout.contentBudget.quickContentHeightVp) * p, 'content budget remains same-source');
      }
      moduleLayouts++;
    }
    }
  }
  const normal = metrics(390, 844);
  const normalWidths = geometry.readerControlCandidateWidths(390, 844, false, normal)[0];
  const defaultLayout = geometry.resolveReaderControlLayout(390, 844, false, normal, 0, [candidate(normalWidths, 'home')]);
  near(defaultLayout.fullPanelHeight, 736, 'original Full preferred/safe cap remains736');
  const fullRequired = 700.0000000001;
  const fullPaid = height.controlHeightWithin(fullRequired, fullRequired, 736, density);
  assert.equal(geometry.readerControlExtentFits(fullRequired, fullPaid), true, 'Full requirements also round outward');
  console.log(JSON.stringify({ kind: id, originalHomeMinimum: homeProfile.minimumHeight, oldQuick, paidQuick,
    thresholdSamples, moduleLayouts, nativeScrollDeclaration: 'actual production statement SDK-emitted', nativeLayout: 'NOT_RUN' }));
  recordContractCasePass(id);
}
