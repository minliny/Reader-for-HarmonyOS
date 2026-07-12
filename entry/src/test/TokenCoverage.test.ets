// TokenCoverage.test — asserts the codegen token registry is complete and resolvable.
import { describe, it, expect } from '@ohos/hypium';
import { TokenRegistry } from '../main/ets/contract/generated/TokenRegistry';
import { ColorTokens } from '../main/ets/contract/generated/ColorTokens';
import { SpacingTokens, SizeTokens, RadiusTokens, ZIndexTokens, ElevationTokens } from '../main/ets/contract/generated/DimensionTokens';
import { MotionDurationTokens, MotionEasingTokens } from '../main/ets/contract/generated/MotionTokens';
import { TypeTokens, FontTokens } from '../main/ets/contract/generated/TypeTokens';
import { TextConstraintTokens } from '../main/ets/contract/generated/TextConstraintTokens';
import { ShadowTokens } from '../main/ets/contract/generated/ShadowTokens';

export default function TokenCoverageTests(): void {
  describe('TokenCoverage', () => {
    it('registryHasAllTokens', 0, () => {
      expect(TokenRegistry.ALL.length > 100).assertTrue();
    });
    it('has31ColorTokens', 0, () => {
      expect(TokenRegistry.byCategory('color').length).assertEqual(31);
    });
    it('paperTokenResolves', 0, () => {
      expect(TokenRegistry.byName('--fd-ds-color-paper') !== undefined).assertTrue();
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
    it('fontTokensMatchContract', 0, () => {
      // 5 font tokens generated from platforms.arkts fallback stacks
      expect(FontTokens.sans.length > 0).assertTrue();
      expect(FontTokens.serif.length > 0).assertTrue();
      expect(FontTokens.kai.length > 0).assertTrue();
      expect(FontTokens.fangsong.length > 0).assertTrue();
      expect(FontTokens.mono.length > 0).assertTrue();
      // serif first family is Noto Serif CJK SC (bundled font)
      expect(FontTokens.serif.indexOf('Noto Serif CJK SC') >= 0).assertTrue();
    });
    it('typeTokensMatchContract', 0, () => {
      expect(TypeTokens.topBarTitleSize).assertEqual(16);
      expect(TypeTokens.topBarSubtitleSize).assertEqual(10);
      expect(TypeTokens.actionLabelSize).assertEqual(11);
      expect(TypeTokens.chapterTitleSize).assertEqual(13);
      expect(TypeTokens.readerBodySize).assertEqual(18);
      expect(TypeTokens.appTitleSize).assertEqual(20);
    });
    it('textConstraintTokensMatchContract', 0, () => {
      expect(TextConstraintTokens.readerLineLength).assertEqual('31ch');
      expect(TextConstraintTokens.bookTitleLines).assertEqual(2);
      expect(TextConstraintTokens.navLabelLines).assertEqual(1);
      expect(TextConstraintTokens.titleLines).assertEqual(1);
      expect(TextConstraintTokens.actionLabelLines).assertEqual(1);
    });
    it('elevationTokensMatchContract', 0, () => {
      expect(ElevationTokens.none).assertEqual(0);
      expect(ElevationTokens.subtle).assertEqual(1);
      expect(ElevationTokens.card).assertEqual(2);
      expect(ElevationTokens.overlay).assertEqual(2);
    });
    it('shadowTokensMatchContract', 0, () => {
      // Shadow tokens are CSS box-shadow strings; assert key fragments
      expect(ShadowTokens.elevated.indexOf('18px') >= 0).assertTrue();
      expect(ShadowTokens.soft.indexOf('8px') >= 0).assertTrue();
    });
    it('motionEasingTokensMatchContract', 0, () => {
      expect(MotionEasingTokens.standard).assertEqual('ease');
      expect(MotionEasingTokens.enter).assertEqual('ease-out');
      expect(MotionEasingTokens.exit).assertEqual('ease-in');
      expect(MotionEasingTokens.reshape).assertEqual('ease-in-out');
    });
    it('iconCategoryHas94Tokens', 0, () => {
      // Contract defines 94 icon tokens, each with platforms.arkts $r() ref
      expect(TokenRegistry.byCategory('icon').length).assertEqual(94);
    });
  });
}
