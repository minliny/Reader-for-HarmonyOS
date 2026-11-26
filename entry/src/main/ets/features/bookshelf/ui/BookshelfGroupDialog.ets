import { FrameCallback } from '@kit.ArkUI';
import { BookshelfGroupPresentation } from '../presentation/BookshelfGroupPresentation';
import { BookshelfGroupSelector } from './BookshelfGroupSelector';
import { ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import { ReaderDialogViewport } from '../../../ui/surfaces/ReaderDialogViewport';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { ReaderInsetsVp, ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerOverlayViewport } from '../../../ui/layout/ReaderOverlayGeometry';

class BookshelfGroupFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

@Component
export struct BookshelfGroupDialog {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @StorageLink('readerAppForeground') private foreground: boolean = true;
  @StorageLink('readerReduceMotion') private appReduceMotion: boolean = false;
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @ObjectLink presentation: BookshelfGroupPresentation;
  @Prop recoveryTop: number = 0;
  isInputAllowed: (() => boolean) | undefined = undefined;

  build() {
    if (this.presentation.identity.length > 0) {
      ForEach([this.presentation.identity], (identity: string): void => {
        this.surface(identity);
      }, (identity: string): string => identity);
    }
  }

  @Builder
  private surface(identity: string) {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.appThemeScheme,
          readerAppColor('app.scrim.modal', this.appThemeScheme)))
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
        .accessibilityLevel('no')
        .onClick((): void => { if (this.groupInputIsCurrent(identity)) this.presentation.dismiss(identity); });
      ReaderDialogViewport({
        onScrollAppeared: (): void => this.requestFocusAfterFrame((): boolean => this.presentation.identity === identity,
          this.selectorFocusKey(identity), this.focusScopeKey(identity)),
        content: (widthVp: number, _heightVp: number): void => {
          ReaderDialogSurface({ specId: 'shelf-group', containerWidthVp: widthVp, title: '编辑分组',
            actions: [], showCloseButton: true,
            onClose: (): void => { if (this.groupInputIsCurrent(identity)) this.presentation.dismiss(identity); },
            body: (): void => { this.selector(identity); } })
            .transition(this.cardTransition());
        },
      });
      Column() {
        if (this.presentation.snapshot.receipt !== undefined) {
          ForEach([this.presentation.snapshot.receipt.facts.generation], (expected: number): void => {
            this.recovery(identity, expected);
          }, (expected: number): string => expected.toString());
        }
      }.width(this.recoveryViewport().width)
        .position({ x: this.recoveryViewport().left, y: this.recoveryInsetTop() })
        .zIndex(1).hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%')
      .hitTestBehavior(this.presentation.identity === identity ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.presentation.identity === identity ? 'auto' : 'no-hide-descendants')
      .transition(this.surfaceTransition())
      .id(this.focusScopeKey(identity)).focusable(true).focusScopeId(this.focusScopeKey(identity), true, false)
      .onDisAppear(this.restoreFocusAction(identity));
  }

  private modalAnimation(entering: boolean): AnimateParam {
    return { duration: entering ? 220 : 180, curve: readerMotionStandardCurve() };
  }

  private surfaceTransition(): TransitionEffect {
    if (this.appReduceMotion) return TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam());
    return TransitionEffect.asymmetric(
      TransitionEffect.OPACITY.animation(this.modalAnimation(true)),
      TransitionEffect.OPACITY.animation(this.modalAnimation(false)));
  }

  private cardTransition(): TransitionEffect {
    if (this.appReduceMotion) return TransitionEffect.IDENTITY;
    return TransitionEffect.asymmetric(
      TransitionEffect.scale({ x: 0.95, y: 0.95 }).combine(TransitionEffect.translate({ y: 8 }))
        .animation(this.modalAnimation(true)),
      TransitionEffect.scale({ x: 0.95, y: 0.95 }).animation(this.modalAnimation(false)));
  }

  private recoveryInsetTop(): number {
    return Math.max(this.recoveryTop, this.recoveryViewport().top) + 12;
  }

  private recoveryViewport(): ReaderRectVp {
    this.metricsRevision;
    return readerOverlayViewport(readerWindowMetrics(), undefined, new ReaderInsetsVp(16, 0, 16, 12));
  }

  private recoveryAvailableHeight(): number {
    const viewport = this.recoveryViewport();
    return Math.max(0, viewport.top + viewport.height - this.recoveryInsetTop());
  }

  @Builder
  private selector(identity: string) {
    BookshelfGroupSelector({
      selectedGroup: this.presentation.currentGroup(),
      groups: this.presentation.snapshot.data.groups,
      busy: this.presentation.assigning || this.presentation.snapshot.busy || this.presentation.snapshot.mutationBlocked === true,
      focusId: this.selectorFocusKey(identity),
      onSelect: (group: string): void => {
        if (this.groupInputIsCurrent(identity)) void this.presentation.assignGroup(identity, group);
      },
    });
  }

  private groupInputIsCurrent(identity: string): boolean {
    return this.foreground && identity.length > 0 && this.presentation.identity === identity &&
      (this.isInputAllowed?.() ?? true);
  }

  private focusScopeKey(identity: string): string { return `reader-shelf-group:${identity}`; }

  private selectorFocusKey(identity: string): string { return `${this.focusScopeKey(identity)}:default`; }

  private restoreFocusAction(identity: string): () => void {
    const restore = this.presentation.captureFocusReturn(identity);
    return (): void => {
      if (restore !== undefined) {
        this.requestFocusAfterFrame(restore.isCurrent, restore.target ?? '', 'reader-bookshelf-search-entry');
      }
    };
  }

  private requestFocusAfterFrame(current: () => boolean, preferred: string, fallback: string): void {
    try {
      this.getUIContext().postFrameCallback(new BookshelfGroupFocusFrame((): void => {
        if (!this.foreground || !current()) return;
        const focus = this.getUIContext().getFocusController();
        if (preferred.length > 0) {
          try { focus.requestFocus(preferred); return; } catch (_unavailableTarget) {}
        }
        try { focus.requestFocus(fallback); } catch (_unavailableFallback) {}
      }));
    } catch (_detached) {}
  }

  @Builder
  private recovery(identity: string, expected: number) {
    ReaderRecoveryNotice({
      maxHeightVp: this.recoveryAvailableHeight(),
      view: this.presentation.recovery(expected), tag: '分组', actionLabel: '核对分组',
      busy: this.presentation.snapshot.busy,
      secondaryActionLabel: this.presentation.canContinue(expected) ? '继续原分组操作' : '',
      onReconcile: (_expected: number): void => {
        if (this.groupInputIsCurrent(identity)) this.presentation.reconcile(identity, expected);
      },
      onSecondaryAction: (_expected: number): void => {
        if (this.groupInputIsCurrent(identity)) this.presentation.reconcile(identity, expected, true);
      },
    });
  }
}
