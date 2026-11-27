import type { UIContext } from '@ohos.arkui.UIContext';
import type { FrameNode } from '@ohos.arkui.node';
import { text as graphicsText } from '@kit.ArkGraphics2D';
import { readerOverlayViewport } from '../../ui/layout/ReaderOverlayGeometry';
import { READER_THEME_DEFINITIONS, type ReaderThemeDefinition } from '../../ui/foundation/ReaderThemeRegistry';
import { readerInteractiveSafeBottom, readerStableInteractiveSafeBottom, type ReaderWindowMetricsSnapshot }
  from '../../ui/foundation/ReaderWindowMetrics';
import type { LayoutInvariantNode, LayoutInvariantRect } from '../../ui/layout/LayoutInvariantEvaluator';
import { READER_LAYOUT_CLOSE_CONTROL, READER_LAYOUT_FOOTER, READER_LAYOUT_NATIVE_MATERIAL,
  READER_LAYOUT_READING_PAPER, READER_LAYOUT_ROTATION_ENVELOPE, READER_LAYOUT_SURFACE_HINT }
  from '../../ui/foundation/ReaderLayoutInvariantSignals';
import { inspectReaderNativeMaterialPaint, type ReaderNativeMaterialAttributes } from '../../ui/layout/ReaderNativeMaterialPaint';
import { evaluateReaderIslandContrast, readerIslandContrastPalette } from '../../ui/layout/ReaderIslandContrastEvaluator';
import { measureMountedTextEvidence, READER_LAYOUT_IMPORT_HINT_TEXT_ID, READER_LAYOUT_MOUNTED_TEXT_CONTROLLER,
  type LayoutAuditClose, type LayoutAuditHitTest, type LayoutAuditPlacement, type LayoutInvariantDensityAudit,
  type LayoutInvariantFeatureAssertion, type LayoutInvariantMountedTextDiagnostics, type LayoutInvariantMountedTextEvidence,
  type LayoutInvariantMountedTextStyle, type LayoutInvariantNativeNode, type LayoutInvariantNativeSample,
  type LayoutInvariantSurfaceAudit, type LayoutInvariantTextLineRange }
  from '../../ui/layout/LayoutInvariantNativeAudit';
import type { LayoutInvariantSurfaceHint } from '../../ui/layout/LayoutInvariantNativeAudit';
import { readerNativeTextSliceAudit } from '../../ui/layout/ReaderNativeTextSliceAudit';

interface ReaderNativeInspectorAttributes extends ReaderNativeMaterialAttributes, LayoutInvariantMountedTextStyle {
  enabled?: boolean | string;
  clickable?: boolean | string;
  hitTestBehavior?: number | string;
  backgroundColor?: string;
  accessibilityText?: string;
  content?: string;
  textOverflow?: string;
  zIndex?: number | string;
}

interface ReaderNativeInspectorNode {
  $ID?: number;
  $attrs?: ReaderNativeInspectorAttributes;
}

export interface ReaderNativeLayoutParent {
  key: string;
  type: string;
  bounds?: LayoutInvariantRect;
  scrollClip: boolean;
  suppressInput: boolean;
}

interface ReaderNativeSurfaceSpec {
  id: string;
  close: 'close-action' | 'native-dismiss';
  placement?: LayoutAuditPlacement;
  anchorId?: string;
  contentId?: string;
}

const INTERACTIVE_TYPES: string[] = ['Button', 'TextInput', 'TextArea', 'Toggle', 'CheckBox', 'Checkbox', 'Radio',
  'Slider', 'Select', 'MenuItem', 'TextPicker', 'DatePicker', 'TimePicker', 'Search', 'Stepper', 'Rating'];
const PAINT_LEAF_TYPES: string[] = ['Canvas', 'Rect', 'Shape', 'Path', 'Circle', 'Line', 'Ellipse'];
const ADDITIONAL_FOOTERS: string[] = ['reader-source-footer-row', 'reader-source-footer-stacked', 'reader-source-v9-batch-dock'];
const READER_NATIVE_SURFACES: ReaderNativeSurfaceSpec[] = [
  { id: 'reader-control-tts-overlay', close: 'close-action', contentId: 'reader-tts-choice-content' },
  { id: 'reader-control-tts-manager-overlay', close: 'close-action',
    contentId: 'reader-tts-manager-content' },
  { id: 'reader-control-appearance-overlay', close: 'native-dismiss' },
  { id: 'reader-source-v9-more-menu', close: 'native-dismiss' },
  { id: 'reader-source-group-panel', close: 'close-action', placement: 'anchor-overlap' },
  { id: 'reader-search-sheet:filter', close: 'native-dismiss', placement: 'bottom-center' },
  { id: 'reader-search-sheet:task', close: 'native-dismiss', placement: 'bottom-center' },
  { id: 'reader-bookshelf-more-sheet', close: 'native-dismiss', placement: 'bottom-center' },
  { id: 'reader-bookshelf-book-action-sheet', close: 'native-dismiss', placement: 'bottom-center' },
  { id: 'reader-settings-select-phone:language', close: 'close-action', placement: 'bottom-center', contentId: 'reader-settings-select-options' },
  { id: 'reader-settings-select-phone:startup', close: 'close-action', placement: 'bottom-center', contentId: 'reader-settings-select-options' },
  { id: 'reader-settings-select-tablet:language', close: 'native-dismiss', placement: 'anchor',
    anchorId: 'reader-settings-select-trigger:language', contentId: 'reader-settings-select-options' },
  { id: 'reader-settings-select-tablet:startup', close: 'native-dismiss', placement: 'anchor',
    anchorId: 'reader-settings-select-trigger:startup', contentId: 'reader-settings-select-options' },
];

interface ReaderNativeFeatureSpec {
  id: string;
  trigger: string;
  required: string[];
  anyVisible?: string[];
}

const NATIVE_FEATURES: ReaderNativeFeatureSpec[] = [
  { id: 'tts-transport', trigger: 'reader-control-tts-transport-toggle',
    required: ['reader-control-tts-transport-previous', 'reader-control-tts-transport-next', 'reader-control-tts-transport-stop'] },
  { id: 'auto-page-transport', trigger: 'reader-control-auto-page-transport-toggle',
    required: ['reader-control-auto-page-transport-previous', 'reader-control-auto-page-transport-next', 'reader-control-auto-page-transport-stop'] },
  { id: 'online-tts-editor', trigger: 'reader-control-tts-manager-overlay', required: ['reader-tts-manager-form', 'reader-tts-manager-content'] },
  { id: 'source-v9-import-review', trigger: 'reader-source-v9-import-review', required: ['reader-source-v9-import'] },
  { id: 'source-group-select', trigger: 'reader-source-group-panel', required: ['reader-source-group-search', 'reader-source-v9-manage-groups'] },
  { id: 'reading-appearance', trigger: 'reader-control-module-appearance', required: ['reader-control-font-grid'],
    anyVisible: READER_THEME_DEFINITIONS.map((theme: ReaderThemeDefinition): string => `reader-control-theme-${theme.id}`) },
];

function hitMode(value?: string | number): LayoutAuditHitTest | undefined {
  if (value === HitTestMode.None || value === 'HitTestMode.None') return 'none';
  if (value === HitTestMode.Block || value === 'HitTestMode.Block') return 'block';
  if (value === HitTestMode.Default || value === 'HitTestMode.Default') return 'default';
  if (value === HitTestMode.Transparent || value === 'HitTestMode.Transparent') return 'transparent';
  return undefined;
}

function bool(value?: boolean | string): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

function mayPaint(value?: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  const color = value.toUpperCase();
  return color !== 'TRANSPARENT' && color !== 'COLOR.TRANSPARENT' && !/^#00[0-9A-F]{6}$/.test(color);
}

function nativeInspector(node: FrameNode, nativeId: number): ReaderNativeInspectorAttributes | undefined {
  try {
    const raw: Object = node.getInspectorInfo();
    const info = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ReaderNativeInspectorNode;
    return info?.$ID === nativeId ? info.$attrs : undefined;
  } catch (_) { return undefined; }
}

function reflowWordBreak(value?: number | string): WordBreak | undefined {
  if (value === WordBreak.NORMAL || value === 'normal') return WordBreak.NORMAL;
  if (value === WordBreak.BREAK_ALL || value === 'break-all') return WordBreak.BREAK_ALL;
  if (value === WordBreak.BREAK_WORD || value === 'break-word') return WordBreak.BREAK_WORD;
  if (value === WordBreak.HYPHENATION || value === 'hyphenation') return WordBreak.HYPHENATION;
  return undefined;
}

function reflowTextHeight(context: UIContext, content: string, frame: LayoutInvariantRect,
  attrs: ReaderNativeInspectorAttributes, matchInspectorStyle: boolean = false): number | undefined {
  try {
    const weight = typeof attrs.fontWeight === 'string' ?
      attrs.fontWeight.replace(/^FontWeight\./, '').replace(/^W([1-9]00)$/, '$1').toLowerCase() : attrs.fontWeight;
    const required = context.getMeasureUtils().measureTextSize({ textContent: content,
      constraintWidth: matchInspectorStyle ? `${context.vp2px(frame.width)}px` : frame.width,
      fontSize: attrs.fontSize, fontFamily: attrs.fontFamily, lineHeight: attrs.lineHeight,
      fontWeight: matchInspectorStyle ? weight : undefined,
      letterSpacing: matchInspectorStyle ? attrs.letterSpacing : undefined,
      wordBreak: matchInspectorStyle ? reflowWordBreak(attrs.wordBreak) : undefined,
    });
    const height = context.px2vp(Number(required.height));
    return Number.isFinite(height) && height > 0 ? height : undefined;
  } catch (_) { return undefined; }
}

function measuredTextClips(context: UIContext, node: LayoutInvariantNativeNode,
  attrs?: ReaderNativeInspectorAttributes): boolean | undefined {
  const content = attrs?.content;
  const frame = node.bounds;
  if (node.type !== 'Text' || typeof content !== 'string' || content.trim().length === 0 ||
    (typeof attrs?.fontSize !== 'number' && typeof attrs?.fontSize !== 'string') ||
    frame === undefined || frame.width <= 0) return undefined;
  const overflow = typeof attrs.textOverflow === 'string' ? attrs.textOverflow.toLowerCase() : '';
  if (overflow.includes('ellipsis') || overflow.includes('marquee')) return false;
  const height = reflowTextHeight(context, content, frame, attrs);
  return height === undefined ? undefined : height > frame.height + 3;
}

function measuredInk(context: UIContext, frame: LayoutInvariantRect, layout: LayoutManager,
  start: number, end: number): LayoutInvariantRect[] {
  const boxes = layout.getRectsForRange({ start, end }, graphicsText.RectWidthStyle.TIGHT, graphicsText.RectHeightStyle.TIGHT);
  return boxes.map((box: TextBox): LayoutInvariantRect => ({
    x: frame.x + context.px2vp(box.rect.left), y: frame.y + context.px2vp(box.rect.top),
    width: context.px2vp(box.rect.right - box.rect.left), height: context.px2vp(box.rect.bottom - box.rect.top),
  }));
}

function mountedTextEvidence(context: UIContext, node: FrameNode, frame?: LayoutInvariantRect,
  attrs?: ReaderNativeInspectorAttributes): LayoutInvariantMountedTextEvidence {
  const content = attrs?.content;
  const diagnostics: LayoutInvariantMountedTextDiagnostics = { expectedUtf16: content?.length };
  const missing: LayoutInvariantMountedTextEvidence = { status: 'missing', diagnostics };
  if (frame === undefined || attrs === undefined || typeof content !== 'string' || content.length === 0) return missing;
  diagnostics.style = { fontSize: attrs.fontSize, fontFamily: attrs.fontFamily, fontWeight: attrs.fontWeight,
    letterSpacing: attrs.letterSpacing, lineHeight: attrs.lineHeight, wordBreak: attrs.wordBreak, maxFontScale: attrs.maxFontScale };
  diagnostics.independentHeightVp = reflowTextHeight(context, content, frame, attrs);
  diagnostics.matchedStyleHeightVp = reflowTextHeight(context, content, frame, attrs, true);
  try {
    const controller = node.getCustomProperty(READER_LAYOUT_MOUNTED_TEXT_CONTROLLER) as TextController | undefined;
    if (controller === undefined) return missing;
    const layout = controller.getLayoutManager();
    const count = layout.getLineCount();
    diagnostics.lineCount = count;
    if (!Number.isSafeInteger(count) || count <= 0 || count > content.length) return missing;
    const lines: LayoutInvariantTextLineRange[] = [];
    for (let index = 0; index < count; index++) {
      const line = layout.getLineMetrics(index);
      lines.push({ start: line.startIndex, end: line.endIndex });
    }
    const length = content.length;
    const tailStart = (content.codePointAt(length - 2) ?? 0) > 0xFFFF ? length - 2 : length - 1;
    const evidence = measureMountedTextEvidence(length, lines, measuredInk(context, frame, layout, 0, length),
      measuredInk(context, frame, layout, tailStart, length));
    evidence.diagnostics = diagnostics;
    return evidence;
  } catch (_) { return missing; }
}

function hasArea(rect?: LayoutInvariantRect): boolean {
  return rect !== undefined && rect.width > 0 && rect.height > 0;
}

function containedFrame(rect?: LayoutInvariantRect, clip?: LayoutInvariantRect): boolean {
  return rect !== undefined && hasArea(rect) && (clip === undefined || (rect.x >= clip.x - 2 && rect.y >= clip.y - 2 &&
    rect.x + rect.width <= clip.x + clip.width + 2 && rect.y + rect.height <= clip.y + clip.height + 2));
}

function nativeSurfaceHint(node: FrameNode): LayoutInvariantSurfaceHint | undefined {
  try {
    const property = node.getCustomProperty(READER_LAYOUT_SURFACE_HINT);
    return property !== undefined && property !== null && typeof property === 'object' ? property as LayoutInvariantSurfaceHint : undefined;
  } catch (_) { return undefined; }
}

function nativePopupBubbleBounds(context: UIContext, node: FrameNode, contentBounds?: LayoutInvariantRect):
  LayoutInvariantRect | undefined {
  if (contentBounds === undefined || !hasArea(contentBounds)) return undefined;
  // The Popup node owns the full-window mask. Its direct child owns the bubble and arrow.
  try {
    let child = node;
    for (let depth = 0; depth < 16; depth += 1) {
      const parent = child.getParent();
      if (parent === null) return undefined;
      if (parent.getNodeType().toLowerCase() === 'popup') {
        const offset = child.getPositionToWindowWithTransform();
        const measured = child.getMeasuredSize();
        const bubble: LayoutInvariantRect = { x: Number(offset.x), y: Number(offset.y),
          width: context.px2vp(Number(measured.width)), height: context.px2vp(Number(measured.height)) };
        return containedFrame(contentBounds, bubble) ? bubble : undefined;
      }
      child = parent;
    }
  } catch (_) { return undefined; }
  return undefined;
}

function nativeBooleanProperty(node: FrameNode, name: string): boolean {
  try { return node.getCustomProperty(name) === true; } catch (_) { return false; }
}

function nativeReadingPaper(node: FrameNode): string | undefined {
  try {
    const paper = node.getCustomProperty(READER_LAYOUT_READING_PAPER);
    return typeof paper === 'string' ? paper : undefined;
  } catch (_) { return undefined; }
}

function union(nodes: LayoutInvariantNativeNode[]): LayoutInvariantRect | undefined {
  let bounds: LayoutInvariantRect | undefined;
  for (const item of nodes) {
    const rect = item.bounds;
    if (rect === undefined || !hasArea(rect)) continue;
    if (bounds === undefined) { bounds = rect; continue; }
    const x = Math.min(bounds.x, rect.x);
    const y = Math.min(bounds.y, rect.y);
    bounds = { x, y, width: Math.max(bounds.x + bounds.width, rect.x + rect.width) - x,
      height: Math.max(bounds.y + bounds.height, rect.y + rect.height) - y };
  }
  return bounds;
}

/** Uses the already bounded native frame traversal. Only Debug can mount its caller. */
export class ReaderNativeLayoutAudit {
  private readonly nodes: LayoutInvariantNativeNode[] = [];
  private readonly byKey: Map<string, LayoutInvariantNativeNode> = new Map<string, LayoutInvariantNativeNode>();
  private readonly byId: Map<string, LayoutInvariantNativeNode> = new Map<string, LayoutInvariantNativeNode>();
  private serial: number = 0;

  reset(): void { this.nodes.length = 0; this.byKey.clear(); this.byId.clear(); this.serial = 0; }

  record(context: UIContext, node: FrameNode, nativeId: number, id: string, type: string, opacity: number,
    bounds: LayoutInvariantRect | undefined, clip: LayoutInvariantRect | undefined,
    parent: ReaderNativeLayoutParent | undefined, leaf: boolean): LayoutInvariantNativeNode {
    const key = nativeId > 0 ? nativeId.toString() : `anon-${++this.serial}`;
    const attrs = nativeInspector(node, nativeId);
    const interactive = INTERACTIVE_TYPES.includes(type) || bool(attrs?.clickable) === true;
    const behavior = hitMode(attrs?.hitTestBehavior) ?? (interactive && attrs !== undefined &&
      attrs.hitTestBehavior === undefined ? 'default' : undefined);
    const enabled = bool(attrs?.enabled) ?? (interactive && attrs !== undefined && attrs.enabled === undefined ? true : undefined);
    const paintLayer = Number(attrs?.zIndex);
    const surfaceHint = id.length > 0 || type === 'Column' ? nativeSurfaceHint(node) : undefined;
    const scrollClip = parent?.scrollClip === true;
    // The transformed origin is one rotated corner, not the image's minimum X/Y.
    // This opt-in image paints inside its native parent's centered rotation envelope.
    const rotationEnvelope = type === 'Image' && nativeBooleanProperty(node, READER_LAYOUT_ROTATION_ENVELOPE);
    const textSlice = type === 'Text' ? readerNativeTextSliceAudit.project(nativeId, parent?.key ?? '', bounds, parent?.bounds) : undefined;
    const paintBounds = textSlice?.bounds ?? (rotationEnvelope ? parent?.bounds : bounds);
    const observation: LayoutInvariantNativeNode = { key, id: id.length > 0 ? id : `${type}:${key}`, type,
      parentKey: parent?.key ?? '', parentType: parent?.type ?? '', bounds: paintBounds,
      parentBounds: textSlice?.parentBounds ?? parent?.bounds,
      clip, scrollClip, opacity, interactive, enabled, hitTest: behavior,
      zIndex: Number.isFinite(paintLayer) ? paintLayer : undefined,
      inputAdmissionSuppressed: parent?.suppressInput === true,
      closeAction: interactive && (/(?:^|[-:])(close|cancel|collapse)(?:[-:]|$)/.test(id) ||
        attrs?.accessibilityText === '关闭' || attrs?.accessibilityText === '取消' || attrs?.accessibilityText === '收起' ||
        nativeBooleanProperty(node, READER_LAYOUT_CLOSE_CONTROL)),
      paintedLeaf: leaf && (PAINT_LEAF_TYPES.includes(type) || mayPaint(attrs?.backgroundColor)),
      surfaceHint,
      nativePopupBounds: surfaceHint?.nativePopupBubble === true ? nativePopupBubbleBounds(context, node, bounds) : undefined,
      dock: type === 'Column' && nativeBooleanProperty(node, READER_LAYOUT_FOOTER),
      nativeMaterialPaint: nativeBooleanProperty(node, READER_LAYOUT_NATIVE_MATERIAL) ?
        inspectReaderNativeMaterialPaint(attrs) : undefined,
      readingPaperTheme: id === 'reader-reading-stage' ? nativeReadingPaper(node) : undefined,
    };
    if (type === 'Text' && attrs?.content === '' && !hasArea(bounds)) observation.opacity = 0;
    // R13 tests the admitted native ink against the real viewport and all
    // ancestor clips. Independent whole-Text reflow still applies to titles and controls.
    if (type === 'Text' && id === READER_LAYOUT_IMPORT_HINT_TEXT_ID)
      observation.mountedText = mountedTextEvidence(context, node, bounds, attrs);
    else if (textSlice === undefined) observation.textClipped = measuredTextClips(context, observation, attrs);
    this.nodes.push(observation);
    this.byKey.set(key, observation);
    if (id.length > 0 && (this.byId.get(id)?.opacity ?? -1) < opacity) this.byId.set(id, observation);
    return observation;
  }

  private descendants(key: string): LayoutInvariantNativeNode[] {
    return this.nodes.filter((node: LayoutInvariantNativeNode): boolean => this.within(node, key));
  }

  private within(node: LayoutInvariantNativeNode, key: string): boolean {
    let parent = node.parentKey;
    let depth = 0;
    while (parent.length > 0 && depth < 128) {
      if (parent === key) return true;
      parent = this.byKey.get(parent)?.parentKey ?? '';
      depth += 1;
    }
    return false;
  }

  private surfaces(safeViewport?: LayoutInvariantRect, windowViewport?: LayoutInvariantRect): LayoutInvariantSurfaceAudit[] {
    const result: LayoutInvariantSurfaceAudit[] = [];
    for (const spec of READER_NATIVE_SURFACES) {
      const node = this.byId.get(spec.id);
      if (node === undefined || node.opacity < .1 || node.surfaceHint?.dialog === true) continue;
      const body = spec.contentId === undefined ? undefined : this.byId.get(spec.contentId);
      const close: LayoutAuditClose = spec.close === 'native-dismiss' ? 'native-dismiss' : this.closeAction(node);
      const contentHeight = body?.bounds?.height;
      const bodyViewport = body?.clip;
      const overhead = node.bounds === undefined || bodyViewport === undefined ? undefined : Math.max(0, node.bounds.height - bodyViewport.height);
      const frame: LayoutInvariantSurfaceAudit = { id: spec.id, bounds: node.bounds, viewport: node.surfaceHint?.viewport ?? safeViewport,
        placement: node.surfaceHint?.placement ?? spec.placement,
        anchor: node.surfaceHint?.anchor ?? (spec.anchorId === undefined ? undefined : this.byId.get(spec.anchorId)?.bounds),
        contentBounds: body?.bounds, contentViewport: bodyViewport, expectsContentMeasurement: spec.contentId !== undefined,
        naturalHeight: contentHeight === undefined || overhead === undefined ? undefined : contentHeight + overhead, close };
      result.push(frame);
    }
    for (const node of this.nodes) {
      if (node.surfaceHint?.dialog !== true || node.opacity < .1) continue;
      if (node.bounds !== undefined && node.clip !== undefined && !hasArea(node.clip)) continue;
      const hint = node.surfaceHint;
      const bounds = hint.nativePopupBubble === true ? node.nativePopupBounds : node.bounds;
      const viewport = hint.windowEdge === true ? windowViewport :
        hint.nativePopupBubble === true ? safeViewport : node.clip ?? safeViewport;
      const descendants = hint.contentMeasured === true ? this.descendants(node.key) : [];
      const body = descendants.find((item: LayoutInvariantNativeNode): boolean => item.parentType === 'Scroll' &&
        item.type === 'Column' && item.bounds !== undefined);
      const contentHeight = body?.bounds?.height;
      const overhead = bounds === undefined || body?.clip === undefined ? 0 : Math.max(0, bounds.height - body.clip.height);
      result.push({ id: node.id, bounds, viewport: hint.viewport ?? viewport, placement: hint.placement, anchor: hint.anchor,
        close: hint.nativeDismiss === true ? 'native-dismiss' : this.closeAction(node), scrollable: node.scrollClip, windowEdge: hint.windowEdge,
        contentBounds: body?.bounds, contentViewport: body?.clip, naturalHeight: contentHeight === undefined ? undefined : contentHeight + overhead,
        expectsContentMeasurement: hint.contentMeasured });
    }
    return result;
  }

  private closeAction(node: LayoutInvariantNativeNode): LayoutAuditClose {
    const candidates = this.descendants(node.key).filter((item: LayoutInvariantNativeNode): boolean =>
      item.closeAction === true && item.enabled !== false && item.hitTest !== 'none' && item.inputAdmissionSuppressed !== true);
    if (candidates.some((item: LayoutInvariantNativeNode): boolean => item.opacity >= .1 && containedFrame(item.bounds, item.clip)))
      return 'visible';
    return candidates.some((item: LayoutInvariantNativeNode): boolean => item.scrollClip) ? 'scroll-reachable' : 'absent';
  }

  private density(): LayoutInvariantDensityAudit[] {
    const result: LayoutInvariantDensityAudit[] = [];
    const bar = this.byId.get('reader-bookshelf-search-bar');
    const lane = this.byId.get('reader-bookshelf-search-lane-row') ?? this.byId.get('reader-bookshelf-search-lane-stacked');
    if (bar !== undefined && lane !== undefined) result.push({ specId: 'library-search-bar', id: bar.id,
      bounds: bar.bounds, contentBounds: lane.bounds });
    if (lane !== undefined) result.push({ specId: 'library-search-lane', id: lane.id, bounds: lane.bounds,
      contentBounds: union(this.nodes.filter((item: LayoutInvariantNativeNode): boolean =>
        item.parentKey === lane.key && item.opacity >= .1 && item.type !== 'Blank')) });
    const choices = this.byId.get('reader-tts-choice-content');
    if (choices !== undefined) result.push({ specId: 'tts-choice-content', id: choices.id, bounds: choices.bounds,
      contentBounds: union(this.nodes.filter((item: LayoutInvariantNativeNode): boolean =>
        item.parentKey === choices.key && item.opacity >= .1 && item.type !== 'Blank')) });
    for (const frame of this.nodes) {
      if (frame.opacity < .1 || !containedFrame(frame.bounds, frame.clip)) continue;
      const specId = frame.id.startsWith('reader-settings-home-group:') ? 'settings-home-group' :
        frame.id === 'reader-source-v9-import-review' ? 'source-import-review' : undefined;
      if (specId === undefined) continue;
      result.push({ specId, id: frame.id, bounds: frame.bounds,
        contentBounds: union(this.nodes.filter((item: LayoutInvariantNativeNode): boolean =>
          item.parentKey === frame.key && item.opacity >= .1 && item.type !== 'Blank')) });
    }
    return result;
  }

  private features(): LayoutInvariantFeatureAssertion[] {
    const result: LayoutInvariantFeatureAssertion[] = [];
    for (const feature of NATIVE_FEATURES) {
      const trigger = this.byId.get(feature.trigger);
      if (trigger === undefined || trigger.opacity < .1 || !hasArea(trigger.bounds)) continue;
      if (feature.anyVisible !== undefined && !feature.anyVisible.some((id: string): boolean => {
        const node = this.byId.get(id);
        return node !== undefined && node.opacity >= .1 && containedFrame(node.bounds, node.clip);
      })) continue;
      const failed = feature.required.filter((id: string): boolean => {
        const node = this.byId.get(id);
        return node === undefined || node.opacity < .1 || !hasArea(node.bounds);
      });
      result.push({ id: feature.id, state: failed.length === 0 ? 'pass' : 'fail',
        detail: failed.length === 0 ? 'required native nodes measurable' : `missing or hidden: ${failed.join(', ')}` });
    }
    return result;
  }

  build(metrics: ReaderWindowMetricsSnapshot, route: string, tagged: LayoutInvariantNode[], complete: boolean, appScheme: string):
    LayoutInvariantNativeSample {
    const viewport: LayoutInvariantRect | undefined = metrics.ready ?
      { x: 0, y: 0, width: metrics.windowRect.width, height: metrics.windowRect.height } : undefined;
    const safe = readerOverlayViewport(metrics);
    const bottom = route === 'reading' ? readerInteractiveSafeBottom(metrics) : readerStableInteractiveSafeBottom(metrics);
    const safeViewport: LayoutInvariantRect | undefined = metrics.ready ? { x: safe.left, y: safe.top, width: safe.width,
      height: Math.max(0, Math.min(safe.top + safe.height, metrics.windowRect.height - bottom) - safe.top) } : undefined;
    const dockBounds: LayoutInvariantRect[] = [];
    for (const item of tagged) {
      if (item.tag.role === 'primary-dock' && item.bounds !== undefined && item.opacity >= .1) dockBounds.push(item.bounds);
    }
    for (const id of ADDITIONAL_FOOTERS) {
      const item = this.byId.get(id);
      if (item?.bounds !== undefined && item.opacity >= .1) dockBounds.push(item.bounds);
    }
    for (const item of this.nodes) {
      if (item.dock === true && item.bounds !== undefined && item.opacity >= .1 && hasArea(item.bounds)) dockBounds.push(item.bounds);
    }
    const stage = this.byId.get('reader-reading-stage');
    const visibleTextReader = route === 'reading' && stage !== undefined && stage.opacity >= .1 && hasArea(stage.bounds);
    const themeId = visibleTextReader ? stage?.readingPaperTheme : undefined;
    const paper = READER_THEME_DEFINITIONS.find((theme: ReaderThemeDefinition): boolean => theme.id === themeId);
    const readingPaletteChecks = evaluateReaderIslandContrast(readerIslandContrastPalette(appScheme),
      paper === undefined ? [] : [paper]);
    return { viewport, safeViewport, nodes: this.nodes, complete, dockBounds, expectDock: route === 'detail',
      readingPaletteChecks, readingPaletteSource: paper === undefined ? appScheme : `${appScheme}/${paper.id}`,
      readingPaperEvidenceMissing: visibleTextReader && paper === undefined,
      surfaces: this.surfaces(safeViewport, viewport), density: this.density(), features: this.features() };
  }
}
