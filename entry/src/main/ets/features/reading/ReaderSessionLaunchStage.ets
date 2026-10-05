import { PathShape } from '@ohos.arkui.shape';
import { ReaderControlMotionPathCache, readerControlMotionClipPath } from './ReaderControlMotionPresentation';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderSessionCapsuleLeading, ReaderSessionCapsulePause,
  readerSessionCapsuleAccessibility } from './ReaderSessionCapsule';
import type { ReaderSessionCapsuleState } from './ReaderSessionCapsuleModel';
import type { ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';

/**
 * Persistent C/D/E/F actors. Parent owns viewport positioning, lifecycle and
 * one clock. Keep this stage mounted through the 2300–3500 hold and afterwards.
 * Builders contain visual source CONTENT only: no source surface, interaction,
 * onAppear work, measurements, Core reads or capture requests. They can render
 * a ready, revision-validated PixelMap; they must never wait for one to exist.
 */
@Component
export struct ReaderSessionLaunchStage {
  @Prop sample: ReaderSessionLaunchSample;
  @Prop sessionState: ReaderSessionCapsuleState = 'preparing';
  @Prop desiredPlaying: boolean = true;
  @Prop countdown: number = 8;
  @Prop interactionEnabled: boolean = true;
  @Prop surfaceColor: string = '';
  @Prop surfaceBorderColor: string = '';
  @Prop sourceSurfaceColor: string = '';
  @Prop sourceSurfaceTopInset: number = 0;
  @Prop sourceHighlightColor: string = '#00000000';
  @Prop sourceGradientStart: string = '';
  @Prop sourceGradientEnd: string = '';
  @Prop sourceBorderColor: string = '';
  @Prop sourceBorderWidth: number = 1;
  @Prop sourceShadowColor: string = '#0D5C4732';
  @Prop sourceShadowRadius: number = 0;
  @Prop sourceShadowOffsetY: number = 5;
  @Prop textColor: string = '';
  @Prop primaryColor: string = '';
  @Prop onPrimaryColor: string = '';
  @Prop themeScheme: string = 'day';
  @Prop shadowColor: string = '#12463423';
  @BuilderParam sourceSharpContent: () => void;
  @BuilderParam sourceBlurContent: () => void;
  onToggle: () => void = (): void => {};

  private sourceClipCache: ReaderControlMotionPathCache<PathShape> = new ReaderControlMotionPathCache<PathShape>(
    (path: string): PathShape => new PathShape().commands(path));

  private sourceClip(): PathShape {
    const s = this.sample;
    const density = this.getUIContext().vp2px(1);
    return this.sourceClipCache.sample('source', [s.proxyWidth, s.proxyHeight, s.sourceClipLeft,
      s.sourceClipTop, s.sourceClipRightInset, s.sourceClipBottomInset, density], (): string =>
      readerControlMotionClipPath([{ x: s.sourceClipLeft, y: s.sourceClipTop,
        width: Math.max(0, s.proxyWidth - s.sourceClipLeft - s.sourceClipRightInset),
        height: Math.max(0, s.proxyHeight - s.sourceClipTop - s.sourceClipBottomInset) }], density));
  }

  build() {
    // TriggerMorphProxy: every child below has a stable identity across phases.
    Stack({ alignContent: Alignment.TopStart }) {
      // MorphSurface · canonical capsule shell.
      Row() {}
        .width('100%').height('100%').backgroundColor(this.effectiveSurfaceColor())
        .border({ width: 1, color: this.effectiveSurfaceBorderColor() }).borderRadius(12)
        .shadow({ radius: 8, color: this.shadowColor, offsetX: 0, offsetY: 3 })
        .opacity(this.sample.canonicalSurfaceOpacity).hitTestBehavior(HitTestMode.None);

      // SourceRegion owns its surface; both content copies retain uniform scale.
      Stack({ alignContent: Alignment.TopStart }) {
        Row().width('100%').height(Math.max(0, this.sample.proxyHeight - this.sourceSurfaceTopInset * (1 - this.sample.flight)))
          .position({ x: 0, y: this.sourceSurfaceTopInset * (1 - this.sample.flight) })
          .linearGradient({ angle: 155, colors: [[this.sourceGradientStart.length > 0 ? this.sourceGradientStart : this.effectiveSourceSurfaceColor(), 0],
            [this.sourceGradientEnd.length > 0 ? this.sourceGradientEnd : this.effectiveSourceSurfaceColor(), 1]] })
          .border({ width: this.sourceBorderWidth, color: this.effectiveSourceBorderColor() }).borderRadius(this.sample.sourceRadius)
          .shadow({ radius: this.sourceShadowRadius, color: this.sourceShadowColor, offsetX: 0, offsetY: this.sourceShadowOffsetY })
          .hitTestBehavior(HitTestMode.None);
        Row().width('100%').height(1).backgroundColor(this.sourceHighlightColor)
          .position({ x: 0, y: this.sourceSurfaceTopInset * (1 - this.sample.flight) }).hitTestBehavior(HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) { this.sourceSharpContent(); }
          .width(this.sample.sourceWidth).height(this.sample.sourceHeight)
          .position({ x: this.sample.sourceContentBaseOffset, y: this.sample.sourceContentBaseOffset })
          .scale({ x: this.sample.sourceContentScale, y: this.sample.sourceContentScale, centerX: '50%', centerY: '50%' })
          .translate({ x: this.sample.sourceContentTranslateX, y: this.sample.sourceContentTranslateY })
          .opacity(this.sample.sharpOpacity).hitTestBehavior(HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) { this.sourceBlurContent(); }
          .width(this.sample.sourceWidth).height(this.sample.sourceHeight)
          .position({ x: this.sample.sourceContentBaseOffset, y: this.sample.sourceContentBaseOffset })
          .scale({ x: this.sample.sourceContentScale, y: this.sample.sourceContentScale, centerX: '50%', centerY: '50%' })
          .translate({ x: this.sample.sourceContentTranslateX, y: this.sample.sourceContentTranslateY })
          .blur(this.sample.blurRadius).opacity(this.sample.blurOpacity).hitTestBehavior(HitTestMode.None);
      }
      .width('100%').height('100%')
      .clipShape(this.sourceClip()).opacity(this.sample.sourceSurfaceOpacity).hitTestBehavior(HitTestMode.None);

      // CapsuleContent reveal clip and CapsuleTransitionContent leading row.
      Stack({ alignContent: Alignment.TopStart }) {
        ReaderSessionCapsuleLeading({ type: this.sample.type, countdown: this.countdown,
          textColor: this.effectiveTextColor(), primaryColor: this.effectivePrimaryColor(),
          onPrimaryColor: this.effectiveOnPrimaryColor(), themeScheme: this.themeScheme, capsuleWidth: this.sample.capsuleWidth })
          .translate({ x: this.sample.leadingOffsetX }).opacity(this.sample.leadingOpacity);
      }.width('100%').height('100%').borderRadius(12).clip(true).hitTestBehavior(HitTestMode.None);

      // CircleState is NOT a descendant of the reveal row: already visible at dot.
      ReaderSessionCapsulePause({ sessionState: this.sessionState, themeScheme: this.themeScheme, desiredPlaying: this.desiredPlaying,
        primaryColor: this.effectivePrimaryColor(), onPrimaryColor: this.effectiveOnPrimaryColor() })
        .position({ x: this.sample.pauseX, y: 4 }).opacity(this.sample.pauseOpacity);
    }
    .width(this.sample.proxyWidth).height(this.sample.proxyHeight)
    .position({ x: this.sample.proxyLeft, y: this.sample.proxyTop })
    .responseRegion({ x: 0, y: -10, width: '100%', height: this.sample.proxyHeight + 20 })
    .hitTestBehavior(this.interactionEnabled && this.sample.pauseOpacity > 0 ? HitTestMode.Block : HitTestMode.None)
    .accessibilityText(readerSessionCapsuleAccessibility(this.sample.type, this.sessionState, this.desiredPlaying))
    .onClick((): void => {
      if (this.interactionEnabled && this.sample.pauseOpacity > 0) this.onToggle();
    });
  }

  private effectiveSurfaceColor(): string {
    return this.surfaceColor.length > 0 ? this.surfaceColor : readerAppColor('TOK_READ_SURFACE', this.themeScheme);
  }

  private effectiveSurfaceBorderColor(): string {
    return this.surfaceBorderColor.length > 0 ? this.surfaceBorderColor : readerAppColor('TOK_LINE', this.themeScheme);
  }

  private effectiveSourceSurfaceColor(): string {
    return this.sourceSurfaceColor.length > 0 ? this.sourceSurfaceColor : readerAppColor('TOK_SURFACE_PANEL', this.themeScheme);
  }

  private effectiveSourceBorderColor(): string {
    return this.sourceBorderColor.length > 0 ? this.sourceBorderColor : readerAppColor('TOK_LINE_STRONG', this.themeScheme);
  }

  private effectiveTextColor(): string {
    return this.textColor.length > 0 ? this.textColor : readerAppColor('TOK_READ_INK', this.themeScheme);
  }

  private effectivePrimaryColor(): string {
    return this.primaryColor.length > 0 ? this.primaryColor : readerAppColor('TOK_READ_PRIMARY', this.themeScheme);
  }

  private effectiveOnPrimaryColor(): string {
    return this.onPrimaryColor.length > 0 ? this.onPrimaryColor : readerAppColor('app.control.onPrimary', this.themeScheme);
  }
}
