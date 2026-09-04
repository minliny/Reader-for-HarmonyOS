import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE_STRONG,
  TOK_READ_DISABLED_BG,
  TOK_READ_ELEVATED,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
} from '../common/ReaderTokens';
import {
  createDefaultReaderSettingsSnapshot,
  isReaderPageTurnStyleAvailable,
  isReaderScreenDirectionAvailable,
  isReaderScreenTimeoutAvailable,
  readerPageTurnStyle,
  type ReaderPageTurnStyle,
  type ReaderScreenDirection,
  type ReaderScreenTimeout,
  type ReaderSettingsSnapshot,
} from './ReaderSettingsState';

type ReaderSettingsSegmentGroup = 'direction' | 'pageTurn' | 'timeout';

/**
 * Figma Reader Settings quick content only.
 *
 * Sources: Phone `942:70` / `924:69`; Tablet `942:72` / `926:65`.
 * The owner supplies state, Host application and persistence. Privileged or
 * unimplemented options remain at their exact Figma positions but cannot
 * receive input.
 */
@Component
export struct ReaderSettingsModulePanel {
  @Prop isTablet: boolean = false;
  @Prop snapshot: ReaderSettingsSnapshot = createDefaultReaderSettingsSnapshot();
  @Prop pageTurnSimulationAvailable: boolean = true;
  onScreenDirectionChange: (direction: ReaderScreenDirection) => void =
    (_direction: ReaderScreenDirection): void => {};
  onPageTurnStyleChange: (style: ReaderPageTurnStyle) => void =
    (_style: ReaderPageTurnStyle): void => {};
  onScreenTimeoutChange: (timeout: ReaderScreenTimeout) => void =
    (_timeout: ReaderScreenTimeout): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column({ space: 7 }) {
        this.segmentRow('direction');
        this.segmentRow('pageTurn');
        this.segmentRow('timeout');
      }
      .width('100%')
      .constraintSize({ maxWidth: this.contentWidth() })
      .height(160)
      .padding({ left: 8, right: 8, top: 7, bottom: 8 })
      .alignItems(HorizontalAlign.Start);
    }
    .width('100%')
    .constraintSize({ maxWidth: this.panelWidth() })
    .height(190)
    .padding({ left: 11, right: 11, top: 13, bottom: 17 })
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private segmentRow(group: ReaderSettingsSegmentGroup) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.groupLabel(group))
        .width('100%')
        .height(12)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .lineHeight(12)
        .fontColor(TOK_READ_MUTED)
        .maxLines(1)
        .position({ x: 0, y: 0 });

      Row({ space: 2 }) {
        ForEach(this.groupOptions(group), (option: string) => {
          this.segmentOption(group, option);
        }, (option: string): string => `reader-settings-quick-${group}-${option}`);
      }
      .width('100%')
      .height(30)
      .padding(3)
      .backgroundColor(TOK_READ_DISABLED_BG)
      .borderRadius(8)
      .position({ x: 0, y: 17 });
    }
    .width('100%')
    .height(47);
  }

  @Builder
  private segmentOption(group: ReaderSettingsSegmentGroup, option: string) {
    Text(this.optionLabel(group, option))
      .layoutWeight(1)
      .height(24)
      .padding({ left: 3, right: 3 })
      .backgroundColor(this.isActive(group, option) ? TOK_READ_ELEVATED : Color.Transparent)
      .borderRadius(6)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(this.isActive(group, option) ? FontWeight.Bold : FontWeight.Medium)
      .fontSize(9)
      .fontColor(this.isActive(group, option) ? TOK_READ_PRIMARY : TOK_READ_MUTED)
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .enabled(this.isAvailable(group, option))
      .accessibilityText(this.optionAccessibilityText(group, option))
      .onClick((): void => this.handleOption(group, option));
  }

  private panelWidth(): number {
    return this.isTablet ? 262 : 286;
  }

  private contentWidth(): number {
    return this.isTablet ? 240 : 264;
  }

  private groupOptions(group: ReaderSettingsSegmentGroup): string[] {
    if (group === 'direction') {
      return ['system', 'portrait', 'landscape'];
    }
    if (group === 'pageTurn') {
      // Figma Phone 924:89: Cover, Slide, Simulation, Scroll, None.
      return ['cover', 'slide', 'simulation', 'scroll', 'none'];
    }
    return ['system', 'oneMinute', 'fiveMinutes', 'tenMinutes', 'alwaysOn'];
  }

  private groupLabel(group: ReaderSettingsSegmentGroup): string {
    if (group === 'direction') {
      return '屏幕方向';
    }
    if (group === 'pageTurn') {
      return '翻页样式';
    }
    return '屏幕超时';
  }

  private optionLabel(group: ReaderSettingsSegmentGroup, option: string): string {
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

  private isActive(group: ReaderSettingsSegmentGroup, option: string): boolean {
    if (group === 'direction') {
      return this.snapshot.screenDirection === option;
    }
    if (group === 'pageTurn') {
      return readerPageTurnStyle(this.snapshot) === option;
    }
    return this.snapshot.screenTimeout === option;
  }

  private isAvailable(group: ReaderSettingsSegmentGroup, option: string): boolean {
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

  private optionAccessibilityText(group: ReaderSettingsSegmentGroup, option: string): string {
    const label = this.optionLabel(group, option);
    if (!this.isAvailable(group, option)) {
      return `${label}，当前宿主能力不可用`;
    }
    return `${this.groupLabel(group)}，${label}`;
  }

  private handleOption(group: ReaderSettingsSegmentGroup, option: string): void {
    if (!this.isAvailable(group, option)) {
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
}
