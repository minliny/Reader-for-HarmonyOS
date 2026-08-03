// PageTurnSurfaceTransformer - the pure host-private mapping from a page-turn
// gesture progress to per-layer translation offsets, driven ONLY by the synced
// PageTurn v2 contract.
//
// cover/slide/none are forbidden from declaring a capability
// (capabilityRegistration.capabilities admits only real3d + scroll), so they
// have no lease provider. Their "provider" is a mode renderer: a two-live-page
// surface for cover/slide and an instant swap for none. This transformer is
// the trajectory core of that renderer - given the active mode and a gesture
// progress in [0,1], it returns each layer's translationX multiplier by
// interpolating the contract's translationX.progress /
// surfaceWidthMultipliers waypoints.
//
// This file adds NO trajectory/easing/duration values. Every waypoint and
// multiplier comes from PageTurnContract.runtimeModeFor(modeId).layers. The
// renderer multiplies the returned multiplier by the live measured surface
// width to get pixels. Surface shape stays rectangular
// (shared.surface.shape="rectangular", roundingOwner="device-mask-only") -
// the transformer never rounds a page.
import { PageTurnContract, PageTurnModeId } from './PageTurnContract';
import { MotionPageTurnRuntimeLayer } from './contract/Motion';

export interface PageTurnLayerTransform {
  // role/page/stackOrder are echoed from the contract layer so the renderer
  // can stack surfaces in the contract's order without re-reading the
  // contract.
  role: string;
  page: string;
  stackOrder: number;
  // Multiply by the live measured surface width to get the translationX in
  // logical pixels. Negative = left, positive = right.
  translationXMultiplier: number;
  // True when the layer is at its "instant-swap" driver (none mode); the
  // renderer swaps page buffers instead of translating.
  instantSwap: boolean;
}

export class PageTurnSurfaceTransformer {
  // Returns the per-layer translationX multipliers at the given gesture
  // progress. progress is clamped to [0,1]. For layers whose transformDriver
  // is "instant-swap" (none) or whose translationX is undefined (real3d
  // layers, whose 3D surface is owned by the real3d provider), the multiplier
  // is 0 and instantSwap is set for instant-swap drivers.
  static transformsFor(modeId: PageTurnModeId, progress: number): PageTurnLayerTransform[] {
    const mode = PageTurnContract.runtimeModeFor(modeId);
    if (mode === undefined) return [];
    const clamped = progress < 0 ? 0 : (progress > 1 ? 1 : progress);
    const out: PageTurnLayerTransform[] = [];
    for (let i = 0; i < mode.layers.length; i++) {
      const layer: MotionPageTurnRuntimeLayer = mode.layers[i];
      const track = layer.translationX;
      const instantSwap = layer.transformDriver === 'instant-swap';
      const multiplier = track === undefined
        ? 0
        : PageTurnSurfaceTransformer.interpolate(track.progress, track.surfaceWidthMultipliers, clamped);
      out.push({
        role: layer.role,
        page: layer.page,
        stackOrder: layer.stackOrder,
        translationXMultiplier: multiplier,
        instantSwap: instantSwap,
      });
    }
    return out;
  }

  // Linear interpolation between the contract's waypoints. The contract
  // carries progress[] (ascending) and surfaceWidthMultipliers[] (one per
  // waypoint). During a drag, progress is the gesture's clamped progress; the
  // settle phase (after release) drives progress to its target via the
  // resolver using the mode's settle easing - this transformer stays pure and
  // never invents an easing curve.
  private static interpolate(progresses: number[], multipliers: number[],
    progress: number): number {
    if (progresses.length === 0 || multipliers.length === 0) return 0;
    if (progresses.length === 1) return multipliers[0];
    if (progress <= progresses[0]) return multipliers[0];
    if (progress >= progresses[progresses.length - 1]) {
      return multipliers[multipliers.length - 1];
    }
    for (let i = 0; i < progresses.length - 1; i++) {
      const lo = progresses[i];
      const hi = progresses[i + 1];
      if (progress >= lo && progress <= hi) {
        const span = hi - lo;
        const t = span <= 0 ? 0 : (progress - lo) / span;
        return multipliers[i] + (multipliers[i + 1] - multipliers[i]) * t;
      }
    }
    return multipliers[multipliers.length - 1];
  }
}
