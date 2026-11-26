export type LayoutInvariantRule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
export type LayoutInvariantRole = 'floating-header' | 'fixed-header' | 'header-content' | 'scroll-content' |
  'key-control' | 'primary-dock' | 'modal-overlay';

export interface LayoutInvariantTag {
  role: LayoutInvariantRole;
  id: string;
  scope?: string;
  expectedHeightVp?: number;
  expectedTopGapVp?: number;
  expectedContentGapVp?: number;
  busy?: boolean;
  unavailable?: boolean;
  active?: boolean;
  closeDurationMs?: number;
  intercepts?: boolean;
}

export interface LayoutInvariantRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutInvariantNode {
  tag: LayoutInvariantTag;
  bounds?: LayoutInvariantRect;
  headerId?: string;
  opacity: number;
  enabled?: boolean;
  clipped?: boolean;
  intercepts?: boolean;
}

export interface LayoutInvariantSample {
  safeTopVp?: number;
  fontScale?: number;
  nodes: LayoutInvariantNode[];
  scanComplete: boolean;
  requiresHeader: boolean;
  requiresControl: boolean;
  requiresFirstContent: boolean;
  modalOpen: boolean;
  recoveryPending: boolean;
  checkRecovery: boolean;
  mainInputEnabled?: boolean;
}

export interface LayoutInvariantViolation {
  rule: LayoutInvariantRule;
  nodeId: string;
  detail: string;
}

export interface LayoutInvariantResult {
  violations: LayoutInvariantViolation[];
  missing: string[];
  observedRules: LayoutInvariantRule[];
}

const BOUNDS_TOLERANCE_VP = 1;
const SPEC_TOLERANCE_VP = 4;
const NATIVE_MINIMUM_HIT_VP = 44;

function overflows(inner: LayoutInvariantRect, outer: LayoutInvariantRect): boolean {
  return inner.x < outer.x - BOUNDS_TOLERANCE_VP || inner.y < outer.y - BOUNDS_TOLERANCE_VP ||
    inner.x + inner.width > outer.x + outer.width + BOUNDS_TOLERANCE_VP ||
    inner.y + inner.height > outer.y + outer.height + BOUNDS_TOLERANCE_VP;
}

export function evaluateLayoutInvariants(sample: LayoutInvariantSample): LayoutInvariantResult {
  const violations: LayoutInvariantViolation[] = [];
  const missing: string[] = [];
  const observed = new Set<LayoutInvariantRule>();
  const headers = sample.nodes.filter((node: LayoutInvariantNode): boolean =>
    node.tag.role === 'floating-header' || node.tag.role === 'fixed-header');
  const body = sample.nodes.filter((node: LayoutInvariantNode): boolean =>
    node.tag.role === 'scroll-content' && node.tag.active !== false);
  const controls = sample.nodes.filter((node: LayoutInvariantNode): boolean => node.tag.role === 'key-control');
  const safeTop = sample.safeTopVp;
  const fontScale = sample.fontScale;
  if (!sample.scanComplete) missing.push('frame-scan');
  if (safeTop === undefined || !Number.isFinite(safeTop) || fontScale === undefined || !Number.isFinite(fontScale)) {
    missing.push('window-metrics');
  }
  if (sample.requiresHeader && headers.length === 0) missing.push('header');
  if (sample.requiresFirstContent && body.length === 0) missing.push('first-content');
  if (sample.requiresControl && controls.length === 0) missing.push('key-control');

  for (const header of headers) {
    const frame = header.bounds;
    if (frame === undefined || frame.width <= 0 || frame.height <= 0) {
      missing.push(`header-bounds:${header.tag.id}`);
      continue;
    }
    const id = header.tag.id;
    if (safeTop !== undefined && Number.isFinite(safeTop)) {
      observed.add('R1');
      if (frame.y < safeTop - BOUNDS_TOLERANCE_VP) violations.push({ rule: 'R1', nodeId: id, detail: `top=${frame.y} safe=${safeTop}` });
      const topGap = header.tag.expectedTopGapVp;
      if (topGap !== undefined) {
        observed.add('R2');
        if (frame.y - safeTop > topGap + SPEC_TOLERANCE_VP) {
          violations.push({ rule: 'R2', nodeId: id, detail: `gap=${frame.y - safeTop} expected=${topGap}` });
        }
      }
    }
    const expectedHeight = header.tag.expectedHeightVp;
    if (fontScale === 1 && expectedHeight !== undefined) {
      observed.add('R3');
      if (Math.abs(frame.height - expectedHeight) > SPEC_TOLERANCE_VP) {
        violations.push({ rule: 'R3', nodeId: id, detail: `height=${frame.height} expected=${expectedHeight}` });
      }
    }
    for (const child of sample.nodes) {
      if (child.headerId !== id || child.tag.role !== 'header-content') continue;
      if (child.bounds === undefined || child.bounds.width <= 0 || child.bounds.height <= 0) {
        missing.push(`header-content:${child.tag.id}`);
        continue;
      }
      observed.add('R4');
      if (overflows(child.bounds, frame) || child.bounds.height * 4 < frame.height) {
        violations.push({ rule: 'R4', nodeId: child.tag.id, detail: 'header content overflow or excessive unused height' });
      }
    }
    if (header.tag.scope !== undefined) {
      for (const first of body) {
        if (first.tag.scope !== header.tag.scope) continue;
        if (first.bounds === undefined || first.tag.expectedContentGapVp === undefined) {
          missing.push(`first-content-bounds:${first.tag.id}`);
          continue;
        }
        observed.add('R4');
        const gap = first.bounds.y - frame.y - frame.height;
        if (gap < -BOUNDS_TOLERANCE_VP || gap > first.tag.expectedContentGapVp + SPEC_TOLERANCE_VP) {
          violations.push({ rule: 'R4', nodeId: first.tag.id, detail: `gap=${gap} expected=${first.tag.expectedContentGapVp}` });
        }
      }
    }
  }

  for (const node of sample.nodes) {
    if (node.tag.role !== 'primary-dock') continue;
    if (node.bounds === undefined || node.bounds.width <= 0 || node.bounds.height <= 0) {
      missing.push(`dock-bounds:${node.tag.id}`);
    }
  }

  for (const control of controls) {
    const id = control.tag.id;
    const frame = control.bounds;
    if (frame === undefined) {
      missing.push(`control-bounds:${id}`);
      continue;
    }
    observed.add('R5');
    if (frame.width < NATIVE_MINIMUM_HIT_VP - BOUNDS_TOLERANCE_VP ||
      frame.height < NATIVE_MINIMUM_HIT_VP - BOUNDS_TOLERANCE_VP || control.clipped === true) {
      violations.push({ rule: 'R5', nodeId: id, detail: `target=${frame.width}×${frame.height} clipped=${control.clipped === true}` });
    }
    if (sample.modalOpen || sample.recoveryPending || control.tag.busy === true || control.tag.unavailable === true) continue;
    if (control.enabled === undefined) missing.push(`control-enabled:${id}`);
    if (control.enabled === false || control.opacity < 0.55) {
      violations.push({ rule: 'R5', nodeId: id, detail: `enabled=${control.enabled} opacity=${control.opacity}` });
    }
  }

  if (sample.checkRecovery && !sample.recoveryPending && !sample.modalOpen) {
    if (sample.mainInputEnabled === undefined) missing.push('recovered-input');
    else observed.add('R6');
    if (sample.mainInputEnabled === false) violations.push({ rule: 'R6', nodeId: 'route', detail: 'main input is still blocked' });
    for (const node of sample.nodes) {
      if (node.tag.role !== 'modal-overlay') continue;
      if (node.intercepts === undefined) missing.push(`modal-hit-test:${node.tag.id}`);
      else if (node.intercepts) violations.push({ rule: 'R6', nodeId: node.tag.id, detail: 'retired modal intercepts input' });
    }
  }
  return { violations, missing, observedRules: [...observed].sort() };
}
