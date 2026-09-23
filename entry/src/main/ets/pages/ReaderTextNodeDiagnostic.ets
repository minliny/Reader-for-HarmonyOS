// Debug-only fixed fixtures. This is a qualification probe, not a reader route.
import { FrameNode, NodeController, typeNode } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import text from '@ohos.graphics.text';
import { ReaderNativeTextWindow } from '../features/reading/ReaderNativeTextWindow';
import { ReaderNativeTextMeasurement } from '../features/reading/ReaderNativeTextMeasurement';

const TEXT_NODE_FONT = 'ReaderTextNodeDiagnosticNoto';
const TEXT_NODE_SAMPLES: string[] = [
  'A😀B',
  '清晨，窗外的树叶轻轻摇动。她翻开书，读到：“山川依旧，日月常新。”这是用于核对换行、标点和首行缩进的固定短文；原始文字不添加空格，也不改写位置。',
  'A😀B 家庭👨‍👩‍👧‍👦，咖啡☕️，e\u0301 与 é。\n第二行：旗帜🇨🇳，肤色👍🏽，English words 123。',
  'مرحبا بالعالم، هذا نص عربي للاختبار. Reader 123، 中文 😀، نهاية السطر.',
  '超长段上下文：中文 English words 👨‍👩‍👧‍👦 e\u0301 العربية（标点，句末。）'.repeat(160),
];

class TextNodeDiagnosticController extends NodeController {
  private root: FrameNode | undefined;
  private textNode: typeNode.Text | undefined;
  private textController: TextController | undefined;
  private closed: boolean = false;
  private window: ReaderNativeTextWindow | undefined;
  private recordedMetrics: LineMetrics[] = [];
  private firstVisibleLine: number = 0;
  private readonly measurement: ReaderNativeTextMeasurement = new ReaderNativeTextMeasurement();

  makeNode(_context: UIContext): FrameNode | null { return this.root ?? null; }

  prepare(context: UIContext, sample: number, middle: boolean, widthPx: number, gapVp: number = 0): void {
    if (this.closed) return;
    this.clear();
    const controller = new TextController();
    this.textController = controller;
    try {
      // The exact unmodified string is set once. The measured Text itself is
      // subsequently mounted; no line strings or indent placeholders exist.
      const started = Date.now();
      this.measurement.measure(context, TEXT_NODE_SAMPLES[sample], controller, {
        widthVp: context.px2vp(widthPx), fontFamily: TEXT_NODE_FONT,
        fontSize: 20, fontWeight: FontWeight.Regular, lineHeight: 30,
        letterSpacing: 0, color: '#181818',
        alignment: sample === 1 || sample === 4 ? TextAlign.JUSTIFY : TextAlign.Start,
        breakAll: false, indentVp: sample === 1 ? context.px2vp(37.25) : 0,
        direction: sample === 3 ? Direction.Rtl : Direction.Ltr,
      });
      const node = this.measurement.take(controller);
      this.textNode = node;
      node.attribute.copyOption(CopyOptions.InApp).editMenuOptions({
        onCreateMenu: (items: Array<TextMenuItem>): Array<TextMenuItem> => items,
        onMenuItemClick: (_item: TextMenuItem, range: TextRange): boolean => {
          hilog.info(0x5244, 'ReaderTextNode', 'READER_TEXT_NODE selection %{public}s', JSON.stringify(range));
          return true; // Probe records the native range without modifying the clipboard.
        },
      });
      const manager = controller.getLayoutManager();
      const count = manager.getLineCount();
      if (count === 0) throw new Error('Text metrics unavailable before mount');
      const startLine = middle && count > 1 ? (count > 20 ? Math.floor(count / 2) : 1) : 0;
      const lastLine = Math.min(count - 1, startLine + 1);
      this.firstVisibleLine = startLine;
      const first = manager.getLineMetrics(startLine), last = manager.getLineMetrics(lastLine);
      // Constructor consumes node ownership even if its setup fails.
      this.textNode = undefined;
      this.window = new ReaderNativeTextWindow(context, node, controller, widthPx);
      this.window.configure(startLine, lastLine, gapVp);
      this.root = this.window.frame() ?? undefined;
      const top = this.window.clipTopPx();
      const height = this.window.clipHeightPx();
      hilog.info(0x5244, 'ReaderTextNode', 'READER_TEXT_NODE prepared %{public}s', JSON.stringify({
        sample, middle, gapVp, widthPx, count, startLine, lastLine, top, height,
        rawStart: first.startIndex, rawEnd: last.endIndex,
        durationMs: Date.now() - started, beforeMount: true, presentationEvidence: false,
      }));
      this.record('before-mount');
      this.rebuild();
    } catch (error) {
      this.clear();
      this.rebuild();
      throw error as Error;
    }
  }

  record(phase: string): void {
    const manager = this.textController?.getLayoutManager();
    if (manager === undefined) return;
    const count = manager.getLineCount();
    const beforeMount = phase === 'before-mount';
    let mismatches = beforeMount || this.recordedMetrics.length === count ? 0 : 1;
    if (beforeMount) this.recordedMetrics = [];
    for (let line = 0; line < count; line += 1) {
      const metric = manager.getLineMetrics(line);
      if (beforeMount) this.recordedMetrics.push(metric);
      else {
        const original = this.recordedMetrics[line];
        if (original === undefined || metric.startIndex !== original.startIndex || metric.endIndex !== original.endIndex ||
          metric.topHeight !== original.topHeight || metric.height !== original.height ||
          metric.width !== original.width || metric.baseline !== original.baseline) mismatches += 1;
      }
      // Compare every line in-process, but keep logs bounded so a long fixture
      // cannot evict earlier samples from the system ring before collection.
      if (line < 2 || line >= count - 2 || Math.abs(line - this.firstVisibleLine) <= 2) {
        hilog.info(0x5244, 'ReaderTextNode', 'READER_TEXT_NODE line %{public}s', JSON.stringify({
          phase, line, rawStart: metric.startIndex, rawEnd: metric.endIndex,
          top: metric.topHeight, height: metric.height, width: metric.width, baseline: metric.baseline,
        }));
      }
    }
    hilog.info(0x5244, 'ReaderTextNode', 'READER_TEXT_NODE comparison %{public}s', JSON.stringify({
      phase: `summary-${phase}`, count, mismatches, firstVisibleLine: this.firstVisibleLine,
    }));
  }

  private clear(): void {
    // Detach before disposing each owned node exactly once. A failed
    // pre-append measure leaves the child separately owned here.
    this.window?.close();
    this.window = undefined;
    this.recordedMetrics = [];
    this.measurement.clear();
    this.textNode?.dispose();
    this.textNode = undefined;
    this.root = undefined;
    this.textController = undefined;
  }
  close(): void { this.closed = true; this.clear(); }
}

@Component
export struct ReaderTextNodeDiagnostic {
  @State private sample: number = 0;
  @State private middle: boolean = false;
  @State private gapVp: number = 0;
  @State private status: string = '等待视口';
  @State private fontReady: boolean = false;
  private widthPx: number = 0;
  private lifecycle: number = 0;
  private mounted: boolean = false;
  private fonts: text.FontCollection | undefined = undefined;
  private controller: TextNodeDiagnosticController = new TextNodeDiagnosticController();

  aboutToAppear(): void {
    this.mounted = true;
    this.controller = new TextNodeDiagnosticController();
    void this.prepareFonts(++this.lifecycle);
  }
  private async prepareFonts(lifecycle: number): Promise<void> {
    try {
      // ArkUI and graphics.text global collections use the same native
      // FontCollection::Create singleton. Await an actual checked load receipt
      // instead of Font.registerFont's background registration submission.
      const fonts = text.FontCollection.getGlobalInstance();
      await fonts.loadFontWithCheck(TEXT_NODE_FONT, $rawfile('NotoSerifSC-Regular.ttf'));
      if (!this.mounted || lifecycle !== this.lifecycle) return;
      this.fonts = fonts;
      this.fontReady = true;
      this.renderSample();
    } catch (error) {
      if (this.mounted && lifecycle === this.lifecycle) this.status = `字体未就绪：${(error as Error).message}`;
    }
  }
  aboutToDisappear(): void {
    this.mounted = false; this.lifecycle += 1; this.fontReady = false;
    this.controller.close(); this.fonts = undefined;
  }
  private renderSample(): void {
    if (!this.mounted || !this.fontReady || this.widthPx <= 0) return;
    try {
      this.controller.prepare(this.getUIContext(), this.sample, this.middle, this.widthPx, this.gapVp);
      this.status = `样本 ${this.sample + 1} · ${this.middle ? '段中两行' : '开头两行'}；等待像素核对`;
    } catch (error) { this.status = `未准入：${(error as Error).message}`; }
  }
  build() {
    Column({ space: 12 }) {
      Text('原生 Text 同节点测量与显示').fontSize(16);
      Text(this.status).fontSize(12).id('reader-textnode-status');
      Button('下一样本').enabled(this.fontReady).id('reader-textnode-next').onClick((): void => {
        this.sample = (this.sample + 1) % TEXT_NODE_SAMPLES.length;
        this.renderSample();
      });
      Button('切换段中窗口').enabled(this.fontReady).id('reader-textnode-middle').onClick((): void => {
        this.middle = !this.middle; this.renderSample();
      });
      Button('切换齐底行距').id('reader-textnode-gap').onClick((): void => { this.gapVp = this.gapVp === 0 ? 6 : 0; this.renderSample(); });
      Button('记录挂载后行数据').id('reader-textnode-record').onClick((): void => this.controller.record('mounted'));
      Row().width('100%').height(1).onAreaChange((_old: Area, area: Area): void => {
        const width = this.getUIContext().vp2px(Number.parseFloat(`${area.width}`));
        if (Number.isFinite(width) && width > 0 && Math.abs(width - this.widthPx) > 0.5) {
          this.widthPx = width; this.renderSample();
        }
      });
      NodeContainer(this.controller).width('100%').height(180).backgroundColor('#FFFFFF');
      Text('固定短文本，不读写书籍；测量回调不等于首帧通过。').fontSize(12);
    }.width('100%').padding(12);
  }
}
