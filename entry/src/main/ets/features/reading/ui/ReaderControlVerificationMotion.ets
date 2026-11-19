import { FrameNode, UIContext } from '@kit.ArkUI';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { sampleReaderControlSession, type ReaderControlLocation, type ReaderControlSessionState } from './ReaderControlSessionState';
import type { ReaderControlVerificationRequest } from './ReaderControlVerificationSession';

const ACTORS: string[] = ['reader-control-motion-shell', 'reader-control-motion-grabber',
  'reader-control-motion-dock', 'reader-control-content-host'];
const CONTENT_CLIP: string = 'reader-control-motion-content-clip';
const MAX_FRAMES: number = 72;
const MAX_ANCESTORS: number = 24;
const MAX_INSPECTOR_TEXT: number = 262144;

interface MotionPoint {
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

interface MotionActor {
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

interface MotionFrame {
  index: number;
  phase: 'start' | 'progress' | 'endpoint';
  frameTimeNs: number;
  captureStartMs: number;
  captureEndMs: number;
  observationPhase: 'before-runtime-publication' | 'after-endpoint-publication';
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

function recordActor(id: string, node: FrameNode | null, context: UIContext,
  attrs: Map<number, InspectorAttributes>): MotionActor {
  const fact: MotionActor = { id: id, mounted: false };
  if (node === null) return fact;
  try {
    if (node.isDisposed() || !node.isAttached()) return fact;
    fact.mounted = true;
    const uniqueId = node.getUniqueId();
    const attributes = attrs.get(uniqueId);
    fact.uniqueId = uniqueId;
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
    let parent = node.getParent();
    fact.parentUniqueId = parent?.getUniqueId();
    const ancestors: MotionAncestor[] = [];
    while (parent !== null && ancestors.length < MAX_ANCESTORS && !parent.isDisposed()) {
      const next = parent.getParent();
      ancestors.push(recordAncestor(parent, next, context, attrs));
      parent = next;
    }
    fact.ancestors = ancestors;
    fact.ancestorChainComplete = parent === null;
  } catch (_) {
    fact.missing = 'NODE_READ_FAILED';
  }
  return fact;
}

/** Only read during a selected normal owner transition. Export after its last frame. */
export class ReaderControlVerificationMotion {
  private request: ReaderControlVerificationRequest | undefined = undefined;
  private frames: MotionFrame[] = [];
  private droppedSamples: number = 0;
  private nextIndex: number = 0;

  sample(request: ReaderControlVerificationRequest, context: UIContext, state: ReaderControlSessionState,
    content: ReaderControlLocation, frameTimeNs: number, runtimeTickMs: number, ticket: number, offsetY: number,
    endpoint: boolean): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    if (this.request?.transitionId !== request.transitionId) {
      this.finish('interrupted');
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
      const actors = ACTORS.map((id: string, index: number): MotionActor =>
        recordActor(id, attachedActors[index], context, attrs));
      const contentClip = recordActor(CONTENT_CLIP, attachedClip, context, attrs);
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
        phase: endpoint ? 'endpoint' : index === 0 ? 'start' : 'progress',
        frameTimeNs: frameTimeNs,
        captureStartMs: start,
        captureEndMs: readerMotionNowMs(),
        observationPhase: endpoint ? 'after-endpoint-publication' : 'before-runtime-publication',
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
      });
    } catch (_) {
      this.droppedSamples += 1;
    }
  }

  finish(reason: 'completed' | 'interrupted' | 'unmounted'): void {
    const request = this.request;
    if (request === undefined) return;
    const frames = this.frames;
    const droppedSamples = this.droppedSamples;
    const last = frames.length > 0 ? frames[frames.length - 1] : undefined;
    const endReason = reason === 'completed' && last?.phase !== 'endpoint' ? 'endpoint-unavailable' : reason;
    this.request = undefined;
    this.frames = [];
    this.nextIndex = 0;
    this.droppedSamples = 0;
    if (!ReaderUIVerificationProbe.enabled()) return;
    // One frame per motion block bounds memory and allows the host to hash and
    // look up a specific raw observation. The transport further chunks by bytes.
    const blockCount = Math.max(frames.length, 1);
    for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
      const frame = frames[blockIndex];
      ReaderUIVerificationProbe.emit('reading.control-motion', 'motion', {
        readingId: request.readingId,
        transitionId: request.transitionId,
        direction: request.direction,
        epoch: request.accepted.epoch,
        blockIndex: blockIndex,
        blockCount: blockCount,
        frameStart: frame?.index ?? -1,
        frameEnd: frame?.index ?? -1,
        droppedSamples: droppedSamples,
        endReason: endReason,
        frames: frame === undefined ? [] : [frame],
      });
    }
  }
}
