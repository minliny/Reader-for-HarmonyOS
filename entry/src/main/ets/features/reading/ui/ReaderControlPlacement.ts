import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass.ts';
import type { ReaderHoldingHand } from '../../../platform/interaction/ReaderHoldingHand.ts';

export type ReaderControlAlignment = 'left' | 'center' | 'right';

const GRIP_SETTLE_MS = 240;

export function readerControlAlignment(value: string | undefined): ReaderControlAlignment {
  return value === 'left' || value === 'right' ? value : 'center';
}

export interface ReaderControlPlacementUpdate {
  alignment: ReaderControlAlignment;
  settleInMs: number;
}

/** Qualifies a physical hand change, then waits for the current interaction to finish. */
export class ReaderControlPlacement {
  private presented: ReaderControlAlignment = 'center';
  private reported: ReaderHoldingHand = undefined;
  private stable: ReaderHoldingHand = undefined;
  private changedAt: number = 0;

  update(manual: ReaderControlAlignment, grip: ReaderHoldingHand,
    locked: boolean, now: number): ReaderControlPlacementUpdate {
    if (grip !== this.reported) {
      this.reported = grip;
      this.changedAt = now;
    }
    const settleInMs = this.stable === this.reported ? 0 : Math.max(0, this.changedAt + GRIP_SETTLE_MS - now);
    if (settleInMs === 0) this.stable = this.reported;
    if (!locked) this.presented = this.stable ?? manual;
    return { alignment: this.presented, settleInMs: locked ? 0 : settleInMs };
  }

  /** Retiring the native subscription also retires its previous hand sample. */
  retireGrip(): void {
    this.reported = undefined;
    this.stable = undefined;
  }
}

export function readerControlDockLeft(viewportWidth: number, panelWidth: number,
  leftGap: number, rightGap: number, alignment: ReaderControlAlignment): number {
  const free = Math.max(0, viewportWidth - panelWidth);
  if (!readerIsExpandedWidth(viewportWidth)) return free / 2;
  const left = Math.max(0, leftGap);
  const right = free - Math.max(0, rightGap);
  if (left > right) return free / 2;
  if (alignment === 'left') return left;
  if (alignment === 'right') return right;
  return Math.max(left, Math.min(right, free / 2));
}
