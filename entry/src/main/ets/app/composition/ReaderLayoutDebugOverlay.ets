import { ReaderWindowCoordinator } from '../ReaderWindowCoordinator';
import { ReaderUIVerificationProbe } from '../diagnostics/ReaderUIVerificationProbe';
import type { ReaderWindowMetricsSnapshot } from '../../ui/foundation/ReaderWindowMetrics';
import { ExpandMode, FrameNode } from '@ohos.arkui.node';
import { hilog } from '@kit.PerformanceAnalysisKit';

interface ReaderDeveloperWindowReport {
  metrics: ReaderWindowMetricsSnapshot;
  vpPixels: number | null;
  fpPixels: number | null;
  followsSystemFontScale: boolean | null;
  maxFontScale: number | null;
  canvasWidthVp: number | null;
  canvasHeightVp: number | null;
  frameTreeReady: boolean;
  frameScanTruncated: boolean;
  excludedBackgroundBranches: number;
  excludedTransparentBranches: number;
  measuredOpaqueHeaders: number;
}

interface ReaderVerificationWindowSample {
  windowId: string;
  orientation: string;
  report: ReaderDeveloperWindowReport;
}

interface ReaderDebugRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ReaderDebugHeader {
  key: string;
  parent: ReaderDebugHeader | undefined;
}

interface ReaderDebugBounds extends ReaderDebugRect {
  kind: string;
  opacity: number;
  clip: ReaderDebugRect | undefined;
  headers: ReaderDebugHeader | undefined;
}

const FRAME_NODE_SCAN_LIMIT: number = 10000;

@Component
export struct ReaderLayoutDebugOverlay {
  @StorageLink('readerDeveloperMode') @Watch('onDeveloperModeChanged') private developerModeEnabled: boolean = false;
  @StorageLink('readerAppForeground') @Watch('onDeveloperModeChanged') private appForeground: boolean = true;
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @State private frameCount: number = 0;
  @State private frameOriginX: number = 0;
  @State private frameOriginY: number = 0;
  @State private frameScanTruncated: boolean = false;
  private frameBounds: ReaderDebugBounds[] = [];
  private readonly opaqueHeaders: Map<string, ReaderDebugRect> = new Map();
  private scannedNodes: number = 0;
  private excludedBackgroundBranches: number = 0;
  private excludedTransparentBranches: number = 0;
  private canvasReady: boolean = false;
  private drawingContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true));
  private frameScanHandle: number = -1;
  private lastWindowSample: string = '';

  aboutToAppear(): void {
    this.onDeveloperModeChanged();
  }

  aboutToDisappear(): void {
    if (this.frameScanHandle >= 0) {
      clearInterval(this.frameScanHandle);
      this.frameScanHandle = -1;
    }
    this.canvasReady = false;
  }

  private onDeveloperModeChanged(): void {
    if (this.frameScanHandle >= 0) {
      clearInterval(this.frameScanHandle);
      this.frameScanHandle = -1;
    }
    this.scanFrameTree();
    if (this.developerModeEnabled && this.appForeground) {
      this.frameScanHandle = setInterval((): void => this.scanFrameTree(), 250);
    }
  }

  private reportWindowSample(): void {
    const metrics = ReaderWindowCoordinator.metrics();
    const context = this.getUIContext();
    let vpPixels: number | null = null;
    let fpPixels: number | null = null;
    let followsSystemFontScale: boolean | null = null;
    let maxFontScale: number | null = null;
    try {
      vpPixels = context.vp2px(1);
      fpPixels = context.fp2px(1);
      followsSystemFontScale = context.isFollowingSystemFontScale();
      maxFontScale = context.getMaxFontScale();
    } catch (_) {
      // Unavailable properties stay null in the receipt.
    }
    const report: ReaderDeveloperWindowReport = {
      metrics, vpPixels, fpPixels, followsSystemFontScale, maxFontScale,
      canvasWidthVp: this.canvasReady ? this.drawingContext.width : null,
      canvasHeightVp: this.canvasReady ? this.drawingContext.height : null,
      frameTreeReady: this.frameCount > 0,
      frameScanTruncated: this.frameScanTruncated,
      excludedBackgroundBranches: this.excludedBackgroundBranches,
      excludedTransparentBranches: this.excludedTransparentBranches,
      measuredOpaqueHeaders: this.opaqueHeaders.size,
    };
    if (ReaderUIVerificationProbe.enabled()) {
      const windowId = ReaderWindowCoordinator.diagnosticWindowId();
      if (windowId !== null && metrics.ready) {
        const sample: ReaderVerificationWindowSample = {
          windowId: windowId.toString(), orientation: metrics.windowRect.width > metrics.windowRect.height ?
            'landscape' : 'portrait',
          report: report,
        };
        ReaderUIVerificationProbe.emit('window-stable', 'probe', sample);
      }
    }
    const payload = JSON.stringify(report);
    if (payload === this.lastWindowSample) return;
    this.lastWindowSample = payload;
    hilog.info(0x5244, 'Reader', 'READER_DEVELOPER_LAYOUT %{public}s', payload);
  }

  private scanFrameTree(): void {
    this.opaqueHeaders.clear();
    if (!this.developerModeEnabled || !this.appForeground) {
      this.lastWindowSample = '';
      this.frameBounds = [];
      this.frameCount = 0;
      this.frameScanTruncated = false;
      this.paintFrameBounds();
      return;
    }
    let root: FrameNode | null = null;
    let overlayNode: FrameNode | null = null;
    this.frameScanTruncated = false;
    this.excludedBackgroundBranches = 0;
    this.excludedTransparentBranches = 0;
    try {
      // getPageRootNode is API 24 while this project supports API 23. Start
      // from our attached overlay (API 12), then walk to the highest parent
      // available on the current device.
      overlayNode = this.getUIContext().getAttachedFrameNodeById('reader-layout-debug-overlay');
      if (overlayNode !== null) {
        const overlayPosition = overlayNode.getPositionToWindow();
        this.frameOriginX = Number(overlayPosition.x);
        this.frameOriginY = Number(overlayPosition.y);
        root = overlayNode;
        let parent: FrameNode | null = overlayNode.getParent();
        let parentDepth = 0;
        while (parent !== null && parentDepth < 128) {
          root = parent;
          parentDepth += 1;
          parent = parent.getParent();
        }
        if (parent !== null) this.frameScanTruncated = true;
      }
    } catch (_) {
      this.frameBounds = [];
      this.frameCount = 0;
      this.frameScanTruncated = true;
      this.reportWindowSample();
      this.paintFrameBounds();
      return;
    }
    if (root === null) {
      this.frameBounds = [];
      this.frameCount = 0;
      this.reportWindowSample();
      this.paintFrameBounds();
      return;
    }
    const next: ReaderDebugBounds[] = [];
    this.scannedNodes = 0;
    this.collectFrameBounds(root, next, 0, 1, undefined, undefined);
    this.frameBounds = next;
    this.frameCount = next.length;
    this.reportWindowSample();
    this.paintFrameBounds();
  }

  private collectFrameBounds(node: FrameNode, output: ReaderDebugBounds[], depth: number, parentOpacity: number,
    parentClip: ReaderDebugRect | undefined, parentHeaders: ReaderDebugHeader | undefined): void {
    if (this.scannedNodes >= FRAME_NODE_SCAN_LIMIT || depth >= 128) {
      this.frameScanTruncated = true;
      return;
    }
    this.scannedNodes += 1;
    let nodeId: string = '';
    let nodeType: string = '';
    let visible: boolean = true;
    let effectiveOpacity: number = parentOpacity;
    let contentUnderHeader: string = '';
    let opaqueHeader: string = '';
    let x: number = 0;
    let y: number = 0;
    let width: number = 0;
    let height: number = 0;
    try { nodeId = node.getId(); } catch (_) { nodeId = ''; }
    // The overlay is a sibling of the page content. Exclude its subtree so
    // the diagnostic frames do not recursively outline themselves.
    if (nodeId === 'reader-layout-debug-overlay') return;
    try {
      if (node.getCustomProperty('readerLayoutDebugExcluded') === true) {
        this.excludedBackgroundBranches += 1;
        return;
      }
      const contentKey = node.getCustomProperty('readerLayoutDebugContentUnderHeader');
      if (typeof contentKey === 'string') contentUnderHeader = contentKey;
      const headerKey = node.getCustomProperty('readerLayoutDebugOpaqueHeader');
      if (typeof headerKey === 'string') opaqueHeader = headerKey;
    } catch (_) { this.frameScanTruncated = true; }
    try { visible = node.isVisible(); } catch (_) { this.frameScanTruncated = true; }
    if (!visible) return;
    try {
      const opacity = node.getOpacity();
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        this.frameScanTruncated = true;
        return;
      }
      if (opacity === 0) {
        this.excludedTransparentBranches += 1;
        return;
      }
      effectiveOpacity *= opacity;
    } catch (_) { this.frameScanTruncated = true; return; }
    try { nodeType = node.getNodeType(); } catch (_) { nodeType = ''; }
    try {
      const position = node.getPositionToWindow();
      const measured = node.getMeasuredSize();
      x = Number(position.x);
      y = Number(position.y);
      width = this.getUIContext().px2vp(Number(measured.width));
      height = this.getUIContext().px2vp(Number(measured.height));
    } catch (_) {
      // A virtual or detached node may not have geometry yet. Still recurse
      // into it because mounted descendants can have a real rectangle.
      width = 0;
      height = 0;
    }
    const headers: ReaderDebugHeader | undefined = contentUnderHeader.length > 0
      ? { key: contentUnderHeader, parent: parentHeaders } : parentHeaders;
    const bounds: ReaderDebugRect | undefined =
      Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0 ? { x, y, width, height } : undefined;
    if (bounds !== undefined) {
      if (opaqueHeader.length > 0 && effectiveOpacity === 1) {
        this.opaqueHeaders.set(opaqueHeader, parentClip === undefined ? bounds : this.intersectBounds(bounds, parentClip));
      }
      output.push({ kind: nodeType, opacity: effectiveOpacity, x, y, width, height, clip: parentClip, headers });
    }
    let childClip = parentClip;
    try {
      if (node.isClipToFrame()) {
        if (bounds === undefined) this.frameScanTruncated = true;
        else childClip = parentClip === undefined ? bounds : this.intersectBounds(bounds, parentClip);
      }
    } catch (_) { this.frameScanTruncated = true; }
    let firstChild: number = -1;
    let lastChild: number = -1;
    try {
      firstChild = node.getFirstChildIndexWithoutExpand();
      lastChild = node.getLastChildIndexWithoutExpand();
    } catch (_) { this.frameScanTruncated = true; return; }
    if (firstChild < 0 || lastChild < firstChild) return;
    for (let index = firstChild; index <= lastChild; index += 1) {
      if (this.scannedNodes >= FRAME_NODE_SCAN_LIMIT) {
        this.frameScanTruncated = true;
        break;
      }
      let child: FrameNode | null = null;
      try {
        // Do not expand LazyForEach just to inspect it. The overlay describes
        // the currently mounted tree and leaves virtualized pages untouched.
        child = node.getChild(index, ExpandMode.NOT_EXPAND);
      } catch (_) { this.frameScanTruncated = true; }
      if (child !== null) this.collectFrameBounds(child, output, depth + 1, effectiveOpacity, childClip, headers);
    }
  }

  private intersectBounds(a: ReaderDebugRect, b: ReaderDebugRect): ReaderDebugRect {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    return { x, y, width: Math.min(a.x + a.width, b.x + b.width) - x,
      height: Math.min(a.y + a.height, b.y + b.height) - y };
  }

  private paintOutline(entry: ReaderDebugBounds, canvas: ReaderDebugRect, x: number, y: number): void {
    // Include half of the centered one-vp stroke when deciding if it can be
    // drawn directly. Preserve the real path when only a portion is exposed.
    const stroke: ReaderDebugRect = { x: entry.x - 0.5, y: entry.y - 0.5, width: entry.width + 1, height: entry.height + 1 };
    let clipped = false;
    if (entry.clip !== undefined) {
      const visible = this.intersectBounds(stroke, entry.clip);
      if (visible.width <= 0 || visible.height <= 0) return;
      if (visible.width < stroke.width || visible.height < stroke.height) {
        this.drawingContext.save();
        clipped = true;
        this.drawingContext.beginPath();
        this.drawingContext.rect(entry.clip.x - canvas.x, entry.clip.y - canvas.y, entry.clip.width, entry.clip.height);
        this.drawingContext.clip();
      }
    }
    let header = entry.headers;
    while (header !== undefined) {
      const mask = this.opaqueHeaders.get(header.key);
      if (mask !== undefined) {
        const cover = this.intersectBounds(canvas, mask);
        const hidden = this.intersectBounds(stroke, cover);
        if (hidden.width >= stroke.width && hidden.height >= stroke.height) {
          if (clipped) this.drawingContext.restore();
          return;
        }
        if (hidden.width > 0 && hidden.height > 0) {
          if (!clipped) this.drawingContext.save();
          clipped = true;
          this.drawingContext.beginPath();
          this.drawingContext.rect(0, 0, canvas.width, canvas.height);
          this.drawingContext.rect(cover.x - canvas.x, cover.y - canvas.y, cover.width, cover.height);
          this.drawingContext.clip('evenodd');
        }
      }
      header = header.parent;
    }
    this.drawingContext.strokeRect(x, y, entry.width, entry.height);
    if (clipped) this.drawingContext.restore();
  }

  private paintFrameBounds(): void {
    if (!this.canvasReady) return;
    const canvasWidth = this.drawingContext.width;
    const canvasHeight = this.drawingContext.height;
    this.drawingContext.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!this.developerModeEnabled) return;
    this.drawingContext.lineWidth = 1;
    const canvas: ReaderDebugRect = { x: this.frameOriginX, y: this.frameOriginY,
      width: canvasWidth, height: canvasHeight };
    let paintedOpacity = -1;
    for (const entry of this.frameBounds) {
      const x = entry.x - this.frameOriginX;
      const y = entry.y - this.frameOriginY;
      if (x + entry.width <= 0 || y + entry.height <= 0 || x >= canvasWidth || y >= canvasHeight) continue;
      const color = entry.kind.startsWith('Text') ? '#147BCD' :
        entry.kind.startsWith('Image') ? '#D87913' : '#7B61FF';
      if (entry.opacity !== paintedOpacity) {
        this.drawingContext.globalAlpha = 0.32 * entry.opacity;
        paintedOpacity = entry.opacity;
      }
      this.drawingContext.strokeStyle = color;
      if (entry.clip === undefined && entry.headers === undefined) {
        this.drawingContext.strokeRect(x, y, entry.width, entry.height);
      } else {
        this.paintOutline(entry, canvas, x, y);
      }
    }
  }

  private statusTop(): number {
    this.metricsRevision;
    return Math.max(0, ReaderWindowCoordinator.metrics().statusBarRect.top);
  }

  private statusHeight(): number {
    this.metricsRevision;
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(0, metrics.statusBarRect.height, metrics.statusBarHeight);
  }

  private contentTop(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const bottom = this.statusTop() + this.statusHeight();
    return Math.max(metrics.systemInsets.top, bottom > 0 ? bottom + 8 : 0);
  }

  private windowLabel(): string {
    this.metricsRevision;
    const metrics = ReaderWindowCoordinator.metrics();
    return metrics.ready ? `${Math.round(metrics.windowRect.width)}×${Math.round(metrics.windowRect.height)}vp ` +
      `d${metrics.densityPixels.toFixed(2)} f${metrics.systemFontScale.toFixed(2)} ` +
      `IME ${metrics.keyboardArea.available ? (metrics.keyboardArea.visible ? '开' : '关') : '未知'}` : '窗口参数未就绪';
  }

  build() {
    // Let the mounted page host determine the overlay size. The window
    // snapshot can briefly be zero-sized during startup or an immersive
    // transition; using those values here collapsed the guide to a strip.
    Stack({ alignContent: Alignment.TopStart }) {
      Stack().width('100%').height('100%')
        .border({ width: 1, color: '#66FF3B30' })
        .hitTestBehavior(HitTestMode.None);
      if (this.statusTop() >= this.frameOriginY) {
        Row().width('100%').height(1)
          .position({ x: 0, y: this.statusTop() - this.frameOriginY }).backgroundColor('#66FF6B6B')
          .hitTestBehavior(HitTestMode.None);
      }
      if (this.statusTop() + this.statusHeight() >= this.frameOriginY) {
        Row().width('100%').height(1)
          .position({ x: 0, y: this.statusTop() + this.statusHeight() - this.frameOriginY })
          .backgroundColor('#66FF6B6B').hitTestBehavior(HitTestMode.None);
      }
      if (this.contentTop() >= this.frameOriginY) {
        Row().width('100%').height(1)
          .position({ x: 0, y: this.contentTop() - this.frameOriginY }).backgroundColor('#662A9D8F')
          .hitTestBehavior(HitTestMode.None);
      }
      Canvas(this.drawingContext)
        .width('100%').height('100%')
        .hitTestBehavior(HitTestMode.None)
        .onReady((): void => {
          this.canvasReady = true;
          this.scanFrameTree();
        });
      Text(`开发者模式 ${this.windowLabel()} · r${this.metricsRevision}${this.frameScanTruncated ? ' 扫描未完整' : this.frameCount === 0 ? ' 等待组件树' : ''}`)
        .fontSize(8).fontColor('#FFFFFFFF').backgroundColor('#A01F3528')
        .minFontScale(1).maxFontScale(1)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .padding({ left: 4, right: 4, top: 1, bottom: 1 })
        .position({ x: 4, y: 2 })
        .hitTestBehavior(HitTestMode.None);
    }.id('reader-layout-debug-overlay').width('100%').height('100%')
      .visibility(this.developerModeEnabled ? Visibility.Visible : Visibility.Hidden)
      // Transparent lets the page below continue receiving taps. None on a
      // full-screen sibling can still mask the lower sibling on some API
      // levels even though the overlay itself has no gesture handlers.
      .hitTestBehavior(HitTestMode.Transparent)
      .accessibilityLevel('no')
      .zIndex(10000);
  }
}
