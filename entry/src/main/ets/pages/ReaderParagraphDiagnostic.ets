// DEBUG renderer-pilot child only. Fixed, bounded fixtures; no Core session,
// pagination, progress, user font selection or production reading ownership.
import text from '@ohos.graphics.text';
import { DrawContext, FrameNode, LengthMetricsUnit, NodeController, RenderNode } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerMotionNowMs } from '../features/common/ReaderMotionClock';
import { ReadingSurfaceLayoutMap } from '../features/reading/ReadingSurfaceLayoutMap';

const PARAGRAPH_FONT = 'ReaderParagraphDiagnosticNotoSerifSC';
const PARAGRAPH_FONT_FILE = 'NotoSerifSC-Regular.ttf';
const PARAGRAPH_STAGE_HEIGHT_VP = 180;

interface ParagraphDiagnosticSample {
  id: string;
  label: string;
  value: string;
  indentPx: number;
  rtl: boolean;
  justify: boolean;
}

// A😀B distinguishes UTF-16 / scalar offsets. Other fixtures intentionally
// expose shaping, fallback and placeholder offsets without guessing a mapping.
const PARAGRAPH_SAMPLES: ParagraphDiagnosticSample[] = [
  { id: 'index', label: '索引单位 A😀B', value: 'A😀B', indentPx: 0, rtl: false, justify: false },
  { id: 'cjk-indent', label: '中文 · 37.25 px 首行缩进',
    value: '清晨，窗外的树叶轻轻摇动。她翻开书，读到：“山川依旧，日月常新。”这是用于核对换行、标点和首行缩进的固定短文；原始文字不添加空格，也不改写位置。',
    indentPx: 37.25, rtl: false, justify: true },
  { id: 'emoji', label: '组合字符 · Emoji · 换行',
    value: 'A😀B 家庭👨‍👩‍👧‍👦，咖啡☕️，e\u0301 与 é。\n第二行：旗帜🇨🇳，肤色👍🏽，English words 123。',
    indentPx: 0, rtl: false, justify: false },
  { id: 'rtl', label: 'RTL · 双向混排',
    value: 'مرحبا بالعالم، هذا نص عربي للاختبار. Reader 123، 中文 😀، نهاية السطر.',
    indentPx: 0, rtl: true, justify: false },
];

interface ParagraphDiagnosticStyle {
  fontSizePx: number;
  lineHeightPx: number;
  letterSpacingPx: number;
}

interface ParagraphDiagnosticFrame {
  paragraph: text.Paragraph;
  revision: number;
  sampleId: string;
  widthPx: number;
  heightPx: number;
  preparedAtMs: number;
}

interface ParagraphDiagnosticPixelSize {
  width: number;
  height: number;
}

interface ParagraphDiagnosticComparison {
  sampleId: string;
  revision: number;
  widthPx: number;
  fontSizePx: number;
  lineHeightPx: number;
}

function paragraphDiagnosticLog(event: string, detail: string): void {
  hilog.info(0x5244, 'ReaderParagraph', 'READER_PARAGRAPH %{public}s %{public}s', event, detail);
}

function buildDiagnosticParagraph(sample: ParagraphDiagnosticSample, widthPx: number,
  style: ParagraphDiagnosticStyle, fonts: text.FontCollection): text.Paragraph {
  const paragraphStyle: text.ParagraphStyle = {
    align: sample.justify ? text.TextAlign.JUSTIFY : text.TextAlign.START,
    textDirection: sample.rtl ? text.TextDirection.RTL : text.TextDirection.LTR,
    textStyle: {
      color: { alpha: 255, red: 24, green: 24, blue: 24 },
      fontFamilies: [PARAGRAPH_FONT],
      fontSize: style.fontSizePx,
      letterSpacing: style.letterSpacingPx,
      // API12 explicitly defines this multiplier against fontSize. Its
      // equivalence to Text.lineHeight is a measured question, not an assertion.
      heightOnly: true,
      heightScale: style.lineHeightPx / style.fontSizePx,
      // ArkUI Text defaults to false; the reference below uses that policy.
      // Align inputs before judging fallback-font line geometry.
      halfLeading: false,
    },
  };
  const builder = new text.ParagraphBuilder(paragraphStyle, fonts);
  if (sample.indentPx > 0) {
    builder.addPlaceholder({ width: sample.indentPx, height: 0,
      align: text.PlaceholderAlignment.FOLLOW_PARAGRAPH,
      baseline: text.TextBaseline.ALPHABETIC, baselineOffset: 0 });
  }
  builder.addText(sample.value);
  const paragraph = builder.build();
  paragraph.layoutSync(widthPx);
  return paragraph;
}

class ParagraphDiagnosticRenderNode extends RenderNode {
  private content: ParagraphDiagnosticFrame | undefined = undefined;
  private reportedRevision: number = -1;

  setContent(content: ParagraphDiagnosticFrame | undefined): void {
    this.content = content;
    if (content !== undefined) {
      this.lengthMetricsUnit = LengthMetricsUnit.PX;
      this.size = { width: content.widthPx, height: content.heightPx };
      this.clipToFrame = true;
    }
    // Clearing must replace the old native draw command list as well.
    this.invalidate();
  }

  draw(context: DrawContext): void {
    const content = this.content;
    if (content === undefined) return;
    const startedAt = readerMotionNowMs();
    // Exactly the already measured Paragraph. No text reconstruction or layout
    // in draw(), and no canvas copy masquerading as a presented-frame receipt.
    try {
      content.paragraph.paint(context.canvas, 0, 0);
    } catch (error) {
      paragraphDiagnosticLog('paint-error', JSON.stringify({ revision: content.revision,
        sampleId: content.sampleId, message: (error as Error).message }));
      return;
    }
    if (this.reportedRevision === content.revision) return;
    this.reportedRevision = content.revision;
    const requestedSizePx: ParagraphDiagnosticPixelSize = {
      width: content.widthPx, height: content.heightPx,
    };
    paragraphDiagnosticLog('draw-called', JSON.stringify({ revision: content.revision,
      sampleId: content.sampleId, canvasSizePx: context.sizeInPixel,
      requestedSizePx,
      paintCallMs: readerMotionNowMs() - startedAt,
      sincePreparedMs: startedAt - content.preparedAtMs,
      presentationEvidence: false }));
  }
}

class ParagraphDiagnosticController extends NodeController {
  private node: FrameNode | undefined = undefined;
  private render: ParagraphDiagnosticRenderNode | undefined = undefined;
  private content: ParagraphDiagnosticFrame | undefined = undefined;
  private closed: boolean = false;

  makeNode(context: UIContext): FrameNode | null {
    if (this.closed) return null;
    if (this.node !== undefined) return this.node;
    const node = new FrameNode(context);
    const parent = node.getRenderNode();
    if (parent === null) {
      node.dispose();
      paragraphDiagnosticLog('node-unavailable', 'FrameNode.getRenderNode returned null');
      return null;
    }
    const render = new ParagraphDiagnosticRenderNode();
    parent.appendChild(render);
    this.node = node;
    this.render = render;
    this.updateNode();
    return node;
  }

  present(content: ParagraphDiagnosticFrame): void {
    if (this.closed) return;
    this.content = content;
    this.updateNode();
  }

  clear(): void {
    if (this.closed) return;
    this.content = undefined;
    this.render?.setContent(undefined);
  }

  private updateNode(): void {
    const content = this.content;
    if (this.closed || content === undefined) return;
    this.node?.commonAttribute.width(`${content.widthPx}px`).height(`${content.heightPx}px`);
    this.render?.setContent(content);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.content = undefined;
    // Drop Paragraph references before disposing native nodes. The local font
    // collection can then be released; never unload an app-global font alias.
    if (this.render !== undefined) {
      this.render.setContent(undefined);
      this.node?.getRenderNode()?.removeChild(this.render);
      this.render.dispose();
      this.render = undefined;
    }
    this.node?.dispose();
    this.node = undefined;
  }
}

@Component
export struct ReaderParagraphDiagnostic {
  @State private sampleIndex: number = 0;
  @State private status: string = '初始化隔离字体样本';
  @State private fontReady: boolean = false;
  @State private widthVp: number = 280;
  @State private fontSizePx: number = 20;
  @State private lineHeightPx: number = 30;
  @State private widthPx: number = 280;
  @State private stageHeightPx: number = 180;
  private mounted: boolean = false;
  private lifecycle: number = 0;
  private revision: number = 0;
  private comparison: ParagraphDiagnosticComparison | undefined = undefined;
  private fonts: text.FontCollection | undefined = undefined;
  private paragraphController: ParagraphDiagnosticController = new ParagraphDiagnosticController();
  private readonly referenceController: TextController = new TextController();

  aboutToAppear(): void {
    this.mounted = true;
    this.paragraphController = new ParagraphDiagnosticController();
    void this.prepareFonts(++this.lifecycle);
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.lifecycle += 1;
    this.paragraphController.close();
    this.comparison = undefined;
    this.fonts = undefined;
    this.fontReady = false;
  }

  private async prepareFonts(lifecycle: number): Promise<void> {
    const startedAt = readerMotionNowMs();
    try {
      const fonts = text.FontCollection.getLocalInstance();
      // Both paths request the exact same packaged font file and alias. ArkUI
      // FontManager and this FontCollection are not presumed to share caches.
      this.getUIContext().getFont().registerFont({ familyName: PARAGRAPH_FONT,
        familySrc: $rawfile('NotoSerifSC-Regular.ttf') });
      await fonts.loadFontWithCheck(PARAGRAPH_FONT, $rawfile('NotoSerifSC-Regular.ttf'));
      if (!this.mounted || lifecycle !== this.lifecycle) return;
      this.fonts = fonts;
      this.fontReady = true;
      paragraphDiagnosticLog('font-loaded', JSON.stringify({ family: PARAGRAPH_FONT,
        file: PARAGRAPH_FONT_FILE, collection: 'local', loadMs: readerMotionNowMs() - startedAt,
        arkUiRegistrationReturned: true, fallbackTypefaceVerified: false }));
      this.renderSample();
    } catch (error) {
      if (!this.mounted || lifecycle !== this.lifecycle) return;
      this.status = `字体准备失败：${(error as Error).message}`;
      paragraphDiagnosticLog('font-error', this.status);
    }
  }

  private sample(): ParagraphDiagnosticSample { return PARAGRAPH_SAMPLES[this.sampleIndex]; }

  private resize(width: number): void {
    if (!Number.isFinite(width) || width < 96) return;
    const bounded = Math.min(600, width);
    if (Math.abs(this.widthVp - bounded) < 0.25) return;
    this.widthVp = bounded;
    this.renderSample();
  }

  private nextSample(): void {
    this.sampleIndex = (this.sampleIndex + 1) % PARAGRAPH_SAMPLES.length;
    this.renderSample();
  }

  private renderSample(): void {
    const fonts = this.fonts;
    if (!this.mounted || fonts === undefined) return;
    const context = this.getUIContext();
    this.widthPx = context.vp2px(this.widthVp);
    this.fontSizePx = context.vp2px(20);
    this.lineHeightPx = context.vp2px(30);
    this.stageHeightPx = context.vp2px(PARAGRAPH_STAGE_HEIGHT_VP);
    const sample = this.sample();
    const startedAt = readerMotionNowMs();
    this.comparison = undefined;
    try {
      const paragraph = buildDiagnosticParagraph(sample, this.widthPx,
        { fontSizePx: this.fontSizePx, lineHeightPx: this.lineHeightPx, letterSpacingPx: 0 }, fonts);
      const layoutMs = readerMotionNowMs() - startedAt;
      const revision = ++this.revision;
      const map = new ReadingSurfaceLayoutMap(sample.value);
      const boundaries: number[] = [];
      for (let i = 0; i <= map.scalarCount(); i += 1) boundaries.push(map.utf16ForScalar(i));
      const lines = paragraph.getLineMetrics();
      paragraphDiagnosticLog('paragraph-layout', JSON.stringify({ revision, sampleId: sample.id,
        layoutMs, widthVp: this.widthVp, widthPx: this.widthPx, pxPerVp: context.vp2px(1),
        fontSizePx: this.fontSizePx, requestedLineHeightPx: this.lineHeightPx,
        heightMode: 'heightOnly/fontSize-ratio/halfLeading=false', indentPx: sample.indentPx,
        sourceUtf16Length: map.utf16Length(), sourceScalarCount: map.scalarCount(),
        sourceScalarBoundariesUtf16: boundaries, rawIndexUnit: 'unverified-no-conversion',
        lineCount: lines.length, heightPx: paragraph.getHeight(),
        stageHeightPx: this.stageHeightPx, clipped: paragraph.getHeight() > this.stageHeightPx,
        placeholderRects: paragraph.getRectsForPlaceholders() }));
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        paragraphDiagnosticLog('paragraph-line', JSON.stringify({ revision, sampleId: sample.id, line: i,
          rawStart: line.startIndex, rawEnd: line.endIndex, widthPx: line.width, heightPx: line.height,
          baselinePx: line.baseline, topPx: line.topHeight, ascentPx: line.ascent, descentPx: line.descent }));
      }
      this.paragraphController.present({ paragraph, revision, sampleId: sample.id,
        widthPx: this.widthPx, heightPx: this.stageHeightPx, preparedAtMs: readerMotionNowMs() });
      this.comparison = { sampleId: sample.id, revision, widthPx: this.widthPx,
        fontSizePx: this.fontSizePx, lineHeightPx: this.lineHeightPx };
      this.status = `${sample.label} · ${lines.length} 行 · 构建及布局 ${layoutMs} ms；未作等价判定`;
    } catch (error) {
      this.paragraphController.clear();
      this.status = `诊断布局失败：${(error as Error).message}`;
      paragraphDiagnosticLog('layout-error', JSON.stringify({ sampleId: sample.id,
        message: this.status, comparisonValid: false, validParagraph: false }));
    }
  }

  private captureReference(): void {
    if (!this.mounted || !this.fontReady) return;
    const sample = this.sample();
    const comparison = this.comparison;
    if (comparison === undefined || comparison.sampleId !== sample.id ||
      comparison.revision !== this.revision || comparison.widthPx !== this.widthPx ||
      comparison.fontSizePx !== this.fontSizePx || comparison.lineHeightPx !== this.lineHeightPx) {
      paragraphDiagnosticLog('text-reference-unpaired', JSON.stringify({ sampleId: sample.id,
        comparisonValid: false, reason: 'no-current-paragraph-for-sample-and-geometry' }));
      this.status = '当前样本没有有效 Paragraph；不生成配对记录';
      return;
    }
    try {
      const manager = this.referenceController.getLayoutManager();
      const count = manager.getLineCount();
      paragraphDiagnosticLog('text-reference', JSON.stringify({ revision: this.revision, sampleId: sample.id,
        lineCount: count, widthPx: this.widthPx, fontSizePx: this.fontSizePx,
        requestedLineHeightPx: this.lineHeightPx, indentPx: sample.indentPx,
        trigger: 'explicit-button-after-layout', rawIndexUnit: 'unverified-no-conversion',
        configuredPairValid: true, equivalenceVerified: false }));
      for (let i = 0; i < count; i += 1) {
        const line = manager.getLineMetrics(i);
        paragraphDiagnosticLog('text-line', JSON.stringify({ revision: this.revision, sampleId: sample.id, line: i,
          rawStart: line.startIndex, rawEnd: line.endIndex, widthPx: line.width, heightPx: line.height,
          baselinePx: line.baseline, topPx: line.topHeight, ascentPx: line.ascent, descentPx: line.descent }));
      }
      this.status = `已记录 ${sample.label} 的 Text 行数据；需对照原始日志及像素`;
    } catch (error) {
      this.status = `Text 行数据尚不可用：${(error as Error).message}`;
      paragraphDiagnosticLog('text-reference-error', this.status);
    }
  }

  build() {
    Scroll() {
      Column({ space: 8 }) {
        Text('系统 Paragraph 诊断 · 固定样本，不读写书籍').fontSize(14);
        Text('同一 Paragraph 测量并绘制；下方 Text 仅作参考。draw-called 不代表屏幕已显示。')
          .fontSize(11).fontColor('#555555');
        Row({ space: 8 }) {
          Button('下一个样本').enabled(this.fontReady).id('reader-paragraph-next')
            .onClick((): void => this.nextSample());
          Button('记录 Text 行数据').enabled(this.fontReady).id('reader-paragraph-reference')
            .onClick((): void => this.captureReference());
        }
        Text(this.status).fontSize(11).id('reader-paragraph-status');
        // This empty width sensor is outside the fixed-width comparison tree.
        Row().width('100%').height(1).onAreaChange((_old: Area, area: Area): void => {
          this.resize(Number.parseFloat(`${area.width}`));
        });
        if (this.fontReady) {
          Text(`Paragraph · ${this.widthPx.toFixed(2)} px / ${this.widthVp.toFixed(2)} vp`).fontSize(12);
          NodeContainer(this.paragraphController)
            .width(`${this.widthPx}px`).height(`${this.stageHeightPx}px`)
            .backgroundColor('#FFFFFF').clip(true).id('reader-paragraph-native');
          Text('ArkUI Text · 相同原文、字体文件和请求尺寸').fontSize(12);
          Stack({ alignContent: Alignment.TopStart }) {
            Text(this.sample().value, { controller: this.referenceController })
              .fontFamily(PARAGRAPH_FONT).fontSize(`${this.fontSizePx}px`)
              .fontColor('#181818').lineHeight(`${this.lineHeightPx}px`).letterSpacing('0px')
              .textIndent(`${this.sample().indentPx}px`)
              .textAlign(this.sample().justify ? TextAlign.JUSTIFY : TextAlign.Start)
              .direction(this.sample().rtl ? Direction.Rtl : Direction.Ltr)
              .width(`${this.widthPx}px`).id('reader-paragraph-text-reference');
          }.width(`${this.widthPx}px`).height(`${this.stageHeightPx}px`).clip(true).backgroundColor('#FFFFFF');
        }
        Text('选择、无障碍、图片、长段性能及生产分页均未准入。Emoji 与阿拉伯文回退字体待运行时核对。')
          .fontSize(11).fontColor('#555555');
      }.width('100%').padding(12)
    }.width('100%').layoutWeight(1)
  }
}
