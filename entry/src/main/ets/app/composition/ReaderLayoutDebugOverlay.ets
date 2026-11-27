import { readerAppColor } from '../../ui/foundation/ReaderThemeRegistry';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../ui/foundation/ReaderFontFamilies';
import { ReaderWindowCoordinator } from '../ReaderWindowCoordinator';
import { ReaderUIVerificationProbe } from '../diagnostics/ReaderUIVerificationProbe';
import { ReaderTransitionRecorder } from '../diagnostics/ReaderTransitionRecorder';
import { ReaderNativeLayoutAudit, type ReaderNativeLayoutParent } from '../diagnostics/ReaderNativeLayoutAudit';
import { readerJourneyEnvironment, type ReaderJourneyEnvironment } from '../diagnostics/ReaderJourneyEnvironment';
import { observeReaderTransitions } from '../../ui/foundation/ReaderTransitionSignals';
import { readerVisualSafeTop } from '../../ui/foundation/ReaderWindowMetrics';
import type { ReaderWindowMetricsSnapshot } from '../../ui/foundation/ReaderWindowMetrics';
import { ExpandMode, FrameNode } from '@ohos.arkui.node';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerMotionNowMs } from '../../ui/foundation/ReaderMotionClock';
import { readerFrameChildQueryRange } from '../../ui/layout/ReaderFrameChildQueryRange';
import { ReaderPostLayoutFrame } from '../../ui/layout/ReaderPostLayoutFrame';
import { READER_LAYOUT_INVARIANT_PROPERTY, readerLayoutOverlayRoots, readerOwnedLayoutModals } from '../../ui/foundation/ReaderLayoutInvariantSignals';
import { evaluateLayoutInvariants, READER_PAGED_INPUT_SCOPE } from '../../ui/layout/LayoutInvariantEvaluator';
import type { LayoutInvariantNode, LayoutInvariantTag, LayoutInvariantRect, LayoutInvariantResult } from '../../ui/layout/LayoutInvariantEvaluator';

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
  invariantHeaderId: string | undefined;
  auditParent?: ReaderNativeLayoutParent;
}

interface LayoutInvariantInspectorAttributes {
  enabled?: string | boolean;
  hitTestBehavior?: string | number;
}

interface LayoutInvariantInspectorNode {
  $ID?: number;
  $attrs?: LayoutInvariantInspectorAttributes;
}

interface LayoutInvariantReceipt extends LayoutInvariantResult {
  schemaVersion: number;
  sequence: number;
  route: string;
  scheme: string;
  status: string;
  modalOpen: boolean;
  recoveryPending: boolean;
  environment: ReaderJourneyEnvironment;
  violationCount: number;
  missingCount: number;
  frameScanIssue?: string;
  frameScanIssueNode?: string;
  frameScanIssueDepth?: number;
  frameScanIssueFirstChildIndex?: number;
  frameScanIssueLastChildIndex?: number;
}

// 838 行书源页可达上万节点；每次全树扫描会挤占主线程，超出消费者需要。
const FRAME_NODE_SCAN_LIMIT: number = 4000;
const FRAME_NODE_CHILD_QUERY_LIMIT: number = 2048;
const CHILD_INDEX_PROBE_WINDOW: number = 16;
const CHILD_INDEX_PROBE_MISS_LIMIT: number = 4;
const MODAL_RECOVERY_ALLOWANCE_MS: number = 200;
let layoutInvariantSequence: number = 0;

@Component
export struct ReaderLayoutDebugOverlay {
  @StorageLink('readerDeveloperMode') @Watch('onDeveloperModeChanged') private developerModeEnabled: boolean = false;
  @StorageLink('readerLayoutInvariantAutomation') @Watch('onDeveloperModeChanged') private automationEnabled: boolean = false;
  @StorageLink('readerAppForeground') @Watch('onDeveloperModeChanged') private appForeground: boolean = true;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('scheduleInvariantScan') private metricsRevision: number = 0;
  @StorageLink('readerLayoutInvariantRevision') @Watch('scheduleInvariantScan') private invariantRevision: number = 0;
  @Prop @Watch('routeChanged') route: string = '';
  @Prop @Watch('scheduleInvariantScan') mainInputEnabled: boolean = true;
  @Prop requiresHeader: boolean = true;
  @Prop requiresFirstContent: boolean = false;
  @Prop requiresControl: boolean = false;
  @State private invariantLabel: string = '…';
  @State private invariantColor: string = '#6F512D';
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
  private frameScanIssueFirstChildIndex: number | undefined = undefined;
  private frameScanIssueLastChildIndex: number | undefined = undefined;
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
  private detachTransitionRecorder: (() => void) | undefined = undefined;
  private transitionRecorder: ReaderTransitionRecorder | undefined = undefined;
  private invariantNodes: LayoutInvariantNode[] = [];
  private readonly nativeLayoutAudit: ReaderNativeLayoutAudit = new ReaderNativeLayoutAudit();
  private invariantFramePending: boolean = false;
  private mounted: boolean = false;
  private modalWasOpen: boolean = false;
  private modalCloseDurationMs: number = 0;
  private modalRecoveryAfter: number = -1;
  private modalRecoveryVerified: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.onDeveloperModeChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.retireTransitionRecorder();
    this.detachToastWindowReporter?.();
    this.detachToastWindowReporter = undefined;
    if (this.frameScanHandle >= 0) {
      clearInterval(this.frameScanHandle);
      this.frameScanHandle = -1;
    }
    this.canvasReady = false;
  }

  private diagnosticsActive(): boolean {
    return this.mounted && this.appForeground && (this.developerModeEnabled || this.automationEnabled);
  }

  private routeChanged(): void {
    // One still-mounted overlay can observe a modal handing input to a new
    // route. Keep the pending close, while retiring any previously completed proof.
    this.modalRecoveryVerified = false;
    this.scheduleInvariantScan();
  }

  private scheduleInvariantScan(): void {
    if (!this.diagnosticsActive() || this.invariantFramePending) return;
    this.invariantFramePending = true;
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        this.invariantFramePending = false;
        if (this.diagnosticsActive()) this.scanFrameTree();
      }));
    } catch (_) { this.invariantFramePending = false; }
  }

  private onDeveloperModeChanged(): void {
    this.detachToastWindowReporter?.();
    this.detachToastWindowReporter = undefined;
    if (this.frameScanHandle >= 0) {
      clearInterval(this.frameScanHandle);
      this.frameScanHandle = -1;
    }
    if (this.diagnosticsActive()) {
      if (this.transitionRecorder === undefined) {
        const recorder = new ReaderTransitionRecorder(() => this.getUIContext(), () => this.route);
        this.transitionRecorder = recorder;
        this.detachTransitionRecorder = observeReaderTransitions(observation => recorder.start(observation));
      }
      this.scheduleInvariantScan();
      this.frameScanHandle = setInterval((): void => this.scheduleInvariantScan(), 500);
    } else {
      this.retireTransitionRecorder();
      this.scanFrameTree();
    }
    if (this.developerModeEnabled && this.appForeground) {
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

  private retireTransitionRecorder(): void {
    this.detachTransitionRecorder?.();
    this.detachTransitionRecorder = undefined;
    this.transitionRecorder?.retire();
    this.transitionRecorder = undefined;
  }

  private reportInvariants(scanned: boolean): void {
    const metrics = ReaderWindowCoordinator.metrics();
    for (const tag of readerOwnedLayoutModals()) this.invariantNodes.push({ tag, opacity: 0, intercepts: tag.intercepts });
    const modals = this.invariantNodes.filter((node: LayoutInvariantNode): boolean => node.tag.role === 'modal-overlay');
    const modalOpen = modals.some((node: LayoutInvariantNode): boolean => node.tag.active === true);
    const now = readerMotionNowMs();
    if (modalOpen) {
      for (const modal of modals) this.modalCloseDurationMs = Math.max(this.modalCloseDurationMs, modal.tag.closeDurationMs ?? 0);
      this.modalRecoveryAfter = -1;
      this.modalRecoveryVerified = false;
    } else if (this.modalWasOpen && scanned && !this.frameScanTruncated) {
      this.modalRecoveryAfter = now + this.modalCloseDurationMs + MODAL_RECOVERY_ALLOWANCE_MS;
      this.modalCloseDurationMs = 0;
    }
    if (scanned && !this.frameScanTruncated) this.modalWasOpen = modalOpen;
    const recoveryPending = this.modalRecoveryAfter >= 0 && now < this.modalRecoveryAfter;
    const recovery = this.modalRecoveryAfter >= 0 && !recoveryPending;
    const result = evaluateLayoutInvariants({ nodes: this.invariantNodes, scanComplete: scanned && !this.frameScanTruncated,
      safeTopVp: metrics.ready ? readerVisualSafeTop(metrics) : undefined,
      fontScale: metrics.ready ? metrics.systemFontScale : undefined,
      requiresHeader: this.requiresHeader, requiresControl: this.requiresControl,
      requiresFirstContent: this.requiresFirstContent, modalOpen, recoveryPending,
      checkRecovery: recovery || this.modalRecoveryVerified,
      mainInputEnabled: this.mainInputEnabled, requiresNativeMainInput: this.route === 'reading',
      native: this.nativeLayoutAudit.build(metrics, this.route, this.invariantNodes, scanned && !this.frameScanTruncated,
        this.appThemeScheme) });
    const receipt: LayoutInvariantReceipt = {
      schemaVersion: 2, sequence: ++layoutInvariantSequence, route: this.route, scheme: this.appThemeScheme,
      status: result.missing.length === 0 && !recoveryPending ? 'measured' : 'incomplete',
      violations: result.violations.slice(0, 12), missing: result.missing.slice(0, 12),
      violationCount: result.violations.length, missingCount: result.missing.length,
      observedRules: result.observedRules, modalOpen, recoveryPending,
      nativeAudit: result.nativeAudit, features: result.features, environment: readerJourneyEnvironment(metrics, this.appThemeScheme),
      frameScanIssue: this.frameScanIssue.length > 0 ? this.frameScanIssue : undefined,
      frameScanIssueNode: this.frameScanIssueNode.length > 0 ? this.frameScanIssueNode : undefined,
      frameScanIssueDepth: this.frameScanIssueDepth >= 0 ? this.frameScanIssueDepth : undefined,
      frameScanIssueFirstChildIndex: this.frameScanIssueFirstChildIndex,
      frameScanIssueLastChildIndex: this.frameScanIssueLastChildIndex,
    };
    if (recovery && receipt.status === 'measured' && result.violations.length === 0) {
      this.modalRecoveryAfter = -1;
      this.modalRecoveryVerified = true;
    }
    if (this.developerModeEnabled) {
      this.invariantLabel = receipt.violations.length > 0 ? `${receipt.violations.length}` : receipt.status === 'measured' ? '0' : '…';
      this.invariantColor = receipt.violations.length > 0 ? '#A51A27' : receipt.status === 'measured' ? '#206841' : '#6F512D';
    }
    hilog.info(0x5244, 'Reader', 'READER_LAYOUT_INVARIANTS %{public}s', JSON.stringify(receipt));
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

  private markFrameScanIncomplete(issue: string, nodeLabel: string, depth: number,
    firstChildIndex?: number, lastChildIndex?: number): void {
    if (!this.frameScanTruncated) {
      this.frameScanIssue = issue;
      this.frameScanIssueNode = nodeLabel;
      this.frameScanIssueDepth = depth;
      this.frameScanIssueFirstChildIndex = firstChildIndex;
      this.frameScanIssueLastChildIndex = lastChildIndex;
    }
    this.frameScanTruncated = true;
  }

  private scanFrameTree(): void {
    this.opaqueHeaders.clear();
    this.invariantNodes = [];
    this.nativeLayoutAudit.reset();
    if (!this.diagnosticsActive()) {
      this.lastWindowSample = '';
      this.frameBounds = [];
      this.frameCount = 0;
      this.frameScanTruncated = false;
      this.frameScanIssue = '';
      this.frameScanIssueNode = '';
      this.frameScanIssueDepth = -1;
      this.frameScanIssueFirstChildIndex = undefined;
      this.frameScanIssueLastChildIndex = undefined;
      this.paintFrameBounds();
      return;
    }
    let root: FrameNode | null = null;
    let overlayNode: FrameNode | null = null;
    this.frameScanTruncated = false;
    this.frameScanIssue = '';
    this.frameScanIssueNode = '';
    this.frameScanIssueDepth = -1;
    this.frameScanIssueFirstChildIndex = undefined;
    this.frameScanIssueLastChildIndex = undefined;
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
      this.reportInvariants(false);
      if (this.developerModeEnabled) this.reportWindowSample();
      this.paintFrameBounds();
      return;
    }
    if (root === null) {
      this.frameBounds = [];
      this.frameCount = 0;
      this.markFrameScanIncomplete('overlay-anchor-unresolved', 'reader-layout-debug-overlay', 0);
      this.reportInvariants(false);
      if (this.developerModeEnabled) this.reportWindowSample();
      this.paintFrameBounds();
      return;
    }
    const next: ReaderDebugBounds[] = [];
    this.scannedNodes = 0;
    this.childIndexQueries = 0;
    const visited: Set<number> = new Set<number>();
    this.collectFrameBounds(root, next, 0, 1, undefined, undefined, visited);
    // A cover, a custom dialog or a popup can be attached outside the page.
    // Each current root is registered by its mounted content in this window.
    const context = this.getUIContext();
    const windowId = context.getWindowId();
    const unscopedOverlay = readerLayoutOverlayRoots(undefined)[0];
    if (windowId === undefined || unscopedOverlay !== undefined) {
      this.markFrameScanIncomplete('overlay-window-unresolved', unscopedOverlay ?? '', 0);
    }
    for (const id of windowId === undefined ? [] : readerLayoutOverlayRoots(windowId)) {
      try {
        const panel = context.getAttachedFrameNodeById(id);
        if (panel === null || !panel.isAttached() || panel.isDisposed()) {
          this.markFrameScanIncomplete('overlay-root-unresolved', id, 0);
        } else this.collectMountedOverlay(panel, next, visited);
      } catch (_) { this.markFrameScanIncomplete('native-surface-read', id, 0); }
    }
    this.frameBounds = next;
    this.frameCount = next.length;
    this.reportInvariants(true);
    if (this.developerModeEnabled) {
      this.reportWindowSample();
      this.paintFrameBounds();
    }
  }

  private collectMountedOverlay(panel: FrameNode, output: ReaderDebugBounds[], visited: Set<number>): void {
    const panelId = panel.getUniqueId();
    if (visited.has(panelId)) return;
    // Include the platform container when its attached branch is available.
    // This preserves its clip and input hierarchy around the registered panel.
    let root = panel;
    let parent = panel.getParent();
    let depth = 0;
    while (parent !== null && !visited.has(parent.getUniqueId()) && depth < 128) {
      root = parent;
      parent = parent.getParent();
      depth += 1;
    }
    if (depth >= 128) this.markFrameScanIncomplete('overlay-parent-depth-limit', this.debugNodeLabel(panel), depth);
    this.collectFrameBounds(root, output, 0, 1, undefined, undefined, visited);
    // Some native overlay containers do not enumerate their attached panel
    // in the normal child range even when its id looks up successfully.
    if (!visited.has(panelId)) this.collectFrameBounds(panel, output, 0, 1, undefined, undefined, visited);
  }

  private collectFrameBounds(root: FrameNode, output: ReaderDebugBounds[], rootDepth: number, rootOpacity: number,
    parentClip: ReaderDebugRect | undefined, parentHeaders: ReaderDebugHeader | undefined, visited: Set<number>): void {
    const queue: ReaderDebugNodeVisit[] = [{ node: root, depth: rootDepth, opacity: rootOpacity,
      clip: parentClip, headers: parentHeaders, invariantHeaderId: undefined }];
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
      let invariantTag: LayoutInvariantTag | undefined;
      let x: number = 0;
      let y: number = 0;
      let width: number = 0;
      let height: number = 0;
      try { nodeId = node.getId(); } catch (_) { nodeId = ''; }
      // The overlay is a sibling of the page content. Exclude its subtree so
      // the diagnostic frames do not recursively outline themselves.
      if (nodeId === 'reader-layout-debug-overlay') continue;
      try {
        const property = node.getCustomProperty(READER_LAYOUT_INVARIANT_PROPERTY);
        if (property !== undefined && property !== null && typeof property === 'object') invariantTag = property as LayoutInvariantTag;
        if (node.getCustomProperty('readerLayoutDebugExcluded') === true) {
          // Keep the native admission receipt for an excluded/disabled reader, but omit its hidden child geometry.
          if (invariantTag?.role === 'main-input') {
            this.recordInvariantNode(node, uniqueId, invariantTag, undefined, visit.clip, visit.invariantHeaderId, visit.opacity);
          }
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
        effectiveOpacity *= opacity;
      } catch (_) {
        this.markFrameScanIncomplete('opacity-read', this.debugNodeLabel(node), visit.depth);
        continue;
      }
      try { nodeType = node.getNodeType(); } catch (_) { nodeType = ''; }
      let invariantBounds: LayoutInvariantRect | undefined;
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
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)) {
          invariantBounds = { x, y, width, height };
        }
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
      const isHeader = invariantTag?.role === 'fixed-header' || invariantTag?.role === 'floating-header';
      const invariantHeaderId = isHeader ? `${invariantTag?.id}:${uniqueId}` : visit.invariantHeaderId;
      let firstChildIndex: number = -1;
      let lastChildIndex: number = -1;
      try {
        firstChildIndex = node.getFirstChildIndexWithoutExpand();
        lastChildIndex = node.getLastChildIndexWithoutExpand();
      } catch (_) {
        this.markFrameScanIncomplete('child-index-read', this.debugNodeLabel(node), visit.depth, firstChildIndex, lastChildIndex);
      }
      const remainingNodes = Math.max(1, FRAME_NODE_SCAN_LIMIT - this.scannedNodes);
      const remainingQueries = FRAME_NODE_CHILD_QUERY_LIMIT - this.childIndexQueries;
      const allowedQueries = Math.min(remainingNodes, Math.max(0, remainingQueries));
      const childQuery = readerFrameChildQueryRange(firstChildIndex, lastChildIndex, allowedQueries);
      const audit = this.nativeLayoutAudit.record(this.getUIContext(), node, uniqueId, nodeId, nodeType, effectiveOpacity,
        invariantBounds, visit.clip, visit.auditParent, firstChildIndex < 0);
      const suppressInput = visit.auditParent?.suppressInput === true || audit.enabled === false || audit.hitTest === 'none';
      if (effectiveOpacity === 0 && suppressInput && invariantTag?.role !== 'modal-overlay' && invariantTag?.role !== 'key-control') {
        this.excludedTransparentBranches += 1;
        continue;
      }
      // A clipped scroll carrier can retain every generated row in the mounted
      // tree. Rows wholly outside its actual native clip cannot paint, so do
      // not spend the observation budget walking their card descendants.
      if (bounds !== undefined && visit.clip !== undefined &&
        (bounds.x + bounds.width <= visit.clip.x || bounds.y + bounds.height <= visit.clip.y ||
          bounds.x >= visit.clip.x + visit.clip.width || bounds.y >= visit.clip.y + visit.clip.height)) {
        continue;
      }
      if (invariantTag !== undefined) {
        this.recordInvariantNode(node, uniqueId, invariantTag, invariantBounds, visit.clip, visit.invariantHeaderId, effectiveOpacity);
      }
      if (bounds !== undefined && effectiveOpacity > 0) {
        if (opaqueHeader.length > 0 && effectiveOpacity === 1) {
          this.opaqueHeaders.set(opaqueHeader,
            visit.clip === undefined ? bounds : this.intersectBounds(bounds, visit.clip));
        }
        output.push({ kind: nodeType, opacity: effectiveOpacity, x, y, width, height, clip: visit.clip, headers });
      }
      let childClip = visit.clip;
      let scrollClip = visit.auditParent?.scrollClip === true;
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
          } else {
            childClip = visit.clip === undefined ? bounds : this.intersectBounds(bounds, visit.clip);
            scrollClip = scrollContainer;
          }
        }
      } catch (_) {
        this.markFrameScanIncomplete('clip-read', this.debugNodeLabel(node), visit.depth);
      }
      const auditParent: ReaderNativeLayoutParent = { key: audit.key, type: nodeType, bounds: invariantBounds,
        scrollClip, suppressInput };
      const childIds: Set<number> = new Set<number>();
      if (childQuery !== undefined) {
        const probeLimit = childQuery.first + allowedQueries - 1;
        const boundedProbeLimit = childQuery.byMountedIndex ? probeLimit :
          Math.min(childQuery.last + CHILD_INDEX_PROBE_WINDOW, probeLimit);
        let reachedMountedEnd = false;
        let consecutiveMisses = 0;
        for (let index = childQuery.first; index <= boundedProbeLimit; index += 1) {
          this.childIndexQueries += 1;
          let child: FrameNode | null = null;
          try {
            // NOT_EXPAND addresses only FrameNodes in the mounted main tree.
            child = node.getChild(index, ExpandMode.NOT_EXPAND);
          } catch (_) {
            this.markFrameScanIncomplete('mounted-child-read', this.debugNodeLabel(node), visit.depth,
              firstChildIndex, lastChildIndex);
            continue;
          }
          if (child === null) {
            if (childQuery.byMountedIndex) {
              reachedMountedEnd = true;
              break;
            }
            // Keep the short tail probe for ordinary generated child ranges.
            consecutiveMisses += 1;
            if (index > childQuery.last && consecutiveMisses >= CHILD_INDEX_PROBE_MISS_LIMIT) break;
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
            clip: childClip, headers, invariantHeaderId, auditParent });
        }
        if (childQuery.byMountedIndex && !reachedMountedEnd) {
          const issue = remainingQueries < remainingNodes ? 'child-index-query-limit' : 'child-index-limit';
          this.markFrameScanIncomplete(issue, this.debugNodeLabel(node), visit.depth, firstChildIndex, lastChildIndex);
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
          clip: childClip, headers, invariantHeaderId, auditParent });
      }
    }
  }

  private recordInvariantNode(node: FrameNode, nativeId: number, tag: LayoutInvariantTag,
    bounds: LayoutInvariantRect | undefined, clip: ReaderDebugRect | undefined, headerId: string | undefined,
    opacity: number): void {
    let enabled: boolean | undefined;
    let intercepts: boolean | undefined = tag.intercepts;
    if (tag.role === 'key-control' || tag.role === 'modal-overlay' || tag.role === 'main-input') {
      try {
        const raw: Object = node.getInspectorInfo();
        const inspector: LayoutInvariantInspectorNode = (typeof raw === 'string' ? JSON.parse(raw) : raw) as LayoutInvariantInspectorNode;
        const attrs = inspector?.$ID === nativeId ? inspector.$attrs : undefined;
        if (attrs?.enabled === true || attrs?.enabled === 'true') enabled = true;
        if (attrs?.enabled === false || attrs?.enabled === 'false') enabled = false;
        const behavior = attrs?.hitTestBehavior;
        if (behavior === 'HitTestMode.None' || behavior === HitTestMode.None) intercepts = false;
        if (behavior === 'HitTestMode.Default' || behavior === 'HitTestMode.Block' ||
          behavior === HitTestMode.Default || behavior === HitTestMode.Block) intercepts = true;
        if (tag.role === 'main-input' && tag.scope === READER_PAGED_INPUT_SCOPE &&
          (behavior === 'HitTestMode.Transparent' || behavior === HitTestMode.Transparent)) intercepts = true;
      } catch (_) {
        // A key control's unreadable native enabled state cannot produce a green sample.
      }
    }
    let clipped = false;
    if (bounds !== undefined && clip !== undefined) {
      const frame: ReaderDebugRect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      const effective = this.intersectBounds(frame, clip);
      clipped = bounds.width - effective.width > 1 || bounds.height - effective.height > 1;
    }
    const reportTag: LayoutInvariantTag = { id: `${tag.id}:${nativeId}`, role: tag.role, scope: tag.scope,
      expectedHeightVp: tag.expectedHeightVp, expectedTopGapVp: tag.expectedTopGapVp,
      expectedContentGapVp: tag.expectedContentGapVp, wrapGapVp: tag.wrapGapVp, wrapPart: tag.wrapPart,
      busy: tag.busy, unavailable: tag.unavailable, modalControl: tag.modalControl, expectsModalControl: tag.expectsModalControl,
      active: tag.active, closeDurationMs: tag.closeDurationMs, intercepts: tag.intercepts };
    this.invariantNodes.push({ tag: reportTag, bounds, clipped, headerId, enabled, opacity, intercepts });
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
      if (this.developerModeEnabled) {
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
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(FontWeight.Regular).fontSize(8)
        .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
        .backgroundColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
        .minFontScale(1).maxFontScale(1)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .padding({ left: 4, right: 4, top: 1, bottom: 1 })
        .position({ x: 4, y: 2 })
        .hitTestBehavior(HitTestMode.None);
      Text(this.invariantLabel).fontSize(11).fontColor('#FFFFFF').backgroundColor(this.invariantColor)
        .padding({ left: 5, right: 5, top: 2, bottom: 2 }).borderRadius(5)
        .align(Alignment.TopEnd).margin(4).accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      }
    }.id('reader-layout-debug-overlay').width('100%').height('100%')
      // Transparent lets the page below continue receiving taps. None on a
      // full-screen sibling can still mask the lower sibling on some API
      // levels even though the overlay itself has no gesture handlers.
      .hitTestBehavior(HitTestMode.Transparent)
      .accessibilityLevel('no')
      .zIndex(10000);
  }
}
