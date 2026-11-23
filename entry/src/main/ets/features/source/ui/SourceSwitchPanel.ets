import type { SourceSwitchPresentation } from '../presentation/SourceSwitchPresentation';
import { motionAnimateParam } from '../../../ui/foundation/MotionSpec';
import { resolveDrawerSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import type { SourceSwitchCandidate } from '../application/SourceSwitchGateway';
import type { SourceSwitchPanelState } from '../presentation/SourceSwitchPresentationState';
import { SourceSwitchWindow } from './SourceSwitchWindow';
import { FrameCallback } from '@kit.ArkUI';

class SourceSwitchSurfaceFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/** Shared modal carrier for the detail and retained reader source picker. */
@Component
export struct SourceSwitchPanel {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private appForeground: boolean = true;
  @Prop @Watch('surfaceChanged') scopeId: number = 0;
  @Prop @Watch('surfaceChanged') showing: boolean = true;
  surface: SourceSwitchPresentation | undefined = undefined;
  @State private attachment: number = 0;
  private attachedScope: number = -1;
  private attachedSurface: SourceSwitchPresentation | undefined = undefined;
  private surfaceRevision: number = 0;
  @Prop state: SourceSwitchPanelState;
  @Prop currentSourceId: string = '';
  @Prop bookTitle: string = '';
  @Prop author: string = '';
  @Prop coverUrl: string = '';
  @Prop currentSourceName: string = '';
  @Prop latestChapterTitle: string = '';
  @Prop currentChapterTitle: string = '';
  @Prop contentKind: string = 'text';
  @Prop @Watch('surfaceChanged') reduceMotion: boolean = false;
  @Prop consumeTopInset: boolean = true;
  @Prop allowCancelWhileSwitching: boolean = false;
  @Prop interactive: boolean = true;
  private mounted: boolean = false;
  onStop: (scopeId: number) => void = (_scopeId: number): void => {};
  onClose: (scopeId: number) => void = (_scopeId: number): void => {};
  onRetry: (scopeId: number) => void = (_scopeId: number): void => {};
  onRefresh: (scopeId: number) => void = (_scopeId: number): void => {};
  onSelectCandidate: (candidate: SourceSwitchCandidate, scopeId: number) => void =
    (_candidate: SourceSwitchCandidate, _scopeId: number): void => {};
  onRollback: (scopeId: number) => void = (_scopeId: number): void => {};

  aboutToAppear(): void { this.mounted = true; this.surfaceChanged(); }
  aboutToDisappear(): void {
    this.mounted = false;
    this.surfaceRevision += 1;
    const surface = this.attachedSurface, attachment = this.attachment, scope = this.attachedScope;
    this.postSurfaceAction((): void => surface?.detachSurface(attachment, scope));
  }
  private surfaceChanged(): void {
    if (!this.mounted || this.surface === undefined) return;
    const revision = ++this.surfaceRevision, surface = this.surface;
    const scope = this.scopeId, showing = this.showing;
    // This child can receive Props while its ObjectLink parent renders. The
    // Presentation publishes surface receipts observed by that parent.
    this.postSurfaceAction((): void => {
      if (!this.mounted || revision !== this.surfaceRevision || surface !== this.surface ||
        scope !== this.scopeId || showing !== this.showing) return;
      this.applySurfaceChanged();
    });
  }
  private postSurfaceAction(action: () => void): void {
    try { this.getUIContext().postFrameCallback(new SourceSwitchSurfaceFrame(action)); }
    catch (_) { setTimeout(action, 0); }
  }
  private applySurfaceChanged(): void {
    const surface = this.surface;
    if (surface === undefined) return;
    if (this.showing) {
      if (surface !== this.attachedSurface || surface.surfaceClosing || !surface.surfaceIsCurrent(this.attachment, this.scopeId)) {
        this.attachedSurface?.detachSurface(this.attachment, this.attachedScope);
        this.attachedScope = this.scopeId;
        this.attachedSurface = surface;
        this.attachment = surface.attachSurface(this.scopeId);
      }
    } else this.attachedSurface?.hideSurface(this.attachment, this.attachedScope, this.reduceMotion);
  }

  private acceptsInput(): boolean {
    return this.showing && this.interactive && this.appForeground && (this.surface === undefined ||
      this.surface === this.attachedSurface && this.surface.surfaceIsCurrent(this.attachment, this.scopeId));
  }

  private isCurrent(scopeId: number): boolean {
    return this.mounted && this.acceptsInput() && scopeId === this.scopeId;
  }

  build() {
    ForEach(this.attachment > 0 ? [this.attachment] : [], (attachment: number): void => {
      this.panel(this.scopeId, attachment);
    }, (attachment: number): string => attachment.toString());
  }

  @Builder
  private panel(scopeId: number, attachment: number) {
    Stack({ alignContent: Alignment.Bottom }) {
      if (this.showing) {
      Stack()
        .width('100%')
        .height('100%')
        .backgroundColor(readerAppColor(resolveDrawerSpec('source-switch-drawer').scrimRole, this.appThemeScheme))
        .transition(this.reduceMotion ? TransitionEffect.IDENTITY : TransitionEffect.asymmetric(
          TransitionEffect.OPACITY.animation(motionAnimateParam('source.switch.open')),
          TransitionEffect.OPACITY.animation(motionAnimateParam('source.switch.close'))),
          (transitionIn: boolean): void => this.surface?.surfaceTransitionFinished(attachment, scopeId, 'scrim', transitionIn))
        .onAppear((): void => this.surface?.surfacePartAppeared(attachment, scopeId, 'scrim'))
        .onClick((): void => { if (this.isCurrent(scopeId)) this.onClose(scopeId); });
      }
      SourceSwitchWindow({
        showing: this.showing, surface: this.surface, surfaceAttachment: attachment, surfaceScope: scopeId,
        state: this.state,
        currentSourceId: this.currentSourceId,
        bookTitle: this.bookTitle, author: this.author, coverUrl: this.coverUrl,
        currentSourceName: this.currentSourceName, latestChapterTitle: this.latestChapterTitle,
        currentChapterTitle: this.currentChapterTitle,
        contentKind: this.contentKind,
        allowCancelWhileSwitching: this.allowCancelWhileSwitching,
        reduceMotion: this.reduceMotion, consumeTopInset: this.consumeTopInset,
        onStop: (): void => { if (this.isCurrent(scopeId)) this.onStop(scopeId); },
        onClose: (): void => { if (this.isCurrent(scopeId)) this.onClose(scopeId); },
        onRetry: (): void => { if (this.isCurrent(scopeId)) this.onRetry(scopeId); },
        onRefresh: (): void => { if (this.isCurrent(scopeId)) this.onRefresh(scopeId); },
        onSelectCandidate: (candidate: SourceSwitchCandidate): void => {
          if (this.isCurrent(scopeId)) this.onSelectCandidate(candidate, scopeId);
        },
        onRollback: (): void => { if (this.isCurrent(scopeId)) this.onRollback(scopeId); },
      });
    }.width('100%').height('100%')
      .focusScopeId(`reader-source-scope:${scopeId}:${attachment}`, true, false)
      .enabled(this.acceptsInput())
      .accessibilityLevel(this.acceptsInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.acceptsInput() ? HitTestMode.Default : HitTestMode.None);
  }
}
