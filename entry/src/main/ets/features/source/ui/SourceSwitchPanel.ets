import type { SourceSwitchPresentation } from '../presentation/SourceSwitchPresentation';
import { motionAnimateParam } from '../../../ui/foundation/MotionSpec';
import { resolveDrawerSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import type { SourceSwitchCandidate } from '../application/SourceSwitchGateway';
import type { SourceSwitchPanelState } from '../presentation/SourceSwitchPresentationState';
import { SourceSwitchWindow } from './SourceSwitchWindow';

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
    this.surface?.detachSurface(this.attachment, this.attachedScope);
  }
  private surfaceChanged(): void {
    if (!this.mounted || this.surface === undefined) return;
    if (this.showing) {
      if (this.surface.surfaceClosing || !this.surface.surfaceIsCurrent(this.attachment, this.scopeId)) {
        this.surface.detachSurface(this.attachment, this.attachedScope);
        this.attachedScope = this.scopeId;
        this.attachment = this.surface.attachSurface(this.scopeId);
      }
    } else this.surface.hideSurface(this.attachment, this.attachedScope, this.reduceMotion);
  }

  private acceptsInput(): boolean { return this.showing && this.interactive && this.appForeground; }

  private isCurrent(scopeId: number): boolean {
    return this.mounted && this.acceptsInput() && scopeId === this.scopeId;
  }

  build() {
    ForEach([this.attachment], (attachment: number): void => {
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
