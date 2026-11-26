export type LayoutInvariantRule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';
export type LayoutInvariantRole = 'floating-header' | 'fixed-header' | 'header-content' | 'scroll-content' |
  'key-control' | 'primary-dock' | 'modal-overlay' | 'main-input';
export const READER_PAGED_INPUT_SCOPE = 'reader-paged-input';

export interface LayoutInvariantTag {
  role: LayoutInvariantRole;
  id: string;
  scope?: string;
  expectedHeightVp?: number;
  expectedTopGapVp?: number;
  expectedContentGapVp?: number;
  wrapGapVp?: number;
  wrapPart?: 'leading' | 'trailing';
  busy?: boolean;
  unavailable?: boolean;
  modalControl?: boolean;
  expectsModalControl?: boolean;
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
  requiresNativeMainInput?: boolean;
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

interface MeasuredControl {
  id: string;
  bounds: LayoutInvariantRect;
}

const BOUNDS_TOLERANCE_VP = 1;
const SPEC_TOLERANCE_VP = 4;
const NATIVE_MINIMUM_HIT_VP = 44;

function overflows(inner: LayoutInvariantRect, outer: LayoutInvariantRect): boolean {
  return inner.x < outer.x - BOUNDS_TOLERANCE_VP || inner.y < outer.y - BOUNDS_TOLERANCE_VP ||
    inner.x + inner.width > outer.x + outer.width + BOUNDS_TOLERANCE_VP ||
    inner.y + inner.height > outer.y + outer.height + BOUNDS_TOLERANCE_VP;
}

function expectedHeaderHeight(header: LayoutInvariantTag, children: LayoutInvariantNode[]): number | undefined {
  const minimum = header.expectedHeightVp;
  const wrapGap = header.wrapGapVp;
  if (minimum === undefined || wrapGap === undefined) return minimum;
  const leading = children.find((node: LayoutInvariantNode): boolean => node.tag.wrapPart === 'leading')?.bounds;
  const trailing = children.find((node: LayoutInvariantNode): boolean => node.tag.wrapPart === 'trailing')?.bounds;
  if (leading === undefined || trailing === undefined || leading.height <= 0 || trailing.height <= 0) return undefined;
  const wrapped = trailing.y >= leading.y + leading.height - BOUNDS_TOLERANCE_VP;
  return Math.max(minimum, wrapped ? leading.height + wrapGap + trailing.height : Math.max(leading.height, trailing.height));
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
  const checkRecovery = sample.checkRecovery && !sample.recoveryPending && !sample.modalOpen;
  const recoveredPageInputs = checkRecovery ? sample.nodes.filter((node: LayoutInvariantNode): boolean =>
    node.tag.role === 'main-input' && node.tag.scope === READER_PAGED_INPUT_SCOPE) : [];
  const expectsModalControl = sample.nodes.some((node: LayoutInvariantNode): boolean =>
    node.tag.role === 'modal-overlay' && node.tag.active === true && node.tag.expectsModalControl === true);
  const safeTop = sample.safeTopVp;
  const fontScale = sample.fontScale;
  if (!sample.scanComplete) missing.push('frame-scan');
  if (safeTop === undefined || !Number.isFinite(safeTop) || fontScale === undefined || !Number.isFinite(fontScale)) {
    missing.push('window-metrics');
  }
  if (!sample.modalOpen) {
    if (sample.requiresHeader && headers.length === 0) missing.push('header');
    if (sample.requiresFirstContent && body.length === 0) missing.push('first-content');
    if (sample.requiresControl && !controls.some((node: LayoutInvariantNode): boolean => node.tag.modalControl !== true)) {
      missing.push('key-control');
    }
  }
  if (expectsModalControl && !controls.some((node: LayoutInvariantNode): boolean => node.tag.modalControl === true)) {
    missing.push('modal-control');
  }

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
    const children = sample.nodes.filter((node: LayoutInvariantNode): boolean => node.headerId === id && node.tag.role === 'header-content');
    const expectedHeight = expectedHeaderHeight(header.tag, children);
    if (fontScale === 1 && header.tag.expectedHeightVp !== undefined && expectedHeight === undefined) {
      missing.push(`header-wrap-children:${id}`);
    }
    if (fontScale === 1 && expectedHeight !== undefined) {
      observed.add('R3');
      if (Math.abs(frame.height - expectedHeight) > SPEC_TOLERANCE_VP) {
        violations.push({ rule: 'R3', nodeId: id, detail: `height=${frame.height} expected=${expectedHeight}` });
      }
    } else if (fontScale !== undefined && fontScale > 1 && expectedHeight !== undefined) {
      observed.add('R3');
      const minimumHeight = expectedHeight - SPEC_TOLERANCE_VP;
      if (frame.height < minimumHeight) {
        violations.push({ rule: 'R3', nodeId: id, detail: `height=${frame.height} minimum=${minimumHeight}` });
      }
    }
    for (const child of children) {
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

  for (const control of [...controls, ...recoveredPageInputs]) {
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
    if ((sample.modalOpen && control.tag.modalControl !== true) || sample.recoveryPending ||
      control.tag.busy === true || control.tag.unavailable === true) continue;
    if (control.enabled === undefined) missing.push(`control-enabled:${id}`);
    if (control.enabled === false || control.opacity < 0.55) {
      violations.push({ rule: 'R5', nodeId: id, detail: `enabled=${control.enabled} opacity=${control.opacity}` });
    }
    if (control.tag.role === 'main-input') {
      if (control.intercepts === undefined) missing.push(`control-hit-test:${id}`);
      else if (!control.intercepts) violations.push({ rule: 'R5', nodeId: id, detail: 'page input does not receive hit tests' });
    }
  }

  if (checkRecovery) {
    const nativeInput = sample.nodes.find((node: LayoutInvariantNode): boolean =>
      node.tag.role === 'main-input' && node.tag.scope !== READER_PAGED_INPUT_SCOPE);
    if (sample.mainInputEnabled === undefined || (sample.requiresNativeMainInput === true && nativeInput?.enabled === undefined)) {
      missing.push('recovered-input');
    } else observed.add('R6');
    if (sample.mainInputEnabled === false) violations.push({ rule: 'R6', nodeId: 'route', detail: 'main input is still blocked' });
    if (nativeInput?.enabled === false) {
      violations.push({ rule: 'R6', nodeId: nativeInput.tag.id, detail: 'native input host is still disabled' });
    }
    for (const node of sample.nodes) {
      if (node.tag.role !== 'modal-overlay') continue;
      if (node.intercepts === undefined) missing.push(`modal-hit-test:${node.tag.id}`);
      else if (node.intercepts) violations.push({ rule: 'R6', nodeId: node.tag.id, detail: 'retired modal intercepts input' });
    }
  }

  const foregroundControls: MeasuredControl[] = [];
  const backgroundControls: MeasuredControl[] = [];
  for (const control of controls) {
    const frame = control.bounds;
    const modalControl = control.tag.modalControl === true;
    if (frame === undefined || !(frame.width > 0 && frame.height > 0 && control.opacity >= 0.1) ||
      (sample.modalOpen && !modalControl)) continue;
    const layer = modalControl ? foregroundControls : backgroundControls;
    if (layer.length > 0) observed.add('R7');
    const id = control.tag.id;
    for (const peer of layer) {
      const other = peer.bounds;
      const interWidth = Math.min(frame.x + frame.width, other.x + other.width) - Math.max(frame.x, other.x) - BOUNDS_TOLERANCE_VP;
      const interHeight = Math.min(frame.y + frame.height, other.y + other.height) - Math.max(frame.y, other.y) - BOUNDS_TOLERANCE_VP;
      if (interWidth > 0 && interHeight > 0) {
        violations.push({ rule: 'R7', nodeId: id, detail: `${id} overlaps ${peer.id} by ${interWidth}×${interHeight}vp` });
      }
    }
    layer.push({ id, bounds: frame });
  }
  return { violations, missing, observedRules: [...observed].sort() };
}
