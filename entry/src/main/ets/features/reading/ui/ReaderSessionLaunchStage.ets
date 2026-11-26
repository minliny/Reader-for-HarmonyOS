import { PathShape } from '@ohos.arkui.shape';
import { ReaderControlMotionPathCache, readerControlMotionClipPath } from './ReaderControlMotionPresentation';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerPressPointer } from '../../../ui/foundation/ReaderPressMotion';
import { READER_SESSION_CAPSULE_RADIUS, ReaderSessionCapsuleFrame, ReaderSessionCapsuleLeading, ReaderSessionCapsulePause,
  readerSessionCapsuleAccessibility, ReaderSessionCapsuleMetricsCache, type ReaderSessionCapsuleMetrics } from './ReaderSessionCapsule';
import type { ReaderSessionCapsuleState } from './ReaderSessionCapsuleModel';
import type { ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';
import { READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT } from './ReaderPageChromeLayout';

/**
 * Persistent launch and playback actors. Parent owns positioning, lifecycle and clock.
 * Builders contain visual source CONTENT only: no source surface, interaction,
 * onAppear work, measurements, Core reads or capture requests. They can render
 * a ready, revision-validated PixelMap; they must never wait for one to exist.
 */
@Component
export struct ReaderSessionLaunchStage {
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop sample: ReaderSessionLaunchSample;
  @Prop sessionState: ReaderSessionCapsuleState = 'preparing';
  @Prop desiredPlaying: boolean = true;
  @Prop countdown: number = 8;
  @Prop interactionEnabled: boolean = true;
  @Prop fontScale: number = 1;
  @Prop surfaceColor: string = '';
  @Prop surfaceBorderColor: string = '';
  @Prop sourceSurfaceColor: string = '';
  @Prop sourceSurfaceTopInset: number = 0;
  @Prop sourceHighlightColor: string = '#00000000';
  @Prop sourceGradientStart: string = '';
  @Prop sourceGradientEnd: string = '';
  @Prop sourceBorderColor: string = '';
  @Prop sourceBorderWidth: number = 1;
  @Prop sourceShadowColor: string = '';
  @Prop sourceShadowRadius: number = 0;
  @Prop sourceShadowOffsetY: number = 5;
  @Prop textColor: string = '';
  @Prop primaryColor: string = '';
  @Prop onPrimaryColor: string = '';
  @Prop themeScheme: string = 'day';
  @Prop shadowColor: string = '';
  @BuilderParam sourceSharpContent: () => void;
  onToggle: () => void = (): void => {};
  @State private pressPointer: number = -1;
  private readonly metricsCache: ReaderSessionCapsuleMetricsCache = new ReaderSessionCapsuleMetricsCache();

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
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Stack({ alignContent: Alignment.TopStart }) {
      // MorphSurface · canonical capsule shell.
      Row() {}
        .id('reader-session-launch-surface')
        .width('100%').height('100%')
        .attributeModifier(new ReaderSessionCapsuleFrame(this.themeScheme, this.surfaceColor, this.surfaceBorderColor, this.shadowColor,
          this.paintDensity(), this.interactionEnabled && this.sample.pauseOpacity > 0 && this.pressPointer >= 0))
        .opacity(this.sample.canonicalSurfaceOpacity).hitTestBehavior(HitTestMode.None);

      // SourceRegion owns its surface; the single content actor retains uniform scale.
      Stack({ alignContent: Alignment.TopStart }) {
        Row().width('100%').height(Math.max(0, this.sample.proxyHeight - this.sourceSurfaceTopInset * (1 - this.sample.flight)))
          .position({ x: 0, y: this.sourceSurfaceTopInset * (1 - this.sample.flight) })
          .linearGradient({ angle: 155, colors: [[this.sourceGradientStart.length > 0 ? this.sourceGradientStart : this.effectiveSourceSurfaceColor(), 0],
            [this.sourceGradientEnd.length > 0 ? this.sourceGradientEnd : this.effectiveSourceSurfaceColor(), 1]] })
          .border({ width: this.sourceBorderWidth, color: this.effectiveSourceBorderColor() }).borderRadius(this.sample.sourceRadius)
          .shadow({ radius: this.sourceShadowRadius * this.paintDensity(), offsetX: 0,
            offsetY: this.sourceShadowOffsetY * this.paintDensity(), color: this.sourceShadowColor.length > 0 ?
              this.sourceShadowColor : readerAppColor('app.shadow.menu', this.themeScheme) })
          .hitTestBehavior(HitTestMode.None);
        Row().width('100%').height(1).backgroundColor(this.sourceHighlightColor)
          .position({ x: 0, y: this.sourceSurfaceTopInset * (1 - this.sample.flight) }).hitTestBehavior(HitTestMode.None);
        if (this.sample.sourceNeeded) {
          Stack({ alignContent: Alignment.TopStart }) { this.sourceSharpContent(); }
            .id('reader-session-launch-sharp')
            .width(this.sample.sourceWidth).height(this.sample.sourceHeight)
            .position({ x: this.sample.sourceContentBaseOffset, y: this.sample.sourceContentBaseOffset })
            .scale({ x: this.sample.sourceContentScale, y: this.sample.sourceContentScale, centerX: '50%', centerY: '50%' })
            .translate({ x: this.sample.sourceContentTranslateX, y: this.sample.sourceContentTranslateY })
            .opacity(this.sample.sharpOpacity).hitTestBehavior(HitTestMode.None);
        }
      }
      .id('reader-session-launch-source')
      .width('100%').height('100%')
      .clipShape(this.sourceClip()).opacity(this.sample.sourceSurfaceOpacity).hitTestBehavior(HitTestMode.None);

      // CapsuleContent reveal clip and CapsuleTransitionContent leading row.
      Stack({ alignContent: Alignment.TopStart }) {
        ReaderSessionCapsuleLeading({ type: this.sample.type, countdown: this.countdown,
          textColor: this.effectiveTextColor(), primaryColor: this.effectivePrimaryColor(),
          onPrimaryColor: this.effectiveOnPrimaryColor(), themeScheme: this.themeScheme, capsuleWidth: this.sample.capsuleWidth,
          capsuleHeight: this.sample.capsuleHeight, labelWidth: this.metrics().labelWidth,
          labelHeight: this.metrics().labelHeight, countdownSize: this.metrics().countdownSize })
          .translate({ x: this.sample.leadingOffsetX }).opacity(this.sample.leadingOpacity);
      }.id('reader-session-launch-leading').width('100%').height('100%').borderRadius(READER_SESSION_CAPSULE_RADIUS).clip(true).hitTestBehavior(HitTestMode.None);

      // The pause control keeps its own position throughout the reveal.
      ReaderSessionCapsulePause({ sessionState: this.sessionState, themeScheme: this.themeScheme, desiredPlaying: this.desiredPlaying,
        primaryColor: this.effectivePrimaryColor(), onPrimaryColor: this.effectiveOnPrimaryColor() })
        .position({ x: this.sample.pauseX, y: (this.sample.proxyHeight - 16) / 2 }).opacity(this.sample.pauseOpacity);
    }
    .id('reader-session-launch-proxy')
    .width(this.sample.proxyWidth).height(this.sample.proxyHeight)
    .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    }
    .id('reader-session-launch-toggle')
    .padding(0).borderRadius(0).backgroundColor(Color.Transparent)
    .width(Math.max(44, this.sample.proxyWidth))
    .height(Math.max(READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT, this.sample.proxyHeight))
    .position({ x: this.sample.proxyLeft - Math.max(0, 44 - this.sample.proxyWidth) / 2,
      y: this.sample.proxyTop - Math.max(0, READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT - this.sample.proxyHeight) / 2 })
    .hitTestBehavior(this.interactionEnabled && this.sample.pauseOpacity > 0 ? HitTestMode.Block : HitTestMode.None)
    .enabled(this.interactionEnabled && this.sample.pauseOpacity > 0)
    .accessibilityText(readerSessionCapsuleAccessibility(this.sample.type, this.sessionState, this.desiredPlaying))
    // Transparent overlay ancestors also admit the page's raw touch owner.
    // Consume the whole pointer stream here; the click recognizer still runs.
    .onTouch((event: TouchEvent): void => {
      event.stopPropagation();
      const pointer = readerPressPointer(event, this.pressPointer, this.interactionEnabled && this.sample.pauseOpacity > 0);
      if (pointer !== this.pressPointer) this.pressPointer = pointer;
    })
    .onClick((): void => {
      if (this.interactionEnabled && this.sample.pauseOpacity > 0) this.onToggle();
    });
  }

  private metrics(): ReaderSessionCapsuleMetrics {
    return this.metricsCache.resolve(this.getUIContext(), this.sample.type, this.fontScale, this.metricsRevision);
  }

  private paintDensity(): number {
    return this.metricsRevision < 0 ? 1 : readerWindowMetrics().densityPixels;
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
