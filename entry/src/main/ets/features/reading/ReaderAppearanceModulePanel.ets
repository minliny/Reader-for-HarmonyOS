import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceFont,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceTheme,
} from './ReaderAppearanceState';

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
    .width(this.panelWidth())
    .height(190)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private themeSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('主题库')
        .width(this.themeTitleWidth())
        .height(10)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9.9)
        .fontColor(TOK_READ_INK)
        .position({ x: 0, y: 3 });

      Text(this.themeSummary())
        .width(88)
        .height(9)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(this.isTablet ? 8 : 7.5)
        .lineHeight(8)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.End)
        .maxLines(1)
        .position({ x: this.themeSummaryX(), y: 6.95 });

      Stack({ alignContent: Alignment.TopStart }) {
        ForEach(this.themeIds(), (theme: ReaderAppearanceTheme, index: number) => {
          this.compactThemeCell(theme, index);
        }, (theme: ReaderAppearanceTheme): string => `reader-appearance-quick-theme-${theme}`);
      }
      .width(this.sectionWidth())
      .height(52)
      .position({ x: 0, y: 21.9 });
    }
    .width(this.sectionWidth())
    .height(75.9)
    .position({ x: this.sectionX(), y: this.themeSectionY() });
  }

  @Builder
  private compactThemeCell(theme: ReaderAppearanceTheme, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width(46)
        .height(18)
        .backgroundColor(this.themeColor(theme))
        .border({
          width: this.snapshot.activeTheme === theme ? 2 : TOK_BORDER_W,
          color: this.snapshot.activeTheme === theme ? TOK_READ_PRIMARY : TOK_LINE_STRONG,
        })
        .borderRadius(6);
    }
    .width(this.cellWidth())
    .height(24)
    .borderRadius(8)
    .position({ x: (index % 4) * this.cellStride(), y: Math.floor(index / 4) * 28 })
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
        .width(this.sectionWidth() - 6)
        .height(10)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9.9)
        .fontColor(TOK_READ_INK)
        .position({ x: 0, y: 4 });

      Stack({ alignContent: Alignment.TopStart }) {
        ForEach(this.fontIds(), (fontId: string, index: number) => {
          this.compactFontCell(fontId, index);
        }, (fontId: string): string => `reader-appearance-quick-font-${fontId}`);
      }
      .width(this.sectionWidth())
      .height(58)
      .position({ x: 0, y: 17 });
    }
    .width(this.sectionWidth())
    .height(77)
    .position({ x: this.sectionX(), y: this.fontSectionY() });
  }

  @Builder
  private compactFontCell(fontId: string, index: number) {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width(this.fontPillWidth())
        .height(22)
        .backgroundColor(this.isActiveFont(fontId) ? TOK_READ_PRIMARY : TOK_SURFACE_SOLID)
        .border({
          width: this.isActiveFont(fontId) ? 0 : TOK_BORDER_W,
          color: TOK_LINE_STRONG,
        })
        .borderRadius(11);
      Text(this.fontLabel(fontId))
        .width(this.fontPillWidth() - 0.5)
        .height(10)
        .fontFamily(fontId === 'lxgwWenKai' ? 'ReaderLXGWWenKaiLite' :
          (fontId === 'sourceHanSerif' || fontId === 'serif' ?
            'ReaderNotoSerifSCRegular' : 'ReaderNotoSansSC'))
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .lineHeight(10)
        .fontColor(this.isActiveFont(fontId) ? '#FFFAF4' : TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .width(this.cellWidth())
    .height(27)
    .position({ x: (index % 4) * this.cellStride(), y: Math.floor(index / 4) * 31 })
    .enabled(this.isSelectableFont(fontId))
    .accessibilityText(this.isSelectableFont(fontId) ? `切换到${this.fontLabel(fontId)}` :
      `${this.fontLabel(fontId)}，暂不可用`)
    .onClick((): void => {
      if (fontId === 'system' || fontId === 'serif' || fontId === 'sans' || fontId === 'lxgwWenKai') {
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

  private cellWidth(): number {
    return this.isTablet ? 56.5 : 62.5;
  }

  private cellStride(): number {
    return this.isTablet ? 60.5 : 66.5;
  }

  private fontPillWidth(): number {
    return this.isTablet ? 49 : 55;
  }

  private fontIds(): string[] {
    return ['system', 'serif', 'sans', 'kai', 'fangSong', 'mono', 'sourceHanSerif', 'lxgwWenKai'];
  }

  private isActiveFont(fontId: string): boolean {
    return fontId === this.snapshot.font;
  }

  private isSelectableFont(fontId: string): boolean {
    return fontId === 'system' || fontId === 'serif' || fontId === 'sans' || fontId === 'lxgwWenKai';
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

  private fontLabel(fontId: string): string {
    if (fontId === 'system') {
      return '系统';
    }
    if (fontId === 'serif') {
      return '宋体';
    }
    if (fontId === 'sans') {
      return '黑体';
    }
    if (fontId === 'kai') {
      return '楷体';
    }
    if (fontId === 'fangSong') {
      return '仿宋';
    }
    if (fontId === 'mono') {
      return '等宽';
    }
    if (fontId === 'sourceHanSerif') {
      return '思源宋体';
    }
    return '文楷 Lite';
  }
}
