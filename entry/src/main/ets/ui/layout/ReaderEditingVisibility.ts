import { ReaderRectVp, ReaderWindowMetricsSnapshot } from '../foundation/ReaderWindowMetrics';
import { readerKeyboardViewport, readerEditingReveal, type ReaderEditingCapacity } from './ReaderKeyboardGeometry';

export interface ReaderEditingTargetRect {
  field: ReaderRectVp;
  caret?: ReaderRectVp;
  /** Module-owned task region, e.g. query plus its current result state.
   * Unlike a multiline field, this minimum cannot fall back to one caret. */
  context?: ReaderRectVp;
}
export interface ReaderEditingTarget {
  id: string;
  current: () => boolean;
  measure: () => ReaderEditingTargetRect | undefined;
  revealText: () => void;
  afterLayout: (action: () => void) => boolean;
  trace?: (event: string, detail: string) => void;
}
export interface ReaderEditingHost {
  current: () => boolean;
  viewport: () => ReaderRectVp | undefined;
  metrics: () => ReaderWindowMetricsSnapshot;
  scroll: (deltaVp: number) => void;
  /** A host may prefer its complete surface when that surface fits. The
   * module still supplies the task minimum for constrained presentations. */
  revealRegion?: (task: ReaderRectVp) => ReaderRectVp;
  /** Used only when an existing internal scroll cannot reveal the target. */
  translate?: (deltaVp: number) => void;
}

/** A mounted host owns only its current editing target and bounded layout work.
 * Drafts, focus, keyboard visibility, native text and business operations are
 * deliberately absent. Back cancels work and never requests focus or IME. */
export class ReaderEditingVisibility {
  private host: ReaderEditingHost | undefined = undefined;
  private target: ReaderEditingTarget | undefined = undefined;
  private generation: number = 0;
  private pending: boolean = false;
  capacity: ReaderEditingCapacity = 'geometry-unknown';

  mount(host: ReaderEditingHost): void { this.host = host; this.refresh(); }
  unmount(): void { this.host = undefined; this.dismiss(); }
  focus(target: ReaderEditingTarget): void {
    if (this.target !== target) { this.generation += 1; this.pending = false; }
    this.target = target; this.refresh();
  }
  blur(target: ReaderEditingTarget): void { if (this.target === target) this.dismiss(); }
  dismiss(): void {
    this.generation += 1; this.pending = false; this.target = undefined;
    this.capacity = 'geometry-unknown';
  }
  private accepts(target: ReaderEditingTarget, host: ReaderEditingHost, generation: number): boolean {
    return this.target === target && this.host === host && this.generation === generation &&
      host.current() && target.current();
  }
  private release(generation: number): void { if (generation === this.generation) this.pending = false; }
  private queue(target: ReaderEditingTarget, action: () => void): void {
    try {
      if (target.afterLayout(action) === false) { this.pending = false; this.capacity = 'geometry-unknown'; }
    } catch (_detached) { this.pending = false; this.capacity = 'geometry-unknown'; }
  }
  refresh(): void {
    const target = this.target, host = this.host;
    if (target === undefined || host === undefined || this.pending || !host.current() || !target.current()) return;
    const generation = this.generation;
    this.pending = true;
    this.queue(target, (): void => {
      if (!this.accepts(target, host, generation)) { this.release(generation); return; }
      target.revealText();
      this.queue(target, (): void => {
        if (!this.accepts(target, host, generation)) { this.release(generation); return; }
        this.reveal(target, host, generation, false);
      });
    });
  }
  private reveal(target: ReaderEditingTarget, host: ReaderEditingHost, generation: number, verifying: boolean): void {
    const hostRect = host.viewport();
    if (hostRect === undefined) { this.pending = false; this.capacity = 'geometry-unknown'; return; }
    if (hostRect.height <= 0 && host.metrics().ready) {
      this.pending = false; this.capacity = 'space-insufficient'; return;
    }
    const measured = target.measure();
    if (measured === undefined) {
      target.trace?.('measure-unavailable', JSON.stringify(hostRect));
      this.pending = false; this.capacity = 'geometry-unknown'; return;
    }
    const task = measured.context ?? measured.field;
    const region = host.revealRegion?.(task) ?? task;
    const viewport = readerKeyboardViewport(host.metrics(), hostRect, region);
    const result = readerEditingReveal(viewport, region, measured.context === undefined ? measured.caret : undefined);
    target.trace?.('reveal', JSON.stringify({ host: hostRect, field: measured.field, context: measured.context, viewport: viewport,
      result: result, revision: host.metrics().revision, keyboard: host.metrics().keyboardArea }));
    this.capacity = result.capacity;
    if (result.capacity === 'geometry-unknown' || result.capacity === 'space-insufficient' ||
      Math.abs(result.scrollDeltaVp) <= .5) { this.pending = false; return; }
    if (verifying) {
      if (host.translate !== undefined) {
        host.translate(result.scrollDeltaVp);
        this.queue(target, (): void => {
          if (!this.accepts(target, host, generation)) { this.release(generation); return; }
          this.pending = false;
          const finalRect = target.measure();
          if (finalRect === undefined) { this.capacity = 'geometry-unknown'; return; }
          const finalHost = host.viewport();
          if (finalHost === undefined) { this.capacity = 'geometry-unknown'; return; }
          const finalTask = finalRect.context ?? finalRect.field;
          const finalRegion = host.revealRegion?.(finalTask) ?? finalTask;
          const finalResult = readerEditingReveal(readerKeyboardViewport(host.metrics(), finalHost, finalRegion),
            finalRegion, finalRect.context === undefined ? finalRect.caret : undefined);
          this.capacity = Math.abs(finalResult.scrollDeltaVp) > .5 ? 'space-insufficient' : finalResult.capacity;
        });
      } else { this.pending = false; this.capacity = 'space-insufficient'; }
      return;
    }
    host.scroll(result.scrollDeltaVp);
    this.queue(target, (): void => {
      if (this.accepts(target, host, generation)) this.reveal(target, host, generation, true);
      else this.release(generation);
    });
  }
}
