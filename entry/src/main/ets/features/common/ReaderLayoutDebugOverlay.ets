import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { ExpandMode, FrameNode } from '@ohos.arkui.node';

interface ReaderDebugBounds {
  id: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const FRAME_NODE_SCAN_LIMIT: number = 10000;

@Component
export struct ReaderLayoutDebugOverlay {
  @StorageLink('readerDeveloperMode') @Watch('onDeveloperModeChanged') private developerModeEnabled: boolean = false;
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @State private frameCount: number = 0;
  @State private frameOriginX: number = 0;
  @State private frameOriginY: number = 0;
  @State private frameScanTruncated: boolean = false;
  private frameBounds: ReaderDebugBounds[] = [];
  private scannedNodes: number = 0;
  private canvasReady: boolean = false;
  private drawingContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true));
  private frameScanHandle: number = -1;

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
    if (this.developerModeEnabled) {
      this.frameScanHandle = setInterval((): void => this.scanFrameTree(), 250);
    }
  }

  private scanFrameTree(): void {
    if (!this.developerModeEnabled) {
      this.frameBounds = [];
      this.frameCount = 0;
      this.frameScanTruncated = false;
      this.paintFrameBounds();
      return;
    }
    let root: FrameNode | null = null;
    let overlayNode: FrameNode | null = null;
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
          try { parent = parent.getParent(); } catch (_) { parent = null; }
        }
      }
    } catch (_) {
      this.frameBounds = [];
      this.frameCount = 0;
      this.frameScanTruncated = false;
      this.paintFrameBounds();
      return;
    }
    if (root === null) {
      this.frameBounds = [];
      this.frameCount = 0;
      this.frameScanTruncated = false;
      this.paintFrameBounds();
      return;
    }
    const next: ReaderDebugBounds[] = [];
    this.frameScanTruncated = false;
    this.scannedNodes = 0;
    this.collectFrameBounds(root, next, 0);
    this.frameBounds = next;
    this.frameCount = next.length;
    this.paintFrameBounds();
  }

  private collectFrameBounds(node: FrameNode, output: ReaderDebugBounds[], depth: number): void {
    if (this.scannedNodes >= FRAME_NODE_SCAN_LIMIT || depth >= 128) {
      this.frameScanTruncated = true;
      return;
    }
    this.scannedNodes += 1;
    let nodeId: string = '';
    let nodeType: string = '';
    let visible: boolean = true;
    let x: number = 0;
    let y: number = 0;
    let width: number = 0;
    let height: number = 0;
    try { nodeId = node.getId(); } catch (_) { nodeId = ''; }
    // The overlay is a sibling of the page content. Exclude its subtree so
    // the diagnostic frames do not recursively outline themselves.
    if (nodeId === 'reader-layout-debug-overlay') return;
    try { nodeType = node.getNodeType(); } catch (_) { nodeType = ''; }
    try { visible = node.isVisible(); } catch (_) { visible = true; }
    if (!visible) return;
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
    if (visible && Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0) {
      let uniqueId: number = 0;
      try { uniqueId = node.getUniqueId(); } catch (_) { uniqueId = output.length; }
      output.push({
        id: `frame:${uniqueId}`,
        kind: `${nodeType.length > 0 ? nodeType : '__Common__'}${nodeId.length > 0 ? `#${nodeId}` : ''}`,
        x, y, width, height,
      });
    }
    let firstChild: number = -1;
    let lastChild: number = -1;
    try {
      firstChild = node.getFirstChildIndexWithoutExpand();
      lastChild = node.getLastChildIndexWithoutExpand();
    } catch (_) { return; }
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
      } catch (_) { child = null; }
      if (child !== null) this.collectFrameBounds(child, output, depth + 1);
    }
  }

  private paintFrameBounds(): void {
    if (!this.canvasReady) return;
    const canvasWidth = this.drawingContext.width;
    const canvasHeight = this.drawingContext.height;
    this.drawingContext.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!this.developerModeEnabled) return;
    this.drawingContext.lineWidth = 1;
    this.drawingContext.font = '8vp sans-serif';
    this.drawingContext.textBaseline = 'top';
    for (const entry of this.frameBounds) {
      const x = entry.x - this.frameOriginX;
      const y = entry.y - this.frameOriginY;
      if (x + entry.width <= 0 || y + entry.height <= 0 || x >= canvasWidth || y >= canvasHeight) continue;
      const color = entry.kind.startsWith('Text') ? '#147BCD' :
        entry.kind.startsWith('Image') ? '#D87913' : '#7B61FF';
      this.drawingContext.strokeStyle = color;
      this.drawingContext.strokeRect(x, y, entry.width, entry.height);
      // All nodes get a border. Label only named nodes to keep the underlying
      // interface readable instead of covering it with hundreds of labels.
      if (entry.kind.indexOf('#') >= 0) {
        this.drawingContext.fillStyle = color;
        this.drawingContext.fillText(entry.kind, Math.max(1, x + 1), Math.max(1, y + 1));
      }
    }
  }

  private statusTop(): number {
    return Math.max(0, ReaderWindowCoordinator.metrics().statusBarRect.top);
  }

  private statusHeight(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(0, metrics.statusBarRect.height, metrics.statusBarHeight);
  }

  private contentTop(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const bottom = this.statusTop() + this.statusHeight();
    return Math.max(metrics.systemInsets.top, bottom > 0 ? bottom + 8 : 0);
  }

  build() {
    // Let the mounted page host determine the overlay size. The window
    // snapshot can briefly be zero-sized during startup or an immersive
    // transition; using those values here collapsed the guide to a strip.
    Stack({ alignContent: Alignment.TopStart }) {
      Stack().width('100%').height('100%')
        .border({ width: 1, color: '#66FF3B30' })
        .hitTestBehavior(HitTestMode.None);
      Row().width('100%').height(1)
        .position({ x: 0, y: this.statusTop() }).backgroundColor('#FFFF6B6B')
        .hitTestBehavior(HitTestMode.None);
      Row().width('100%').height(1)
        .position({ x: 0, y: this.statusTop() + this.statusHeight() }).backgroundColor('#FFFF6B6B')
        .hitTestBehavior(HitTestMode.None);
      Row().width('100%').height(1)
        .position({ x: 0, y: this.contentTop() }).backgroundColor('#FF2A9D8F')
        .hitTestBehavior(HitTestMode.None);
      Canvas(this.drawingContext)
        .width('100%').height('100%')
        .hitTestBehavior(HitTestMode.None)
        .onReady((): void => {
          this.canvasReady = true;
          this.scanFrameTree();
        });
      Text(`开发者模式 status ${Math.round(this.statusHeight())}vp nodes ${this.frameCount}${this.frameScanTruncated ? '（扫描未完整）' : this.frameCount === 0 ? '（组件树暂未就绪）' : ''} r${this.metricsRevision}`)
        .fontSize(10).fontColor('#FFFFFFFF').backgroundColor('#B31F3528')
        .padding({ left: 6, right: 6, top: 3, bottom: 3 })
        .position({ x: 6, y: Math.max(2, this.contentTop() + 2) })
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
