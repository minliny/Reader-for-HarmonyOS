import { FrameNode, UIContext } from '@kit.ArkUI';
import { ReaderStartupTrace, type ReaderTtsCapsuleTiming } from '../../../app/ReaderStartupTrace';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import type { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import { readReaderControlNativeActors, type MotionActor } from './ReaderControlVerificationMotion';
import type { ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';
import type { ReaderSessionLaunchGeometry } from './ReaderSessionLaunchPresentation';
import type { ReaderControlLocation } from './ReaderControlSessionState';

const ACTOR_IDS: string[] = ['reader-session-launch-proxy', 'reader-session-launch-source',
  'reader-session-launch-sharp', 'reader-session-launch-blur', 'reader-session-launch-surface',
  'reader-session-launch-leading', 'reader-control-motion-dock', 'reader-control-motion-topbar'];
const MAX_FRAMES: number = 192;
const BLOCK_FRAMES: number = 2;
const BLOCK_INTERVAL_MS: number = 75;
const HANDOFF_FADE_MAX_FRAMES: number = 48;
const HANDOFF_FADE_MAX_ANCESTORS: number = 24;

interface ReaderControlCapsuleFadeFrame {
  observedMs: number;
  frameTimeNs?: number;
  stageId?: number;
  opacity?: number;
  quickId?: number;
  quickVisible?: boolean;
  receiverId?: number;
  receiverVisible?: boolean;
}

interface ReaderControlCapsuleFadeCapture {
  generation: number;
  readingId: string;
  moduleActorId: string;
  receiverActorId?: string;
  receiverInsideModule: boolean;
  start: ReaderControlCapsuleFadeFrame;
  frames: ReaderControlCapsuleFadeFrame[];
  frameLimitReached: boolean;
}

interface ReaderControlCapsuleFadeTrace {
  generation: number;
  source: string;
  quickActorId: string;
  receiverActorId?: string;
  start: ReaderControlCapsuleFadeFrame;
  frames: ReaderControlCapsuleFadeFrame[];
  endpoint: ReaderControlCapsuleFadeFrame;
  frameLimitReached: boolean;
}

interface ReaderControlCapsuleFrame {
  index: number;
  frameTimeNs: number;
  publishedTickMs: number;
  previousHostUpdateMs: number;
  callbackQueuedMs?: number;
  callbackEnteredMs?: number;
  nextAdvanceTickMs?: number;
  captureStartMs: number;
  captureEndMs: number;
  timeMs: number;
  phase: string;
  controlsPresented: boolean;
  sourceNeeded: boolean;
  actors: MotionActor[];
}

interface ReaderControlCapsuleCapture {
  generation: number;
  readingId: string;
  body: ReaderControlCapsuleFrame[];
  dropped: number;
  tickMs: number;
  hostUpdateMs: number;
  ttsTiming?: ReaderTtsCapsuleTiming;
}

interface ReaderControlCapsuleBlock {
  generation: number;
  blockCount: number;
  blockIndex: number;
  finalBlock: boolean;
  droppedSamples: number;
  endReason: string;
  frames: ReaderControlCapsuleFrame[];
}

interface ReaderControlCapsuleAdmission {
  generation: number;
  type: string;
  kind: string;
  source: ReaderControlLocation;
  sourceActorId: string;
  geometry: ReaderSessionLaunchGeometry;
  startTimeMs: number;
  reducedMotion: boolean;
  moduleVisit: number;
  viewportRevision: number;
}

interface ReaderControlCapsuleOwnerState {
  generation: number;
  type: string;
  kind: string;
  status: string;
  desiredPlaying: boolean;
  ownership: string;
  timeMs: number;
  cancelReason?: string;
  controlsPresented: boolean;
  sourceNeeded: boolean;
  tts?: ReaderControlCapsuleSpeechFacts;
  autoPageStatus?: string;
}

export interface ReaderControlCapsuleSpeechFacts {
  engine: 'system' | 'http';
  sessionGeneration: number;
  status: string;
  audioStarted: boolean;
  audioSession: 'inactive' | 'active';
  pauseReason?: string;
}

/** Reads controls and capsule actors during the existing reader launch. */
export class ReaderControlCapsuleVerification {
  private readonly owner: ReaderControlVerificationSession;
  private capture: ReaderControlCapsuleCapture | undefined = undefined;
  private fade: ReaderControlCapsuleFadeCapture | undefined = undefined;

  constructor(owner: ReaderControlVerificationSession) { this.owner = owner; }

  begin(launch: ReaderSessionLaunchTransaction, source: ReaderControlLocation, reducedMotion: boolean): void {
    if (!this.owner.observing()) return;
    const previousTiming = this.capture?.ttsTiming;
    const trace = launch.geometry.type === 'tts' || previousTiming !== undefined ? ReaderStartupTrace.currentTts() : undefined;
    if (previousTiming !== undefined) trace?.closeTtsCapsuleTiming(previousTiming);
    const ttsTiming = launch.geometry.type === 'tts' ? trace?.createTtsCapsuleTiming() : undefined;
    this.capture = { generation: launch.generation, readingId: this.owner.observationIdentity(),
      body: [], dropped: 0, tickMs: launch.startTimeMs, hostUpdateMs: readerMotionNowMs(), ttsTiming };
    const facts: ReaderControlCapsuleAdmission = {
      generation: launch.generation, type: launch.geometry.type, kind: launch.geometry.kind,
      source: source, sourceActorId: launch.geometry.sourceActorId, geometry: launch.geometry,
      startTimeMs: launch.startTimeMs, reducedMotion: reducedMotion,
      moduleVisit: launch.identity.moduleVisit, viewportRevision: launch.identity.viewportRevision,
    };
    this.owner.effect('capsule-launch', 'admitted', facts);
  }

  ttsTiming(generation?: number): ReaderTtsCapsuleTiming | undefined {
    const capture = this.capture;
    return capture?.ttsTiming !== undefined && capture.generation === generation &&
      capture.readingId === this.owner.observationIdentity() ? capture.ttsTiming : undefined;
  }

  queuedFrameTime(generation: number): number | undefined {
    return this.capture?.generation === generation ? readerMotionNowMs() : undefined;
  }

  read(context: UIContext, launch: ReaderSessionLaunchTransaction, frameTimeNs: number,
    callbackQueuedMs?: number, callbackEnteredMs?: number, nextAdvanceTickMs?: number): void {
    const capture = this.capture;
    if (!this.owner.observing() || capture === undefined || capture.generation !== launch.generation) return;
    if (capture.body.length >= MAX_FRAMES) { capture.dropped += 1; return; }
    try {
      const sample = launch.sample;
      const captureStartMs = readerMotionNowMs();
      const actors = readReaderControlNativeActors(context, ACTOR_IDS);
      const captureEndMs = readerMotionNowMs();
      const frame: ReaderControlCapsuleFrame = { index: capture.body.length,
        frameTimeNs: frameTimeNs, publishedTickMs: capture.tickMs, timeMs: sample.timeMs,
        previousHostUpdateMs: capture.hostUpdateMs, callbackQueuedMs: callbackQueuedMs,
        callbackEnteredMs: callbackEnteredMs, nextAdvanceTickMs: nextAdvanceTickMs,
        captureStartMs: captureStartMs, captureEndMs: captureEndMs,
        phase: sample.phase, controlsPresented: sample.controlsPresented,
        sourceNeeded: sample.sourceNeeded, actors: actors };
      capture.body.push(frame);
    } catch (_) {
      capture.dropped += 1;
    }
  }

  update(launch: ReaderSessionLaunchTransaction, tickMs: number, before: ReaderSessionLaunchTransaction | undefined): void {
    const capture = this.capture;
    if (!this.owner.observing()) return;
    if (capture !== undefined && capture.generation === launch.generation) {
      capture.tickMs = tickMs;
      capture.hostUpdateMs = readerMotionNowMs();
    }
    if (before?.sample.controlsPresented === true && !launch.sample.controlsPresented) this.ownerState('panel-released', launch);
    if (before?.sample.sourceNeeded === true && !launch.sample.sourceNeeded) this.ownerState('source-released', launch);
    if (before?.sample.settled !== true && launch.sample.settled) this.ownerState('visual-settled', launch);
    if (before?.sample.finished !== true && launch.sample.finished) this.ownerState('timeline-finished', launch);
  }

  ownerState(phase: string, launch: ReaderSessionLaunchTransaction, tts?: ReaderControlCapsuleSpeechFacts,
    autoPageStatus?: string): void {
    if (!this.owner.observing()) return;
    const facts: ReaderControlCapsuleOwnerState = {
      generation: launch.generation, type: launch.geometry.type, kind: launch.geometry.kind,
      status: launch.businessStatus, desiredPlaying: launch.desiredPlaying, ownership: launch.ownership,
      timeMs: launch.sample.timeMs, cancelReason: launch.cancelReason,
      controlsPresented: launch.sample.controlsPresented, sourceNeeded: launch.sample.sourceNeeded,
      tts: tts, autoPageStatus: autoPageStatus,
    };
    this.owner.effect('capsule-launch', phase, facts);
  }

  /** Observe the exit animation independently of the completed launch flight. */
  beginHandoffFade(context: UIContext, launch: ReaderSessionLaunchTransaction): boolean {
    const kind = launch.geometry.kind;
    const full = kind === 'fullAutoPagePlayback' || kind === 'fullTtsPlayback';
    const quick = kind === 'quickAutoPage' || kind === 'quickTts';
    if (!this.owner.observing() || launch.cancelReason !== 'openControl' || launch.ownership !== 'exitPending' ||
      (!quick && !full)) return false;
    const moduleActorId = launch.geometry.type === 'tts' ? 'reader-control-module-tts' : 'reader-control-module-autoPage';
    const receiverActorId = full || (quick && !launch.sample.settled) ? launch.geometry.sourceActorId : undefined;
    this.fade = { generation: launch.generation, readingId: this.owner.observationIdentity(), moduleActorId: moduleActorId,
      receiverActorId: receiverActorId, receiverInsideModule: full,
      start: this.readFadeActors(context, moduleActorId, receiverActorId, full),
      frames: [], frameLimitReached: false };
    return true;
  }

  readHandoffFade(context: UIContext, generation: number, frameTimeNs: number): boolean {
    const fade = this.currentFade(generation);
    if (fade === undefined) return false;
    if (fade.frames.length >= HANDOFF_FADE_MAX_FRAMES) {
      fade.frameLimitReached = true;
      return false;
    }
    const frame = this.readFadeActors(context, fade.moduleActorId, fade.receiverActorId, fade.receiverInsideModule);
    frame.frameTimeNs = frameTimeNs;
    fade.frames.push(frame);
    return true;
  }

  finishHandoffFade(context: UIContext, generation: number): void {
    const fade = this.currentFade(generation);
    this.discardHandoffFade();
    if (fade === undefined) return;
    const trace: ReaderControlCapsuleFadeTrace = {
      generation: generation, source: 'FrameNode.getOpacity', quickActorId: fade.moduleActorId,
      receiverActorId: fade.receiverActorId, start: fade.start, frames: fade.frames,
      endpoint: this.readFadeActors(context, fade.moduleActorId, fade.receiverActorId, fade.receiverInsideModule),
      frameLimitReached: fade.frameLimitReached,
    };
    this.owner.effect('capsule-launch', 'handoff-fade', trace, 'motion');
  }

  discardHandoffFade(): void { this.fade = undefined; }

  private currentFade(generation: number): ReaderControlCapsuleFadeCapture | undefined {
    const fade = this.fade;
    return this.owner.observing() && fade?.generation === generation &&
      fade.readingId === this.owner.observationIdentity() ? fade : undefined;
  }

  private readFadeActorVisibility(actor: FrameNode, requiredAncestors: number[]): boolean | undefined {
    let node: FrameNode | null = actor;
    let matched = 0;
    let visible = true;
    // FrameNode opacity and visibility are local. Include the intermediate
    // nodes and require the exact content clip and dock on the same path.
    for (let depth = 0; node !== null && depth < HANDOFF_FADE_MAX_ANCESTORS; depth += 1) {
      if (node.isDisposed() || !node.isAttached()) return undefined;
      const opacity = node.getOpacity();
      const nodeVisible = node.isVisible();
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1 || typeof nodeVisible !== 'boolean') return undefined;
      visible = visible && nodeVisible && opacity > 0;
      if (depth > 0 && node.getUniqueId() === requiredAncestors[matched]) {
        matched += 1;
        if (matched === requiredAncestors.length) return visible;
      }
      node = node.getParent();
    }
    return undefined;
  }

  private readFadeActors(context: UIContext, moduleActorId: string, receiverActorId: string | undefined,
    receiverInsideModule: boolean): ReaderControlCapsuleFadeFrame {
    const frame: ReaderControlCapsuleFadeFrame = { observedMs: readerMotionNowMs() };
    try {
      const stage = context.getAttachedFrameNodeById('reader-session-launch-fade-owner');
      if (stage !== null && !stage.isDisposed() && stage.isAttached()) {
        frame.stageId = stage.getUniqueId();
        frame.opacity = stage.getOpacity();
      }
      const module = context.getAttachedFrameNodeById(moduleActorId);
      const clip = context.getAttachedFrameNodeById('reader-control-motion-content-clip');
      const dock = context.getAttachedFrameNodeById('reader-control-motion-dock');
      const anchors: number[] | undefined = clip !== null && !clip.isDisposed() && clip.isAttached() &&
        dock !== null && !dock.isDisposed() && dock.isAttached() ? [clip.getUniqueId(), dock.getUniqueId()] : undefined;
      if (module !== null && !module.isDisposed() && module.isAttached()) {
        const moduleId = module.getUniqueId();
        frame.quickId = moduleId;
        if (anchors !== undefined) frame.quickVisible = this.readFadeActorVisibility(module, anchors);
      }
      if (receiverActorId !== undefined) {
        const receiver = context.getAttachedFrameNodeById(receiverActorId);
        if (receiver !== null && !receiver.isDisposed() && receiver.isAttached()) {
          frame.receiverId = receiver.getUniqueId();
          if (anchors !== undefined) {
            if (!receiverInsideModule) frame.receiverVisible = this.readFadeActorVisibility(receiver, anchors);
            else if (frame.quickId !== undefined) {
              frame.receiverVisible = this.readFadeActorVisibility(receiver, [frame.quickId, ...anchors]);
            }
          }
        }
      }
    } catch (_) {
      // Unavailable or partial native reads remain gaps in the observation.
    }
    return frame;
  }

  finish(generation: number, endReason: string): void {
    const capture = this.capture;
    if (capture === undefined || capture.generation !== generation) return;
    this.capture = undefined;
    const ttsTiming = capture.ttsTiming;
    if (ttsTiming !== undefined) ReaderStartupTrace.currentTts()?.closeTtsCapsuleTiming(ttsTiming);
    if (!this.owner.observing()) return;
    const blockCount = Math.max(1, Math.ceil(capture.body.length / BLOCK_FRAMES));
    const exportBlock = (index: number): void => {
      if (!this.owner.observing() || this.owner.observationIdentity() !== capture.readingId) return;
      if (index === 0 && endReason === 'visual-settled' && ttsTiming?.operationId !== undefined) {
        this.owner.effect('capsule-timing', 'first-start', {
          generation: capture.generation, operationId: ttsTiming.operationId, marks: ttsTiming.marks,
        }, 'motion');
      }
      const start = index * BLOCK_FRAMES;
      const block: ReaderControlCapsuleBlock = { generation: generation, blockCount: blockCount,
        blockIndex: index, finalBlock: index + 1 === blockCount, droppedSamples: capture.dropped,
        endReason: endReason, frames: capture.body.slice(start, start + BLOCK_FRAMES) };
      this.owner.effect('capsule-launch', 'frame-block', block, 'motion');
      if (index + 1 < blockCount) setTimeout((): void => exportBlock(index + 1), BLOCK_INTERVAL_MS);
    };
    setTimeout((): void => exportBlock(0), BLOCK_INTERVAL_MS);
  }
}
