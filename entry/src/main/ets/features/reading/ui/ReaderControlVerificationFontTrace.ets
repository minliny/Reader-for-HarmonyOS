import { UIContext } from '@kit.ArkUI';
import type { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import { readReaderControlNativeActor, type MotionActor, type MotionPoint } from './ReaderControlVerificationMotion';

class ReaderControlFontVerificationPoint {
  readonly x: number;
  readonly y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class ReaderControlFontVerificationTrack {
  readonly id: string;
  readonly from: ReaderControlFontVerificationPoint;
  readonly to: ReaderControlFontVerificationPoint;

  constructor(id: string, fromX: number, fromY: number, toX: number, toY: number) {
    this.id = id;
    this.from = new ReaderControlFontVerificationPoint(fromX, fromY);
    this.to = new ReaderControlFontVerificationPoint(toX, toY);
  }
}

interface ReaderControlFontNativeSlot {
  id: string;
  mounted: boolean;
  uniqueId?: number;
  parentUniqueId?: number;
  windowOriginVp?: MotionPoint;
  zIndex?: number;
  inspectorSource?: string;
}

interface ReaderControlFontVerificationFrame {
  index: number;
  frameTimeNs: number;
  tickMs: number;
  endpoint: boolean;
  grid: ReaderControlFontNativeSlot;
  slots: ReaderControlFontNativeSlot[];
}

interface ReaderControlFontVerificationRun {
  generation: number;
  type: 'shift' | 'settle';
  fromTickMs: number;
  durationMs: number;
  order: string[];
  tracks: ReaderControlFontVerificationTrack[];
  frames: ReaderControlFontVerificationFrame[];
  omitted: number;
}

interface ReaderControlFontTraceResult {
  reason: 'completed' | 'interrupted';
  run: ReaderControlFontVerificationRun;
}

function fontNative(actor: MotionActor): ReaderControlFontNativeSlot {
  return { id: actor.id, mounted: actor.mounted, uniqueId: actor.uniqueId,
    parentUniqueId: actor.parentUniqueId, windowOriginVp: actor.windowOriginVp,
    zIndex: actor.zIndex, inspectorSource: actor.inspectorSource };
}

/** Captures the existing font clock and the native cells governed by it. */
export class ReaderControlVerificationFontTrace {
  private run: ReaderControlFontVerificationRun | undefined = undefined;

  begin(owner: ReaderControlVerificationSession | undefined, generation: number, type: 'shift' | 'settle',
    fromTickMs: number, durationMs: number, order: string[], tracks: ReaderControlFontVerificationTrack[]): void {
    this.finish(owner, 'interrupted');
    if (owner?.observing() !== true) return;
    this.run = { generation: generation, type: type, fromTickMs: fromTickMs, durationMs: durationMs,
      order: order, tracks: tracks, frames: [], omitted: 0 };
  }

  observe(owner: ReaderControlVerificationSession | undefined, context: UIContext, generation: number,
    frameTimeNs: number, tickMs: number, endpoint: boolean): void {
    const run = this.run;
    if (run === undefined || owner?.observing() !== true || run.generation !== generation) return;
    if (run.frames.length >= 40) { run.omitted += 1; return; }
    const grid = fontNative(readReaderControlNativeActor(context, 'reader-control-font-grid'));
    const slots = run.tracks.map((track: ReaderControlFontVerificationTrack): ReaderControlFontNativeSlot =>
      fontNative(readReaderControlNativeActor(context, track.id)));
    const frame: ReaderControlFontVerificationFrame = {
      index: run.frames.length, frameTimeNs: frameTimeNs, tickMs: tickMs,
      endpoint: endpoint, grid: grid, slots: slots,
    };
    run.frames.push(frame);
  }

  finish(owner: ReaderControlVerificationSession | undefined, reason: 'completed' | 'interrupted'): void {
    const run = this.run;
    this.run = undefined;
    if (run === undefined || owner?.observing() !== true) return;
    const result: ReaderControlFontTraceResult = { reason: reason, run: run };
    owner.effect('font-reorder', 'trace', result, 'motion');
  }
}
