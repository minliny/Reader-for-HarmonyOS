import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_READ_ACTIVE_SOFT,
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

/**
 * Figma Reader Full Appearance sheet / Phone (`1505:18040` / `1505:18349`).
 *
 * The component is presentation-only. The reading experience owns applying
 * the returned settings and the gateway owns persistence. Figma does not
 * define a production Tablet full-sheet geometry at this node, so this file
 * intentionally implements only the specified 364×736 Phone sheet.
 */
@Component
export struct ReaderAppearanceFullPanel {
  @Prop snapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  onCollapse: () => void = (): void => {};
  onThemeChange: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetDayTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetNightTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onFontChange: (font: ReaderAppearanceFont) => void = (_font: ReaderAppearanceFont): void => {};
  onIndentRequest: (current: ReaderAppearanceIndent) => void = (_current: ReaderAppearanceIndent): void => {};
  onAlignmentRequest: (current: ReaderAppearanceAlignment) => void =
    (_current: ReaderAppearanceAlignment): void => {};
  onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) => void =
    (_metric: ReaderAppearanceMetric, _direction: ReaderAppearanceStepDirection): void => {};

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
        .position({ x: 161, y: 9 });

      this.header();

      Row()
        .width(338)
        .height(666)
        .backgroundColor(TOK_SURFACE_PANEL)
        .border({ width: TOK_BORDER_W, color: TOK_LINE })
        .borderRadius(12)
        .position({ x: 13, y: 57 });

      Scroll() {
        Stack({ alignContent: Alignment.TopStart }) {
          this.themeLibrary();
          this.fontLibrary();
          this.typographyLibrary();
        }
        .width(338)
        .height(989);
      }
      .width(338)
      .height(666)
      .scrollBar(BarState.Off)
      .position({ x: 13, y: 57 });
    }
    .width(364)
    .height(736)
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(24)
    .clip(true);
  }

  @Builder
  private header() {
    Row() {
      Image($r('app.media.rc_palette'))
        .width(16)
        .height(16);
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
    .width(338)
    .height(30)
    .alignItems(VerticalAlign.Center)
    .position({ x: 13, y: 19 });
  }

  @Builder
  private themeLibrary() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('主题库')
        .width(180)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(17)
        .fontColor(TOK_READ_INK)
        .position({ x: 2, y: 11 });
      Text(this.themeSummary())
        .width(140)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(13)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.End)
        .maxLines(1)
        .position({ x: 174, y: 13 });

      ForEach(this.themeIds(), (theme: ReaderAppearanceTheme, index: number) => {
        this.fullThemeCard(theme, index);
      }, (theme: ReaderAppearanceTheme): string => `reader-appearance-full-theme-${theme}`);

      this.themeAction(true);
      this.themeAction(false);

      Row()
        .width(316)
        .height(1)
        .backgroundColor(TOK_LINE)
        .position({ x: 0, y: 209 });
    }
    .width(316)
    .height(210)
    .position({ x: 11, y: 11 });
  }

  @Builder
  private fullThemeCard(theme: ReaderAppearanceTheme, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(46)
        .height(18)
        .backgroundColor(this.themeColor(theme))
        .border({
          width: this.snapshot.activeTheme === theme ? 2 : TOK_BORDER_W,
          color: this.snapshot.activeTheme === theme ? TOK_READ_PRIMARY : TOK_LINE_STRONG,
        })
        .borderRadius(6)
        .position({
          x: this.snapshot.activeTheme === theme ? 12.75 : 13.75,
          y: this.snapshot.activeTheme === theme ? 11 : 12,
        });
      Text(this.themeLabel(theme))
        .width(63.5)
        .height(13)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(13)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .position({ x: 5, y: this.snapshot.activeTheme === theme ? 38 : 39 });
    }
    .width(73.5)
    .height(58.8)
    .backgroundColor(this.snapshot.activeTheme === theme ? TOK_READ_ACTIVE_SOFT : TOK_SURFACE_PANEL_SOFT)
    .border({
      width: this.snapshot.activeTheme === theme ? TOK_BORDER_W : 0,
      color: TOK_READ_PRIMARY,
    })
    .borderRadius(8)
    .position({ x: 2 + (index % 4) * 79.5, y: 32.4 + Math.floor(index / 4) * 64.8 })
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
      .position({ x: day ? 160 : 240, y: 172 })
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
        .width(180)
        .height(16)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(13)
        .fontColor(TOK_READ_INK)
        .position({ x: 2, y: 0 });
      Text('可拖动调整位置')
        .width(126)
        .height(16)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(10)
        .fontColor('#807366')
        .textAlign(TextAlign.End)
        .position({ x: 188, y: 0 });

      Stack({ alignContent: Alignment.TopStart }) {
        ForEach(this.fullFontIds(), (fontId: string, index: number) => {
          this.fullFontCell(fontId, index);
        }, (fontId: string): string => `reader-appearance-full-font-${fontId}`);
      }
      .width(316)
      .height(106)
      .position({ x: 0, y: 30 });
    }
    .width(316)
    .height(136)
    .position({ x: 11, y: 221 });
  }

  @Builder
  private fullFontCell(fontId: string, index: number) {
    Text(this.fontLabel(fontId))
      .width(73)
      .height(30)
      .backgroundColor(this.isActiveFont(fontId) ? TOK_READ_PRIMARY :
        (fontId === 'import' ? Color.Transparent : TOK_SURFACE_SOLID))
      .border({
        width: this.isActiveFont(fontId) ? 0 : TOK_BORDER_W,
        color: fontId === 'import' ? '#808C8073' : TOK_LINE_STRONG,
        style: fontId === 'import' ? BorderStyle.Dashed : BorderStyle.Solid,
      })
      .borderRadius(12)
      .fontFamily(fontId === 'sourceHanSerif' || fontId === 'serif' ?
        'ReaderNotoSerifSCRegular' : 'ReaderNotoSansSC')
      .fontWeight(FontWeight.Regular)
      .fontSize(12)
      .fontColor(this.isActiveFont(fontId) ? '#FFFAF4' : (fontId === 'import' ? '#736659' : TOK_READ_INK))
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .position({ x: (index % 4) * 81, y: Math.floor(index / 4) * 38 })
      .enabled(fontId === 'serif')
      .accessibilityText(fontId === 'serif' ? '宋体，使用思源宋体字形' : `${this.fontLabel(fontId)}，暂不可用`)
      .onClick((): void => {
        if (fontId === 'serif') {
          this.onFontChange('serif');
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
        .position({ x: 174, y: 13 });

      Stack({ alignContent: Alignment.TopStart }) {
        this.selectField('indent', 0);
        this.selectField('language', 1);
        this.selectField('pageTurn', 2);
        this.selectField('alignment', 3);
      }
      .width(312)
      .height(200)
      .position({ x: 2, y: 54 });

      Stack({ alignContent: Alignment.TopStart }) {
        this.stepperRow('fontSize', 0);
        this.stepperRow('lineHeightMultiplier', 1);
        this.stepperRow('paragraphSpacing', 2);
        this.stepperRow('letterSpacing', 3);
      }
      .width(312)
      .height(144)
      .padding({ bottom: 2 })
      .backgroundColor(TOK_SURFACE_PANEL)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(8)
      .position({ x: 2, y: 262 });
    }
    .width(316)
    .height(406)
    .position({ x: 11, y: 367 });
  }

  @Builder
  private selectField(kind: string, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.selectLabel(kind))
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(TOK_READ_INK)
        .position({ x: 9, y: 15 });

      Row() {
        Text(this.selectValue(kind))
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(TOK_READ_INK);
        Blank();
        Text('▾')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .fontColor(TOK_READ_PRIMARY);
      }
      .width(88)
      .height(32)
      .padding({ left: 12, right: 12 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#FFFDF8')
      .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
      .borderRadius(10)
      .position({ x: 214, y: 6 });

      Row()
        .width(88)
        .height(44)
        .position({ x: 214, y: 0 })
        .enabled(this.selectEnabled(kind))
        .accessibilityText(this.selectAccessibilityText(kind))
        .onClick((): void => this.handleSelectRequest(kind));
    }
    .width(312)
    .height(44)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(6)
    .position({ x: 0, y: index * 52 });
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
        .position({ x: 17, y: 10 });

      Text(this.metricValue(metric))
        .width(48)
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .position({ x: 216, y: 10 });

      this.stepHitTarget(metric, -1, 174);
      this.stepHitTarget(metric, 1, 254);
    }
    .width(312)
    .height(34)
    .position({ x: 0, y: index * 36 });
  }

  @Builder
  private stepHitTarget(metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection, x: number) {
    Stack({ alignContent: Alignment.Center }) {
      Text(direction < 0 ? '-' : '+')
        .width(24)
        .height(28)
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .borderRadius(8)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center);
    }
    .width(44)
    .height(44)
    .position({ x, y: -5 })
    .accessibilityText(`${this.metricLabel(metric)}${direction < 0 ? '减小' : '增大'}`)
    .onClick((): void => this.onMetricStep(metric, direction));
  }

  private themeIds(): ReaderAppearanceTheme[] {
    return ['day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight'];
  }

  private fullFontIds(): string[] {
    return ['system', 'serif', 'sans', 'kai', 'fangSong', 'mono', 'sourceHanSerif', 'lxgwWenKai', 'import'];
  }

  private isActiveFont(fontId: string): boolean {
    return fontId === 'serif' && this.snapshot.font === 'serif';
  }

  private selectEnabled(kind: string): boolean {
    return kind === 'indent' || kind === 'alignment';
  }

  private handleSelectRequest(kind: string): void {
    if (kind === 'indent') {
      this.onIndentRequest(this.snapshot.indent);
    } else if (kind === 'alignment') {
      this.onAlignmentRequest(this.snapshot.alignment);
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
    return '文字对齐';
  }

  private selectValue(kind: string): string {
    if (kind === 'indent') {
      return this.snapshot.indent === 'none' ? '无' : '首行';
    }
    if (kind === 'language') {
      return '简体';
    }
    if (kind === 'pageTurn') {
      return '无动画';
    }
    return this.snapshot.alignment === 'justify' ? '开启' : '关闭';
  }

  private selectAccessibilityText(kind: string): string {
    if (kind === 'language') {
      return '简繁转换暂不可用';
    }
    if (kind === 'pageTurn') {
      return '当前仅支持无动画翻页';
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
      return `${this.snapshot.fontSize}px`;
    }
    if (metric === 'lineHeightMultiplier') {
      return this.snapshot.lineHeightMultiplier.toFixed(2);
    }
    if (metric === 'paragraphSpacing') {
      return `${this.snapshot.paragraphSpacing}px`;
    }
    return `${this.snapshot.letterSpacing}px`;
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
      return '霞鹜文楷';
    }
    return '+ 导入';
  }
}
