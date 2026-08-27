import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_PRIMARY_SOFT,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_DISABLED_BG,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
} from '../common/ReaderTokens';
import {
  createDefaultReaderAppearanceSnapshot,
  isReaderAppearanceFont,
  type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceTheme,
} from './ReaderAppearanceState';
import {
  readerAppearanceFontSlotFamily,
  readerAppearanceFontSlotLabel,
} from './ReaderAppearanceRenderStyle';

/**
 * Figma Reader Quick Appearance content: Phone `942:66`, Tablet `942:68`.
 *
 * This is the responsive 286/262×190 module content. Its owner places it in the existing
 * Reader Control dock and owns state/persistence. Every visual font slot from
 * Figma remains present. The active `宋体` slot is backed by the bundled
 * Noto Serif SC files, per the product font substitution decision.
 */
@Component
export struct ReaderAppearanceModulePanel {
  @Prop isTablet: boolean = false;
  @Prop snapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  onThemeChange: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onFontChange: (font: ReaderAppearanceFont) => void = (_font: ReaderAppearanceFont): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.themeSection();
      this.fontSection();
    }
    .width('100%')
    .constraintSize({ maxWidth: this.panelWidth() })
    .height(190)
    .padding({ left: this.sectionX(), right: this.sectionRightGap() })
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private themeSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('主题库')
          .layoutWeight(1)
          .constraintSize({ maxWidth: this.themeTitleWidth() })
          .height(10)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(9)
          .lineHeight(9.9)
          .fontColor(TOK_READ_INK);

        Text(this.themeSummary())
          .width(88)
          .height(9)
          .margin({ left: this.themeSummaryGap(), top: 3.95 })
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Medium)
          .fontSize(this.isTablet ? 8 : 7.5)
          .lineHeight(8)
          .fontColor(TOK_READ_MUTED)
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
      .width('100%')
      .height(13.95)
      .alignItems(VerticalAlign.Top)
      .position({ x: 0, y: 3 });

      Column({ space: 4 }) {
        this.themeGridRow(0);
        this.themeGridRow(4);
      }
      .width('100%')
      .constraintSize({ maxWidth: this.sectionWidth() })
      .height(52)
      .position({ x: 0, y: 21.9 });
    }
    .width('100%')
    .constraintSize({ maxWidth: this.sectionWidth() })
    .height(75.9)
    .position({ x: 0, y: this.themeSectionY() });
  }

  @Builder
  private themeGridRow(startIndex: number) {
    Row({ space: 4 }) {
      ForEach(this.themeIds().slice(startIndex, startIndex + 4), (theme: ReaderAppearanceTheme) => {
        this.compactThemeCell(theme);
      }, (theme: ReaderAppearanceTheme): string => `reader-appearance-quick-theme-${theme}`);
    }
    .width('100%')
    .height(24);
  }

  @Builder
  private compactThemeCell(theme: ReaderAppearanceTheme) {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width('100%')
        .constraintSize({ maxWidth: 46 })
        .height(18)
        .backgroundColor(this.themeColor(theme))
        .border({ width: TOK_BORDER_W, color: '#1F5B5046' })
        .borderRadius(6);
    }
    .layoutWeight(1)
    .constraintSize({ maxWidth: this.cellWidth() })
    .height(24)
    .backgroundColor(this.snapshot.activeTheme === theme ? TOK_READ_ACTIVE_SOFT :
      (this.isNightTheme(theme) ? TOK_READ_DISABLED_BG : Color.Transparent))
    .border({
      width: { top: this.snapshot.activeTheme === theme ? TOK_BORDER_W : 0 },
      color: TOK_READ_PRIMARY,
    })
    .opacity(this.snapshot.activeTheme === theme ? 1 : 0.8)
    .accessibilityText(`切换到${this.themeLabel(theme)}主题`)
    .onClick((): void => this.onThemeChange(theme));
  }

  @Builder
  private fontSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(this.sectionWidth())
        .height(1)
        .backgroundColor(TOK_LINE)
        .position({ x: 0, y: 0 });

      Text('字体库')
        .width('100%')
        .constraintSize({ maxWidth: this.sectionWidth() - 6 })
        .height(10)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9.9)
        .fontColor(TOK_READ_INK)
        .position({ x: 0, y: 4 });

      Column({ space: 4 }) {
        this.fontGridRow(0);
        this.fontGridRow(4);
      }
      .width('100%')
      .constraintSize({ maxWidth: this.sectionWidth() })
      .height(58)
      .position({ x: 0, y: 17 });
    }
    .width('100%')
    .constraintSize({ maxWidth: this.sectionWidth() })
    .height(77)
    .position({ x: 0, y: this.fontSectionY() });
  }

  @Builder
  private fontGridRow(startIndex: number) {
    Row({ space: 4 }) {
      ForEach(this.fontIds().slice(startIndex, startIndex + 4), (fontId: ReaderAppearanceFontSlot) => {
        this.compactFontCell(fontId);
      }, (fontId: ReaderAppearanceFontSlot): string => `reader-appearance-quick-font-${fontId}`);
    }
    .width('100%')
    .height(27);
  }

  @Builder
  private compactFontCell(fontId: ReaderAppearanceFontSlot) {
    Text(readerAppearanceFontSlotLabel(this.snapshot, fontId))
      .width('100%')
      .constraintSize({ maxWidth: this.cellWidth() })
      .height(27)
      .padding({ left: 4, right: 4 })
      .backgroundColor(this.isActiveFont(fontId) ? TOK_PRIMARY_SOFT : Color.Transparent)
      .border({ width: { top: TOK_BORDER_W }, color: TOK_LINE })
      .fontFamily(readerAppearanceFontSlotFamily(this.snapshot, fontId))
      .fontWeight(FontWeight.Regular)
      .fontSize(8)
      .lineHeight(10)
      .fontColor(TOK_READ_INK)
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .layoutWeight(1)
      .constraintSize({ maxWidth: this.cellWidth() })
      .enabled(this.isSelectableFont(fontId))
      .accessibilityText(this.isSelectableFont(fontId) ?
        `切换到${readerAppearanceFontSlotLabel(this.snapshot, fontId)}` :
        `${readerAppearanceFontSlotLabel(this.snapshot, fontId)}，暂不可用`)
      .onClick((): void => {
        if (isReaderAppearanceFont(fontId)) {
          this.onFontChange(fontId);
        }
      });
  }

  private themeIds(): ReaderAppearanceTheme[] {
    return ['day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight'];
  }

  private panelWidth(): number {
    return this.isTablet ? 262 : 286;
  }

  private sectionWidth(): number {
    return this.isTablet ? 238 : 262;
  }

  private sectionX(): number {
    return this.isTablet ? 12 : 11;
  }

  private sectionRightGap(): number {
    return this.panelWidth() - this.sectionX() - this.sectionWidth();
  }

  private themeSectionY(): number {
    return this.isTablet ? 13 : 12;
  }

  private fontSectionY(): number {
    return this.isTablet ? 98.89 : 97.9;
  }

  private themeTitleWidth(): number {
    return this.isTablet ? 144.48 : 168.5;
  }

  private themeSummaryX(): number {
    return this.isTablet ? 150 : 174;
  }

  private themeSummaryGap(): number {
    return this.themeSummaryX() - this.themeTitleWidth();
  }

  private cellWidth(): number {
    return this.isTablet ? 56.5 : 62.5;
  }

  private fontIds(): ReaderAppearanceFontSlot[] {
    return this.snapshot.fontOrder.filter((fontId: ReaderAppearanceFontSlot): boolean => fontId !== 'import');
  }

  private isActiveFont(fontId: string): boolean {
    return fontId === this.snapshot.font;
  }

  private isSelectableFont(fontId: string): boolean {
    return isReaderAppearanceFont(fontId);
  }

  private isNightTheme(theme: ReaderAppearanceTheme): boolean {
    return theme === 'night' || theme === 'warmNight' || theme === 'paperNight' || theme === 'greenNight';
  }

  private themeSummary(): string {
    return `日间：${this.themeLabel(this.snapshot.dayTheme)} · 夜间：${this.themeLabel(this.snapshot.nightTheme)}`;
  }

  private themeLabel(theme: ReaderAppearanceTheme): string {
    if (theme === 'day') {
      return '日间';
    }
    if (theme === 'warm') {
      return '暖白';
    }
    if (theme === 'night') {
      return '夜间';
    }
    if (theme === 'warmNight') {
      return '暖夜';
    }
    if (theme === 'paper') {
      return '纸纹';
    }
    if (theme === 'green') {
      return '青叶纹';
    }
    if (theme === 'paperNight') {
      return '夜纹';
    }
    return '林夜纹';
  }

  private themeColor(theme: ReaderAppearanceTheme): string {
    if (theme === 'day') {
      return '#FFFFFF';
    }
    if (theme === 'warm') {
      return '#FBF0DF';
    }
    if (theme === 'night') {
      return '#26231F';
    }
    if (theme === 'warmNight') {
      return '#302922';
    }
    if (theme === 'paper') {
      return '#F5EAD8';
    }
    if (theme === 'green') {
      return '#E7F0E2';
    }
    if (theme === 'paperNight') {
      return '#34302B';
    }
    return '#263129';
  }

}
