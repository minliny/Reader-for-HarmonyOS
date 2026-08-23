import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_READ_ELEVATED,
  TOK_READ_HANDLE,
  TOK_READ_INK,
  TOK_READ_PRIMARY,
  TOK_READ_SURFACE,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';
import {
  createDefaultReaderSettingsSnapshot,
  isReaderPageTurnStyleAvailable,
  isReaderScreenDirectionAvailable,
  isReaderScreenTimeoutAvailable,
  isReaderSettingsToggleAvailable,
  type ReaderPageTurnStyle,
  type ReaderScreenDirection,
  type ReaderScreenTimeout,
  type ReaderSettingsSnapshot,
  type ReaderSettingsToggleKey,
} from './ReaderSettingsState';
import {
  READER_FULL_PANEL_HEIGHT_PHONE,
  READER_FULL_PANEL_HEIGHT_TABLET,
  READER_FULL_PANEL_MAX_WIDTH_PHONE,
  READER_FULL_PANEL_MAX_WIDTH_TABLET,
} from './ReaderLayoutGeometry';

type ReaderSettingsFullSegmentGroup = 'direction' | 'pageTurn' | 'timeout';

/**
 * Figma Reader Settings complete control sheet.
 *
 * Sources: Phone `942:86` / `936:66`; Tablet `942:88` / `938:62`.
 * The component is presentation-only. Host-backed controls stay in the exact
 * Figma rows but remain disabled until a formal window/audio capability is
 * admitted by the owner.
 */
@Component
export struct ReaderSettingsFullPanel {
  @Prop isTablet: boolean = false;
  @Prop availableWidth: number = 0;
  @Prop availableHeight: number = 0;
  @Prop snapshot: ReaderSettingsSnapshot = createDefaultReaderSettingsSnapshot();
  @Prop justifyText: boolean = true;
  onCollapse: () => void = (): void => {};
  onScreenDirectionChange: (direction: ReaderScreenDirection) => void =
    (_direction: ReaderScreenDirection): void => {};
  onPageTurnStyleChange: (style: ReaderPageTurnStyle) => void =
    (_style: ReaderPageTurnStyle): void => {};
  onScreenTimeoutChange: (timeout: ReaderScreenTimeout) => void =
    (_timeout: ReaderScreenTimeout): void => {};
  onToggleChange: (key: ReaderSettingsToggleKey, value: boolean) => void =
    (_key: ReaderSettingsToggleKey, _value: boolean): void => {};
  onJustifyTextChange: (value: boolean) => void = (_value: boolean): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(42)
        .height(4)
        .backgroundColor(TOK_READ_HANDLE)
        .borderRadius(999)
        .position({ x: this.handleX(), y: 9 });

      this.header();

      Row()
        .width(this.viewportWidth())
        .height(this.viewportHeight())
        .backgroundColor(TOK_SURFACE_PANEL)
        .border({ width: TOK_BORDER_W, color: TOK_LINE })
        .borderRadius(12)
        .position({ x: 13, y: 57 });

      Scroll() {
        Stack({ alignContent: Alignment.TopStart }) {
          this.screenStyleSection();
          this.navigationSection();
          this.layoutSection();
          this.controlSection();
        }
        .width(this.viewportWidth())
        .height(780);
      }
      .width(this.viewportWidth())
      .height(this.viewportHeight())
      .scrollBar(BarState.Off)
      .position({ x: 13, y: 57 });
    }
    .width(this.sheetWidth())
    .height(this.sheetHeight())
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(24)
    .clip(true);
  }

  @Builder
  private header() {
    Row() {
      Image($r('app.media.rc_settings'))
        .width(20)
        .height(20)
        .fillColor(TOK_READ_INK);
      Text('设置')
        .width(28)
        .height(17)
        .margin({ left: 8 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .lineHeight(16.8)
        .fontColor(TOK_READ_INK)
        .maxLines(1);
      Blank();
      Text('收起')
        .width(40)
        .height(26)
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .borderRadius(8)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .fontColor(TOK_READ_PRIMARY)
        .textAlign(TextAlign.Center)
        .accessibilityText('收起阅读设置')
        .onClick((): void => this.onCollapse());
    }
    .width(this.headerWidth())
    .height(30)
    .alignItems(VerticalAlign.Center)
    .position({ x: 13, y: 19 });
  }

  @Builder
  private screenStyleSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sectionTitle('屏幕样式', false);
      Stack({ alignContent: Alignment.TopStart }) {
        this.fullSegmentRow('direction', 0);
        this.fullSegmentRow('pageTurn', 1);
        this.fullSegmentRow('timeout', 2);
      }
      .width(this.sectionWidth())
      .height(216)
      .position({ x: 0, y: 30 });
    }
    .width(this.sectionWidth())
    .height(258)
    .position({ x: 14, y: 4 });
  }

  @Builder
  private fullSegmentRow(group: ReaderSettingsFullSegmentGroup, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.groupLabel(group))
        .width('100%')
        .height(16)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(11)
        .fontColor(TOK_READ_INK)
        .maxLines(1)
        .position({ x: 0, y: 8 });

      Row({ space: 3 }) {
        ForEach(this.groupOptions(group), (option: string) => {
          this.fullSegmentOption(group, option);
        }, (option: string): string => `reader-settings-full-${group}-${option}`);
      }
      .width('100%')
      .height(33)
      .padding(3)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .borderRadius(8)
      .position({ x: 0, y: 31 });
    }
    .width(this.sectionWidth())
    .height(72)
    .position({ x: 0, y: index * 72 });
  }

  @Builder
  private fullSegmentOption(group: ReaderSettingsFullSegmentGroup, option: string) {
    Text(this.optionLabel(group, option))
      .layoutWeight(1)
      .height(27)
      .backgroundColor(this.isSegmentActive(group, option) ? TOK_READ_ELEVATED : Color.Transparent)
      .borderRadius(6)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Medium)
      .fontSize(9)
      .fontColor(this.isSegmentActive(group, option) ? TOK_READ_PRIMARY : TOK_READ_INK)
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .enabled(this.isSegmentAvailable(group, option))
      .accessibilityText(this.segmentAccessibilityText(group, option))
      .onClick((): void => this.handleSegment(group, option));
  }

  @Builder
  private navigationSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sectionTitle('导航状态栏', true);
      Stack({ alignContent: Alignment.TopStart }) {
        this.toggleRow('隐藏状态栏', 'hideStatusBar', 0);
        this.toggleRow('隐藏导航栏', 'hideNavigationBar', 1);
        this.toggleRow('拓展到刘海（灵动岛）', 'extendIntoCutout', 2);
      }
      .width(this.sectionWidth())
      .height(114)
      .position({ x: 0, y: 43 });
    }
    .width(this.sectionWidth())
    .height(169)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_LINE })
    .position({ x: 14, y: 262 });
  }

  @Builder
  private layoutSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sectionTitle('排版', true);
      Stack({ alignContent: Alignment.TopStart }) {
        this.justifyToggleRow(0);
        this.toggleRow('底部对齐', 'alignPageBottom', 1);
      }
      .width(this.sectionWidth())
      .height(76)
      .position({ x: 0, y: 43 });
    }
    .width(this.sectionWidth())
    .height(131)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_LINE })
    .position({ x: 14, y: 431 });
  }

  @Builder
  private controlSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sectionTitle('控制', true);
      Stack({ alignContent: Alignment.TopStart }) {
        this.toggleRow('音量键翻页', 'volumeKeysTurnPage', 0);
        this.toggleRow('息屏终止朗读', 'stopTtsOnScreenOff', 1);
        this.toggleRow('长按选择文本', 'longPressSelectText', 2);
      }
      .width(this.sectionWidth())
      .height(114)
      .position({ x: 0, y: 43 });
    }
    .width(this.sectionWidth())
    .height(169)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_LINE })
    .position({ x: 14, y: 562 });
  }

  @Builder
  private sectionTitle(label: string, insetTop: boolean) {
    Text(label)
      .width(this.sectionWidth() - 8)
      .height(14)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(12)
      .lineHeight(14.4)
      .letterSpacing(0.48)
      .fontColor(TOK_READ_INK)
      .maxLines(1)
      .position({ x: 0, y: insetTop ? 21 : 8 });
  }

  @Builder
  private toggleRow(label: string, key: ReaderSettingsToggleKey, index: number) {
    Row() {
      Text(label)
        .layoutWeight(1)
        .height(13)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(11)
        .lineHeight(13.2)
        .fontColor(TOK_READ_INK)
        .maxLines(1);
      this.toggleTrack(this.toggleValue(key));
    }
    .width(this.sectionWidth())
    .height(38)
    .alignItems(VerticalAlign.Center)
    .position({ x: 0, y: index * 38 })
    .enabled(isReaderSettingsToggleAvailable(key))
    .opacity(isReaderSettingsToggleAvailable(key) ? 1 : 0.55)
    .accessibilityText(this.toggleAccessibilityText(label, key))
    .onClick((): void => {
      if (isReaderSettingsToggleAvailable(key)) {
        this.onToggleChange(key, !this.toggleValue(key));
      }
    });
  }

  @Builder
  private justifyToggleRow(index: number) {
    Row() {
      Text('文字两端对齐')
        .layoutWeight(1)
        .height(13)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(11)
        .lineHeight(13.2)
        .fontColor(TOK_READ_INK)
        .maxLines(1);
      this.toggleTrack(this.justifyText);
    }
    .width(this.sectionWidth())
    .height(38)
    .alignItems(VerticalAlign.Center)
    .position({ x: 0, y: index * 38 })
    .accessibilityText(`文字两端对齐，${this.justifyText ? '已开启' : '已关闭'}，与阅读样式同步`)
    .onClick((): void => this.onJustifyTextChange(!this.justifyText));
  }

  @Builder
  private toggleTrack(value: boolean) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(44)
        .height(24)
        .backgroundColor(value ? TOK_READ_PRIMARY : '#AAA39A')
        .borderRadius(999);
      Row()
        .width(20)
        .height(20)
        .backgroundColor(TOK_READ_ELEVATED)
        .borderRadius(10)
        .position({ x: value ? 22 : 2, y: 2 });
    }
    .width(44)
    .height(24);
  }

  private sheetWidth(): number {
    const designWidth = this.isTablet ? READER_FULL_PANEL_MAX_WIDTH_TABLET :
      READER_FULL_PANEL_MAX_WIDTH_PHONE;
    return this.availableWidth > 0 ? Math.min(designWidth, this.availableWidth) : designWidth;
  }

  private sheetHeight(): number {
    const designHeight = this.isTablet ? READER_FULL_PANEL_HEIGHT_TABLET : READER_FULL_PANEL_HEIGHT_PHONE;
    return this.availableHeight > 0 ? Math.min(designHeight, this.availableHeight) : designHeight;
  }

  private headerWidth(): number {
    return Math.max(0, this.sheetWidth() - 26);
  }

  private viewportWidth(): number {
    return Math.max(0, this.sheetWidth() - 26);
  }

  private viewportHeight(): number {
    return Math.max(0, this.sheetHeight() - 70);
  }

  private sectionWidth(): number {
    return Math.max(0, this.viewportWidth() - 30);
  }

  private handleX(): number {
    const designX = this.isTablet ? 490 : 135;
    return Math.min(designX, Math.max(0, this.sheetWidth() - 42));
  }

  private groupOptions(group: ReaderSettingsFullSegmentGroup): string[] {
    if (group === 'direction') {
      return ['system', 'portrait', 'landscape'];
    }
    if (group === 'pageTurn') {
      return ['cover', 'slide', 'simulation', 'scroll', 'none'];
    }
    return ['system', 'oneMinute', 'fiveMinutes', 'tenMinutes', 'alwaysOn'];
  }

  private groupLabel(group: ReaderSettingsFullSegmentGroup): string {
    if (group === 'direction') {
      return '屏幕方向';
    }
    if (group === 'pageTurn') {
      return '翻页样式';
    }
    return '屏幕超时';
  }

  private optionLabel(group: ReaderSettingsFullSegmentGroup, option: string): string {
    if (group === 'direction') {
      if (option === 'system') {
        return '跟随系统';
      }
      return option === 'portrait' ? '竖屏' : '横屏';
    }
    if (group === 'pageTurn') {
      if (option === 'cover') {
        return '覆盖';
      }
      if (option === 'slide') {
        return '滑动';
      }
      if (option === 'simulation') {
        return '仿真';
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

  private isSegmentActive(group: ReaderSettingsFullSegmentGroup, option: string): boolean {
    if (group === 'direction') {
      return this.snapshot.screenDirection === option;
    }
    if (group === 'pageTurn') {
      return this.snapshot.pageTurnStyle === option;
    }
    return this.snapshot.screenTimeout === option;
  }

  private isSegmentAvailable(group: ReaderSettingsFullSegmentGroup, option: string): boolean {
    if (group === 'direction') {
      return isReaderScreenDirectionAvailable(option as ReaderScreenDirection);
    }
    if (group === 'pageTurn') {
      return isReaderPageTurnStyleAvailable(option as ReaderPageTurnStyle);
    }
    return isReaderScreenTimeoutAvailable(option as ReaderScreenTimeout);
  }

  private segmentAccessibilityText(group: ReaderSettingsFullSegmentGroup, option: string): string {
    const label = this.optionLabel(group, option);
    if (!this.isSegmentAvailable(group, option)) {
      return `${label}，当前宿主能力不可用`;
    }
    return `${this.groupLabel(group)}，${label}`;
  }

  private handleSegment(group: ReaderSettingsFullSegmentGroup, option: string): void {
    if (!this.isSegmentAvailable(group, option)) {
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
