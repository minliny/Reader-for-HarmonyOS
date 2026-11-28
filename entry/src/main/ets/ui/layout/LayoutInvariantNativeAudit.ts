import { evaluateReaderIslandContrast, readerIslandContrastPalette, type ReaderIslandContrastCheck }
  from './ReaderIslandContrastEvaluator';
import type { LayoutInvariantRect, LayoutInvariantRule, LayoutInvariantViolation } from './LayoutInvariantEvaluator';
import type { ReaderNativeMaterialPaint } from './ReaderNativeMaterialPaint';

export type LayoutAuditHitTest = 'none' | 'block' | 'default' | 'transparent';
export type LayoutAuditPlacement = 'center' | 'bottom-center' | 'side-end' | 'anchor' | 'anchor-overlap';
export type LayoutAuditClose = 'visible' | 'scroll-reachable' | 'native-dismiss' | 'absent' | 'unknown';
export const READER_LAYOUT_IMPORT_LABEL_TEXT_ID = 'reader-local-import-file-selection-label';
export const READER_LAYOUT_IMPORT_HINT_TEXT_ID = 'reader-local-import-selection-hint';
export const READER_LAYOUT_MOUNTED_TEXT_CONTROLLER = 'readerLayoutMountedTextController';

export interface LayoutInvariantTextLineRange {
  start: number;
  end: number;
}

export interface LayoutInvariantMountedTextEvidence {
  status: 'measured' | 'clipped' | 'missing';
  ink?: LayoutInvariantRect;
  coveredUtf16?: number;
  diagnostics?: LayoutInvariantMountedTextDiagnostics;
}

export interface LayoutInvariantMountedTextStyle {
  fontSize?: number | string;
  fontFamily?: string;
  fontWeight?: number | string;
  letterSpacing?: number | string;
  lineHeight?: number | string;
  wordBreak?: number | string;
  maxFontScale?: number | string;
}

export interface LayoutInvariantTextReflow {
  style?: LayoutInvariantMountedTextStyle;
  independentHeightVp?: number;
  matchedStyleHeightVp?: number;
}

export function measuredTextReflowClips(id: string, frameHeightVp: number,
  reflow: LayoutInvariantTextReflow): boolean | undefined {
  const matchedHeight = id === READER_LAYOUT_IMPORT_LABEL_TEXT_ID ? reflow.matchedStyleHeightVp : undefined;
  const height = matchedHeight ?? reflow.independentHeightVp;
  return height === undefined ? undefined : height > frameHeightVp + 3;
}

export interface LayoutInvariantMountedTextDiagnostics extends LayoutInvariantTextReflow {
  expectedUtf16?: number;
  lineCount?: number;
}

export interface LayoutInvariantMountedTextObservation {
  key: string;
  id: string;
  evidence: LayoutInvariantMountedTextEvidence;
  frame: LayoutInvariantRect;
}

export interface LayoutInvariantSurfaceHint {
  placement: LayoutAuditPlacement;
  anchor?: LayoutInvariantRect;
  viewport?: LayoutInvariantRect;
  dialog?: boolean;
  windowEdge?: boolean;
  contentMeasured?: boolean;
  nativeDismiss?: boolean;
  nativePopupBubble?: boolean;
}

export interface LayoutInvariantNativeNode {
  key: string;
  id: string;
  stableId?: string;
  type: string;
  parentKey: string;
  parentType: string;
  bounds?: LayoutInvariantRect;
  parentBounds?: LayoutInvariantRect;
  clip?: LayoutInvariantRect;
  scrollClip: boolean;
  opacity: number;
  zIndex?: number;
  interactive: boolean;
  enabled?: boolean;
  hitTest?: LayoutAuditHitTest;
  closeAction?: boolean;
  textClipped?: boolean;
  textReflow?: LayoutInvariantTextReflow;
  mountedText?: LayoutInvariantMountedTextEvidence;
  paintedLeaf?: boolean;
  surfaceHint?: LayoutInvariantSurfaceHint;
  nativePopupBounds?: LayoutInvariantRect;
  inputAdmissionSuppressed?: boolean;
  dock?: boolean;
  nativeMaterialPaint?: ReaderNativeMaterialPaint;
  readingPaperTheme?: string;
}

export interface LayoutInvariantSurfaceAudit {
  id: string;
  bounds?: LayoutInvariantRect;
  viewport?: LayoutInvariantRect;
  placement?: LayoutAuditPlacement;
  anchor?: LayoutInvariantRect;
  contentBounds?: LayoutInvariantRect;
  contentViewport?: LayoutInvariantRect;
  naturalHeight?: number;
  expectsContentMeasurement?: boolean;
  close: LayoutAuditClose;
  scrollable?: boolean;
  windowEdge?: boolean;
}

export interface LayoutInvariantDensityAudit {
  specId: string;
  id: string;
  bounds?: LayoutInvariantRect;
  contentBounds?: LayoutInvariantRect;
  insetLeft?: number;
  insetRight?: number;
  maxChildGap?: number;
  viewportWidth?: number;
}

export interface LayoutInvariantFeatureAssertion {
  id: string;
  state: 'pass' | 'fail' | 'missing';
  detail: string;
}

export interface LayoutInvariantNativeSample {
  viewport?: LayoutInvariantRect;
  safeViewport?: LayoutInvariantRect;
  nodes: LayoutInvariantNativeNode[];
  complete: boolean;
  readingPaletteChecks?: ReaderIslandContrastCheck[];
  readingPaletteSource?: string;
  readingPaperEvidenceMissing?: boolean;
  dockBounds: LayoutInvariantRect[];
  expectDock: boolean;
  surfaces: LayoutInvariantSurfaceAudit[];
  density: LayoutInvariantDensityAudit[];
  features: LayoutInvariantFeatureAssertion[];
  requiredRules?: LayoutInvariantRule[];
  requiredFeatures?: string[];
}

export interface LayoutInvariantNativeCoverage {
  textCount: number;
  imageCount: number;
  interactiveCount: number;
  complete: boolean;
  mountedText?: LayoutInvariantMountedTextObservation[];
  clippingOffenders?: LayoutInvariantNativeClippingObservation[];
  clippingOffenderCount?: number;
}

type LayoutInvariantClipReason = 'independent-text-height' | 'missing-glyphs' | 'ink-outside-text' |
  'ancestor-clips-frame' | 'ancestor-clips-ink' | 'frame-outside-parent';

interface LayoutInvariantNativeClippingObservation {
  key: string;
  id: string;
  stableId?: string;
  type: string;
  frame: LayoutInvariantRect;
  parentBounds?: LayoutInvariantRect;
  clip?: LayoutInvariantRect;
  scrollClip: boolean;
  reasons: LayoutInvariantClipReason[];
  reflow?: LayoutInvariantTextReflow;
  ink?: LayoutInvariantRect;
}

export interface LayoutInvariantNativeResult {
  violations: LayoutInvariantViolation[];
  missing: string[];
  observedRules: LayoutInvariantRule[];
  nativeAudit: LayoutInvariantNativeCoverage;
  features: LayoutInvariantFeatureAssertion[];
}

interface LayoutDensitySpec {
  id: string;
  minHeight: number;
  maxHeight: number;
  lineGrowth: number;
  maximumGap: number;
  minWidth?: number;
  maxWidth?: number;
  expectedInsetX?: number;
  insetTolerance?: number;
  maxInternalGap?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
  strict?: boolean;
}

// Independent design values. Measured and tagged nodes never author their own R12 limits.
const DENSITY_SPECS: LayoutDensitySpec[] = [
  { id: 'library-search-bar', minHeight: 48, maxHeight: 104, lineGrowth: 55, maximumGap: 34 },
  { id: 'library-search-lane', minHeight: 42, maxHeight: 64, lineGrowth: 22, maximumGap: 16 },
  { id: 'tts-choice-content', minHeight: 0, maxHeight: 1200, lineGrowth: 240, maximumGap: 36 },
  { id: 'settings-home-group', minHeight: 50, maxHeight: 202, lineGrowth: 104, maximumGap: 28 },
  { id: 'source-import-review', minHeight: 32, maxHeight: 112, lineGrowth: 70, maximumGap: 24 },
  { id: 'bookshelf-viewport-inset', minHeight: 200, maxHeight: 2000, lineGrowth: 0, maximumGap: 2000, expectedInsetX: 16, insetTolerance: 1.5, strict: true },
  { id: 'bookshelf-view-pill', minHeight: 28, maxHeight: 31, lineGrowth: 0, maximumGap: 31, minWidth: 29, maxWidth: 31, strict: true },
  { id: 'bookshelf-filter-toggle', minHeight: 33, maxHeight: 35, lineGrowth: 0, maximumGap: 35, minWidth: 33, maxWidth: 35, strict: true },
  { id: 'reader-control-island-quick', minHeight: 326, maxHeight: 334, lineGrowth: 0, maximumGap: 334, maxInternalGap: 26, strict: true },
  { id: 'reader-control-chapter-card', minHeight: 104, maxHeight: 112, lineGrowth: 24, maximumGap: 112, strict: true },
  { id: 'reader-control-bookmark-lane', minHeight: 32, maxHeight: 36, lineGrowth: 12, maximumGap: 36, strict: true },
  { id: 'reader-control-grabber', minHeight: 3, maxHeight: 5, lineGrowth: 0, maximumGap: 5, minWidth: 34, maxWidth: 38, strict: true },
  { id: 'settings-single-row', minHeight: 50, maxHeight: 54, lineGrowth: 24, maximumGap: 54, strict: true },
  { id: 'settings-two-line-row', minHeight: 56, maxHeight: 62, lineGrowth: 36, maximumGap: 62, strict: true },
  { id: 'reader-toggle', minHeight: 24, maxHeight: 28, lineGrowth: 0, maximumGap: 28, minWidth: 42, maxWidth: 46, strict: true },
  { id: 'source-filter-block', minHeight: 80, maxHeight: 160, lineGrowth: 40, maximumGap: 160, expectedInsetX: 16, insetTolerance: 1.5, strict: true },
  { id: 'source-status-chip', minHeight: 26, maxHeight: 30, lineGrowth: 14, maximumGap: 30, strict: true },
  { id: 'source-footer-action', minHeight: 38, maxHeight: 42, lineGrowth: 16, maximumGap: 42, strict: true },
  { id: 'download-book-cover', minHeight: 64, maxHeight: 68, lineGrowth: 0, maximumGap: 68, minWidth: 46, maxWidth: 50, minAspectRatio: 0.68, maxAspectRatio: 0.78, strict: true },
  { id: 'detail-inline-source-action', minHeight: 30, maxHeight: 34, lineGrowth: 14, maximumGap: 34, strict: true },
  { id: 'detail-preview-row', minHeight: 44, maxHeight: 48, lineGrowth: 22, maximumGap: 48, strict: true },
];

function validRect(rect?: LayoutInvariantRect): boolean {
  return rect !== undefined && Number.isFinite(rect.x) && Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0;
}

function bottom(rect: LayoutInvariantRect): number { return rect.y + rect.height; }
function right(rect: LayoutInvariantRect): number { return rect.x + rect.width; }

export function measureMountedTextEvidence(length: number, lines: LayoutInvariantTextLineRange[],
  ink: LayoutInvariantRect[], tailInk: LayoutInvariantRect[]): LayoutInvariantMountedTextEvidence {
  if (!Number.isSafeInteger(length) || length <= 0 || lines.length === 0) return { status: 'missing' };
  let renderedEnd = 0;
  for (const line of lines) {
    if (line.start !== renderedEnd || !Number.isSafeInteger(line.end) || line.end <= line.start || line.end > length)
      return { status: 'missing' };
    renderedEnd = line.end;
  }
  if (renderedEnd < length) return { status: 'clipped', coveredUtf16: renderedEnd };
  if (ink.length === 0 || tailInk.length === 0) return { status: 'missing', coveredUtf16: renderedEnd };
  let left = Infinity, top = Infinity, extentRight = -Infinity, extentBottom = -Infinity;
  for (const box of ink.concat(tailInk)) {
    if (!validRect(box)) return { status: 'missing', coveredUtf16: renderedEnd };
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    extentRight = Math.max(extentRight, right(box));
    extentBottom = Math.max(extentBottom, bottom(box));
  }
  return { status: 'measured', coveredUtf16: renderedEnd,
    ink: { x: left, y: top, width: extentRight - left, height: extentBottom - top } };
}

function contains(outer: LayoutInvariantRect, inner: LayoutInvariantRect, tolerance: number = 2): boolean {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance &&
    right(inner) <= right(outer) + tolerance && bottom(inner) <= bottom(outer) + tolerance;
}

function overlaps(a: LayoutInvariantRect, b: LayoutInvariantRect, tolerance: number = 2): boolean {
  return Math.min(right(a), right(b)) - Math.max(a.x, b.x) > tolerance &&
    Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > tolerance;
}

function isImage(node: LayoutInvariantNativeNode): boolean { return node.type === 'Image' || node.type === 'SymbolGlyph'; }
function isVisualLeaf(node: LayoutInvariantNativeNode): boolean { return node.type === 'Text' || isImage(node) || node.paintedLeaf === true; }
function isScrollContainer(type: string): boolean {
  return type === 'Scroll' || type === 'List' || type === 'Grid' || type === 'WaterFlow' || type === 'Swiper';
}

function isGhost(node: LayoutInvariantNativeNode): boolean {
  return node.opacity <= .01 && node.inputAdmissionSuppressed !== true && node.enabled !== false &&
    (node.hitTest === 'block' || (node.interactive && node.hitTest === 'default')) && validRect(node.bounds);
}

function add(violations: LayoutInvariantViolation[], rule: LayoutInvariantRule, nodeId: string, detail: string): void {
  violations.push({ rule, nodeId, detail });
}

function checkFooters(sample: LayoutInvariantNativeSample, result: LayoutInvariantNativeResult): void {
  if (sample.dockBounds.length === 0) {
    if (sample.expectDock) result.missing.push('R8:footer-bounds');
    return;
  }
  const safe = sample.safeViewport;
  if (safe === undefined || !validRect(safe)) { result.missing.push('R8:safe-viewport'); return; }
  result.observedRules.push('R8');
  for (const footer of sample.dockBounds) {
    if (!validRect(footer)) { result.missing.push('R8:footer-bounds'); continue; }
    if (bottom(footer) > bottom(safe) + 2) add(result.violations, 'R8', 'primary-dock',
      `bottom=${bottom(footer)} safe=${bottom(safe)}`);
  }
}

function checkSurfaces(sample: LayoutInvariantNativeSample, result: LayoutInvariantNativeResult): void {
  for (const surface of sample.surfaces) {
    const panel = surface.bounds;
    const viewport = surface.viewport ?? sample.safeViewport;
    if (panel === undefined || viewport === undefined || !validRect(panel) || !validRect(viewport)) {
      result.missing.push(`R9:surface-bounds:${surface.id}`);
      continue;
    }
    if (surface.close === 'unknown') result.missing.push(`R9:close-exit:${surface.id}`);
    else if (result.observedRules.indexOf('R9') === -1) result.observedRules.push('R9');
    if (surface.close === 'absent') add(result.violations, 'R9', surface.id, 'no reachable close action');
    const tallAndScrolling = surface.scrollable === true && panel.height > viewport.height + 2;
    const visiblePanel = tallAndScrolling ? { x: panel.x, y: viewport.y, width: panel.width, height: viewport.height } : panel;
    if (!contains(viewport, visiblePanel) || !overlaps(viewport, panel, 0) ||
      (surface.windowEdge !== true && sample.safeViewport !== undefined && !contains(sample.safeViewport, visiblePanel))) {
      add(result.violations, 'R9', surface.id, 'panel extends beyond its safe viewport');
    }
    if (surface.expectsContentMeasurement === true && (surface.naturalHeight === undefined ||
      !validRect(surface.contentBounds) || !validRect(surface.contentViewport))) {
      result.missing.push(`R9:list-bounds:${surface.id}`);
    } else if (surface.naturalHeight !== undefined && Number.isFinite(surface.naturalHeight) && surface.naturalHeight <= viewport.height + 2) {
      if (surface.contentBounds === undefined || surface.contentViewport === undefined) {
        result.missing.push(`R9:list-bounds:${surface.id}`);
      } else if (!contains(surface.contentViewport, surface.contentBounds)) {
        add(result.violations, 'R9', surface.id, 'short list clipped despite room for its natural layout');
      }
    }
    if (surface.placement === undefined) continue;
    if (surface.placement === 'anchor' || surface.placement === 'anchor-overlap') {
      const anchor = surface.anchor;
      if (anchor === undefined || !validRect(anchor)) { result.missing.push(`R10:anchor:${surface.id}`); continue; }
      if (!result.observedRules.includes('R10')) result.observedRules.push('R10');
      const crossAxisGap = Math.max(anchor.x - right(panel), panel.x - right(anchor), 0);
      const axisGap = Math.max(anchor.y - bottom(panel), panel.y - bottom(anchor), 0);
      const overlap = overlaps(panel, anchor);
      if (crossAxisGap > 12 || axisGap > 20 || (surface.placement === 'anchor' && overlap)) {
        add(result.violations, 'R10', surface.id, 'panel detached from its trigger or overlaps the trigger');
      }
    } else {
      if (!result.observedRules.includes('R10')) result.observedRules.push('R10');
      const deltaX = surface.placement === 'side-end' ? Math.abs(right(viewport) - right(panel)) :
        Math.abs(panel.x + panel.width / 2 - viewport.x - viewport.width / 2);
      const deltaY = surface.placement === 'side-end' ? Math.abs(panel.y - viewport.y) :
        surface.placement === 'bottom-center' ? Math.abs(bottom(viewport) - bottom(visiblePanel)) :
        Math.abs(visiblePanel.y + visiblePanel.height / 2 - viewport.y - viewport.height / 2);
      if (deltaX > 4 || deltaY > 20) add(result.violations, 'R10', surface.id, `off-center by ${deltaX}×${deltaY}vp`);
    }
  }
}

function checkContrast(sample: LayoutInvariantNativeSample, result: LayoutInvariantNativeResult): void {
  if (sample.readingPaperEvidenceMissing === true) result.missing.push('R11:reading-paper');
  if (sample.readingPaletteChecks === undefined) {
    for (const scheme of ['day', 'night']) {
      checkPaletteContrast(evaluateReaderIslandContrast(readerIslandContrastPalette(scheme)), scheme, result);
    }
  } else {
    checkPaletteContrast(sample.readingPaletteChecks, sample.readingPaletteSource ?? 'runtime', result);
  }
  for (const node of sample.nodes) {
    const paint = node.nativeMaterialPaint;
    const bounds = node.bounds;
    if (paint === undefined || node.opacity < .1) continue;
    if (bounds === undefined || !validRect(bounds)) { result.missing.push(`R11:native-edge-bounds:${node.id}`); continue; }
    if ((sample.viewport !== undefined && !overlaps(sample.viewport, bounds, 0)) ||
      (node.clip !== undefined && !overlaps(node.clip, bounds, 0))) continue;
    if (paint.outline === true || paint.border === true || paint.shadow === true) continue;
    if (paint.outline === false && paint.border === false && paint.shadow === false) {
      add(result.violations, 'R11', node.id, 'native material has no visible outline, border or shadow');
    } else {
      result.missing.push(`R11:native-edge:${node.id}`);
    }
  }
}

function checkPaletteContrast(checks: ReaderIslandContrastCheck[], source: string, result: LayoutInvariantNativeResult): void {
  if (checks.length === 0) { result.missing.push(`R11:palette:${source}`); return; }
  if (!result.observedRules.includes('R11')) result.observedRules.push('R11');
  for (const check of checks) {
    if (!Number.isFinite(check.actual) || check.actual < check.minimum) {
      add(result.violations, 'R11', check.id, `${source} actual=${check.actual} minimum=${check.minimum}`);
    }
  }
}

function checkDensity(sample: LayoutInvariantNativeSample, fontScale: number | undefined, result: LayoutInvariantNativeResult): void {
  for (const measurement of sample.density) {
    const spec = DENSITY_SPECS.find((item: LayoutDensitySpec): boolean => item.id === measurement.specId);
    const frame = measurement.bounds;
    const content = measurement.contentBounds ?? (spec !== undefined && spec.maximumGap >= spec.maxHeight ? frame : undefined);
    if (spec === undefined || frame === undefined || content === undefined || !validRect(frame) || !validRect(content) ||
      fontScale === undefined || !Number.isFinite(fontScale) || fontScale <= 0) {
      result.missing.push(`R12:density:${measurement.id}`);
      continue;
    }
    if (!result.observedRules.includes('R12')) result.observedRules.push('R12');
    const reasons: string[] = [];
    const heightTol = spec.strict === true ? 0.1 : 2;
    const maxHeight = spec.maxHeight + spec.lineGrowth * Math.max(0, fontScale - 1);
    const free = frame.height - content.height;
    if (frame.height < spec.minHeight - heightTol || frame.height > maxHeight + heightTol ||
      free > spec.maximumGap + 2 || !contains(frame, content)) {
      reasons.push(`height=${frame.height} limit=${spec.minHeight}-${maxHeight} free=${free}`);
    }
    if (fontScale <= 1.05) {
      if ((spec.minWidth !== undefined && frame.width < spec.minWidth - 0.5) ||
        (spec.maxWidth !== undefined && frame.width > spec.maxWidth + 0.5)) {
        reasons.push(`width=${frame.width} limit=${spec.minWidth ?? 0}-${spec.maxWidth ?? 'inf'}`);
      }
      if (spec.minAspectRatio !== undefined || spec.maxAspectRatio !== undefined) {
        const ratio = frame.height > 0 ? frame.width / frame.height : 0;
        if ((spec.minAspectRatio !== undefined && ratio < spec.minAspectRatio) ||
          (spec.maxAspectRatio !== undefined && ratio > spec.maxAspectRatio)) {
          reasons.push(`ratio=${ratio.toFixed(3)} limit=${spec.minAspectRatio ?? 0}-${spec.maxAspectRatio ?? 'inf'}`);
        }
      }
    }
    if (spec.maxInternalGap !== undefined && measurement.maxChildGap !== undefined &&
      Number.isFinite(measurement.maxChildGap) && measurement.maxChildGap > spec.maxInternalGap + 2) {
      reasons.push(`gap=${measurement.maxChildGap} limit<=${spec.maxInternalGap}`);
    }
    const viewportWidth = measurement.viewportWidth ?? sample.viewport?.width ?? 0;
    if (spec.expectedInsetX !== undefined && viewportWidth > 0 && viewportWidth < 600 &&
      measurement.insetLeft !== undefined && measurement.insetRight !== undefined) {
      const tol = spec.insetTolerance ?? 1.5;
      if (Math.abs(measurement.insetLeft - spec.expectedInsetX) > tol ||
        Math.abs(measurement.insetRight - spec.expectedInsetX) > tol) {
        reasons.push(`inset=(${measurement.insetLeft},${measurement.insetRight}) expected=${spec.expectedInsetX}±${tol}`);
      }
    }
    if (reasons.length > 0) {
      add(result.violations, 'R12', measurement.id, reasons.join('; '));
    }
  }
}

function checkNativeNodes(sample: LayoutInvariantNativeSample, result: LayoutInvariantNativeResult): void {
  const siblings = new Map<string, LayoutInvariantNativeNode[]>();
  let mountedTextEvidenceMissing = false;
  for (const node of sample.nodes) {
    if (isGhost(node)) add(result.violations, 'R13', node.id, 'zero-opacity node still accepts hit tests');
    if (node.opacity < .1 || (!isVisualLeaf(node) && !node.interactive)) continue;
    const rect = node.bounds;
    if (rect === undefined || !validRect(rect)) { result.missing.push(`R13:native-bounds:${node.id}`); continue; }
    if (sample.viewport !== undefined && !overlaps(sample.viewport, rect, 0)) continue;
    if (node.scrollClip && node.clip !== undefined && !overlaps(node.clip, rect, 0)) continue;
    if (node.type === 'Text') result.nativeAudit.textCount += 1;
    if (isImage(node)) result.nativeAudit.imageCount += 1;
    if (node.interactive) result.nativeAudit.interactiveCount += 1;
    const evidence = node.mountedText;
    if (evidence !== undefined) {
      const mountedText = result.nativeAudit.mountedText ?? [];
      mountedText.push({ key: node.key, id: node.id, frame: rect, evidence });
      result.nativeAudit.mountedText = mountedText;
    }
    const ink = evidence?.ink;
    if (evidence?.status === 'missing' || (evidence?.status === 'measured' && !validRect(ink))) {
      mountedTextEvidenceMissing = true;
      result.missing.push(`R13:native-text-layout:${node.id}`);
    }
    const reasons: LayoutInvariantClipReason[] = [];
    if (evidence === undefined && node.textClipped === true) reasons.push('independent-text-height');
    if (evidence?.status === 'clipped') reasons.push('missing-glyphs');
    const validInk = ink !== undefined && validRect(ink);
    if (ink !== undefined && validInk && !contains(rect, ink)) reasons.push('ink-outside-text');
    if (!node.scrollClip && node.clip !== undefined) {
      if (!contains(node.clip, rect)) reasons.push('ancestor-clips-frame');
      if (ink !== undefined && validInk && !contains(node.clip, ink)) reasons.push('ancestor-clips-ink');
    }
    if (reasons.length > 0) {
      add(result.violations, 'R13', node.id, 'visible text, image or input is clipped');
    }
    if (node.parentBounds !== undefined && validRect(node.parentBounds) && !isScrollContainer(node.parentType) &&
      !contains(node.parentBounds, rect)) {
      add(result.violations, 'R13', node.id, 'paint bounds escape the parent');
      reasons.push('frame-outside-parent');
    }
    if (reasons.length > 0) {
      const coverage = result.nativeAudit;
      coverage.clippingOffenderCount = (coverage.clippingOffenderCount ?? 0) + 1;
      const offenders = coverage.clippingOffenders ?? [];
      // The layout receipt is a single bounded hilog line.
      if (offenders.length < 3) {
        offenders.push({ key: node.key, id: node.id, stableId: node.stableId, type: node.type,
          frame: rect, parentBounds: node.parentBounds, clip: node.clip, scrollClip: node.scrollClip,
          reasons, reflow: node.textReflow, ink });
        coverage.clippingOffenders = offenders;
      }
    }
    if (node.interactive && node.enabled === true && node.hitTest === 'none' && node.inputAdmissionSuppressed !== true) {
      add(result.violations, 'R13', node.id, 'enabled native input does not receive hit tests');
    }
    if (node.interactive && node.inputAdmissionSuppressed !== true && (node.enabled === undefined || node.hitTest === undefined)) {
      result.missing.push(`R13:native-input:${node.id}`);
    }
    // A Stack deliberately superimposes paint. Independently targetable
    // sibling controls still must not overlap inside either stack or flow.
    const compare = node.interactive || (isVisualLeaf(node) && node.parentType !== 'Stack' && node.parentType !== 'RelativeContainer');
    if (!compare || node.parentKey.length === 0) continue;
    const others = siblings.get(node.parentKey) ?? [];
    for (const peer of others) {
      if (node.interactive !== peer.interactive || (node.zIndex ?? 0) !== (peer.zIndex ?? 0) ||
        peer.bounds === undefined || !overlaps(peer.bounds, rect)) continue;
      add(result.violations, 'R13', node.id, `same-layer overlap with ${peer.id}`);
    }
    others.push(node);
    siblings.set(node.parentKey, others);
  }
  if (sample.complete && sample.viewport !== undefined && validRect(sample.viewport) &&
    result.nativeAudit.textCount + result.nativeAudit.imageCount + result.nativeAudit.interactiveCount > 0) {
    if (!mountedTextEvidenceMissing) result.observedRules.push('R13');
  } else result.missing.push('R13:native-tree');
}

export function evaluateNativeLayoutInvariants(sample: LayoutInvariantNativeSample, fontScale?: number): LayoutInvariantNativeResult {
  const result: LayoutInvariantNativeResult = { violations: [], missing: [], observedRules: [],
    nativeAudit: { textCount: 0, imageCount: 0, interactiveCount: 0, complete: sample.complete }, features: sample.features };
  checkFooters(sample, result);
  checkSurfaces(sample, result);
  checkContrast(sample, result);
  checkDensity(sample, fontScale, result);
  checkNativeNodes(sample, result);
  if (sample.features.some((feature: LayoutInvariantFeatureAssertion): boolean => feature.state !== 'missing')) result.observedRules.push('R14');
  for (const feature of sample.features) {
    if (feature.state === 'fail') add(result.violations, 'R14', feature.id, feature.detail);
    if (feature.state === 'missing') result.missing.push(`R14:feature:${feature.id}`);
  }
  for (const required of sample.requiredFeatures ?? []) {
    if (!sample.features.some((feature: LayoutInvariantFeatureAssertion): boolean => feature.id === required) &&
      !result.missing.includes(`R14:feature:${required}`)) result.missing.push(`R14:feature:${required}`);
  }
  for (const rule of sample.requiredRules ?? []) {
    if (!result.observedRules.includes(rule)) result.missing.push(`${rule}:no-applicable-evidence`);
  }
  return result;
}
