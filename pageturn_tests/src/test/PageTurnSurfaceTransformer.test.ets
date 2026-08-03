import { describe, it, expect } from '@ohos/hypium';
import { PageTurnSurfaceTransformer, PageTurnLayerTransform } from 'pageturn';
import { PageTurnModeId } from 'pageturn';

// ArkTS forbids nested functions; float comparison lives at module scope.
function assertClose(actual: number, expected: number, tol: number): void {
  const diff = actual - expected;
  const abs = diff < 0 ? -diff : diff;
  expect(abs <= tol).assertTrue();
}

function layerOf(transforms: PageTurnLayerTransform[], role: string): PageTurnLayerTransform {
  for (let i = 0; i < transforms.length; i++) {
    if (transforms[i].role === role) return transforms[i];
  }
  // ArkTS requires a return on all paths; return a zeroed transform if the
  // role is absent (tests will then fail the subsequent assertion).
  return { role: role, page: '', stackOrder: -1, translationXMultiplier: 0, instantSwap: false };
}

export default function PageTurnSurfaceTransformerTests(): void {
  describe('PageTurnSurfaceTransformer', () => {
    it('coverLayerWaypointsMatchContractExactly', 0, () => {
      // cover.layers[].translationX:
      //   outgoing(current):  progress [0,0.2,1] -> multipliers [0,0,-1]
      //   incoming(adjacent): progress [0,0.2,1] -> multipliers [0,1,0]
      const at0 = PageTurnSurfaceTransformer.transformsFor('cover', 0);
      const at02 = PageTurnSurfaceTransformer.transformsFor('cover', 0.2);
      const at1 = PageTurnSurfaceTransformer.transformsFor('cover', 1);
      expect(at0.length).assertEqual(2);
      // stackOrder: incoming(0) below outgoing(1).
      expect(layerOf(at0, 'outgoing').stackOrder).assertEqual(1);
      expect(layerOf(at0, 'incoming').stackOrder).assertEqual(0);
      // progress 0: both at rest.
      expect(layerOf(at0, 'outgoing').translationXMultiplier).assertEqual(0);
      expect(layerOf(at0, 'incoming').translationXMultiplier).assertEqual(0);
      // progress 0.2: outgoing still 0, incoming fully offset by 1 surface.
      expect(layerOf(at02, 'outgoing').translationXMultiplier).assertEqual(0);
      expect(layerOf(at02, 'incoming').translationXMultiplier).assertEqual(1);
      // progress 1: outgoing fully left (-1), incoming at rest (0) covering.
      expect(layerOf(at1, 'outgoing').translationXMultiplier).assertEqual(-1);
      expect(layerOf(at1, 'incoming').translationXMultiplier).assertEqual(0);
      // cover is a two-live-page-surface, not an instant swap.
      expect(layerOf(at0, 'outgoing').instantSwap).assertFalse();
    });

    it('coverInterpolatesLinearlyBetweenWaypoints', 0, () => {
      // At progress 0.1 (mid first segment [0,0.2]): outgoing stays 0
      // (both waypoints 0), incoming lerps 0->1 at t=0.5 => 0.5.
      const at = PageTurnSurfaceTransformer.transformsFor('cover', 0.1);
      expect(layerOf(at, 'outgoing').translationXMultiplier).assertEqual(0);
      assertClose(layerOf(at, 'incoming').translationXMultiplier, 0.5, 1e-9);
      // At progress 0.6 (mid second segment [0.2,1]): outgoing lerps 0->-1 at
      // t=0.5 => -0.5; incoming lerps 1->0 at t=0.5 => 0.5.
      const at06 = PageTurnSurfaceTransformer.transformsFor('cover', 0.6);
      assertClose(layerOf(at06, 'outgoing').translationXMultiplier, -0.5, 1e-9);
      assertClose(layerOf(at06, 'incoming').translationXMultiplier, 0.5, 1e-9);
    });

    it('slideUsesNormalizedOverlapMultipliersFromContract', 0, () => {
      // slide.layers[].translationX:
      //   outgoing(current):  progress [0,1] -> [0, -0.9948717948717949]
      //   incoming(adjacent): progress [0,1] -> [0.9948717948717949, 0]
      // The 388/390 normalization keeps the two live pages joined with the
      // contracted overlap (no host blank gap).
      const norm = 0.9948717948717949;
      const at0 = PageTurnSurfaceTransformer.transformsFor('slide', 0);
      const at1 = PageTurnSurfaceTransformer.transformsFor('slide', 1);
      const at05 = PageTurnSurfaceTransformer.transformsFor('slide', 0.5);
      expect(layerOf(at0, 'outgoing').translationXMultiplier).assertEqual(0);
      assertClose(layerOf(at0, 'incoming').translationXMultiplier, norm, 1e-9);
      assertClose(layerOf(at1, 'outgoing').translationXMultiplier, -norm, 1e-9);
      expect(layerOf(at1, 'incoming').translationXMultiplier).assertEqual(0);
      assertClose(layerOf(at05, 'outgoing').translationXMultiplier, -norm / 2, 1e-9);
      assertClose(layerOf(at05, 'incoming').translationXMultiplier, norm / 2, 1e-9);
    });

    it('noneIsInstantSwapWithZeroTranslation', 0, () => {
      // none.layers[].transformDriver="instant-swap"; translationX undefined.
      // The renderer swaps page buffers; no translation is applied.
      const at = PageTurnSurfaceTransformer.transformsFor('none', 0.5);
      expect(at.length).assertEqual(2);
      expect(layerOf(at, 'outgoing').instantSwap).assertTrue();
      expect(layerOf(at, 'incoming').instantSwap).assertTrue();
      expect(layerOf(at, 'outgoing').translationXMultiplier).assertEqual(0);
      expect(layerOf(at, 'incoming').translationXMultiplier).assertEqual(0);
    });

    it('simulationLayersAreReal3dNoTwoDTranslation', 0, () => {
      // simulation.layers use transformDriver "real3d-finger-follow" with
      // translationX undefined; the 3D surface is owned by the real3d
      // provider, not this 2D transformer. Multipliers stay 0 so nothing here
      // can masquerade as a 2D rotation/slide fallback.
      const at = PageTurnSurfaceTransformer.transformsFor('simulation', 0.5);
      expect(at.length).assertEqual(3);
      expect(layerOf(at, 'outgoingFront').translationXMultiplier).assertEqual(0);
      expect(layerOf(at, 'outgoingBack').translationXMultiplier).assertEqual(0);
      expect(layerOf(at, 'incomingUnderlay').translationXMultiplier).assertEqual(0);
      expect(layerOf(at, 'outgoingFront').instantSwap).assertFalse();
    });

    it('progressIsClampedToZeroOne', 0, () => {
      const below = PageTurnSurfaceTransformer.transformsFor('cover', -0.5);
      const above = PageTurnSurfaceTransformer.transformsFor('cover', 2);
      const at0 = PageTurnSurfaceTransformer.transformsFor('cover', 0);
      const at1 = PageTurnSurfaceTransformer.transformsFor('cover', 1);
      expect(layerOf(below, 'outgoing').translationXMultiplier)
        .assertEqual(layerOf(at0, 'outgoing').translationXMultiplier);
      expect(layerOf(below, 'incoming').translationXMultiplier)
        .assertEqual(layerOf(at0, 'incoming').translationXMultiplier);
      expect(layerOf(above, 'outgoing').translationXMultiplier)
        .assertEqual(layerOf(at1, 'outgoing').translationXMultiplier);
      expect(layerOf(above, 'incoming').translationXMultiplier)
        .assertEqual(layerOf(at1, 'incoming').translationXMultiplier);
    });
  });
}
