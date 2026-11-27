export const READER_ROUTE_PARENT_PARALLAX = 0.16;
export const READER_ROUTE_PARENT_DIM = 0.04;
export const READER_ROUTE_EDGE_BACK_COMMIT_FRACTION = 0.33;
export const READER_RETAINED_DETAIL_LANE = 'reader-detail-scene';

export interface ReaderConditionalSceneMotion {
  enter: 'push' | 'none';
  exit: 'pop' | 'none';
}

export function readerConditionalSceneMotion(enabled: boolean, retainedParent: boolean = false): ReaderConditionalSceneMotion {
  return enabled && !retainedParent ? { enter: 'push', exit: 'pop' } : { enter: 'none', exit: 'none' };
}

function unit(value: number): number { return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0; }

export function readerRouteMotionPose(kind: 'push' | 'pop', role: 'child' | 'parent', width: number, progress: number,
  reducedMotion: boolean = false): number {
  if (reducedMotion) return 0;
  const coverage = kind === 'push' ? unit(progress) : 1 - unit(progress);
  const span = Number.isFinite(width) ? Math.max(0, width) : 0;
  return role === 'child' ? span * (1 - coverage) : -span * READER_ROUTE_PARENT_PARALLAX * coverage;
}

export function readerDetailSceneOpacity(coverage: number, reducedMotion: boolean): number {
  return reducedMotion ? unit(coverage) : 1;
}

export type ReaderDetailScenePhase = 'push' | 'covered' | 'preview' | 'cancel' | 'pop' | 'retired';

export interface ReaderDetailSceneSnapshot {
  generation: number;
  phase: ReaderDetailScenePhase;
  coverage: number;
}

/** A single foreground detail and its retained reading parent. Coverage is
 * the sampled pose, so Back can reverse a push without completing it first. */
export class ReaderDetailSceneTransition {
  private generation: number = 0;
  private current: ReaderDetailSceneSnapshot | undefined = undefined;
  private from: number = 0;
  private previewWidth: number = 0;

  snapshot(): ReaderDetailSceneSnapshot | undefined { return this.current; }

  open(animate: boolean): ReaderDetailSceneSnapshot {
    return this.begin(animate ? 'push' : 'covered', animate ? 0 : 1);
  }

  back(): ReaderDetailSceneSnapshot | undefined {
    const current = this.current;
    if (current === undefined || current.phase === 'pop' || current.phase === 'retired') return current;
    return this.begin('pop', current.coverage);
  }

  preview(width: number): ReaderDetailSceneSnapshot | undefined {
    if (this.current?.phase !== 'covered' || !Number.isFinite(width) || width <= 0) return undefined;
    this.previewWidth = width;
    return this.begin('preview', 1);
  }

  updatePreview(generation: number, offset: number): ReaderDetailSceneSnapshot | undefined {
    if (this.current?.generation !== generation || this.current.phase !== 'preview') return this.current;
    return this.update(1 - unit(offset / this.previewWidth));
  }

  shouldCommitPreview(): boolean {
    return this.current?.phase === 'preview' && this.current.coverage <= 1 - READER_ROUTE_EDGE_BACK_COMMIT_FRACTION;
  }

  previewViewportMatches(width: number): boolean { return width === this.previewWidth; }

  cancelPreview(): ReaderDetailSceneSnapshot | undefined {
    return this.current?.phase === 'preview' ? this.begin('cancel', this.current.coverage) : undefined;
  }

  sample(generation: number, fraction: number): ReaderDetailSceneSnapshot | undefined {
    const current = this.current;
    if (current?.generation !== generation || current.phase === 'preview' ||
      current.phase === 'covered' || current.phase === 'retired') return current;
    const target = current.phase === 'pop' ? 0 : 1;
    const coverage = this.from + (target - this.from) * unit(fraction);
    return this.update(current.phase === 'pop' ? Math.min(current.coverage, coverage) : Math.max(current.coverage, coverage));
  }

  settle(generation: number): ReaderDetailSceneSnapshot | undefined {
    if (this.current?.generation !== generation) return this.current;
    if (this.current.phase === 'retired') return this.current;
    // The normal detail destination can remain cached under the reader. Keep
    // the outgoing pose until the host has no further use for this scene.
    if (this.current.phase === 'pop') return this.begin('retired', 0);
    return this.begin('covered', 1);
  }

  clear(): void { this.generation += 1; this.current = undefined; }

  private begin(phase: ReaderDetailScenePhase, coverage: number): ReaderDetailSceneSnapshot {
    this.from = coverage;
    const snapshot: ReaderDetailSceneSnapshot = { generation: ++this.generation, phase, coverage };
    this.current = snapshot;
    return snapshot;
  }

  private update(coverage: number): ReaderDetailSceneSnapshot | undefined {
    const current = this.current;
    if (current === undefined) return undefined;
    const snapshot: ReaderDetailSceneSnapshot = { generation: current.generation, phase: current.phase, coverage };
    this.current = snapshot;
    return snapshot;
  }
}
