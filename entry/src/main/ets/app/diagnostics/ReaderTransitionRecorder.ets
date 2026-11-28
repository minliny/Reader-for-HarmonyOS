import { FrameCallback, type UIContext } from '@kit.ArkUI';
import { ExpandMode, FrameNode } from '@ohos.arkui.node';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerMotionNowMs } from '../../ui/foundation/ReaderMotionClock';
import { readerTransitionsEnabled } from '../../ui/foundation/ReaderTransitionSignals';
import { evaluateTransitionInvariants, READER_LAUNCH_LEADING, READER_LAUNCH_LEADING_ICON, READER_LAUNCH_LEADING_LABEL,
  READER_LAUNCH_PROXY, READER_LAUNCH_SHARP, READER_LAUNCH_SHARP_SCALE, READER_LAUNCH_SOURCE_CLIP, READER_TRANSITION_SAMPLE_MS }
  from '../../ui/layout/TransitionInvariantEvaluator';
import type { ReaderLaunchSourceClip, ReaderTransitionEvaluation, ReaderTransitionFrame, ReaderTransitionKind, ReaderTransitionNode,
  ReaderTransitionObservation } from '../../ui/layout/TransitionInvariantEvaluator';
import { readerWindowMetrics } from '../../ui/foundation/ReaderWindowEnvironment';

const MAX_FRAMES = 64;
const MAX_RECORDINGS = 8;
const MAX_FRAME_GAP_MS = 75;
const MAX_TARGETS = 12;
const MAX_CHILD_QUERIES = 128;
const CHUNK_SIZE = 450;
let nextSequence: number = 0;

class TransitionFrameCallback extends FrameCallback {
  private readonly capture: () => void;
  constructor(capture: () => void) { super(); this.capture = capture; }
  onFrame(_time: number): void { this.capture(); }
  onIdle(_time: number): void {}
}

interface TransitionRecording {
  sequence: number;
  route: string;
  request: ReaderTransitionObservation;
  startMs: number;
  frames: ReaderTransitionFrame[];
}

interface NativeBodyAnchor {
  nativeId: number;
  y: number;
}

interface NativeBodyVisit {
  owner: FrameNode;
  window?: ReaderTransitionNode;
}

interface TransitionReceipt extends ReaderTransitionEvaluation {
  schemaVersion: number;
  sequence: number;
  kind: ReaderTransitionKind;
  action: string;
  subject: string;
  route: string;
  status: string;
  frameCount: number;
  durationMs: number;
  interrupted: boolean;
}

interface TransitionFrameRecord {
  sequence: number;
  frames: ReaderTransitionFrame[];
}

/** Bounded ID lookups per real frame. The steady-state tree scanner is never run at frame rate. */
export class ReaderTransitionRecorder {
  private readonly context: () => UIContext;
  private readonly route: () => string;
  private readonly onSamplingIdle: () => void;
  private readonly active: Map<string, TransitionRecording> = new Map<string, TransitionRecording>();
  private callbackPending: boolean = false;
  private generation: number = 0;

  constructor(context: () => UIContext, route: () => string, onSamplingIdle: () => void) {
    this.context = context;
    this.route = route;
    this.onSamplingIdle = onSamplingIdle;
  }

  isRecording(): boolean { return this.active.size > 0; }

  start(request: ReaderTransitionObservation): void {
    if (!readerTransitionsEnabled() || request.nodes.length === 0 || request.nodes.length > MAX_TARGETS) return;
    const previous = this.active.get(request.scope);
    if (previous !== undefined) {
      this.active.delete(request.scope);
      this.finish(previous, true);
    } else if (this.active.size >= MAX_RECORDINGS) {
      for (const oldest of this.active.values()) {
        this.active.delete(oldest.request.scope);
        this.finish(oldest, false, 'sampling-budget');
        break;
      }
    }
    const sequence = ++nextSequence;
    const recording: TransitionRecording = { sequence, route: this.route(), request,
      startMs: readerMotionNowMs(), frames: [] };
    // The publisher still owns the mounted native origin in this callback.
    // The next native frame may already have applied the target body.
    if (request.originChapterIndex !== undefined) {
      try { recording.frames.push(this.read(this.context(), request, 0)); }
      catch (_) { recording.frames.push({ atMs: 0, nodes: [], unreadableIds: request.nodes }); }
    }
    this.active.set(request.scope, recording);
    hilog.info(0x5244, 'Reader', 'READER_TRANSITION_BEGIN %{public}d', sequence);
    this.schedule();
  }

  retire(): void {
    const wasRecording = this.isRecording();
    this.generation += 1;
    this.callbackPending = false;
    this.active.clear();
    if (wasRecording) this.onSamplingIdle();
  }

  private schedule(): void {
    if (this.callbackPending || this.active.size === 0) return;
    this.callbackPending = true;
    const generation = this.generation;
    try {
      const context = this.context();
      context.postFrameCallback(new TransitionFrameCallback((): void => {
        if (generation !== this.generation) return;
        this.callbackPending = false;
        if (!readerTransitionsEnabled()) { this.retire(); return; }
        this.capture(context);
        this.schedule();
      }));
    } catch (_) {
      this.callbackPending = false;
      for (const recording of this.active.values()) this.finish(recording, false, 'frame-callback-unavailable');
      this.active.clear();
      this.onSamplingIdle();
    }
  }

  private capture(context: UIContext): void {
    const now = readerMotionNowMs();
    for (const recording of this.active.values()) {
      const elapsed = Math.max(0, now - recording.startMs);
      if (elapsed <= READER_TRANSITION_SAMPLE_MS) {
        recording.frames.push(this.read(context, recording.request, elapsed));
      }
      if (elapsed >= READER_TRANSITION_SAMPLE_MS || recording.frames.length >= MAX_FRAMES) {
        this.active.delete(recording.request.scope);
        this.finish(recording, false, elapsed < READER_TRANSITION_SAMPLE_MS ? 'frame-budget' : undefined);
      }
    }
    if (!this.isRecording()) this.onSamplingIdle();
  }

  private read(context: UIContext, request: ReaderTransitionObservation, atMs: number): ReaderTransitionFrame {
    const sample: ReaderTransitionFrame = { atMs: Math.round(atMs), nodes: [], unreadableIds: [] };
    for (let index = 0; index < request.nodes.length; index += 1) {
      const id = request.nodes[index];
      try {
        let owner = context.getAttachedFrameNodeById(id);
        if (owner !== null && request.firstChildBounds === true) {
          const index = owner.getFirstChildIndexWithoutExpand();
          owner = index >= 0 ? owner.getChild(index, ExpandMode.NOT_EXPAND) : null;
        }
        if (owner === null || owner.isDisposed() || !owner.isAttached()) continue;
        const node = this.readNode(context, id, owner, request.layoutBounds === true);
        if (request.kind === 'launch' && node.visible) this.clipLaunchContent(sample, node, owner);
        if (request.kind === 'chapter' && index < (request.chapterBodyCount ?? 0) && node.visible) {
          // Paged text is measured inside the title/body column. Use that
          // native viewport origin and the first actual visible text leaf.
          const continuous = id === 'reader-reading-interaction-host-continuous';
          const viewport = continuous ? owner : owner.getParent() ?? owner;
          const rect = this.readNode(context, id, viewport);
          const contentTop = continuous ? owner.getCustomProperty('readerTransitionContentTop') : 0;
          const contentBottom = continuous ? owner.getCustomProperty('readerTransitionContentBottom') : 0;
          const top = typeof contentTop === 'number' ? contentTop : 0;
          const bottom = typeof contentBottom === 'number' ? contentBottom : 0;
          rect.y += top;
          rect.height -= top + bottom;
          node.y = rect.y;
          const ink = this.findBodyAnchor(context, owner, rect);
          const chapter = owner.getCustomProperty('readerTransitionChapterIndex');
          node.chapterIndex = typeof chapter === 'number' && chapter >= 0 ? chapter : undefined;
          node.bodyVisible = ink !== undefined;
          node.bodyAnchorId = ink?.nativeId;
          node.bodyAnchorY = ink?.y;
        }
        sample.nodes.push(node);
      } catch (_) { sample.unreadableIds.push(id); }
    }
    return sample;
  }

  private clipLaunchContent(sample: ReaderTransitionFrame, actor: ReaderTransitionNode, owner: FrameNode): void {
    const leadingInk = actor.id === READER_LAUNCH_LEADING_ICON || actor.id === READER_LAUNCH_LEADING_LABEL;
    if (!leadingInk && actor.id !== READER_LAUNCH_SHARP) return;
    const clipId = leadingInk ? READER_LAUNCH_LEADING : READER_LAUNCH_PROXY;
    const clip = sample.nodes.find((candidate: ReaderTransitionNode): boolean => candidate.id === clipId);
    if (clip === undefined) throw new Error('launch-content-clip-unavailable');
    let left = clip.x;
    let top = clip.y;
    let right = clip.x + clip.width;
    let bottom = clip.y + clip.height;
    if (actor.id === READER_LAUNCH_SHARP) {
      // FrameNode exposes the transformed origin and the unscaled measured
      // size. The values read here are the same scale/clip applied to this
      // attached actor, sampled alongside its native effective opacity.
      const scale = owner.getCustomProperty(READER_LAUNCH_SHARP_SCALE);
      const insets = owner.getCustomProperty(READER_LAUNCH_SOURCE_CLIP) as ReaderLaunchSourceClip | undefined;
      if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0 || insets === undefined ||
        insets === null || ![insets.left, insets.top, insets.right, insets.bottom].every(Number.isFinite)) {
        throw new Error('launch-sharp-geometry-unavailable');
      }
      actor.width *= scale;
      actor.height *= scale;
      left += insets.left;
      top += insets.top;
      right -= insets.right;
      bottom -= insets.bottom;
    }
    const viewport = readerWindowMetrics().windowRect;
    right = Math.min(right, actor.x + actor.width, viewport.width);
    bottom = Math.min(bottom, actor.y + actor.height, viewport.height);
    actor.x = Math.max(actor.x, left, 0);
    actor.y = Math.max(actor.y, top, 0);
    actor.width = Math.max(0, right - actor.x);
    actor.height = Math.max(0, bottom - actor.y);
    actor.visible = clip.visible && actor.width > 0 && actor.height > 0;
  }

  private readNode(context: UIContext, id: string, owner: FrameNode, layoutBounds: boolean = false): ReaderTransitionNode {
    const position = layoutBounds ? owner.getPositionToWindow() : owner.getPositionToWindowWithTransform();
    const size = owner.getMeasuredSize();
    const width = context.px2vp(Number(size.width)), height = context.px2vp(Number(size.height));
    const x = Number(position.x), y = Number(position.y);
    if (![x, y, width, height].every(Number.isFinite)) throw new Error('transition-bounds-unavailable');
    const viewport = readerWindowMetrics().windowRect;
    const opacity = this.effectiveOpacity(owner);
    return { id, nativeId: owner.getUniqueId(), x, y, width, height, opacity,
      visible: opacity > 0 && width > 0 && height > 0 && x + width > 0 && y + height > 0 &&
        x < viewport.width && y < viewport.height };
  }

  private effectiveOpacity(owner: FrameNode): number {
    let node: FrameNode | null = owner;
    let result = 1;
    let depth = 0;
    while (node !== null && depth < 64) {
      if (!node.isVisible()) return 0;
      const opacity = node.getOpacity();
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new Error('transition-opacity-unavailable');
      result *= opacity;
      if (result === 0) return 0;
      node = node.getParent();
      depth += 1;
    }
    if (node !== null) throw new Error('transition-parent-depth');
    return result;
  }

  private intersects(first: ReaderTransitionNode, second: ReaderTransitionNode): boolean {
    return first.visible && first.x < second.x + second.width && first.x + first.width > second.x &&
      first.y < second.y + second.height && first.y + first.height > second.y;
  }

  private findBodyAnchor(context: UIContext, root: FrameNode, viewport: ReaderTransitionNode): NativeBodyAnchor | undefined {
    const queue: NativeBodyVisit[] = [{ owner: root }];
    let queries = 0;
    let truncated = false;
    let best: NativeBodyAnchor | undefined;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const visit = queue[cursor];
      const node = visit.owner;
      const kind = node.getNodeType();
      if (kind === 'Text' || kind === 'Image' || kind === 'RichEditor') {
        // A native Text node may extend above its clipped paragraph window.
        // Use the actual mounted NodeContainer once its text leaf is proven.
        const box = visit.window ?? this.readNode(context, '', node);
        if (this.intersects(box, viewport) && (best === undefined || box.y < best.y))
          best = { nativeId: box.nativeId, y: box.y };
        continue;
      }
      if (!node.isVisible() || node.getCustomProperty('readerTransitionIgnoreBody') === true) continue;
      const textWindow = kind === 'NodeContainer' ? this.readNode(context, '', node) : visit.window;
      if (textWindow !== undefined && !this.intersects(textWindow, viewport)) continue;
      const first = node.getFirstChildIndexWithoutExpand(), last = node.getLastChildIndexWithoutExpand();
      for (let index = first; first >= 0 && index <= last; index += 1) {
        if (queries >= MAX_CHILD_QUERIES) { truncated = true; break; }
        queries += 1;
        const child = node.getChild(index, ExpandMode.NOT_EXPAND);
        if (child !== null && child.isAttached()) queue.push({ owner: child, window: textWindow });
      }
    }
    if (best === undefined && truncated) throw new Error('transition-body-scan-budget');
    return best;
  }

  private finish(recording: TransitionRecording, interrupted: boolean, issue?: string): void {
    if (!readerTransitionsEnabled()) return;
    const result = evaluateTransitionInvariants(recording.request, recording.frames, !interrupted && issue === undefined);
    const first = recording.frames[0]?.atMs ?? 0;
    const last = recording.frames[recording.frames.length - 1]?.atMs ?? 0;
    let gap = first;
    for (let index = 1; index < recording.frames.length; index += 1)
      gap = Math.max(gap, recording.frames[index].atMs - recording.frames[index - 1].atMs);
    if (issue !== undefined) result.missing.push(issue);
    if (gap > MAX_FRAME_GAP_MS || (!interrupted && last < READER_TRANSITION_SAMPLE_MS - MAX_FRAME_GAP_MS))
      result.missing.push('frame-coverage');
    const request = recording.request;
    const receipt: TransitionReceipt = { schemaVersion: 1, sequence: recording.sequence, kind: request.kind, action: request.action,
      subject: request.subject, route: recording.route, status: result.missing.length === 0 ? 'measured' : 'incomplete',
      observedRules: result.observedRules, violations: result.violations, missing: result.missing,
      frameCount: recording.frames.length, durationMs: last, interrupted };
    hilog.info(0x5244, 'Reader', 'READER_TRANSITION_INVARIANTS %{public}s', JSON.stringify(receipt));
    const frameRecord: TransitionFrameRecord = { sequence: recording.sequence, frames: recording.frames };
    const record = JSON.stringify(frameRecord);
    const chunks = Math.ceil(record.length / CHUNK_SIZE);
    for (let index = 0; index < chunks; index += 1) {
      const key = `${recording.sequence}/${index}/${chunks} `;
      hilog.info(0x5244, 'Reader', 'READER_TRANSITION_FRAMES %{public}s%{public}s', key,
        record.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
    }
  }
}
