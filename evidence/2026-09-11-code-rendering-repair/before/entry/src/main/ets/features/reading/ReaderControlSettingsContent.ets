import { PathShape } from '@ohos.arkui.shape';
import { sampleReaderControlMotionPresentation, readerControlMotionClipRects, readerControlMotionClipPath,
  type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { createReaderControlMorphScroll, advanceReaderControlMorphScroll, observeReaderControlMorphScroll,
  readerControlMorphScrollTranslation, readerControlMorphScrollExtent, readerControlMorphScrollAllowsNative,
  type ReaderControlMorphScrollState } from './ReaderControlMorphScroll';
import { registerReaderFonts } from '../common/ReaderFonts';
import { TOK_BORDER_W, TOK_LINE, TOK_READ_ELEVATED, TOK_READ_INK,
  TOK_READ_PRIMARY, TOK_SURFACE_PANEL, TOK_SURFACE_PANEL_SOFT } from '../common/ReaderTokens';
import { ReaderControlSwitchTrack } from './ReaderControlSwitchTrack';
import { createDefaultReaderSettingsSnapshot, isReaderPageTurnStyleAvailable,
  isReaderScreenDirectionAvailable, isReaderScreenTimeoutAvailable, isReaderSettingsToggleAvailable,
  readerPageTurnStyle, type ReaderPageTurnStyle, type ReaderScreenDirection,
  type ReaderScreenTimeout, type ReaderSettingsSnapshot, type ReaderSettingsToggleKey } from './ReaderSettingsState';
import { readerControlLerp, readerControlUnit, type ReaderControlActorFrame } from './ReaderControlActorGeometry';
import { readerControlSettingsLabel, readerControlSettingsBar, readerControlSettingsChoice,
  readerControlSettingsScreenTitle, readerControlSettingsAddedGroup, readerControlSettingsAddedChild,
  sampleReaderControlSettings, type ReaderControlSettingsFrame,
  type ReaderControlSettingsGroup, type ReaderControlSettingsAddedGroup } from './ReaderControlSettingsGeometry';

const SETTINGS_DIRECTION_OPTIONS: string[] = ['system', 'portrait', 'landscape'];
const SETTINGS_PAGE_OPTIONS: string[] = ['cover', 'slide', 'simulation', 'scroll', 'none'];
const SETTINGS_TIMEOUT_OPTIONS: string[] = ['system', 'oneMinute', 'fiveMinutes', 'tenMinutes', 'alwaysOn'];

/** Restored Settings 1692:3071 viewport only. One persistent Screen group and
 * three mounted AddedModules consume the caller's p; no shell, local clock,
 * page swap, dropdown substitution or text scaling. State stays with the Host. */
@Component
export struct ReaderControlSettingsContent {
  @Prop @Watch('onMotionChanged') motionProgress: number = 0;
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop @Watch('onMotionChanged') interactionEnabled: boolean = true;
  @Prop snapshot: ReaderSettingsSnapshot = createDefaultReaderSettingsSnapshot();
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
  onJustifyTextChange: (value: boolean) => void = (_value: boolean): void => {};
  @State private scrollMotion: ReaderControlMorphScrollState = createReaderControlMorphScroll();
  @Prop fullViewportHeight: number = 666;
  private scroller: Scroller = new Scroller();
  private cachedGeometry: ReaderControlSettingsFrame | undefined = undefined;
  private geometryProgress: number = -1;
  private geometryWidth: number = -1;
  private cachedPaint: ReaderControlMotionPresentation | undefined = undefined;
  private paintProgress: number = -1;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  private p(): number { return readerControlUnit(this.motionProgress); }
  private fullInput(): boolean { return this.interactionEnabled && this.p() === 1; }
  private scrollContentHeight(): number {
    return Math.max(readerControlLerp(190, 732, this.p()), this.availableHeight + readerControlMorphScrollExtent(this.scrollMotion));
  }
  private onMotionChanged(): void { this.syncMorphScroll(); }
  private syncMorphScroll(): void {
    const update = advanceReaderControlMorphScroll(this.scrollMotion, this.motionProgress,
      this.interactionEnabled, this.scroller.currentOffset().yOffset);
    this.scrollMotion = update.state;
    if (update.targetOffset !== undefined) {
      this.scroller.scrollTo({ xOffset: 0, yOffset: update.targetOffset, animation: false });
      this.onFullDidScroll();
    }
  }
  private onFullDidScroll(): void {
    this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion,
      this.scroller.currentOffset().yOffset, this.fullInput());
  }
  private nativeScrollDelta(y: number, source: ScrollSource): OffsetResult {
    return { xOffset: 0, yOffset: readerControlMorphScrollAllowsNative(this.scrollMotion,
      this.fullInput(), source === ScrollSource.SCROLLER) ? y : 0 };
  }
  private sharedScrollTranslation(): number {
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress);
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
    if (this.cachedGeometry === undefined || this.geometryProgress !== progress ||
      this.geometryWidth !== this.availableWidth) {
      this.geometryProgress = progress;
      this.geometryWidth = this.availableWidth;
      this.cachedGeometry = sampleReaderControlSettings(progress, this.availableWidth);
    }
    return this.cachedGeometry;
  }
  private sharedRect(row: number, bar: boolean, p: number): ReaderControlMotionClipRect {
    const actor = bar ? readerControlSettingsBar(row, p, this.availableWidth) : readerControlSettingsLabel(row, p);
    return { x: actor.x + 15, y: actor.y + 5, width: actor.width, height: actor.height };
  }
  private sharedClip(row: number, bar: boolean): PathShape {
    return new PathShape().commands(readerControlMotionClipPath(readerControlMotionClipRects(this.p(),
      this.sharedRect(row, bar, 1), this.sharedRect(row, bar, this.p()), this.sharedRect(row, bar, 0),
      this.fullViewportHeight, this.scrollMotion.fullScrollOffset), this.getUIContext().vp2px(1)));
  }
  private label(index: number): ReaderControlActorFrame {
    return this.geometry().labels[index];
  }
  private bar(index: number): ReaderControlActorFrame {
    return this.geometry().bars[index];
  }
  private choice(group: ReaderControlSettingsGroup, row: number, index: number): ReaderControlActorFrame {
    return group === 'direction' ? this.geometry().directionChoices[index] : this.geometry().pageChoices[index];
  }
  private group(group: ReaderControlSettingsAddedGroup): ReaderControlActorFrame {
    return this.geometry().groups[group === 'status' ? 0 : group === 'typography' ? 1 : 2];
  }
  private child(kind: 'divider' | 'title' | 'row', index: number): ReaderControlActorFrame {
    return this.geometry().children[kind === 'divider' ? 0 : kind === 'title' ? 1 : 2 + index];
  }

  build() {
    Scroll(this.scroller) {
      Stack({ alignContent: Alignment.TopStart }) {
        this.screenGroup();
        this.addedGroup('status', '导航状态栏');
        this.addedGroup('typography', '排版');
        this.addedGroup('control', '控制');
      }
      .width(this.availableWidth)
      .height(this.scrollContentHeight());
    }
    .width(this.availableWidth).height(this.availableHeight)
    .scrollBar(BarState.Off).edgeEffect(EdgeEffect.None)
    .enableScrollInteraction(this.fullInput())
    .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult =>
      this.nativeScrollDelta(y, source))
    .onDidScroll((): void => this.onFullDidScroll())
    .enabled(this.interactionEnabled)
    .clip(true);
  }

  @Builder
  private screenGroup() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('屏幕样式').fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold)
        .fontSize(11).lineHeight(16).fontColor(TOK_READ_PRIMARY)
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
    .width(this.groupWidth()).height(258).position({ x: 15, y: 5 })
      .translate({ y: this.sharedScrollTranslation() });
  }

  @Builder
  private segmentRow(group: ReaderControlSettingsGroup, row: number) {
    Text(this.groupLabel(group)).width(this.label(row).width).height(this.label(row).height)
      .fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold)
      .fontSize(11).lineHeight(16).fontColor(TOK_READ_INK).maxLines(1)
      .position({ x: this.label(row).x, y: this.label(row).y })
      .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .clipShape(this.sharedClip(row, false));
    Stack({ alignContent: Alignment.TopStart }) {
      ForEach(this.groupOptions(group), (option: string, index: number) => {
        Text(this.optionLabel(group, option))
          .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
          .width(this.choice(group, row, index).width).height(this.choice(group, row, index).height)
          .position({ x: this.choice(group, row, index).x, y: this.choice(group, row, index).y })
          .backgroundColor(this.isSegmentActive(group, option) ? TOK_READ_ELEVATED : Color.Transparent)
          .borderRadius(6).fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Medium)
          .fontSize(9).fontColor(this.isSegmentActive(group, option) ? TOK_READ_PRIMARY : TOK_READ_INK)
          .textAlign(TextAlign.Center).maxLines(1)
          .enabled(this.interactionEnabled && this.isSegmentAvailable(group, option))
          .accessibilityText(this.segmentAccessibilityText(group, option))
          .onClick((): void => this.handleSegment(group, option));
      }, (option: string): string => `reader-control-settings-${group}-${option}`);
    }
    .width(this.bar(row).width).height(this.bar(row).height)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT).borderRadius(8)
    .position({ x: this.bar(row).x, y: this.bar(row).y })
    .clipShape(this.sharedClip(row, true));
  }

  @Builder
  private addedGroup(group: ReaderControlSettingsAddedGroup, title: string) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width(this.child('divider', 0).width).height(this.child('divider', 0).height)
        .backgroundColor(TOK_LINE).opacity(this.child('divider', 0).opacity)
        .position({ x: this.child('divider', 0).x, y: this.child('divider', 0).y });
      Text(title).width(this.child('title', 0).width).height(this.child('title', 0).height)
        .fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold)
        .fontSize(11).lineHeight(16).fontColor(TOK_READ_PRIMARY)
        .opacity(this.child('title', 0).opacity)
        .position({ x: this.child('title', 0).x, y: this.child('title', 0).y });
      if (group === 'status') {
        this.toggleRow('隐藏状态栏', 'hideStatusBar', 0);
        this.toggleRow('隐藏导航栏', 'hideNavigationBar', 1);
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
    .enabled(this.interactionEnabled && this.p() > 0)
    .hitTestBehavior(this.p() > 0 ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private toggleRow(label: string, key: ReaderSettingsToggleKey, index: number) {
    Row({ space: 20 }) {
      Text(label).layoutWeight(1).height(16).fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium).fontSize(11).lineHeight(16).fontColor(TOK_READ_INK).maxLines(1);
      ReaderControlSwitchTrack({ value: this.toggleValue(key) });
    }
    .width(this.child('row', index).width).height(this.child('row', index).height)
    .alignItems(VerticalAlign.Center)
    .position({ x: this.child('row', index).x, y: this.child('row', index).y })
    .opacity(this.child('row', index).opacity * (isReaderSettingsToggleAvailable(key) ? 1 : .55))
    .enabled(this.interactionEnabled && this.p() > 0 && isReaderSettingsToggleAvailable(key))
    .accessibilityText(this.toggleAccessibilityText(label, key))
    .onClick((): void => this.handleToggle(key));
  }

  @Builder
  private justifyToggleRow() {
    Row({ space: 20 }) {
      Text('文字两端对齐').layoutWeight(1).height(16).fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium).fontSize(11).lineHeight(16).fontColor(TOK_READ_INK).maxLines(1);
      ReaderControlSwitchTrack({ value: this.justifyText });
    }
    .width(this.child('row', 0).width).height(this.child('row', 0).height)
    .alignItems(VerticalAlign.Center)
    .position({ x: this.child('row', 0).x, y: this.child('row', 0).y })
    .opacity(this.child('row', 0).opacity)
    .accessibilityText(`文字两端对齐，${this.justifyText ? '已开启' : '已关闭'}，与阅读样式同步`)
    .onClick((): void => this.handleJustify());
  }

  private handleToggle(key: ReaderSettingsToggleKey): void {
    if (this.interactionEnabled && this.p() > 0 && isReaderSettingsToggleAvailable(key)) {
      this.onToggleChange(key, !this.toggleValue(key));
    }
  }

  private handleJustify(): void {
    if (this.interactionEnabled && this.p() > 0) this.onJustifyTextChange(!this.justifyText);
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
    if (group === 'direction') {
      return '屏幕方向';
    }
    if (group === 'pageTurn') {
      return '翻页样式';
    }
    return '屏幕超时';
  }

  private optionLabel(group: ReaderControlSettingsGroup, option: string): string {
    if (group === 'direction') {
      if (option === 'system') {
        return '跟随系统';
      }
      return option === 'portrait' ? '竖屏' : '横屏';
    }
    if (group === 'pageTurn') {
      if (option === 'simulation') {
        return '仿真';
      }
      if (option === 'cover') {
        return '覆盖';
      }
      if (option === 'slide') {
        return '滑动';
      }
      if (option === 'scroll') {
        return '滚动';
      }
      return '无动画';
    }
    if (option === 'system') {
      return '跟随系统';
    }
    if (option === 'oneMinute') {
      return '1 分钟';
    }
    if (option === 'fiveMinutes') {
      return '5 分钟';
    }
    if (option === 'tenMinutes') {
      return '10 分钟';
    }
    return '始终开启';
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
    if (!this.interactionEnabled || !this.isSegmentAvailable(group, option)) {
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
