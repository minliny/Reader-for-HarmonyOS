import { sampleReaderSessionLaunch } from './ReaderSessionLaunchPresentation.ts';
import type { ReaderSessionLaunchCurves, ReaderSessionLaunchGeometry, ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';
import type { ReaderSessionCapsuleState } from './ReaderSessionCapsuleModel';

/** PH09 physical review: one production time mapping for all Figma actors. */
export const READER_SESSION_LAUNCH_TIME_SCALE = 0.5;

/** Identity captured from the same visible-source measurement transaction. */
export interface ReaderSessionLaunchIdentity {
  readonly lifecycle: number;
  readonly bookIdentity: string;
  readonly moduleVisit: number;
  readonly viewportRevision: number;
  readonly scrollRevision: number;
  readonly layoutRevision: number;
  readonly paletteRevision: number;
  readonly fontRevision: number;
  readonly sourceRevision: number;
  readonly sourceActorId: string;
}
export type ReaderSessionLaunchCancelReason = 'stop' | 'failure' | 'stopBarrierFailure' |
  'openControl' | 'background' | 'leave' | 'bookChanged' | 'sourceChanged';
export type ReaderSessionLaunchOwnership = 'stage' | 'handoffPending' | 'exitPending' | 'released';
export interface ReaderSessionLaunchResource { release: () => void; }
export interface ReaderSessionLaunchTransaction {
  readonly generation: number;
  readonly identity: ReaderSessionLaunchIdentity;
  readonly geometry: ReaderSessionLaunchGeometry;
  readonly startTimeMs: number;
  readonly sample: ReaderSessionLaunchSample;
  readonly businessStatus: ReaderSessionCapsuleState;
  readonly desiredPlaying: boolean;
  readonly ownership: ReaderSessionLaunchOwnership;
  readonly cancelReason: ReaderSessionLaunchCancelReason | undefined;
}

export function sameReaderSessionLaunchIdentity(a: ReaderSessionLaunchIdentity, b: ReaderSessionLaunchIdentity): boolean {
  return a.lifecycle === b.lifecycle && a.bookIdentity === b.bookIdentity && a.moduleVisit === b.moduleVisit &&
    a.viewportRevision === b.viewportRevision && a.scrollRevision === b.scrollRevision &&
    a.layoutRevision === b.layoutRevision && a.paletteRevision === b.paletteRevision &&
    a.fontRevision === b.fontRevision && a.sourceRevision === b.sourceRevision && a.sourceActorId === b.sourceActorId;
}

function validIdentity(identity: ReaderSessionLaunchIdentity): boolean {
  return identity.bookIdentity.length > 0 && identity.sourceActorId.length > 0 &&
    Number.isFinite(identity.lifecycle) && Number.isFinite(identity.moduleVisit) &&
    Number.isFinite(identity.viewportRevision) && Number.isFinite(identity.scrollRevision) &&
    Number.isFinite(identity.layoutRevision) && Number.isFinite(identity.paletteRevision) &&
    Number.isFinite(identity.fontRevision) && Number.isFinite(identity.sourceRevision);
}

/**
 * Reader-specific presentation ownership, not a business/audio coordinator.
 * Native frame timestamps drive advance(); no timer or asynchronous IO lives
 * here. The host must obey desiredPlaying BEFORE issuing the first play call.
 */
export class ReaderSessionLaunchController {
  private generation: number = 0;
  private current: ReaderSessionLaunchTransaction | undefined = undefined;
  private resource: ReaderSessionLaunchResource | undefined = undefined;
  private lastTimeMs: number = 0;
  private reducedMotion: boolean = false;
  private readonly curves: ReaderSessionLaunchCurves;
  private readonly timeScale: number;

  constructor(curves: ReaderSessionLaunchCurves, timeScale: number = READER_SESSION_LAUNCH_TIME_SCALE) {
    this.curves = curves;
    this.timeScale = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : READER_SESSION_LAUNCH_TIME_SCALE;
  }

  remainingHoldMs(): number {
    return Math.max(0, 3500 - (this.current?.sample.timeMs ?? 3500)) * this.timeScale;
  }

  snapshot(): ReaderSessionLaunchTransaction | undefined { return this.current; }

  begin(identity: ReaderSessionLaunchIdentity, geometry: ReaderSessionLaunchGeometry,
    monotonicTimeMs: number, reduceMotion: boolean = false): ReaderSessionLaunchTransaction | undefined {
    if (!Number.isFinite(monotonicTimeMs) || !validIdentity(identity) || geometry.sourceRevision !== identity.sourceRevision ||
      geometry.sourceActorId !== identity.sourceActorId) return undefined;
    const previous = this.current;
    if (previous !== undefined && previous.ownership === 'stage' &&
      previous.geometry.kind === geometry.kind && sameReaderSessionLaunchIdentity(previous.identity, identity)) {
      return previous; // duplicate intent cannot restart the source flight
    }
    this.releaseResource();
    this.generation += 1;
    this.lastTimeMs = monotonicTimeMs;
    this.reducedMotion = reduceMotion;
    this.current = {
      generation: this.generation, identity: { ...identity }, geometry: { ...geometry },
      startTimeMs: monotonicTimeMs, sample: sampleReaderSessionLaunch(0, geometry, this.curves, reduceMotion),
      businessStatus: 'preparing', desiredPlaying: true, ownership: 'stage', cancelReason: undefined,
    };
    return this.current;
  }

  isCurrent(generation: number, identity?: ReaderSessionLaunchIdentity): boolean {
    const value = this.current;
    return value !== undefined && value.generation === generation && value.ownership === 'stage' &&
      (identity === undefined || sameReaderSessionLaunchIdentity(value.identity, identity));
  }

  advance(generation: number, monotonicTimeMs: number): ReaderSessionLaunchTransaction | undefined {
    const value = this.current;
    if (value === undefined || !this.isCurrent(generation)) return value;
    if (Number.isFinite(monotonicTimeMs)) this.lastTimeMs = Math.max(this.lastTimeMs, monotonicTimeMs);
    const sample = sampleReaderSessionLaunch((this.lastTimeMs - value.startTimeMs) / this.timeScale,
      value.geometry, this.curves, this.reducedMotion);
    this.current = { ...value, sample };
    if (!sample.sourceNeeded) this.releaseResource();
    return this.current;
  }

  /** A snapshot is optional. Late, zero-size or stale snapshots are disposed. */
  admitPreparedResource(generation: number, identity: ReaderSessionLaunchIdentity,
    resource: ReaderSessionLaunchResource, pixelWidth: number, pixelHeight: number,
    pixelBudget: number): boolean {
    if (!this.isCurrent(generation, identity) || this.current?.sample.sourceNeeded !== true ||
      !Number.isFinite(pixelWidth) || !Number.isFinite(pixelHeight) || !Number.isFinite(pixelBudget) ||
      pixelWidth <= 0 || pixelHeight <= 0 || pixelWidth * pixelHeight > pixelBudget) {
      resource.release();
      return false;
    }
    if (this.resource === resource) return true;
    this.releaseResource();
    this.resource = resource;
    return true;
  }

  setDesiredPlaying(generation: number, desiredPlaying: boolean): boolean {
    const value = this.current;
    if (value === undefined || !this.isCurrent(generation)) return false;
    // Deliberately do not label preparing as paused: only a business ACK may.
    this.current = { ...value, desiredPlaying };
    return true;
  }

  /** Gate actual audio/timer activation; call before the first play operation. */
  mayStartBusiness(generation: number): boolean {
    return this.isCurrent(generation) && this.current?.desiredPlaying === true;
  }

  acknowledgeBusiness(generation: number, status: ReaderSessionCapsuleState): boolean {
    const value = this.current;
    if (value === undefined || !this.isCurrent(generation)) return false;
    // An old play ACK must not override a preparing pause intent.
    if (status === 'playing' && !value.desiredPlaying) return false;
    this.current = { ...value, businessStatus: status };
    return true;
  }

  setReduceMotion(reduceMotion: boolean): ReaderSessionLaunchTransaction | undefined {
    if (!reduceMotion || this.current?.ownership !== 'stage') return this.current;
    this.reducedMotion = true; // disabling it never replays an observed launch
    return this.advance(this.current.generation, this.lastTimeMs);
  }

  /** Freeze the exact screen pose until the receiving control owner is ready. */
  cancel(reason: ReaderSessionLaunchCancelReason): ReaderSessionLaunchTransaction | undefined {
    const value = this.current;
    if (value === undefined || value.ownership !== 'stage') return value;
    const needsHandoff = reason === 'failure' || reason === 'stopBarrierFailure' || reason === 'openControl' || reason === 'sourceChanged';
    this.current = { ...value, ownership: needsHandoff ? 'handoffPending' : reason === 'stop' ? 'exitPending' : 'released',
      desiredPlaying: reason === 'stop' || reason === 'failure' ? false : value.desiredPlaying, cancelReason: reason };
    if (!needsHandoff && reason !== 'stop') this.releaseResource();
    return this.current;
  }

  /** New owner has mounted visible content at the frozen pose; old actor may fade. */
  confirmHandoffReady(generation: number): boolean {
    const value = this.current;
    if (value === undefined || value.generation !== generation || value.ownership !== 'handoffPending') return false;
    this.current = { ...value, ownership: 'exitPending' };
    return true;
  }

  finishExit(generation: number): boolean {
    const value = this.current;
    if (value === undefined || value.generation !== generation || value.ownership !== 'exitPending') return false;
    this.current = { ...value, ownership: 'released' };
    this.releaseResource();
    return true;
  }

  dispose(): void {
    this.generation += 1;
    this.releaseResource();
    this.current = undefined;
  }

  private releaseResource(): void {
    const resource = this.resource;
    this.resource = undefined;
    if (resource !== undefined) resource.release();
  }
}
