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
  frameScanIssue: string | null;
  frameScanIssueNode: string | null;
  frameScanIssueDepth: number | null;
  scannedFrameNodes: number;
  uniqueFrameNodes: number;
  repeatedFrameNodes: number;
  collectedFrameNodes: number;
  excludedBackgroundBranches: number;
  excludedTransparentBranches: number;
  measuredOpaqueHeaders: number;
  mountedIdHints: number;
  resolvedMountedIds: number;
  unresolvedMountedIds: number;
}

interface ReaderVerificationWindowSample {
  windowId: string;
  orientation: string;
  report: ReaderDeveloperWindowReport;
  publicFixtureScope?: string;
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

interface ReaderDebugNodeVisit {
  node: FrameNode;
  depth: number;
  opacity: number;
  clip: ReaderDebugRect | undefined;
  headers: ReaderDebugHeader | undefined;
}

// 838 行书源页可达上万节点；每次全树扫描会挤占主线程，超出消费者需要。
const FRAME_NODE_SCAN_LIMIT: number = 4000;
const FRAME_NODE_CHILD_QUERY_LIMIT: number = 2048;
const CHILD_INDEX_PROBE_WINDOW: number = 16;
const CHILD_INDEX_PROBE_MISS_LIMIT: number = 4;

@Component
export struct ReaderLayoutDebugOverlay {
  @StorageLink('readerDeveloperMode') @Watch('onDeveloperModeChanged') private developerModeEnabled: boolean = false;
  @StorageLink('readerAppForeground') @Watch('onDeveloperModeChanged') private appForeground: boolean = true;
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @State private frameCount: number = 0;
  @State private frameOriginX: number = 0;
  @State private frameOriginY: number = 0;
  @State private frameScanTruncated: boolean = false;
  @State private frameScanIssue: string = '';
  private frameBounds: ReaderDebugBounds[] = [];
  private readonly opaqueHeaders: Map<string, ReaderDebugRect> = new Map();
  private scannedNodes: number = 0;
  private childIndexQueries: number = 0;
  private frameScanIssueNode: string = '';
  private frameScanIssueDepth: number = -1;
  private excludedBackgroundBranches: number = 0;
  private excludedTransparentBranches: number = 0;
  private uniqueNodes: number = 0;
  private repeatedNodes: number = 0;
  private mountedIdHints: number = 0;
  private resolvedMountedIds: number = 0;
  private unresolvedMountedIds: number = 0;
  private canvasReady: boolean = false;
  private drawingContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true));
  private frameScanHandle: number = -1;
  private lastWindowSample: string = '';
  private detachToastWindowReporter: (() => void) | undefined = undefined;

  aboutToAppear(): void {
    this.onDeveloperModeChanged();
  }

  aboutToDisappear(): void {
    this.detachToastWindowReporter?.();
    this.detachToastWindowReporter = undefined;
    if (this.frameScanHandle >= 0) {
      clearInterval(this.frameScanHandle);
      this.frameScanHandle = -1;
    }
    this.canvasReady = false;
  }

  private onDeveloperModeChanged(): void {
    this.detachToastWindowReporter?.();
    this.detachToastWindowReporter = undefined;
    if (this.frameScanHandle >= 0) {
      clearInterval(this.frameScanHandle);
      this.frameScanHandle = -1;
    }
    this.scanFrameTree();
    if (this.developerModeEnabled && this.appForeground) {
      this.frameScanHandle = setInterval((): void => this.scanFrameTree(), 1000);
      this.detachToastWindowReporter = ReaderUIVerificationProbe.attachSourceImportToastWindowReporter(
        (windowId: number, windowRevision: number): boolean => {
          const metrics = ReaderWindowCoordinator.metrics();
          if (!this.appForeground || !this.developerModeEnabled || this.getUIContext().getWindowId() !== windowId ||
            ReaderWindowCoordinator.diagnosticWindowId() !== windowId || !metrics.ready ||
            metrics.revision !== windowRevision) return false;
          this.reportWindowSample();
          return true;
        });
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
      frameScanIssue: this.frameScanIssue.length > 0 ? this.frameScanIssue : null,
      frameScanIssueNode: this.frameScanIssueNode.length > 0 ? this.frameScanIssueNode : null,
      frameScanIssueDepth: this.frameScanIssueDepth >= 0 ? this.frameScanIssueDepth : null,
      scannedFrameNodes: this.scannedNodes,
      uniqueFrameNodes: this.uniqueNodes,
      repeatedFrameNodes: this.repeatedNodes,
      collectedFrameNodes: this.frameBounds.length,
      excludedBackgroundBranches: this.excludedBackgroundBranches,
      excludedTransparentBranches: this.excludedTransparentBranches,
      measuredOpaqueHeaders: this.opaqueHeaders.size,
      mountedIdHints: this.mountedIdHints,
      resolvedMountedIds: this.resolvedMountedIds,
      unresolvedMountedIds: this.unresolvedMountedIds,
    };
    if (ReaderUIVerificationProbe.enabled()) {
      const windowId = ReaderWindowCoordinator.diagnosticWindowId();
      if (windowId !== null && metrics.ready) {
        const sample: ReaderVerificationWindowSample = {
          windowId: windowId.toString(), orientation: metrics.windowRect.width > metrics.windowRect.height ?
            'landscape' : 'portrait',
          report: report,
          publicFixtureScope: ReaderUIVerificationProbe.publicFixtureScope(),
        };
        ReaderUIVerificationProbe.emit('window-stable', 'probe', sample);
      }
    }
    const payload = JSON.stringify(report);
    if (payload === this.lastWindowSample) return;
    this.lastWindowSample = payload;
    hilog.info(0x5244, 'Reader', 'READER_DEVELOPER_LAYOUT %{public}s', payload);
  }

  private markFrameScanIncomplete(issue: string, nodeLabel: string, depth: number): void {
    if (!this.frameScanTruncated) {
      this.frameScanIssue = issue;
      this.frameScanIssueNode = nodeLabel;
      this.frameScanIssueDepth = depth;
    }
    this.frameScanTruncated = true;
  }

  private scanFrameTree(): void {
    this.opaqueHeaders.clear();
    if (!this.developerModeEnabled || !this.appForeground) {
      this.lastWindowSample = '';
      this.frameBounds = [];
      this.frameCount = 0;
      this.frameScanTruncated = false;
      this.frameScanIssue = '';
      this.frameScanIssueNode = '';
      this.frameScanIssueDepth = -1;
      this.paintFrameBounds();
      return;
    }
    let root: FrameNode | null = null;
    let overlayNode: FrameNode | null = null;
    this.frameScanTruncated = false;
    this.frameScanIssue = '';
    this.frameScanIssueNode = '';
    this.frameScanIssueDepth = -1;
    this.excludedBackgroundBranches = 0;
    this.excludedTransparentBranches = 0;
    this.uniqueNodes = 0;
    this.repeatedNodes = 0;
    this.mountedIdHints = 0;
    this.resolvedMountedIds = 0;
    this.unresolvedMountedIds = 0;
    try {
      // getPageRootNode is API 24 while this project supports API 23. Start
      // from our attached overlay (API 12), then walk to the highest parent
      // available on the current device.
      overlayNode = this.getUIContext().getAttachedFrameNodeById('reader-layout-debug-overlay');
      if (overlayNode !== null) {
        const overlayPosition = overlayNode.getPositionToWindowWithTransform();
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
        if (parent !== null) {
          this.markFrameScanIncomplete('parent-depth-limit', 'reader-layout-debug-overlay', parentDepth);
        }
      }
    } catch (_) {
      this.frameBounds = [];
      this.frameCount = 0;
      this.markFrameScanIncomplete('overlay-attach-read', 'reader-layout-debug-overlay', 0);
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
    this.childIndexQueries = 0;
    this.collectFrameBounds(root, next, 0, 1, undefined, undefined);
    this.frameBounds = next;
    this.frameCount = next.length;
    this.reportWindowSample();
    this.paintFrameBounds();
  }

  private collectFrameBounds(root: FrameNode, output: ReaderDebugBounds[], rootDepth: number, rootOpacity: number,
    parentClip: ReaderDebugRect | undefined, parentHeaders: ReaderDebugHeader | undefined): void {
    const queue: ReaderDebugNodeVisit[] = [{ node: root, depth: rootDepth, opacity: rootOpacity,
      clip: parentClip, headers: parentHeaders }];
    const visited: Set<number> = new Set<number>();
    let cursor = 0;
    while (cursor < queue.length) {
      const visit = queue[cursor];
      cursor += 1;
      const node = visit.node;
      let uniqueId = 0;
      try { uniqueId = node.getUniqueId(); } catch (_) { uniqueId = 0; }
      // Sibling chains can expose the same FrameNode wrapper more than once on
      // generated/virtual subtrees. Count and ignore repeats before spending
      // the node budget so one branch cannot starve later mounted cards.
      if (uniqueId > 0) {
        if (visited.has(uniqueId)) {
          this.repeatedNodes += 1;
          continue;
        }
        visited.add(uniqueId);
      }
      if (this.scannedNodes >= FRAME_NODE_SCAN_LIMIT) {
        this.markFrameScanIncomplete('node-limit', this.debugNodeLabel(node), visit.depth);
        break;
      }
      if (visit.depth >= 128) {
        this.markFrameScanIncomplete('depth-limit', this.debugNodeLabel(node), visit.depth);
        continue;
      }
      this.scannedNodes += 1;
      this.uniqueNodes += 1;
      let nodeId: string = '';
      let nodeType: string = '';
      let visible: boolean = true;
      let effectiveOpacity: number = visit.opacity;
      let contentUnderHeader: string = '';
      let opaqueHeader: string = '';
      let mountedDebugIds: string[] = [];
      let x: number = 0;
      let y: number = 0;
      let width: number = 0;
      let height: number = 0;
      try { nodeId = node.getId(); } catch (_) { nodeId = ''; }
      // The overlay is a sibling of the page content. Exclude its subtree so
      // the diagnostic frames do not recursively outline themselves.
      if (nodeId === 'reader-layout-debug-overlay') continue;
      try {
        if (node.getCustomProperty('readerLayoutDebugExcluded') === true) {
          this.excludedBackgroundBranches += 1;
          continue;
        }
        const contentKey = node.getCustomProperty('readerLayoutDebugContentUnderHeader');
        if (typeof contentKey === 'string') contentUnderHeader = contentKey;
        const headerKey = node.getCustomProperty('readerLayoutDebugOpaqueHeader');
        if (typeof headerKey === 'string') opaqueHeader = headerKey;
        const mountedIds = node.getCustomProperty('readerLayoutDebugMountedIds');
        if (typeof mountedIds === 'string' && mountedIds.length > 0) {
          try {
            const parsed: object = JSON.parse(mountedIds);
            if (Array.isArray(parsed)) {
              mountedDebugIds = parsed.filter((value: object): boolean => typeof value === 'string') as string[];
            }
          } catch (_) {
            this.markFrameScanIncomplete('mounted-id-parse', this.debugNodeLabel(node), visit.depth);
          }
        }
      } catch (_) {
        this.markFrameScanIncomplete('custom-property-read', this.debugNodeLabel(node), visit.depth);
      }
      try { visible = node.isVisible(); } catch (_) {
        this.markFrameScanIncomplete('visibility-read', this.debugNodeLabel(node), visit.depth);
      }
      if (!visible) continue;
      try {
        const opacity = node.getOpacity();
        if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
          this.markFrameScanIncomplete('opacity-invalid', this.debugNodeLabel(node), visit.depth);
          continue;
        }
        if (opacity === 0) {
          this.excludedTransparentBranches += 1;
          continue;
        }
        effectiveOpacity *= opacity;
      } catch (_) {
        this.markFrameScanIncomplete('opacity-read', this.debugNodeLabel(node), visit.depth);
        continue;
      }
      try { nodeType = node.getNodeType(); } catch (_) { nodeType = ''; }
      try {
        // Bookshelf cards are positioned by a parent translate rather than
        // their layout slot. The untransformed window position puts every
        // generated column at the same origin, so use the same transformed
        // geometry contract as the shelf's shared-element measurement path.
        const position = node.getPositionToWindowWithTransform();
        const measured = node.getMeasuredSize();
        x = Number(position.x);
        y = Number(position.y);
        width = this.getUIContext().px2vp(Number(measured.width));
        height = this.getUIContext().px2vp(Number(measured.height));
      } catch (_) {
        // A virtual or detached node may not have geometry yet. Still enqueue
        // it because mounted descendants can have a real rectangle.
        width = 0;
        height = 0;
      }
      const headers: ReaderDebugHeader | undefined = contentUnderHeader.length > 0
        ? { key: contentUnderHeader, parent: visit.headers } : visit.headers;
      const bounds: ReaderDebugRect | undefined =
        Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0 ? { x, y, width, height } : undefined;
      // A clipped scroll carrier can retain every generated row in the mounted
      // tree. Rows wholly outside its actual native clip cannot paint, so do
      // not spend the observation budget walking their card descendants.
      if (bounds !== undefined && visit.clip !== undefined &&
        (bounds.x + bounds.width <= visit.clip.x || bounds.y + bounds.height <= visit.clip.y ||
          bounds.x >= visit.clip.x + visit.clip.width || bounds.y >= visit.clip.y + visit.clip.height)) {
        continue;
      }
      if (bounds !== undefined) {
        if (opaqueHeader.length > 0 && effectiveOpacity === 1) {
          this.opaqueHeaders.set(opaqueHeader,
            visit.clip === undefined ? bounds : this.intersectBounds(bounds, visit.clip));
        }
        output.push({ kind: nodeType, opacity: effectiveOpacity, x, y, width, height, clip: visit.clip, headers });
      }
      let childClip = visit.clip;
      try {
        // ArkUI scroll containers clip their mounted content even when the
        // low-level FrameNode does not report the clip bit. Without this
        // semantic fallback, a retained source list can be walked through all
        // offscreen rows before the node budget stops the sample.
        const scrollContainer = nodeType === 'List' || nodeType === 'Scroll' ||
          nodeType === 'Grid' || nodeType === 'WaterFlow' || nodeType === 'Swiper';
        if (node.isClipToFrame() || scrollContainer) {
          if (bounds === undefined) {
            // Scroll carriers can omit their own measured rectangle while the
            // nearest measurable ancestor still owns the visible viewport
            // clip. Inherit that clip instead of marking the whole sample
            // incomplete for an internal frame that cannot paint a rectangle.
            if (visit.clip === undefined) {
              this.markFrameScanIncomplete('clip-bounds-unavailable', this.debugNodeLabel(node), visit.depth);
            }
          } else childClip = visit.clip === undefined ? bounds : this.intersectBounds(bounds, visit.clip);
        }
      } catch (_) {
        this.markFrameScanIncomplete('clip-read', this.debugNodeLabel(node), visit.depth);
      }
      let firstChildIndex: number = -1;
      let lastChildIndex: number = -1;
      try {
        firstChildIndex = node.getFirstChildIndexWithoutExpand();
        lastChildIndex = node.getLastChildIndexWithoutExpand();
      } catch (_) {
        this.markFrameScanIncomplete('child-index-read', this.debugNodeLabel(node), visit.depth);
      }
      const childIds: Set<number> = new Set<number>();
      if (firstChildIndex >= 0 && lastChildIndex >= firstChildIndex) {
        const remainingBudget = Math.max(1, FRAME_NODE_SCAN_LIMIT - this.scannedNodes);
        const remainingQueryBudget = FRAME_NODE_CHILD_QUERY_LIMIT - this.childIndexQueries;
        const span = lastChildIndex - firstChildIndex + 1;
        const allowedQueries = Math.min(remainingBudget, Math.max(0, remainingQueryBudget));
        const probeLimit = firstChildIndex + allowedQueries - 1;
        const exceedsNodeBudget = span > remainingBudget;
        const exceedsQueryBudget = span > remainingQueryBudget;
        if (exceedsQueryBudget && (!exceedsNodeBudget || remainingQueryBudget < remainingBudget)) {
          this.markFrameScanIncomplete('child-index-query-limit', this.debugNodeLabel(node), visit.depth);
        }
        if (exceedsNodeBudget && (!exceedsQueryBudget || remainingBudget <= remainingQueryBudget)) {
          this.markFrameScanIncomplete('child-index-limit', this.debugNodeLabel(node), visit.depth);
        }
        const boundedProbeLimit = Math.min(lastChildIndex + CHILD_INDEX_PROBE_WINDOW, probeLimit);
        let consecutiveMisses = 0;
        for (let index = firstChildIndex; index <= boundedProbeLimit; index += 1) {
          if (this.childIndexQueries >= FRAME_NODE_CHILD_QUERY_LIMIT) {
            this.markFrameScanIncomplete('child-index-query-limit', this.debugNodeLabel(node), visit.depth);
            break;
          }
          this.childIndexQueries += 1;
          let child: FrameNode | null = null;
          try {
            // The mounted main-tree indices are not guaranteed to start at
            // zero for generated ForEach/LazyForEach children. Enumerating the
            // documented first..last range keeps the siblings that a virtual
            // child cursor omits while NOT_EXPAND avoids creating the rest.
            child = node.getChild(index, ExpandMode.NOT_EXPAND);
          } catch (_) {
            this.markFrameScanIncomplete('mounted-child-read', this.debugNodeLabel(node), visit.depth);
            continue;
          }
          if (child === null) {
            // Some generated subtrees report only their first mounted child in
            // the no-expand range even though later mounted children remain
            // addressable by index. Probe a bounded window past the reported
            // range and stop after a short run of misses so a long virtual
            // list is not walked page by page.
            consecutiveMisses += 1;
            if (index > lastChildIndex && consecutiveMisses >= CHILD_INDEX_PROBE_MISS_LIMIT) break;
            continue;
          }
          consecutiveMisses = 0;
          let childUniqueId = 0;
          try { childUniqueId = child.getUniqueId(); } catch (_) { childUniqueId = 0; }
          if (childUniqueId > 0 && childIds.has(childUniqueId)) {
            this.repeatedNodes += 1;
            continue;
          }
          if (childUniqueId > 0) childIds.add(childUniqueId);
          queue.push({ node: child, depth: visit.depth + 1, opacity: effectiveOpacity,
            clip: childClip, headers });
        }
      }
      // ArkUI's unqualified child and sibling cursors can build lazy rows
      // during a scan. A generated row can expose otherwise hidden mounted
      // cards by publishing their stable IDs for attached-node lookup.
      for (const mountedId of mountedDebugIds) {
        if (this.scannedNodes >= FRAME_NODE_SCAN_LIMIT) {
          this.markFrameScanIncomplete('node-limit', this.debugNodeLabel(node), visit.depth);
          break;
        }
        this.mountedIdHints += 1;
        let mounted: FrameNode | null = null;
        try {
          mounted = this.getUIContext().getAttachedFrameNodeById(mountedId);
          if (mounted === null) mounted = this.getUIContext().getFrameNodeById(mountedId);
        } catch (_) {
          mounted = null;
        }
        if (mounted === null) {
          this.unresolvedMountedIds += 1;
          this.markFrameScanIncomplete('mounted-id-unresolved', mountedId, visit.depth);
          continue;
        }
        this.resolvedMountedIds += 1;
        queue.push({ node: mounted, depth: visit.depth + 1, opacity: effectiveOpacity,
          clip: childClip, headers });
      }
    }
  }

  private debugNodeLabel(node: FrameNode): string {
    try {
      const id = node.getId();
      if (id.length > 0) return id;
    } catch (_) {
      // A readable type is still useful when the identifier is unavailable.
    }
    try {
      const type = node.getNodeType();
      if (type.length > 0) return type;
    } catch (_) {
      // Keep the stable fallback below.
    }
    return '<anonymous>';
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
      Text(`开发者模式 ${this.windowLabel()} · ${this.scannedNodes}→${this.frameCount}` +
        `${this.mountedIdHints > 0 ? ` id${this.resolvedMountedIds}/${this.mountedIdHints}` : ''}` +
        `${this.frameScanTruncated ? ` 扫描未完整:${this.frameScanIssue}` +
          `${this.frameScanIssueNode.length > 0 ? `@${this.frameScanIssueNode}` : ''}` :
          this.frameCount === 0 ? ' 等待组件树' : ''} · r${this.metricsRevision}`)
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
