// TokenCoverage.test — asserts the codegen token registry is complete and resolvable.
import { describe, it, expect } from '@ohos/hypium';
import { TokenRegistry } from '../main/ets/contract/generated/TokenRegistry';
import { ColorTokens } from '../main/ets/contract/generated/ColorTokens';
import { SpacingTokens, SizeTokens, RadiusTokens, ZIndexTokens } from '../main/ets/contract/generated/DimensionTokens';
import { MotionDurationTokens } from '../main/ets/contract/generated/MotionTokens';

export default function TokenCoverageTests(): void {
  describe('TokenCoverage', () => {
    it('registryHasAllTokens', 0, () => {
      expect(TokenRegistry.ALL.length > 100).assertTrue();
    });
    it('has16ColorTokens', 0, () => {
      expect(TokenRegistry.byCategory('color').length).assertEqual(16);
    });
    it('paperTokenResolves', 0, () => {
      expect(TokenRegistry.byName('--reader-ds-color-paper') !== undefined).assertTrue();
    });
    it('colorTokensAreArgb8', 0, () => {
      expect(ColorTokens.paper.startsWith('#FF')).assertTrue();
      expect(ColorTokens.ink.startsWith('#FF')).assertTrue();
    });
    it('spacingTokensMatchContract', 0, () => {
      expect(SpacingTokens.md).assertEqual(16);
      expect(SpacingTokens.lg).assertEqual(24);
      expect(SpacingTokens.xl).assertEqual(48);
    });
    it('sizeTokensMatchContract', 0, () => {
      expect(SizeTokens.topBarHeight).assertEqual(58);
      expect(SizeTokens.bottomBarHeight).assertEqual(68);
      expect(SizeTokens.readerModuleNavHeight).assertEqual(82);
    });
    it('radiusTokensMatchContract', 0, () => {
      expect(RadiusTokens.card).assertEqual(4);
      expect(RadiusTokens.control).assertEqual(999);
    });
    it('zIndexOrdered', 0, () => {
      expect(ZIndexTokens.overlay > ZIndexTokens.content).assertTrue();
      expect(ZIndexTokens.dialog > ZIndexTokens.mainNav).assertTrue();
    });
    it('motionDurationTokensMatchContract', 0, () => {
      expect(MotionDurationTokens.firstOpen).assertEqual(280);
      expect(MotionDurationTokens.tabSwitch).assertEqual(160);
    });
  });
}
