import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_ELEVATED,
  TOK_READ_HANDLE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_READ_SURFACE,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceAlignment,
  type ReaderAppearanceFont,
  type ReaderAppearanceIndent,
  type ReaderAppearanceMetric,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceStepDirection,
  type ReaderAppearanceTheme,
} from './ReaderAppearanceState';
import type { ReaderChineseConversionMode } from './ReaderChineseConversionGateway';

/**
 * Figma Reader Full Appearance sheet: Phone `942:82`, Tablet `942:84`.
 *
 * The component is presentation-only. The reading experience owns applying
 * the returned settings and the gateway owns persistence. Phone and Tablet
 * are one semantic panel. Only the outer geometry and the
 * widths of the same internal rows/cards vary with the viewport profile.
 */
@Component
export struct ReaderAppearanceFullPanel {
  @Prop isTablet: boolean = false;
  @Prop snapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop chineseConversionMode: ReaderChineseConversionMode = 'none';
  onCollapse: () => void = (): void => {};
  onThemeChange: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetDayTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetNightTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onFontChange: (font: ReaderAppearanceFont) => void = (_font: ReaderAppearanceFont): void => {};
  onIndentRequest: (indent: ReaderAppearanceIndent) => void = (_indent: ReaderAppearanceIndent): void => {};
  onAlignmentRequest: (current: ReaderAppearanceAlignment) => void =
    (_current: ReaderAppearanceAlignment): void => {};
  onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) => void =
    (_metric: ReaderAppearanceMetric, _direction: ReaderAppearanceStepDirection): void => {};
  onChineseConversionChange: (mode: ReaderChineseConversionMode) => void =
    (_mode: ReaderChineseConversionMode): void => {};

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
          this.themeLibrary();
          this.typographyLibrary();
          this.fontLibrary();
        }
        .width(this.viewportWidth())
        .height(this.contentHeight());
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
      Image($r('app.media.rc_palette'))
        .width(20)
        .height(20);
      Text('界面')
        .margin({ left: 8 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .lineHeight(20)
        .fontColor(TOK_READ_INK);
      Blank();
      Text('收起')
        .width(40)
        .height(26)
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .borderRadius(8)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(TOK_READ_PRIMARY)
        .textAlign(TextAlign.Center)
        .accessibilityText('收起界面设置')
        .onClick((): void => this.onCollapse());
    }
    .width(this.headerWidth())
    .height(30)
    .alignItems(VerticalAlign.Center)
    .position({ x: 13, y: 19 });
  }

  @Builder
  private themeLibrary() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('主题库')
        .width(this.sectionInnerWidth() - 132)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(17)
        .fontColor(TOK_READ_INK)
        .position({ x: 2, y: 11 });
      Text(this.themeSummary())
        .width(109)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.End)
        .maxLines(1)
        .position({ x: this.sectionInnerWidth() - 107, y: 13 });

      ForEach(this.themeIds(), (theme: ReaderAppearanceTheme, index: number) => {
        this.fullThemeCard(theme, index);
      }, (theme: ReaderAppearanceTheme): string => `reader-appearance-full-theme-${theme}`);

      this.themeAction(true);
      this.themeAction(false);

      Row()
        .width(this.sectionWidth())
        .height(1)
        .backgroundColor(TOK_LINE)
        .position({ x: 0, y: 209 });
    }
    .width(this.sectionWidth())
    .height(210)
    .position({ x: 11, y: 11 });
  }

  @Builder
  private fullThemeCard(theme: ReaderAppearanceTheme, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(this.fullCardWidth() - 10)
        .height(24)
        .backgroundColor(this.themeColor(theme))
        .border({
          width: this.snapshot.activeTheme === theme ? 2 : TOK_BORDER_W,
          color: this.snapshot.activeTheme === theme ? TOK_READ_PRIMARY : TOK_LINE_STRONG,
        })
        .borderRadius(6)
        .position({ x: 5, y: 10 });
      Text(this.themeLabel(theme))
        .width(this.fullCardWidth() - 10)
        .height(11)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(13)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .position({ x: 5, y: 42.9 });
    }
    .width(this.fullCardWidth())
    .height(58.8)
    .backgroundColor(this.snapshot.activeTheme === theme ? TOK_READ_ACTIVE_SOFT : TOK_SURFACE_PANEL_SOFT)
    .border({
      width: this.snapshot.activeTheme === theme ? TOK_BORDER_W : 0,
      color: TOK_READ_PRIMARY,
    })
    .borderRadius(8)
    .position({
      x: 2 + (index % 4) * this.fullCardStride(),
      y: 32.4 + Math.floor(index / 4) * 64.8,
    })
    .accessibilityText(`切换到${this.themeLabel(theme)}主题`)
    .onClick((): void => this.onThemeChange(theme));
  }

  @Builder
  private themeAction(day: boolean) {
    Text(day ? '设为日间主题' : '设为夜间主题')
      .width(74)
      .height(28)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(9)
      .lineHeight(13)
      .fontColor(TOK_READ_INK)
      .textAlign(TextAlign.Center)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(6)
      .position({ x: day ? this.sectionInnerWidth() - 152 : this.sectionInnerWidth() - 72, y: 172 })
      .accessibilityText(day ? '将当前主题设为日间主题' : '将当前主题设为夜间主题')
      .onClick((): void => {
        if (day) {
          this.onSetDayTheme(this.snapshot.activeTheme);
        } else {
          this.onSetNightTheme(this.snapshot.activeTheme);
        }
      });
  }

  @Builder
  private fontLibrary() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('字体库')
        .width(this.sectionInnerWidth() - 78)
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(14.4)
        .fontColor(TOK_READ_INK)
        .position({ x: 2, y: 11 });
      Text('可拖动调整位置')
        .width(70)
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.End)
        .position({ x: this.sectionWidth() - 72, y: 11 });

      Stack({ alignContent: Alignment.TopStart }) {
        ForEach(this.fullFontIds(), (fontId: string, index: number) => {
          this.fullFontCell(fontId, index);
        }, (fontId: string): string => `reader-appearance-full-font-${fontId}`);
      }
      .width(this.sectionInnerWidth())
      .height(126)
      .position({ x: 2, y: 33.39 });
    }
    .width(this.sectionWidth())
    .height(169.39)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_LINE })
    .position({ x: 11, y: 600.98 });
  }

  @Builder
  private fullFontCell(fontId: string, index: number) {
    Text(this.fontLabel(fontId))
      .width(this.fullCardWidth())
      .height(38)
      .backgroundColor(this.isActiveFont(fontId) ? TOK_READ_ACTIVE_SOFT :
        (fontId === 'import' ? Color.Transparent : TOK_SURFACE_SOLID))
      .border({
        width: TOK_BORDER_W,
        color: this.isActiveFont(fontId) ? TOK_READ_PRIMARY :
          (fontId === 'import' ? '#808C8073' : TOK_LINE_STRONG),
        style: fontId === 'import' ? BorderStyle.Dashed : BorderStyle.Solid,
      })
      .borderRadius(6)
      .fontFamily(fontId === 'lxgwWenKai' ? 'ReaderLXGWWenKaiLite' :
        (fontId === 'sourceHanSerif' || fontId === 'serif' ?
          'ReaderNotoSerifSCRegular' : 'ReaderNotoSansSC'))
      .fontWeight(FontWeight.Regular)
      .fontSize(10)
      .fontColor(fontId === 'import' ? '#736659' : TOK_READ_INK)
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .position({ x: (index % 4) * this.fullCardStride(), y: Math.floor(index / 4) * 44 })
      .enabled(this.isSelectableFont(fontId))
      .accessibilityText(this.isSelectableFont(fontId) ? `切换到${this.fontLabel(fontId)}` :
        `${this.fontLabel(fontId)}，暂不可用`)
      .onClick((): void => {
        if (fontId === 'system' || fontId === 'serif' || fontId === 'sans' || fontId === 'lxgwWenKai') {
          this.onFontChange(fontId);
        }
      });
  }

  @Builder
  private typographyLibrary() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('排版库')
        .width(180)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(17)
        .fontColor(TOK_READ_INK)
        .position({ x: 2, y: 11 });
      Text('即时应用')
        .width(140)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(13)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.End)
        .position({ x: this.sectionWidth() - 56, y: 13 });

      Stack({ alignContent: Alignment.TopStart }) {
        this.indentRow();
        this.selectField('language', 9, 61);
        this.selectField('pageTurn', this.isTablet ? 339 : 161, 61);
        this.selectField('alignment', 9, 113);
      }
      .width(this.sectionInnerWidth())
      .height(168)
      .position({ x: 2, y: 44 });

      Stack({ alignContent: Alignment.TopStart }) {
        this.stepperRow('fontSize', 0);
        this.stepperRow('lineHeightMultiplier', 1);
        this.stepperRow('paragraphSpacing', 2);
        this.stepperRow('letterSpacing', 3);
      }
      .width(this.stepperPanelWidth())
      .height(140)
      .backgroundColor(TOK_SURFACE_PANEL)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(8)
      .position({ x: 2, y: 228 });
    }
    .width(this.sectionWidth())
    .height(380)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_LINE })
    .position({ x: 11, y: 220.98 });
  }

  @Builder
  private indentRow() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('首行缩进')
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(TOK_READ_INK)
        .position({ x: 9, y: 15 });

      Row() {
        this.indentOption('不缩进', 'none');
        this.indentOption('单字缩进', 'single');
        this.indentOption('双字缩进', 'firstLine');
      }
      .width(200)
      .height(36)
      .padding({ top: 6, bottom: 6 })
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(6)
      .position({ x: this.indentRowWidth() - 209, y: 4 });
    }
    .width(this.indentRowWidth())
    .height(44)
    .position({ x: 9, y: 9 });
  }

  @Builder
  private indentOption(label: string, value: string) {
    Text(label)
      .layoutWeight(1)
      .height(24)
      .backgroundColor(this.indentOptionActive(value) ? TOK_READ_ELEVATED : Color.Transparent)
      .borderRadius(6)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(this.indentOptionActive(value) ? FontWeight.Bold : FontWeight.Medium)
      .fontSize(9)
      .fontColor(this.indentOptionActive(value) ? TOK_READ_PRIMARY : TOK_READ_MUTED)
      .textAlign(TextAlign.Center)
      .accessibilityText(label)
      .onClick((): void => {
        if ((value === 'none' || value === 'single' || value === 'firstLine') &&
          this.snapshot.indent !== value) {
          this.onIndentRequest(value);
        }
      });
  }

  @Builder
  private selectField(kind: string, x: number, y: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.selectLabel(kind))
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(TOK_READ_INK)
        .position({ x: 9, y: 14 });

      Row() {
        Text(this.selectValue(kind))
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .fontColor(TOK_READ_INK);
        Blank();
        Image($r('app.media.reader_chevron_down'))
          .width(12)
          .height(12)
          .fillColor(TOK_READ_PRIMARY);
      }
      .width(56)
      .height(36)
      .padding({ left: 8, right: 6 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#FFFDF8')
      .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
      .borderRadius(10)
      .position({ x: this.selectRowWidth() - 64, y: 3 });

      Row()
        .width(56)
        .height(44)
        .position({ x: this.selectRowWidth() - 64, y: 0 })
        .enabled(this.selectEnabled(kind))
        .accessibilityText(this.selectAccessibilityText(kind))
        .onClick((): void => this.handleSelectRequest(kind));
    }
    .width(this.selectRowWidth())
    .height(44)
    .position({ x, y });
  }

  @Builder
  private stepperRow(metric: ReaderAppearanceMetric, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.metricLabel(metric))
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(TOK_READ_INK)
        .position({ x: 8, y: index === 0 ? 9 : 9.5 });

      Row({ space: 4 }) {
        this.stepButton(metric, -1);
        Text(this.metricValue(metric))
          .width(42)
          .height(13)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .fontColor(TOK_READ_INK)
          .textAlign(TextAlign.Center);
        this.stepButton(metric, 1);
      }
      .width(110)
      .height(28)
      .alignItems(VerticalAlign.Center)
      .position({ x: this.stepperRowWidth() - 118, y: 3 });
    }
    .width(this.stepperRowWidth())
    .height(34)
    .border({ width: { top: index === 0 ? 0 : TOK_BORDER_W }, color: TOK_LINE })
    .position({ x: 9, y: 2 + index * 34 });
  }

  @Builder
  private stepButton(metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) {
    Stack({ alignContent: Alignment.Center }) {
      Text(direction < 0 ? '-' : '+')
        .width(24)
        .height(28)
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .borderRadius(8)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center);
    }
    .width(30)
    .height(28)
    .accessibilityText(`${this.metricLabel(metric)}${direction < 0 ? '减小' : '增大'}`)
    .onClick((): void => this.onMetricStep(metric, direction));
  }

  private sheetWidth(): number {
    return this.isTablet ? 720 : 364;
  }

  private sheetHeight(): number {
    return this.isTablet ? 852 : 840;
  }

  private headerWidth(): number {
    return this.isTablet ? 694 : 338;
  }

  private viewportWidth(): number {
    return this.isTablet ? 694 : 338;
  }

  private viewportHeight(): number {
    return this.isTablet ? 834 : 772;
  }

  private contentHeight(): number {
    return this.isTablet ? 832 : 769.375;
  }

  private handleX(): number {
    return this.isTablet ? 489 : 134;
  }

  private sectionWidth(): number {
    return this.isTablet ? 672 : 316;
  }

  private sectionInnerWidth(): number {
    return this.isTablet ? 668 : 312;
  }

  private fullCardWidth(): number {
    return this.isTablet ? 162.5 : 73.5;
  }

  private fullCardStride(): number {
    return this.isTablet ? 168.5 : 79.5;
  }

  private indentRowWidth(): number {
    return this.isTablet ? 648 : 292;
  }

  private indentOptionActive(value: string): boolean {
    return value === this.snapshot.indent;
  }

  private selectRowWidth(): number {
    return this.isTablet ? 318 : 140;
  }

  private stepperPanelWidth(): number {
    return this.isTablet ? 666 : 310;
  }

  private stepperRowWidth(): number {
    return this.isTablet ? 648 : 292;
  }

  private themeIds(): ReaderAppearanceTheme[] {
    return ['day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight'];
  }

  private fullFontIds(): string[] {
    return ['system', 'serif', 'sans', 'kai', 'fangSong', 'mono', 'sourceHanSerif', 'lxgwWenKai', 'import'];
  }

  private isActiveFont(fontId: string): boolean {
    return fontId === this.snapshot.font;
  }

  private isSelectableFont(fontId: string): boolean {
    return fontId === 'system' || fontId === 'serif' || fontId === 'sans' || fontId === 'lxgwWenKai';
  }

  private selectEnabled(kind: string): boolean {
    return kind === 'indent' || kind === 'alignment' || kind === 'language';
  }

  private handleSelectRequest(kind: string): void {
    if (kind === 'indent') {
      const next: ReaderAppearanceIndent = this.snapshot.indent === 'none' ? 'single' :
        (this.snapshot.indent === 'single' ? 'firstLine' : 'none');
      this.onIndentRequest(next);
    } else if (kind === 'alignment') {
      this.onAlignmentRequest(this.snapshot.alignment);
    } else if (kind === 'language') {
      const next: ReaderChineseConversionMode = this.chineseConversionMode === 'none' ? 't2s' :
        (this.chineseConversionMode === 't2s' ? 's2t' : 'none');
      this.onChineseConversionChange(next);
    }
  }

  private selectLabel(kind: string): string {
    if (kind === 'indent') {
      return '缩进';
    }
    if (kind === 'language') {
      return '简繁';
    }
    if (kind === 'pageTurn') {
      return '翻页动画';
    }
    return '文字两端对齐';
  }

  private selectValue(kind: string): string {
    if (kind === 'indent') {
      if (this.snapshot.indent === 'none') {
        return '无';
      }
      return this.snapshot.indent === 'single' ? '单字' : '双字';
    }
    if (kind === 'language') {
      if (this.chineseConversionMode === 'none') {
        return '原文';
      }
      return this.chineseConversionMode === 't2s' ? '繁转简' : '简转繁';
    }
    if (kind === 'pageTurn') {
      // Figma `1150:10317` displays the approved selector value `平移`.
      // The selector remains disabled until the separate page-turn runtime is
      // admitted; keeping its visible skeleton source-exact does not claim
      // that this P1 appearance slice implements that runtime.
      return '平移';
    }
    return this.snapshot.alignment === 'justify' ? '开启' : '关闭';
  }

  private selectAccessibilityText(kind: string): string {
    if (kind === 'pageTurn') {
      return '平移翻页设计项暂未接通';
    }
    return `${this.selectLabel(kind)}，当前${this.selectValue(kind)}`;
  }

  private metricLabel(metric: ReaderAppearanceMetric): string {
    if (metric === 'fontSize') {
      return '字号';
    }
    if (metric === 'lineHeightMultiplier') {
      return '行距';
    }
    if (metric === 'paragraphSpacing') {
      return '段距';
    }
    return '字距';
  }

  private metricValue(metric: ReaderAppearanceMetric): string {
    if (metric === 'fontSize') {
      return `${this.snapshot.fontSize}`;
    }
    if (metric === 'lineHeightMultiplier') {
      return this.snapshot.lineHeightMultiplier.toFixed(2);
    }
    if (metric === 'paragraphSpacing') {
      return `${this.snapshot.paragraphSpacing}`;
    }
    return `${this.snapshot.letterSpacing}`;
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
    if (fontId === 'lxgwWenKai') {
      return '文楷 Lite';
    }
    return '导入';
  }
}
