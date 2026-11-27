import { evaluateReaderIslandContrast, readerIslandContrastPalette, type ReaderIslandContrastCheck }
  from './ReaderIslandContrastEvaluator';
import type { LayoutInvariantRect, LayoutInvariantRule, LayoutInvariantViolation } from './LayoutInvariantEvaluator';
import type { ReaderNativeMaterialPaint } from './ReaderNativeMaterialPaint';

export type LayoutAuditHitTest = 'none' | 'block' | 'default' | 'transparent';
export type LayoutAuditPlacement = 'center' | 'bottom-center' | 'side-end' | 'anchor' | 'anchor-overlap';
export type LayoutAuditClose = 'visible' | 'scroll-reachable' | 'native-dismiss' | 'absent' | 'unknown';
export interface LayoutInvariantSurfaceHint {
  placement: LayoutAuditPlacement;
  anchor?: LayoutInvariantRect;
  viewport?: LayoutInvariantRect;
  dialog?: boolean;
  windowEdge?: boolean;
  contentMeasured?: boolean;
  nativeDismiss?: boolean;
}

export interface LayoutInvariantNativeNode {
  key: string;
  id: string;
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
  paintedLeaf?: boolean;
  surfaceHint?: LayoutInvariantSurfaceHint;
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
}

// Independent design values. Measured and tagged nodes never author their own R12 limits.
const DENSITY_SPECS: LayoutDensitySpec[] = [
  { id: 'library-search-bar', minHeight: 48, maxHeight: 104, lineGrowth: 55, maximumGap: 34 },
  { id: 'library-search-lane', minHeight: 42, maxHeight: 64, lineGrowth: 22, maximumGap: 16 },
  { id: 'tts-choice-content', minHeight: 0, maxHeight: 1200, lineGrowth: 240, maximumGap: 36 },
  { id: 'settings-home-group', minHeight: 50, maxHeight: 202, lineGrowth: 104, maximumGap: 28 },
  { id: 'source-import-review', minHeight: 32, maxHeight: 112, lineGrowth: 70, maximumGap: 24 },
];

function validRect(rect?: LayoutInvariantRect): boolean {
  return rect !== undefined && Number.isFinite(rect.x) && Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0;
}

function bottom(rect: LayoutInvariantRect): number { return rect.y + rect.height; }
function right(rect: LayoutInvariantRect): number { return rect.x + rect.width; }

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
    const content = measurement.contentBounds;
    if (spec === undefined || frame === undefined || content === undefined || !validRect(frame) || !validRect(content) ||
      fontScale === undefined || !Number.isFinite(fontScale) || fontScale <= 0) {
      result.missing.push(`R12:density:${measurement.id}`);
      continue;
    }
    if (!result.observedRules.includes('R12')) result.observedRules.push('R12');
    const maxHeight = spec.maxHeight + spec.lineGrowth * Math.max(0, fontScale - 1);
    const free = frame.height - content.height;
    if (frame.height < spec.minHeight - 2 || frame.height > maxHeight + 2 || free > spec.maximumGap + 2 || !contains(frame, content)) {
      add(result.violations, 'R12', measurement.id, `height=${frame.height} limit=${spec.minHeight}–${maxHeight} free=${free}`);
    }
  }
}

function checkNativeNodes(sample: LayoutInvariantNativeSample, result: LayoutInvariantNativeResult): void {
  const siblings = new Map<string, LayoutInvariantNativeNode[]>();
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
    if (node.textClipped === true || (!node.scrollClip && node.clip !== undefined && !contains(node.clip, rect))) {
      add(result.violations, 'R13', node.id, 'visible text, image or input is clipped');
    }
    if (node.parentBounds !== undefined && validRect(node.parentBounds) && !isScrollContainer(node.parentType) &&
      !contains(node.parentBounds, rect)) add(result.violations, 'R13', node.id, 'paint bounds escape the parent');
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
    result.observedRules.push('R13');
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
