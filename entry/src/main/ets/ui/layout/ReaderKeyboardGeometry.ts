import { ReaderRectVp, ReaderWindowMetricsSnapshot, readerInteractiveSafeTop,
  readerInteractiveSafeBottom } from '../foundation/ReaderWindowMetrics';

export type ReaderEditingCapacity = 'visible' | 'reveal' | 'caret-only' | 'space-insufficient' | 'geometry-unknown';

export interface ReaderKeyboardViewport {
  rect: ReaderRectVp;
  known: boolean;
  occluded: boolean;
}

function finite(value: number): number { return Number.isFinite(value) ? value : 0; }
function end(rect: ReaderRectVp): number { return rect.top + rect.height; }
function horizontalIntersection(a: ReaderRectVp, b: ReaderRectVp): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width;
}

/** Current-window vp only. The actual host may already have been resized or
 * offset by ArkUI; intersecting it avoids charging that change a second time.
 * For a floating keyboard choose a real free vertical lane at the target X,
 * never invent a bottom-spanning rectangle from its height. */
export function readerKeyboardViewport(metrics: ReaderWindowMetricsSnapshot, host: ReaderRectVp,
  target?: ReaderRectVp): ReaderKeyboardViewport {
  const top = Math.max(finite(host.top), readerInteractiveSafeTop(metrics, false));
  const bottom = Math.max(top, Math.min(end(host),
    metrics.windowRect.height - readerInteractiveSafeBottom(metrics, false)));
  let lanes: ReaderRectVp[] = [new ReaderRectVp(host.left, top, Math.max(0, host.width), Math.max(0, bottom - top))];
  const area = metrics.keyboardArea;
  const known = metrics.ready && area !== undefined && area.available;
  if (known && area.visible) {
    for (const keyboard of area.rects) {
      if (!horizontalIntersection(target ?? host, keyboard)) continue;
      const next: ReaderRectVp[] = [];
      for (const lane of lanes) {
        if (keyboard.top >= end(lane) || end(keyboard) <= lane.top) { next.push(lane); continue; }
        next.push(new ReaderRectVp(lane.left, lane.top, lane.width, Math.max(0, keyboard.top - lane.top)));
        if (end(keyboard) < end(lane)) next.push(new ReaderRectVp(lane.left, end(keyboard), lane.width, end(lane) - end(keyboard)));
      }
      lanes = next;
    }
  } else if (!known && metrics.keyboardInsets.bottom > 0) {
    // Compatibility capacity only. Missing native geometry is never a visible
    // editing receipt, even though old callers can still reserve a safe lane.
    const limit = metrics.windowRect.height - metrics.keyboardInsets.bottom;
    lanes = lanes.map((lane: ReaderRectVp): ReaderRectVp =>
      new ReaderRectVp(lane.left, lane.top, lane.width, Math.max(0, Math.min(end(lane), limit) - lane.top)));
  }
  let selected = lanes[0] ?? new ReaderRectVp(host.left, top, Math.max(0, host.width), 0);
  for (const lane of lanes) {
    if (target === undefined) break;
    const contains = target !== undefined && target.top >= lane.top && end(target) <= end(lane);
    const selectedContains = target !== undefined && target.top >= selected.top && end(target) <= end(selected);
    if ((contains && !selectedContains) || (contains === selectedContains && lane.height > selected.height)) selected = lane;
  }
  return { rect: selected, known, occluded: selected.top > top || end(selected) < bottom };
}

/** Relative bottom of the unobscured top lane of an existing host. Slots that
 * already reserve their own header/footer subtract those budgets afterwards. */
export function readerKeyboardHostBottom(metrics: ReaderWindowMetricsSnapshot, originY: number, height: number,
  originX: number = 0, width: number = metrics.windowRect.width): number {
  const visible = readerKeyboardViewport(metrics, new ReaderRectVp(originX, originY, width, Math.max(0, height)));
  return Math.max(0, visible.rect.top + visible.rect.height - originY);
}

export interface ReaderEditingReveal {
  capacity: ReaderEditingCapacity;
  /** Positive scroll moves content upwards; negative reveals preceding content. */
  scrollDeltaVp: number;
}

export function readerEditingReveal(viewport: ReaderKeyboardViewport, field: ReaderRectVp,
  caret?: ReaderRectVp, marginVp: number = 8): ReaderEditingReveal {
  if (!viewport.known) return { capacity: 'geometry-unknown', scrollDeltaVp: 0 };
  const lane = viewport.rect;
  const useCaret = field.height > lane.height;
  const target = useCaret ? caret : field;
  const margin = Math.min(Math.max(0, finite(marginVp)),
    Math.max(0, (lane.height - (target?.height ?? lane.height)) / 2));
  const available = Math.max(0, lane.height - 2 * margin);
  if (target === undefined || target.height <= 0 || target.height > available)
    return { capacity: 'space-insufficient', scrollDeltaVp: 0 };
  const delta = end(target) > end(lane) - margin ? end(target) - end(lane) + margin :
    target.top < lane.top + margin ? target.top - lane.top - margin : 0;
  return { capacity: useCaret ? 'caret-only' : Math.abs(delta) > 0.01 ? 'reveal' : 'visible', scrollDeltaVp: delta };
}

/** The shell's measured content depends on these facts, not on IME occlusion.
 * Full environment keys remain authoritative for asynchronous admission. */
export function readerControlStructureKey(metrics: ReaderWindowMetricsSnapshot, width: number, height: number,
  expanded: boolean): string {
  return JSON.stringify([width, height, expanded, metrics.ready, metrics.densityPixels, metrics.systemFontScale,
    metrics.windowRect, metrics.systemInsets, metrics.cutoutInsets, metrics.gestureInsets,
    metrics.navigationInsets, metrics.statusBarRect, metrics.statusBarHeight, metrics.statusBarCutoutRect]);
}
