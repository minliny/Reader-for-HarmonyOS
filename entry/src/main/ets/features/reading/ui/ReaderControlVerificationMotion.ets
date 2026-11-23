import { FrameNode, UIContext } from '@kit.ArkUI';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { sampleReaderControlSession, type ReaderControlLocation, type ReaderControlSessionState } from './ReaderControlSessionState';
import type { ReaderControlVerificationDirection, ReaderControlVerificationRequest } from './ReaderControlVerificationSession';

const ACTORS: string[] = ['reader-control-motion-shell', 'reader-control-motion-grabber',
  'reader-control-motion-dock', 'reader-control-content-host'];
const CONTENT_CLIP: string = 'reader-control-motion-content-clip';
const MODULES: string[] = ['home', 'directory', 'tts', 'appearance', 'settings', 'search', 'autoPage', 'replace'];
const MAX_EXPORTS: number = 8;
const MAX_FRAMES: number = 72;
const MAX_ANCESTORS: number = 24;
const MAX_INSPECTOR_TEXT: number = 262144;
const EXPORT_BLOCK_INTERVAL_MS: number = 100;
const EXPORT_SCHEDULER_SLACK_MS: number = 1000;

export interface MotionPoint {
  x: number;
  y: number;
}

interface MotionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MotionVector {
  x: number;
  y: number;
  z: number;
}

interface MotionScale extends MotionVector {
  centerX: number;
  centerY: number;
}

interface MotionRotation extends MotionScale {
  angle: number;
}

interface InspectorAttributes {
  zIndex?: number | string;
  borderRadius?: string;
  clip?: string | boolean;
}

/** The opaque SDK return is only used for this allowlist. Shape drift leaves fields absent. */
interface InspectorNode {
  $ID?: number;
  $attrs?: InspectorAttributes;
}

interface MotionAncestor {
  uniqueId: number;
  parentUniqueId?: number;
  clipToFrame: boolean;
  zIndex?: number;
  borderRadiusVp?: number;
  clip?: string | boolean;
  windowOriginVp?: MotionPoint;
  measuredSizeVp?: MotionRect;
}

export interface MotionActor {
  id: string;
  mounted: boolean;
  uniqueId?: number;
  parentUniqueId?: number;
  layoutRectVp?: MotionRect;
  localOriginVp?: MotionPoint;
  windowOriginVp?: MotionPoint;
  translateVp?: MotionVector;
  scale?: MotionScale;
  rotation?: MotionRotation;
  matrix?: number[];
  opacity?: number;
  visible?: boolean;
  clipToFrame?: boolean;
  ancestors?: MotionAncestor[];
  ancestorChainComplete?: boolean;
  zIndex?: number;
  borderRadiusVp?: number;
  inspectorClip?: string | boolean;
  inspectorSource?: string;
  missing?: string;
}

export interface ReaderControlVerificationLayoutInputs {
  dockLeftVp: number;
  dockTopVp: number;
  widthVp: number;
  fullHeightVp: number;
  quickHeightVp: number;
  quickContentHeightVp: number;
  fullContentHeightVp: number;
  fullContentTopVp: number;
}

interface MotionFrame {
  index: number;
  phase: 'start' | 'progress' | 'endpoint' | 'pointer';
  frameTimeNs: number;
  captureStartMs: number;
  captureEndMs: number;
  observationPhase: 'before-runtime-publication' | 'after-endpoint-publication' | 'after-pointer-publication';
  runtimeElapsedMs: number | null;
  runtimeTickMs: number;
  runtimeElapsedSource: 'runtime-transition' | 'runtime-tick-delta';
  runtimeDurationMs: number;
  visibilityProgress: number;
  expansionProgress: number;
  runtimeLayoutOffsetVp: number;
  runtimeEpoch: number;
  runtimeTicket: number;
  density: number;
  content: ReaderControlLocation;
  actors: MotionActor[];
  contentClip: MotionActor;
  mountedContent?: MotionActor;
  attachedContentIds?: string[];
  contentAdmitted?: boolean;
  pointerWindowYVp?: number;
  pointerStartWindowYVp?: number;
  layoutInputs?: ReaderControlVerificationLayoutInputs;
  heldPointerId?: number;
  runtimeProgress?: number;
  continuationSlope?: number;
}

interface MotionExport {
  readonly readingId: string;
  readonly transitionId: string;
  readonly direction: ReaderControlVerificationDirection;
  readonly target: ReaderControlLocation;
  readonly origin: string;
  readonly epoch: number;
  readonly frames: MotionFrame[];
  readonly blockCount: number;
  readonly droppedSamples: number;
  readonly endReason: string;
  readonly deadlineMs: number;
}

function readOwnInspectorAttrs(node: FrameNode | null, attrs: Map<number, InspectorAttributes>): void {
  if (node === null) return;
  try {
    if (node.isDisposed() || !node.isAttached()) return;
    const id = node.getUniqueId();
    if (!Number.isSafeInteger(id)) return;
    const raw: Object = node.getInspectorInfo();
    if (typeof raw === 'string' && raw.length > MAX_INSPECTOR_TEXT) return;
    const root: InspectorNode = (typeof raw === 'string' ? JSON.parse(raw) : raw) as InspectorNode;
    if (root === undefined || root === null || typeof root !== 'object' || root.$ID !== id) return;
    const attributes = root.$attrs;
    if (attributes === undefined || attributes === null || typeof attributes !== 'object') return;
    // Keep only same-frame attributes from this exact attached node. The
    // inspector response can omit children and can contain private text.
    attrs.set(id, { zIndex: attributes.zIndex, borderRadius: attributes.borderRadius, clip: attributes.clip });
  } catch (_) {
    // Geometry remains usable when a node's Inspector fields are unavailable.
  }
}

function inspectorZ(attrs: InspectorAttributes | undefined): number | undefined {
  const z = attrs?.zIndex;
  if (typeof z === 'number' && Number.isSafeInteger(z)) return z;
  if (typeof z === 'string' && /^-?\d+$/.test(z) && Number.isSafeInteger(Number(z))) return Number(z);
  return undefined;
}

function inspectorRadiusVp(attrs: InspectorAttributes | undefined): number | undefined {
  const radius = attrs?.borderRadius;
  if (typeof radius !== 'string' || !/^\d+(?:\.\d+)?vp$/.test(radius)) return undefined;
  return Number(radius.slice(0, -2));
}

function inspectorClip(attrs: InspectorAttributes | undefined): string | boolean | undefined {
  const clip = attrs?.clip;
  if (clip === true || clip === false || clip === 'true' || clip === 'false') return clip;
  // OpenHarmony inspector describes clip shapes in a stringified object. Do
  // not forward the object, path data, or any unexpected inspector values.
  if (typeof clip === 'string' && clip.length < 256 && clip.startsWith('{')) return 'shape-present';
  return undefined;
}

function recordAncestor(node: FrameNode, parent: FrameNode | null, context: UIContext,
  attrs: Map<number, InspectorAttributes>): MotionAncestor {
  const uniqueId = node.getUniqueId();
  const attributes = attrs.get(uniqueId);
  const clips = node.isClipToFrame();
  const fact: MotionAncestor = { uniqueId: uniqueId, parentUniqueId: parent?.getUniqueId(), clipToFrame: clips,
    zIndex: inspectorZ(attributes), borderRadiusVp: inspectorRadiusVp(attributes), clip: inspectorClip(attributes) };
  if (clips) {
    const origin = node.getPositionToWindowWithTransform();
    const size = node.getMeasuredSize();
    fact.windowOriginVp = { x: origin.x, y: origin.y };
    fact.measuredSizeVp = { x: origin.x, y: origin.y, width: context.px2vp(size.width), height: context.px2vp(size.height) };
  }
  return fact;
}

function recordActorIdentity(id: string, node: FrameNode | null, context: UIContext,
  attrs: Map<number, InspectorAttributes>, ancestorsById: Map<number, MotionAncestor>): MotionActor {
  const fact: MotionActor = { id: id, mounted: false };
  if (node === null) return fact;
  try {
    if (node.isDisposed() || !node.isAttached()) return fact;
    fact.mounted = true;
    fact.uniqueId = node.getUniqueId();
    let parent = node.getParent();
    fact.parentUniqueId = parent?.getUniqueId();
    const ancestors: MotionAncestor[] = [];
    while (parent !== null && ancestors.length < MAX_ANCESTORS && !parent.isDisposed()) {
      const next = parent.getParent();
      const parentId = parent.getUniqueId();
      let observed = ancestorsById.get(parentId);
      if (observed === undefined) {
        observed = recordAncestor(parent, next, context, attrs);
        ancestorsById.set(parentId, observed);
      }
      ancestors.push(observed);
      parent = next;
    }
    fact.ancestors = ancestors;
    fact.ancestorChainComplete = parent === null;
  } catch (_) {
    fact.missing = 'NODE_READ_FAILED';
  }
  return fact;
}

function recordActor(id: string, node: FrameNode | null, context: UIContext,
  attrs: Map<number, InspectorAttributes>, ancestorsById: Map<number, MotionAncestor>): MotionActor {
  const fact = recordActorIdentity(id, node, context, attrs, ancestorsById);
  if (node === null || !fact.mounted || fact.uniqueId === undefined) return fact;
  try {
    const attributes = attrs.get(fact.uniqueId);
    fact.opacity = node.getOpacity();
    fact.visible = node.isVisible();
    fact.clipToFrame = node.isClipToFrame();
    fact.zIndex = inspectorZ(attributes);
    fact.borderRadiusVp = inspectorRadiusVp(attributes);
    fact.inspectorClip = inspectorClip(attributes);
    if (attributes !== undefined) fact.inspectorSource = 'FrameNode.getInspectorInfo';
    const info = context.getComponentUtils().getRectangleById(id);
    fact.layoutRectVp = { x: context.px2vp(info.windowOffset.x), y: context.px2vp(info.windowOffset.y),
      width: context.px2vp(info.size.width), height: context.px2vp(info.size.height) };
    fact.localOriginVp = { x: context.px2vp(info.localOffset.x), y: context.px2vp(info.localOffset.y) };
    const origin = node.getPositionToWindowWithTransform();
    fact.windowOriginVp = { x: origin.x, y: origin.y };
    // The SDK declares these lengths in vp and the angle in degrees.
    fact.translateVp = { x: info.translate.x, y: info.translate.y, z: info.translate.z };
    fact.scale = { x: info.scale.x, y: info.scale.y, z: info.scale.z,
      centerX: info.scale.centerX, centerY: info.scale.centerY };
    fact.rotation = { x: info.rotate.x, y: info.rotate.y, z: info.rotate.z, angle: info.rotate.angle,
      centerX: info.rotate.centerX, centerY: info.rotate.centerY };
    fact.matrix = Array.from(info.transform);
  } catch (_) {
    fact.missing = 'NODE_READ_FAILED';
  }
  return fact;
}

export function readReaderControlNativeActor(context: UIContext, id: string): MotionActor {
  const node = context.getAttachedFrameNodeById(id);
  const attrs = new Map<number, InspectorAttributes>();
  readOwnInspectorAttrs(node, attrs);
  return recordActor(id, node, context, attrs, new Map<number, MotionAncestor>());
}

/** Reads one private observation frame and reuses only that frame's ancestor facts. */
export function readReaderControlNativeActors(context: UIContext, ids: string[]): MotionActor[] {
  const nodes = ids.map((id: string): FrameNode | null => context.getAttachedFrameNodeById(id));
  const attrs = new Map<number, InspectorAttributes>();
  for (const node of nodes) readOwnInspectorAttrs(node, attrs);
  const ancestorsById = new Map<number, MotionAncestor>();
  return ids.map((id: string, index: number): MotionActor => recordActor(id, nodes[index], context, attrs, ancestorsById));
}

export interface ReaderControlPopupOwnerObservation {
  status: 'scroll-unavailable' | 'ancestor-unexposed' | 'known-owner-unavailable' | 'read-failed' | 'measured';
  relation?: 'scroll-ancestor' | 'known-host';
  uniqueId?: number;
  scrollUniqueId?: number;
  type?: string;
  opacity?: number;
  windowOriginVp?: MotionPoint;
  parentOriginVp?: MotionPoint;
  widthVp?: number;
  heightVp?: number;
  zIndex?: number;
  clipToFrame?: boolean;
}

export function readReaderControlPopupOwner(context: UIContext, menu: MotionActor,
  knownPopupId: number): ReaderControlPopupOwnerObservation {
  const result: ReaderControlPopupOwnerObservation = { status: 'scroll-unavailable' };
  try {
    let host: FrameNode | null = null;
    if (menu.mounted && menu.uniqueId !== undefined) {
      const scroll = context.getAttachedFrameNodeById(menu.id);
      if (scroll === null || scroll.isDisposed() || !scroll.isAttached() ||
        scroll.getUniqueId() !== menu.uniqueId || scroll.getNodeType() !== 'Scroll') return result;
      let ancestor = scroll.getParent();
      result.status = 'ancestor-unexposed';
      for (let depth = 0; depth < 6 && ancestor !== null && !ancestor.isDisposed(); depth += 1) {
        if (ancestor.getNodeType() === 'Popup') {
          host = ancestor;
          result.relation = 'scroll-ancestor';
          result.scrollUniqueId = menu.uniqueId;
          break;
        }
        ancestor = ancestor.getParent();
      }
    } else if (knownPopupId > 0) {
      result.status = 'known-owner-unavailable';
      const known = context.getFrameNodeByUniqueId(knownPopupId);
      if (known !== null && !known.isDisposed() && known.getUniqueId() === knownPopupId && known.getNodeType() === 'Popup') {
        host = known;
        result.relation = 'known-host';
      }
    }
    if (host === null || !host.isAttached()) return result;
    const uniqueId = host.getUniqueId();
    result.uniqueId = uniqueId;
    result.type = 'Popup';
    const origin = host.getPositionToWindowWithTransform();
    const parentOrigin = host.getPositionToParentWithTransform();
    const size = host.getMeasuredSize();
    const attrs = new Map<number, InspectorAttributes>();
    readOwnInspectorAttrs(host, attrs);
    result.windowOriginVp = { x: origin.x, y: origin.y };
    result.parentOriginVp = { x: parentOrigin.x, y: parentOrigin.y };
    result.widthVp = context.px2vp(size.width);
    result.heightVp = context.px2vp(size.height);
    result.opacity = host.getOpacity();
    result.clipToFrame = host.isClipToFrame();
    result.zIndex = inspectorZ(attrs.get(uniqueId));
    result.status = 'measured';
  } catch (_) {
    result.status = 'read-failed';
  }
  return result;
}

/** Only read during a selected normal owner transition. Export after its last frame. */
export class ReaderControlVerificationMotion {
  private request: ReaderControlVerificationRequest | undefined = undefined;
  private frames: MotionFrame[] = [];
  private droppedSamples: number = 0;
  private nextIndex: number = 0;
  private readonly pendingExports: MotionExport[] = [];
  private pendingExport: MotionExport | undefined = undefined;
  private exportTimer: number = -1;

  sample(request: ReaderControlVerificationRequest, context: UIContext, state: ReaderControlSessionState,
    content: ReaderControlLocation, frameTimeNs: number, runtimeTickMs: number, ticket: number, offsetY: number,
    endpoint: boolean, layoutInputs?: ReaderControlVerificationLayoutInputs, continuationSlope?: number,
    pointerWindowYVp?: number, pointerStartWindowYVp?: number, contentAdmitted?: boolean): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    const previousRequest = this.request;
    if (previousRequest?.transitionId !== request.transitionId || previousRequest?.accepted.epoch !== request.accepted.epoch) {
      if (previousRequest !== undefined) this.finish('interrupted', previousRequest.transitionId);
      this.request = request;
    }
    const index = this.nextIndex++;
    if (this.frames.length >= MAX_FRAMES) {
      this.droppedSamples += 1;
      return;
    }
    const start = readerMotionNowMs();
    try {
      const attachedActors = ACTORS.map((id: string): FrameNode | null => context.getAttachedFrameNodeById(id));
      const attachedClip = context.getAttachedFrameNodeById(CONTENT_CLIP);
      const attrs = new Map<number, InspectorAttributes>();
      // Populate the same-frame values before walking any actor's ancestors,
      // so the content host can resolve its actual clip owner's observation.
      for (const node of attachedActors) readOwnInspectorAttrs(node, attrs);
      readOwnInspectorAttrs(attachedClip, attrs);
      const contentId = content.level === 'secondary' ? 'reader-control-module-' + content.module : 'reader-control-module-home';
      let contentNode: FrameNode | null = null;
      const attachedContentIds: string[] = [];
      if (layoutInputs !== undefined) {
        for (const module of MODULES) {
          const id = 'reader-control-module-' + module;
          const node = context.getAttachedFrameNodeById(id);
          if (node === null || node.isDisposed() || !node.isAttached()) continue;
          attachedContentIds.push(id);
          if (id === contentId) contentNode = node;
        }
      }
      const ancestorsById = new Map<number, MotionAncestor>();
      const actors = ACTORS.map((id: string, index: number): MotionActor =>
        recordActor(id, attachedActors[index], context, attrs, ancestorsById));
      const contentClip = recordActor(CONTENT_CLIP, attachedClip, context, attrs, ancestorsById);
      const pointer = state.heldPointerId >= 0;
      // The host actor supplies the full geometry and transforms; the module
      // read proves which native content is attached within that same host.
      const mountedContent = layoutInputs === undefined ? undefined :
        recordActorIdentity(contentId, contentNode, context, attrs, ancestorsById);
      const visual = sampleReaderControlSession(state);
      const previous = this.frames[this.frames.length - 1];
      const prior = this.frames[this.frames.length - 2];
      // The reducer removes the transition on commit. Recover elapsed time
      // from the preceding observation and the actual clock tick supplied to
      // runtime, instead of substituting the configured duration.
      let elapsedMs: number | null = state.transition?.elapsedMs ?? null;
      if (endpoint && previous !== undefined && prior !== undefined &&
        previous.runtimeElapsedMs !== null && previous.runtimeTickMs === runtimeTickMs &&
        previous.runtimeTicket === ticket && prior.runtimeTicket === ticket) {
        elapsedMs = previous.runtimeElapsedMs + Math.max(0, runtimeTickMs - prior.runtimeTickMs);
      }
      this.frames.push({
        index: index,
        phase: endpoint ? 'endpoint' : pointer ? 'pointer' : index === 0 ? 'start' : 'progress',
        frameTimeNs: frameTimeNs,
        captureStartMs: start,
        captureEndMs: readerMotionNowMs(),
        observationPhase: endpoint ? 'after-endpoint-publication' :
          pointer ? 'after-pointer-publication' : 'before-runtime-publication',
        runtimeElapsedMs: elapsedMs,
        runtimeTickMs: runtimeTickMs,
        runtimeElapsedSource: endpoint ? 'runtime-tick-delta' : 'runtime-transition',
        runtimeDurationMs: state.transition?.durationMs ?? previous?.runtimeDurationMs ?? request.durationMs,
        visibilityProgress: visual.visibilityProgress,
        expansionProgress: visual.expansionProgress,
        runtimeLayoutOffsetVp: offsetY,
        runtimeEpoch: state.epoch,
        runtimeTicket: ticket,
        density: context.vp2px(1),
        content: { level: content.level, module: content.module, directoryTab: content.directoryTab, form: content.form },
        actors: actors,
        contentClip: contentClip,
        mountedContent: mountedContent,
        contentAdmitted: contentAdmitted,
        attachedContentIds: layoutInputs === undefined ? undefined : attachedContentIds,
        pointerWindowYVp: pointerWindowYVp,
        pointerStartWindowYVp: pointerStartWindowYVp,
        layoutInputs: layoutInputs,
        heldPointerId: layoutInputs === undefined ? undefined : state.heldPointerId,
        runtimeProgress: layoutInputs === undefined ? undefined : state.transition?.progress ?? request.transition?.targetProgress,
        continuationSlope: continuationSlope,
      });
    } catch (_) {
      this.droppedSamples += 1;
    }
  }

  finish(reason: 'completed' | 'interrupted' | 'unmounted', transitionId?: string): void {
    const request = this.request;
    if (transitionId !== undefined && transitionId !== request?.transitionId) return;
    const frames = this.frames;
    const droppedSamples = this.droppedSamples;
    this.resetRecording();
    if (reason === 'unmounted') {
      this.pendingExports.length = 0;
      this.cancelExport();
      return;
    }
    if (request === undefined || !ReaderUIVerificationProbe.enabled()) return;
    if (this.pendingExports.length >= MAX_EXPORTS) {
      ReaderUIVerificationProbe.emit('reading.control-motion', 'motion', {
        readingId: request.readingId, transitionId: request.transitionId, direction: request.direction,
        epoch: request.accepted.epoch, blockIndex: 0, blockCount: 1, finalBlock: true,
        frameStart: -1, frameEnd: -1, droppedSamples: frames.length + droppedSamples,
        endReason: 'export-overflow', frames: [],
      });
      return;
    }
    const last = frames.length > 0 ? frames[frames.length - 1] : undefined;
    const endReason = reason === 'completed' && last?.phase !== 'endpoint' ? 'endpoint-unavailable' : reason;
    const blockCount = Math.max(frames.length, 1);
    // Move the detached frames to one export. At most MAX_FRAMES intervals
    // (7.2 s) plus scheduler slack are allowed, without catch-up bursts.
    const trace: MotionExport = {
      readingId: request.readingId,
      transitionId: request.transitionId,
      direction: request.direction,
      target: request.target,
      origin: request.origin,
      epoch: request.accepted.epoch,
      frames: frames,
      blockCount: blockCount,
      droppedSamples: droppedSamples,
      endReason: endReason,
      deadlineMs: readerMotionNowMs() + (blockCount + (this.pendingExports.length + 1) * MAX_FRAMES) *
        EXPORT_BLOCK_INTERVAL_MS + EXPORT_SCHEDULER_SLACK_MS,
    };
    this.pendingExports.push(trace);
    this.startNextExport();
  }

  private startNextExport(): void {
    if (this.pendingExport !== undefined) return;
    const trace = this.pendingExports.shift();
    if (trace === undefined) return;
    this.pendingExport = trace;
    this.scheduleExportBlock(trace, 0);
  }

  private resetRecording(): void {
    this.request = undefined;
    this.frames = [];
    this.nextIndex = 0;
    this.droppedSamples = 0;
  }

  private cancelExport(): void {
    this.pendingExport = undefined;
    if (this.exportTimer >= 0) clearTimeout(this.exportTimer);
    this.exportTimer = -1;
  }

  private scheduleExportBlock(trace: MotionExport, blockIndex: number): void {
    this.exportTimer = setTimeout((): void => {
      if (this.pendingExport !== trace) return;
      this.exportTimer = -1;
      if (!ReaderUIVerificationProbe.enabled() || readerMotionNowMs() > trace.deadlineMs) {
        this.cancelExport();
        this.startNextExport();
        return;
      }
      const frame = trace.frames[blockIndex];
      ReaderUIVerificationProbe.emit('reading.control-motion', 'motion', {
        readingId: trace.readingId,
        transitionId: trace.transitionId,
        direction: trace.direction,
        epoch: trace.epoch,
        blockIndex: blockIndex,
        blockCount: trace.blockCount,
        finalBlock: blockIndex + 1 === trace.blockCount,
        frameStart: frame?.index ?? -1,
        frameEnd: frame?.index ?? -1,
        droppedSamples: trace.droppedSamples,
        endReason: trace.endReason,
        frames: frame === undefined ? [] : [frame],
        target: trace.target,
        origin: trace.origin,
      });
      if (blockIndex + 1 < trace.blockCount) this.scheduleExportBlock(trace, blockIndex + 1);
      else {
        this.pendingExport = undefined;
        this.startNextExport();
      }
    }, EXPORT_BLOCK_INTERVAL_MS);
  }
}
