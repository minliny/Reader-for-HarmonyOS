import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { readerControlActor, readerControlPaidResponses, readerControlLerp, readerControlUnit, type ReaderControlActorFrame } from './ReaderControlActorGeometry';
import { readerControlSettingsMinimumFacts, readerControlSettingsGroupLabel, readerControlSettingsOptionLabel, measureReaderControlSettingsMinimum } from './ReaderControlSettingsMinimum';
import { readerControlModuleProfileMatches, readerControlModuleFactsMatch, type ReaderControlPreparedModuleProfile, type ReaderControlModuleFacts } from './ReaderControlMinimumMeasurement';
import { TYPE_READER_PANEL_LABEL, TYPE_APP_ROW_DETAIL, TYPE_READER_SETTINGS_SEGMENT_LABEL_FULL, TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK, TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL, TYPE_READER_SETTINGS_RETAINED_JUSTIFY_TOGGLE_ROW_LABEL, TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL, TYPE_READER_SETTINGS_RETAINED_SEGMENT_ROW_VALUE, TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL } from '../../../ui/foundation/ReaderTypography';

import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { PathShape, RectShape } from '@ohos.arkui.shape';
import { sampleReaderControlMotionPresentation, ReaderControlMotionClipCache, readerControlMotionSourceFullyVisible,
  type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { createReaderControlMorphScroll, advanceReaderControlMorphScroll, observeReaderControlMorphScroll,
  readerControlMorphScrollTranslation, readerControlMorphScrollExtent, readerControlMorphScrollAllowsNative,
  readerControlMorphScrollPath, sampleReaderControlMorphScrollPath,
  type ReaderControlMorphScrollPath, type ReaderControlMorphScrollState } from './ReaderControlMorphScroll';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { ReaderSegmentedControl } from '../../../ui/controls/ReaderSegmentedControl';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { ReaderIslandSwitchRow } from './ReaderIslandControlStyle';
import { ReaderControlSwitchTrack } from './ReaderControlSwitchTrack';
import { ReaderControlSettingsOptionModifier } from './ReaderControlSettingsOptionModifier';
import { createDefaultReaderSettingsSnapshot, isReaderPageTurnStyleAvailable,
  isReaderScreenDirectionAvailable, isReaderScreenTimeoutAvailable, isReaderSettingsToggleAvailable,
  readerPageTurnStyle, type ReaderPageTurnStyle, type ReaderScreenDirection,
  type ReaderScreenTimeout, type ReaderSettingsSnapshot, type ReaderSettingsToggleKey,
  type ReaderWidePageLayout } from '../application/ReaderSettingsState';

import { readerControlSettingsLabel, readerControlSettingsBar, readerControlSettingsChoice, readerControlSettingsScreenTitle, readerControlSettingsAddedGroup, readerControlSettingsAddedChild, sampleReaderControlSettings, type ReaderControlSettingsFrame, type ReaderControlSettingsGroup, type ReaderControlSettingsAddedGroup, type ReaderControlSettingsMinimumProfile } from './ReaderControlSettingsGeometry';

import { readerControlExtentFits, type ReaderControlCandidateWidths, type ReaderControlModuleMinimum, type ReaderControlModuleMeasurer } from './ReaderLayoutGeometry';

const SETTINGS_DIRECTION_OPTIONS: string[] = ['system', 'portrait', 'landscape'];
const SETTINGS_PAGE_OPTIONS: string[] = ['cover', 'slide', 'simulation', 'scroll', 'none'];
const SETTINGS_TIMEOUT_OPTIONS: string[] = ['system', 'oneMinute', 'fiveMinutes', 'tenMinutes', 'alwaysOn'];

/** Restored Settings 1692:3071 viewport only. One persistent Screen group and
 * three mounted AddedModules consume the caller's p; no shell, local clock,
 * page swap, dropdown substitution or text scaling. State stays with the Host. */
@Component
export struct ReaderControlSettingsContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop fixedIsland: boolean = false;
  @Prop @Watch('onPreparedMinimumChanged') preparedMinimum: ReaderControlPreparedModuleProfile | undefined = undefined;
  @Prop preparedMinimumRequired: boolean = false;
  onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts) => void =
    (_identity: string, _facts: ReaderControlModuleFacts): void => {};
  @Prop @Watch('onMotionChanged') motionProgress: number = 0;
  @Prop @Watch('onMinimumIdentityChanged') minimumIdentity: string = '';
  @Prop minimumKey: string = '';
  onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined) => void =
    (_identity: string, _measurer: ReaderControlModuleMeasurer | undefined): void => {};
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop @Watch('onMotionChanged') interactionEnabled: boolean = true;
  inputCurrent?: () => boolean;
  @Prop snapshot: ReaderSettingsSnapshot = createDefaultReaderSettingsSnapshot();
  @Prop widePageLayoutAvailable: boolean = false;
  @Prop widePageLayout: ReaderWidePageLayout = 'spread';
  @Prop pageTurnSimulationAvailable: boolean = true;
  @Prop justifyText: boolean = true;
  onScreenDirectionChange: (direction: ReaderScreenDirection) => void =
    (_direction: ReaderScreenDirection): void => {};
  onPageTurnStyleChange: (style: ReaderPageTurnStyle) => void =
    (_style: ReaderPageTurnStyle): void => {};
  onScreenTimeoutChange: (timeout: ReaderScreenTimeout) => void =
    (_timeout: ReaderScreenTimeout): void => {};
  onToggleChange: (key: ReaderSettingsToggleKey, value: boolean) => void =
    (_key: ReaderSettingsToggleKey, _value: boolean): void => {};
  onWidePageLayoutChange: (value: ReaderWidePageLayout) => void = (_value: ReaderWidePageLayout): void => {};
  onJustifyTextChange: (value: boolean) => void = (_value: boolean): void => {};
  @State private scrollMotion: ReaderControlMorphScrollState = createReaderControlMorphScroll();
  @State private widePageLayoutHeight: number = 0;
  @Prop fullViewportHeight: number = 666;
  private adoptedPrepared: ReaderControlPreparedModuleProfile | undefined = undefined;
  private presentationPrepared(): ReaderControlPreparedModuleProfile | undefined {
    const current = this.preparedMinimum;
    if (current !== undefined && current.identity === this.minimumIdentity && current.key === this.minimumKey &&
      readerControlModuleProfileMatches(current.moduleData, 'settings') && readerControlModuleFactsMatch(current.facts, 'settings')) return current;
    const adopted = this.adoptedPrepared;
    return this.preparedMinimumRequired && adopted !== undefined &&
      readerControlModuleProfileMatches(adopted.moduleData, 'settings') && readerControlModuleFactsMatch(adopted.facts, 'settings') ? adopted : undefined;
  }
  private preparedProfile(): ReaderControlSettingsMinimumProfile | undefined {
    return this.presentationPrepared()?.moduleData.settings;
  }
  private currentMinimumProfile(): ReaderControlSettingsMinimumProfile | undefined {
    return this.preparedMinimumRequired ? this.preparedProfile() : this.preparedProfile() ?? this.minimumProfiles.get(this.minimumKey);
  }
  private adoptedPreparedKey: string = '';
  private onPreparedMinimumChanged(): void {
    if (!this.preparedMinimumRequired) { this.onMotionChanged(); return; }
    const prepared = this.preparedMinimum;
    if (prepared === undefined || prepared.identity !== this.minimumIdentity || prepared.key !== this.minimumKey ||
      !readerControlModuleProfileMatches(prepared.moduleData, 'settings') || !readerControlModuleFactsMatch(prepared.facts, 'settings')) return;
    this.adoptedPrepared = prepared;
    const adopted = `${prepared.identity}|${prepared.key}`;
    if (adopted === this.adoptedPreparedKey) return;
    this.adoptedPreparedKey = adopted;
    this.onMotionChanged();
  }
  private scroller: Scroller = new Scroller();
  private minimumQuickScrollOffset: number = 0;
  private minimumScrollPath: ReaderControlMorphScrollPath | undefined = undefined;
  private minimumLastProgress: number = 0;
  private clipCache: ReaderControlMotionClipCache<PathShape | RectShape> = new ReaderControlMotionClipCache<PathShape | RectShape>(
    (path: string): PathShape => new PathShape().commands(path),
    (): RectShape => new RectShape().width('100%').height('100%'));
  private clipEndpointWidth: number = -1;
  private clipFullRects: ReaderControlMotionClipRect[] = [];
  private clipQuickRects: ReaderControlMotionClipRect[] = [];
  private cachedGeometry: ReaderControlSettingsFrame | undefined = undefined;
  private geometryProgress: number = -1;
  private geometryWidth: number = -1;
  private cachedPaint: ReaderControlMotionPresentation | undefined = undefined;
  private paintProgress: number = -1;
  private optionModifiers: ReaderControlSettingsOptionModifier[] = [];

  private minimumProfiles: Map<string, ReaderControlSettingsMinimumProfile> = new Map<string, ReaderControlSettingsMinimumProfile>();
  private minimumCacheTicket: string = '';
  private publishedMinimumIdentity: string = '';
  private minimumMounted: boolean = false;
  private geometryMinimumKey: string = '';
  private clipMinimumKey: string = '';
  private readonly minimumMeasurer: ReaderControlModuleMeasurer =
    (widths: ReaderControlCandidateWidths, key: string): ReaderControlModuleMinimum | undefined => this.measureMinimum(widths, key);
  private currentInputEnabled(): boolean {
    return (!this.preparedMinimumRequired || this.presentationPrepared()?.ownerCurrent?.() === true) &&
      this.interactionEnabled && (this.inputCurrent?.() ?? true);
  }

  private measureMinimum(widths: ReaderControlCandidateWidths, key: string): ReaderControlModuleMinimum | undefined {
    const groups: ReaderControlSettingsGroup[] = ['direction', 'pageTurn', 'timeout'];
    const groupLabels: string[] = []; const options: string[][] = [];
    for (let row = 0; row < groups.length; row++) {
      groupLabels.push(this.groupLabel(groups[row]));
      const labels: string[] = [];
      for (let i = 0; i < this.groupOptions(groups[row]).length; i++)
        labels.push(this.optionLabel(groups[row], this.groupOptions(groups[row])[i]));
      options.push(labels);
    }
    const profile = measureReaderControlSettingsMinimum(this.getUIContext(), widths, groupLabels, options,
      ['隐藏状态栏', '隐藏底部导航栏', '拓展到刘海（灵动岛）', '文字两端对齐', '底部对齐', '音量键翻页', '息屏终止朗读', '长按选择文本']);
    if (profile === undefined) return undefined;
    const ticket = key.slice(0, key.lastIndexOf('|'));
    if (ticket !== this.minimumCacheTicket) {
      const selected = this.currentMinimumProfile();
      this.minimumProfiles.clear();
      if (selected !== undefined && this.minimumKey.length > 0) this.minimumProfiles.set(this.minimumKey, selected);
      this.minimumCacheTicket = ticket;
    }
    this.minimumProfiles.set(key, profile);
    const q = sampleReaderControlSettings(0, widths.quickContentWidthVp, profile);
    const f = sampleReaderControlSettings(1, widths.fullContentWidthVp, profile);
    return { module: 'settings',
      quick: { heightVp: Math.max(183, q.contentHeight), minWidthVp: widths.quickContentWidthVp, fits: profile.quick.fits },
      full: { heightVp: f.bars[2].y + f.bars[2].height + 5, minWidthVp: widths.fullContentWidthVp, fits: profile.full.fits } };
  }
  private onMinimumIdentityChanged(): void {
    if (!this.minimumMounted) return;
    if (this.preparedMinimumRequired) {
      if (this.minimumIdentity.length > 0) this.onMinimumFactsChanged(this.minimumIdentity, { module: 'settings', settings: readerControlSettingsMinimumFacts() });
      return;
    }
    if (this.publishedMinimumIdentity.length > 0 && this.publishedMinimumIdentity !== this.minimumIdentity)
      this.onMinimumMeasurerReady(this.publishedMinimumIdentity, undefined);
    this.publishedMinimumIdentity = this.minimumIdentity;
    if (this.minimumIdentity.length > 0) this.onMinimumMeasurerReady(this.minimumIdentity, this.minimumMeasurer);
  }
  aboutToDisappear(): void {
    this.adoptedPrepared = undefined;
    this.adoptedPreparedKey = '';

    this.minimumMounted = false;
    if (this.publishedMinimumIdentity.length > 0) this.onMinimumMeasurerReady(this.publishedMinimumIdentity, undefined);
    this.publishedMinimumIdentity = '';
  }

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.minimumMounted = true;
    this.onMinimumIdentityChanged();

    if (this.preparedMinimumRequired) this.onPreparedMinimumChanged();
  }

  private p(): number { return readerControlUnit(this.motionProgress); }
  private fullInput(): boolean { return this.currentInputEnabled() && this.p() === 1; }
  private scrollContentHeight(): number {
    const wideHeight = this.widePageLayoutAvailable ? this.widePageLayoutHeight : 0;
    return Math.max(this.geometry().contentHeight, this.availableHeight + readerControlMorphScrollExtent(this.scrollMotion) - wideHeight);
  }
  private onMotionChanged(): void {
    const p = this.p();
    if (this.minimumLastProgress === 0 && p > 0 && this.minimumQuickScrollOffset > 0)
      this.minimumScrollPath = readerControlMorphScrollPath(0, this.minimumQuickScrollOffset);
    this.minimumLastProgress = p;
    this.syncMorphScroll();
  }
  private syncMorphScroll(): void {
    const offset = this.scroller.currentOffset()?.yOffset;
    if (offset === undefined || !Number.isFinite(offset)) return;
    const path = this.minimumScrollPath;
    if (path !== undefined) {
      const target = sampleReaderControlMorphScrollPath(path, this.p());
      this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion, offset, false);
      if (Math.abs(offset - target) > .1) this.scroller.scrollTo({ xOffset: 0, yOffset: target, animation: false });
      if (this.currentInputEnabled() && (this.p() === 0 || this.p() === 1)) {
        this.minimumQuickScrollOffset = this.p() === 0 ? path.quickOffset : 0;
        this.minimumScrollPath = undefined;
      }
      return;
    }
    if (this.quickMinimumScrollPresentation()) {
      this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion, offset, false);
      this.minimumQuickScrollOffset = offset;
      return;
    }
    const update = advanceReaderControlMorphScroll(this.scrollMotion, this.motionProgress,
      this.currentInputEnabled(), offset);
    this.scrollMotion = update.state;
    if (update.targetOffset !== undefined) {
      this.scroller.scrollTo({ xOffset: 0, yOffset: update.targetOffset, animation: false });
      this.onFullDidScroll();
    }
  }
  private onFullDidScroll(): void {
    const offset = this.scroller.currentOffset()?.yOffset;
    if (offset === undefined || !Number.isFinite(offset)) return;
    this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion,
      offset, this.fullInput());
    if (this.quickMinimumScrollPresentation()) this.minimumQuickScrollOffset = offset;
  }
  private nativeScrollDelta(y: number, source: ScrollSource): OffsetResult {
    if (this.quickMinimumScrollInput() || (this.minimumScrollPath !== undefined && source === ScrollSource.SCROLLER))
      return { xOffset: 0, yOffset: y };
    return { xOffset: 0, yOffset: readerControlMorphScrollAllowsNative(this.scrollMotion,
      this.fullInput(), source === ScrollSource.SCROLLER) ? y : 0 };
  }
  private sharedScrollTranslation(): number {
    if (this.minimumScrollPath !== undefined) return this.scrollMotion.nativeScrollOffset -
      sampleReaderControlMorphScrollPath(this.minimumScrollPath, this.p());
    if (this.quickMinimumScrollPresentation()) return 0;
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress);
  }
  private quickMinimumScrollInput(): boolean {
    return this.currentInputEnabled() && this.quickMinimumScrollPresentation();
  }

  private quickMinimumScrollPresentation(): boolean {
    const wideHeight = this.widePageLayoutAvailable ? this.widePageLayoutHeight : 0;
    return this.p() === 0 && !readerControlExtentFits(this.geometry().contentHeight + wideHeight, this.availableHeight);
  }

  private fullOnlyScrollTranslation(): number {
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress, 'fullOnly');
  }
  private groupWidth(): number { return Math.max(0, this.availableWidth - 30); }
  private presentation(): ReaderControlMotionPresentation {
    if (this.cachedPaint === undefined || this.paintProgress !== this.motionProgress) {
      this.paintProgress = this.motionProgress;
      this.cachedPaint = sampleReaderControlMotionPresentation(this.motionProgress);
    }
    return this.cachedPaint;
  }
  private geometry(): ReaderControlSettingsFrame {
    const progress = this.p();
    const minimum = this.currentMinimumProfile();
    const key = this.preparedMinimumRequired ? this.presentationPrepared()?.key ?? '' : this.minimumKey;
    if (this.cachedGeometry === undefined || this.geometryProgress !== progress ||
      this.geometryWidth !== this.availableWidth || this.geometryMinimumKey !== key) {
      this.geometryProgress = progress;
      this.geometryWidth = this.availableWidth;
      this.geometryMinimumKey = key;
      this.cachedGeometry = sampleReaderControlSettings(progress, this.availableWidth, minimum);
    }
    return this.cachedGeometry;
  }
  private sharedRect(row: number, bar: boolean, p: number): ReaderControlMotionClipRect {
    const minimum = this.currentMinimumProfile();
    const key = this.preparedMinimumRequired ? this.presentationPrepared()?.key ?? '' : this.minimumKey;
    if (this.clipEndpointWidth !== this.availableWidth || this.clipMinimumKey !== key) {
      this.clipMinimumKey = key;
      this.clipEndpointWidth = this.availableWidth; this.clipFullRects = []; this.clipQuickRects = [];
    }
    const index = row * 2 + (bar ? 1 : 0);
    const cache = p === 1 ? this.clipFullRects : this.clipQuickRects;
    if ((p === 0 || p === 1) && cache[index] !== undefined) return cache[index];
    const geometry = p === this.p() ? this.geometry() :
      sampleReaderControlSettings(p, this.availableWidth, minimum);
    const actor = bar ? geometry.bars[row] : geometry.labels[row];
    const rect: ReaderControlMotionClipRect = { x: actor.x + 15, y: actor.y + 5, width: actor.width, height: actor.height };
    if (p === 0 || p === 1) cache[index] = rect;
    return rect;
  }
  private sharedClip(row: number, bar: boolean): PathShape | RectShape {
    const full = this.sharedRect(row, bar, 1);
    if (readerControlMotionSourceFullyVisible(full, this.fullViewportHeight, this.scrollMotion.fullScrollOffset)) {
      return this.clipCache.full();
    }
    return this.clipCache.sample(`${row}:${bar}`, this.p(), full,
      this.sharedRect(row, bar, this.p()), this.sharedRect(row, bar, 0),
      this.fullViewportHeight, this.scrollMotion.fullScrollOffset, this.getUIContext().vp2px(1));
  }
  private label(index: number): ReaderControlActorFrame {
    return this.geometry().labels[index];
  }
  private bar(index: number): ReaderControlActorFrame {
    return this.geometry().bars[index];
  }
  private choice(group: ReaderControlSettingsGroup, row: number, index: number): ReaderControlActorFrame {
    return group === 'direction' ? this.geometry().directionChoices[index] : group === 'pageTurn' ?
      this.geometry().pageChoices[index] : this.geometry().timeoutChoices[index];
  }
  private segmentResponse(group: ReaderControlSettingsGroup, row: number, index: number): Rectangle {
    const paints = this.groupOptions(group).map((_option: string, i: number): ReaderControlActorFrame => this.choice(group, row, i));
    const bar = this.bar(row);
    const response = readerControlPaidResponses(paints, readerControlActor(0, 0, bar.width, bar.height))[index].response;
    const paint = paints[index];
    return { x: response.x - paint.x, y: response.y - paint.y, width: response.width, height: response.height };
  }
  private optionModifier(group: ReaderControlSettingsGroup, row: number, index: number,
    option: string): ReaderControlSettingsOptionModifier {
    const slot = row * 5 + index;
    if (this.optionModifiers[slot] === undefined) {
      this.optionModifiers[slot] = new ReaderControlSettingsOptionModifier(
        (): void => this.handleSegment(group, option));
    }
    return this.optionModifiers[slot].update(this.choice(group, row, index), this.presentation(),
      this.isSegmentActive(group, option), this.currentInputEnabled() && this.isSegmentAvailable(group, option),
      this.segmentAccessibilityText(group, option), this.appThemeScheme, this.segmentResponse(group, row, index));
  }
  private group(group: ReaderControlSettingsAddedGroup): ReaderControlActorFrame {
    return this.geometry().groups[group === 'status' ? 0 : group === 'typography' ? 1 : 2];
  }
  private child(kind: 'divider' | 'title' | 'row', index: number): ReaderControlActorFrame {
    return this.geometry().children[kind === 'divider' ? 0 : kind === 'title' ? 1 : 2 + index];
  }

  build() {
    if (this.fixedIsland && (!this.preparedMinimumRequired || this.presentationPrepared() !== undefined)) {
      this.islandContent();
    } else if (!this.preparedMinimumRequired || this.presentationPrepared() !== undefined) {
    Scroll(this.scroller) {
      if (this.widePageLayoutAvailable) {
        Column() {
          this.widePageLayoutRow();
          this.settingsGroups();
        }.width(this.availableWidth);
      } else {
        this.settingsGroups();
      }
    }
    .id('reader-control-module-settings')
    .width(this.availableWidth).height(this.availableHeight)
    .scrollBar(BarState.Off).edgeEffect(EdgeEffect.None)
    .enableScrollInteraction(this.fullInput() || this.quickMinimumScrollInput())
    .onAppear((): void => this.syncMorphScroll())
    .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult =>
      this.nativeScrollDelta(y, source))
    .onDidScroll((): void => this.onFullDidScroll())
    .enabled(this.currentInputEnabled())
    .clip(true);

    }
  }

  @Builder
  private settingsGroups() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.screenGroup();
      this.addedGroup('status', '导航状态栏');
      this.addedGroup('typography', '排版');
      this.addedGroup('control', '控制');
    }.width(this.availableWidth).height(this.scrollContentHeight());
  }

  @Builder
  private islandContent() {
    Scroll() {
      Column({ space: 7 }) {
        Column({ space: 5 }) {
          this.islandHeading('屏幕样式');
          this.islandOptions('direction');
          this.islandOptions('pageTurn');
          this.islandOptions('timeout');
          if (this.widePageLayoutAvailable) {
            this.widePageLayoutRow();
          }
        }.width('100%').padding(8).attributeModifier(new ReaderPanelFrame('reader-island-card', this.appThemeScheme));
        Column({ space: 5 }) {
          this.islandHeading('状态栏与显示');
          this.islandToggle('隐藏状态栏', 'hideStatusBar');
          this.islandToggle('隐藏底部导航栏', 'hideNavigationBar');
          this.islandToggle('拓展到刘海（灵动岛）', 'extendIntoCutout');
        }.width('100%').padding(8).attributeModifier(new ReaderPanelFrame('reader-island-card', this.appThemeScheme));
        Column({ space: 5 }) {
          this.islandHeading('正文排版');
          this.islandToggle('文字两端对齐', 'justifyText');
          this.islandToggle('底部对齐', 'alignPageBottom');
        }.width('100%').padding(8).attributeModifier(new ReaderPanelFrame('reader-island-card', this.appThemeScheme));
        Column({ space: 5 }) {
          this.islandHeading('阅读操作');
          this.islandToggle('音量键翻页', 'volumeKeysTurnPage');
          this.islandToggle('息屏终止朗读', 'stopTtsOnScreenOff');
          this.islandToggle('长按选择文本', 'longPressSelectText');
        }.width('100%').padding(8).attributeModifier(new ReaderPanelFrame('reader-island-card', this.appThemeScheme));
      }.width('100%').padding({ bottom: 2 });
    }.id('reader-control-module-settings').width(this.availableWidth).height(this.availableHeight)
      .scrollBar(BarState.Auto).edgeEffect(EdgeEffect.None).clip(true).enabled(this.currentInputEnabled());
  }

  @Builder
  private islandHeading(label: string) {
    Text(label).width('100%').padding({ top: 2, bottom: 2 }).fontFamily(TYPE_READER_PANEL_LABEL.fontFamily).fontWeight(TYPE_READER_PANEL_LABEL.fontWeight).fontSize(TYPE_READER_PANEL_LABEL.fontSizeFp)
      .fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme));
  }

  @Builder
  private islandOptions(group: ReaderControlSettingsGroup) {
    Column({ space: 4 }) {
      Text(this.groupLabel(group)).width('100%').fontFamily(TYPE_APP_ROW_DETAIL.fontFamily).fontWeight(TYPE_APP_ROW_DETAIL.fontWeight).fontSize(TYPE_APP_ROW_DETAIL.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Flex({ wrap: FlexWrap.Wrap }) {
        ForEach(this.groupOptions(group), (option: string) => {
          ReaderButton({ scheme: this.appThemeScheme, label: this.optionLabel(group, option),
            visualSize: 'small',
            variant: this.isSegmentActive(group, option) ? 'reader-island-selected' : 'reader-island',
            focusId: `reader-control-settings-${group}-${option}`,
            actionEnabled: this.currentInputEnabled() && this.isSegmentAvailable(group, option),
            actionAccessibilityLabel: this.segmentAccessibilityText(group, option),
            primary: this.isSegmentActive(group, option), selectionSemantic: true,
            onAction: (): void => this.handleSegment(group, option),
          }).margin({ right: 4 });
        }, (option: string): string => option);
      }.width('100%');
    }.width('100%');
  }

  @Builder
  private islandToggle(label: string, key: ReaderSettingsToggleKey) {
    ReaderIslandSwitchRow({ scheme: this.appThemeScheme, label,
      accessibleLabel: key === 'justifyText' ? label : this.toggleAccessibilityText(label, key),
      value: key === 'justifyText' ? this.justifyText : this.toggleValue(key),
      actionReady: this.currentInputEnabled() && (key === 'justifyText' || isReaderSettingsToggleAvailable(key)),
      onChange: (): void => {
        if (key === 'justifyText') this.handleJustify();
        else this.handleToggle(key);
      },
    });
  }

  @Builder
  private widePageLayoutRow() {
    Row({ space: 12 }) {
      Text('宽屏正文布局').layoutWeight(1)
        .fontFamily(TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL.fontFamily)
        .fontWeight(TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL.fontWeight)
        .fontSize(TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL.fontSizeFp)
        .lineHeight(TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme));
      ForEach([this.minimumIdentity], (identity: string): void => {
        ReaderSegmentedControl({ specId: 'app-theme-segment', options: ['双栏对开', '单栏居中'],
          optionIds: ['spread', 'single'], selectedIndex: this.widePageLayout === 'spread' ? 0 : 1,
          inputIdentity: `${identity}|wide-page-layout`, actionEnabled: this.currentInputEnabled(),
          accessibilityLabel: '宽屏正文布局', onSelect: (index: number): void => this.selectWidePageLayout(identity, index),
        });
      }, (identity: string): string => identity);
    }.width(this.fixedIsland ? '100%' : this.availableWidth).padding(this.fixedIsland ? { top: 4, bottom: 4 } : { left: 15, right: 15, top: 4, bottom: 4 })
      .onAreaChange((_previous: Area, next: Area): void => {
        const height = readerPageAreaLength(next.height);
        if (Number.isFinite(height) && height >= 0 && Math.abs(height - this.widePageLayoutHeight) > .1) {
          this.widePageLayoutHeight = height;
        }
      });
  }

  private selectWidePageLayout(identity: string, index: number): void {
    if (!this.minimumMounted || !this.widePageLayoutAvailable || identity !== this.minimumIdentity || !this.currentInputEnabled() ||
      (index !== 0 && index !== 1)) return;
    const value: ReaderWidePageLayout = index === 0 ? 'spread' : 'single';
    if (value !== this.widePageLayout) this.onWidePageLayoutChange(value);
  }

  @Builder
  private screenGroup() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('屏幕样式').fontFamily(TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL.fontFamily).fontWeight(TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL.fontWeight)
        .fontSize(TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL.fontSizeFp).lineHeight(TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL.lineHeightFp as number).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
        .width(this.geometry().title.width)
        .height(this.geometry().title.height)
        .position({ x: this.geometry().title.x,
          y: this.geometry().title.y })
        .opacity(this.geometry().title.opacity * this.presentation().contentOpacity)
        .blur(this.presentation().contentBlur);
      this.segmentRow('direction', 0);
      this.segmentRow('pageTurn', 1);
      this.segmentRow('timeout', 2);
    }
    .width(this.groupWidth()).height(this.geometry().screenHeight).position({ x: 15, y: 5 })
      .translate({ y: this.sharedScrollTranslation() });
  }

  @Builder
  private segmentRow(group: ReaderControlSettingsGroup, row: number) {
    Text(this.groupLabel(group)).width(this.label(row).width).height(this.label(row).height)
      .fontFamily(TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK.fontFamily).fontWeight(TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK.fontWeight)
      .fontSize(readerControlLerp(TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK.fontSizeFp, TYPE_READER_SETTINGS_SEGMENT_LABEL_FULL.fontSizeFp, this.p()))
      .lineHeight(readerControlLerp(TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK.lineHeightFp as number,
        TYPE_READER_SETTINGS_SEGMENT_LABEL_FULL.lineHeightFp as number, this.p()))
      .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1)
      .position({ x: this.label(row).x, y: this.label(row).y })
      .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .clipShape(this.sharedClip(row, false));
    Stack({ alignContent: Alignment.TopStart }) {
      // 1692:3687/3692/3699 paint an 8vp rounded bar. The shared rectangle/path
      // is a scroll visibility mask, not the bar silhouette. Keep that mask on
      // the unpainted parent so it cannot square off this background's corners.
      Stack({ alignContent: Alignment.TopStart }) {
        ForEach(this.groupOptions(group), (option: string, index: number) => {
          Button({ type: ButtonType.Normal, stateEffect: false }) {
            Text(this.optionLabel(group, option))
              .fontFamily(TYPE_READER_SETTINGS_RETAINED_SEGMENT_ROW_VALUE.fontFamily).fontWeight(TYPE_READER_SETTINGS_RETAINED_SEGMENT_ROW_VALUE.fontWeight)
              .fontSize(TYPE_READER_SETTINGS_RETAINED_SEGMENT_ROW_VALUE.fontSizeFp).textAlign(TextAlign.Center).maxLines(1)
              .fontColor(this.optionModifier(group, row, index, option).labelColor())
              .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
          }.padding(0).accessibilitySelected(this.isSegmentActive(group, option))
            .attributeModifier(this.optionModifier(group, row, index, option));
        }, (option: string): string => `reader-control-settings-${group}-${option}`);
      }
      .width(this.bar(row).width).height(this.bar(row).height)
      .attributeModifier(new ReaderPanelFrame('reader-soft-control', this.appThemeScheme))
      .clip(true).position({ x: 0, y: 0 });
    }
    .width(this.bar(row).width).height(this.bar(row).height)
    .position({ x: this.bar(row).x, y: this.bar(row).y })
    .clipShape(this.sharedClip(row, true));
  }

  @Builder
  private addedGroup(group: ReaderControlSettingsAddedGroup, title: string) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width(this.child('divider', 0).width).height(this.child('divider', 0).height)
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme)).opacity(this.child('divider', 0).opacity)
        .position({ x: this.child('divider', 0).x, y: this.child('divider', 0).y });
      Text(title).width(this.child('title', 0).width).height(this.child('title', 0).height)
        .fontFamily(TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL.fontFamily).fontWeight(TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL.fontWeight)
        .fontSize(TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL.fontSizeFp).lineHeight(TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL.lineHeightFp as number).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
        .opacity(this.child('title', 0).opacity)
        .position({ x: this.child('title', 0).x, y: this.child('title', 0).y });
      if (group === 'status') {
        this.toggleRow('隐藏状态栏', 'hideStatusBar', 0);
        this.toggleRow('隐藏底部导航栏', 'hideNavigationBar', 1);
        this.toggleRow('拓展到刘海（灵动岛）', 'extendIntoCutout', 2);
      } else if (group === 'typography') {
        this.justifyToggleRow();
        this.toggleRow('底部对齐', 'alignPageBottom', 1);
      } else {
        this.toggleRow('音量键翻页', 'volumeKeysTurnPage', 0);
        this.toggleRow('息屏终止朗读', 'stopTtsOnScreenOff', 1);
        this.toggleRow('长按选择文本', 'longPressSelectText', 2);
      }
    }
    .width(this.group(group).width).height(this.group(group).height)
    .position({ x: this.group(group).x, y: this.group(group).y })
    .translate({ y: this.fullOnlyScrollTranslation() })
    // Added groups are live motion actors. Avoid an off-screen cache and a
    // visibility mount/unmount at p=0; both can expose a black intermediate
    // frame on device while the parent dock is resizing.
    .opacity(this.group(group).opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .enabled(this.currentInputEnabled() && this.p() > 0)
    .hitTestBehavior(this.p() > 0 ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private toggleRow(label: string, key: ReaderSettingsToggleKey, index: number) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 20 }) {
        Text(label).layoutWeight(1).height(this.geometry().toggleLabelHeight).fontFamily(TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL.fontFamily)
          .fontWeight(TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL.fontWeight).fontSize(TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL.fontSizeFp).lineHeight(TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL.lineHeightFp as number).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
        ReaderControlSwitchTrack({ value: this.toggleValue(key) });
      }.width('100%').alignItems(VerticalAlign.Center)
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }
    .width(this.child('row', index).width).height(this.child('row', index).height)
    .padding(0).backgroundColor(Color.Transparent).borderRadius(0)
    .position({ x: this.child('row', index).x, y: this.child('row', index).y })
    .opacity(this.child('row', index).opacity * (isReaderSettingsToggleAvailable(key) ? 1 : .55))
    .enabled(this.currentInputEnabled() && (this.fixedIsland || this.p() > 0) && isReaderSettingsToggleAvailable(key))
    .accessibilityText(this.toggleAccessibilityText(label, key))
    .onClick((): void => this.handleToggle(key));
  }

  @Builder
  private justifyToggleRow() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 20 }) {
        Text('文字两端对齐').layoutWeight(1).height(this.geometry().toggleLabelHeight).fontFamily(TYPE_READER_SETTINGS_RETAINED_JUSTIFY_TOGGLE_ROW_LABEL.fontFamily)
          .fontWeight(TYPE_READER_SETTINGS_RETAINED_JUSTIFY_TOGGLE_ROW_LABEL.fontWeight).fontSize(TYPE_READER_SETTINGS_RETAINED_JUSTIFY_TOGGLE_ROW_LABEL.fontSizeFp).lineHeight(TYPE_READER_SETTINGS_RETAINED_JUSTIFY_TOGGLE_ROW_LABEL.lineHeightFp as number).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
        ReaderControlSwitchTrack({ value: this.justifyText });
      }.width('100%').alignItems(VerticalAlign.Center)
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }
    .width(this.child('row', 0).width).height(this.child('row', 0).height)
    .padding(0).backgroundColor(Color.Transparent).borderRadius(0)
    .position({ x: this.child('row', 0).x, y: this.child('row', 0).y })
    .opacity(this.child('row', 0).opacity)
    .accessibilityText(`文字两端对齐，${this.justifyText ? '已开启' : '已关闭'}，与阅读样式同步`)
    .onClick((): void => this.handleJustify());
  }

  private handleToggle(key: ReaderSettingsToggleKey): void {
    if (this.currentInputEnabled() && (this.fixedIsland || this.p() > 0) && isReaderSettingsToggleAvailable(key)) {
      this.onToggleChange(key, !this.toggleValue(key));
    }
  }

  private handleJustify(): void {
    if (this.currentInputEnabled() && (this.fixedIsland || this.p() > 0)) this.onJustifyTextChange(!this.justifyText);
  }

  private groupOptions(group: ReaderControlSettingsGroup): string[] {
    if (group === 'direction') {
      return SETTINGS_DIRECTION_OPTIONS;
    }
    if (group === 'pageTurn') {
      return SETTINGS_PAGE_OPTIONS;
    }
    return SETTINGS_TIMEOUT_OPTIONS;
  }

  private groupLabel(group: ReaderControlSettingsGroup): string {
    return readerControlSettingsGroupLabel(group);
  }

  private optionLabel(group: ReaderControlSettingsGroup, option: string): string {
    return readerControlSettingsOptionLabel(group, option);
  }

  private isSegmentActive(group: ReaderControlSettingsGroup, option: string): boolean {
    if (group === 'direction') {
      return this.snapshot.screenDirection === option;
    }
    if (group === 'pageTurn') {
      return readerPageTurnStyle(this.snapshot) === option;
    }
    return this.snapshot.screenTimeout === option;
  }

  private isSegmentAvailable(group: ReaderControlSettingsGroup, option: string): boolean {
    if (group === 'direction') {
      return isReaderScreenDirectionAvailable(option as ReaderScreenDirection);
    }
    if (group === 'pageTurn') {
      if (option === 'simulation' && !this.pageTurnSimulationAvailable) {
        return false;
      }
      return isReaderPageTurnStyleAvailable(option as ReaderPageTurnStyle);
    }
    return isReaderScreenTimeoutAvailable(option as ReaderScreenTimeout);
  }

  private segmentAccessibilityText(group: ReaderControlSettingsGroup, option: string): string {
    const label = this.optionLabel(group, option);
    if (!this.isSegmentAvailable(group, option)) {
      return `${label}，当前宿主能力不可用`;
    }
    return `${this.groupLabel(group)}，${label}`;
  }

  private handleSegment(group: ReaderControlSettingsGroup, option: string): void {
    if (!this.currentInputEnabled() || !this.isSegmentAvailable(group, option)) {
      return;
    }
    if (group === 'direction') {
      this.onScreenDirectionChange(option as ReaderScreenDirection);
    } else if (group === 'pageTurn') {
      this.onPageTurnStyleChange(option as ReaderPageTurnStyle);
    } else {
      this.onScreenTimeoutChange(option as ReaderScreenTimeout);
    }
  }

  private toggleValue(key: ReaderSettingsToggleKey): boolean {
    if (key === 'hideStatusBar') {
      return this.snapshot.hideStatusBar;
    }
    if (key === 'hideNavigationBar') {
      return this.snapshot.hideNavigationBar;
    }
    if (key === 'extendIntoCutout') {
      return this.snapshot.extendIntoCutout;
    }
    if (key === 'justifyText') {
      return this.snapshot.justifyText;
    }
    if (key === 'alignPageBottom') {
      return this.snapshot.alignPageBottom;
    }
    if (key === 'volumeKeysTurnPage') {
      return this.snapshot.volumeKeysTurnPage;
    }
    if (key === 'stopTtsOnScreenOff') {
      return this.snapshot.stopTtsOnScreenOff;
    }
    return this.snapshot.longPressSelectText;
  }

  private toggleAccessibilityText(label: string, key: ReaderSettingsToggleKey): string {
    if (!isReaderSettingsToggleAvailable(key)) {
      return `${label}，当前宿主能力不可用，已关闭`;
    }
    return `${label}，${this.toggleValue(key) ? '已开启' : '已关闭'}`;
  }
}
