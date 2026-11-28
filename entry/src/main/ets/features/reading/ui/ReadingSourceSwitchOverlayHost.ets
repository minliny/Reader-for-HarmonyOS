import type { ReadingPhase } from '../application/ReadingExperienceRenderSnapshots';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { ReadingPageTurnRenderSnapshot } from './ReaderReadingSurfaceHost';
import type { ReadingSurfacePageFragment } from './ReadingSurface';
import type { UIContext } from '@ohos.arkui.UIContext';
import type { AnimatorResult } from '@ohos.animator';
import curves from '@ohos.curves';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { ReaderSourceSwitchReveal } from '../presentation/ReaderSourceSwitchReveal';
import { createReaderSourceSwitchWash } from './ReaderSourceSwitchWash';
import { SOURCE_SWITCH_VISUAL } from '../../source/ui/SourceSwitchVisual';
import type { SourceSwitchCompletionPresentation } from '../../source/presentation/SourceSwitchCompletionPresentation';
import { SourceSwitchCompletionOverlay } from '../../source/ui/SourceSwitchCompletionOverlay';
import type { ReaderAppearanceTheme } from '../application/ReaderAppearanceState';

export interface ReaderSourceSwitchRevealEnvironment {
  readonly completion: () => SourceSwitchCompletionPresentation | undefined;
  readonly lifecycle: () => number;
  readonly selection: () => number;
  readonly mounted: () => boolean;
  readonly revision: (continuous: boolean) => number;
  readonly continuous: () => boolean;
  readonly reducedMotion: () => boolean;
  readonly uiContext: () => UIContext;
  readonly publishOpacity: (opacity: number) => void;
  readonly publishSelection: (selection: number) => void;
  readonly visible: () => boolean;
}

export interface ReaderSourceSwitchReadingScene {
  readonly sourceId: () => string;
  readonly bookId: () => string;
  readonly readyGeneration: () => number;
  readonly candidate: () => ReaderMeasuredPagePublication;
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly phase: () => ReadingPhase;
  readonly exiting: () => boolean;
  readonly foreground: () => boolean;
  readonly showCompletion: () => boolean;
  readonly failureMessage: () => string;
  readonly sessionCurrent: () => boolean;
  readonly awaitingSourceSwitch: () => boolean;
  readonly visualSelection: () => number;
  readonly onContinuousRange: (start: number, end: number, progress: number) => void;
  readonly verifyControl: () => void;
}

/** Owns the native wash actor and feedback lifetime for a single eligible
 * durable completion. Mounted stage and page identities arrive as facts. */
export class ReadingSourceSwitchOverlayHost {
  private readonly reveal: ReaderSourceSwitchReveal = new ReaderSourceSwitchReveal();
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private animator: AnimatorResult | undefined = undefined;
  private readonly environment: ReaderSourceSwitchRevealEnvironment;

  private readonly scene: ReaderSourceSwitchReadingScene;

  constructor(environment: ReaderSourceSwitchRevealEnvironment, scene: ReaderSourceSwitchReadingScene) {
    this.scene = scene;
    this.environment = environment;
  }

  shouldShowPreparation(): boolean {
    const scene = this.scene;
    if (!scene.awaitingSourceSwitch() || !scene.sessionCurrent() || scene.phase() === 'failed' || scene.failureMessage().length > 0) {
      return false;
    }
    return !(scene.phase() === 'ready' && scene.candidate().page !== undefined && scene.projection().visibleFragments.length > 0 &&
      scene.candidate().selection === this.environment.selection());
  }

  observeContinuousRange(revision: number): (start: number, end: number, progress: number) => void {
    return (start: number, end: number, progress: number): void => {
      const scope = this.environment;
      if (revision !== scope.revision(true) || this.scene.candidate().selection !== scope.selection()) return;
      this.scene.onContinuousRange(start, end, progress);
      this.pagePresented(revision, true);
    };
  }

  pagePresented(revision: number, continuous: boolean = false): void {
    const scope = this.environment;
    const scene = this.scene;
    const continuousStage = scope.continuous();
    if (!scope.mounted() || scene.exiting() || scene.phase() !== 'ready' || continuous !== continuousStage ||
      revision !== scope.revision(continuous) || !this.canonicalPageCurrent()) return;
    // Visible view effects require a fresh stage receipt. Core acknowledgement
    // and physical compositor fences remain independent of this reveal.
    this.present(revision, scope.selection(), continuous);
    this.completionChanged();
  }

  completionDisplayCurrent(): boolean {
    const completion = this.environment.completion();
    return completion !== undefined && this.scene.visualSelection() === this.environment.selection() && this.current(completion);
  }

  visibilityChanged(): void {
    if (!this.scene.showCompletion()) this.retire();
    else this.completionChanged();
  }

  completionChanged(): void {
    this.scene.verifyControl();
    this.refresh();
  }

  private canonicalPageCurrent(): boolean {
    const scene = this.scene;
    const measured = scene.candidate();
    const chapter = measured.chapter;
    return chapter !== undefined && chapter.sourceId === scene.sourceId() && chapter.bookId === scene.bookId() &&
      chapter.cacheRefreshRequired !== true && chapter.sourceCorrectionRequired !== true && chapter.content.trim().length > 0 &&
      measured.materializedChapterSelectionToken === this.environment.selection() &&
      measured.page !== undefined && measured.selection === this.environment.selection() &&
      scene.projection().visibleFragments.some((fragment: ReadingSurfacePageFragment): boolean => fragment.text.trim().length > 0 &&
        fragment.imageHeight <= 0 && (fragment.nativeParagraph === undefined || fragment.nativeParagraphFirst));
  }

  private eligible(completion: SourceSwitchCompletionPresentation): boolean {
    const scene = this.scene;
    return this.environment.mounted() && !scene.exiting() && scene.foreground() && scene.showCompletion() && scene.sessionCurrent() &&
      completion.sourceId === scene.sourceId() && completion.bookId === scene.bookId() &&
      completion.readingReadyGeneration === scene.readyGeneration() && scene.phase() === 'ready' &&
      scene.failureMessage().length === 0 && this.canonicalPageCurrent();
  }

  private disqualified(completion: SourceSwitchCompletionPresentation): boolean {
    const scene = this.scene;
    if (!scene.foreground() || !scene.showCompletion() || scene.exiting() || !scene.sessionCurrent() ||
      completion.sourceId !== scene.sourceId() || completion.bookId !== scene.bookId() ||
      completion.readingReadyGeneration !== scene.readyGeneration() || scene.phase() === 'failed') return true;
    const chapter = scene.candidate().chapter;
    return chapter?.sourceId === completion.sourceId && chapter.bookId === completion.bookId &&
      (chapter.cacheRefreshRequired === true || chapter.sourceCorrectionRequired === true);
  }

  private present(revision: number, selection: number, continuous: boolean): void {
    this.reveal.present(revision, selection, continuous);
  }

  current(completion: SourceSwitchCompletionPresentation): boolean {
    const scope = this.environment;
    const continuous = scope.continuous();
    return this.eligible(completion) && this.reveal.matches(completion, scope.selection(), scope.lifecycle(),
      scope.revision(continuous), continuous) &&
      this.scene.candidate().chapter?.chapterIndex === completion.chapterIndex &&
      this.scene.candidate().page?.startScalar === completion.chapterOffset;
  }

  finishWash(): void {
    const animator = this.animator;
    this.animator = undefined;
    if (animator !== undefined) {
      // A native cancellation end sample belongs to the retired actor.
      animator.onFrame = (_value: number): void => {};
      animator.onFinish = (): void => {};
      animator.cancel();
    }
    this.environment.publishOpacity(0);
  }

  retire(consume: boolean = true): void {
    this.reveal.retire(consume ? this.environment.completion() : undefined);
    this.finishWash();
    this.feedback.reset();
    this.environment.publishSelection(-1);
  }

  refresh(): void {
    const scope = this.environment;
    const completion = scope.completion();
    if (completion === undefined) {
      this.reveal.clearPending();
      this.retire(false);
      return;
    }
    if (!scope.mounted()) return;
    const key = this.reveal.bind(completion, scope.selection(), scope.lifecycle());
    if (!this.reveal.pendingAt(scope.selection(), scope.lifecycle()) || this.disqualified(completion)) {
      this.retire();
      return;
    }
    if (!this.current(completion)) {
      // A same-selection reflow may still produce a canonical presentation.
      this.feedback.reset();
      if (scope.visible()) this.retire();
      return;
    }
    if (this.reveal.consumed(key)) return;
    this.retire(false);
    const epoch = this.reveal.consume(key);
    const lifecycle = scope.lifecycle();
    const selection = scope.selection();
    scope.publishSelection(selection);
    const current = (): boolean => {
      if (!this.reveal.isEpoch(epoch) || lifecycle !== scope.lifecycle() || selection !== scope.selection()) return false;
      const live = scope.completion();
      return live !== undefined && this.reveal.key(live) === key && this.current(completion);
    };
    this.feedback.show(scope.uiContext, {
      title: '书源已切换',
      tone: 'success',
      message: `已切换至 ${completion.sourceName || completion.sourceId}`,
      key: `source-switch:${key}`,
      duration: READER_FEEDBACK_EXTENDED_MS,
    }, current);
    if (scope.reducedMotion()) return;
    if (!readerTransitionsEnabled()) {
      const from = 1 - SOURCE_SWITCH_VISUAL.readerEnterFromOpacity;
      scope.publishOpacity(from);
      scope.uiContext().animateTo({
        duration: SOURCE_SWITCH_VISUAL.readerEnterDurationMs,
        curve: curves.cubicBezierCurve(SOURCE_SWITCH_VISUAL.easingX1, SOURCE_SWITCH_VISUAL.easingY1,
          SOURCE_SWITCH_VISUAL.easingX2, SOURCE_SWITCH_VISUAL.easingY2),
        onFinish: (): void => {
          if (current()) scope.publishOpacity(0);
        },
      }, (): void => {
        if (current()) scope.publishOpacity(0);
      });
      return;
    }
    const animator = createReaderSourceSwitchWash(scope.uiContext, scope.publishOpacity);
    this.animator = animator;
    animator.onFrame = (opacity: number): void => {
      if (this.animator !== animator) return;
      if (!current()) { this.retire(); return; }
      scope.publishOpacity(opacity);
    };
    animator.onFinish = (): void => {
      if (this.animator !== animator) return;
      if (!current()) { this.retire(); return; }
      this.animator = undefined;
      scope.publishOpacity(0);
    };
    animator.play();
  }
}

export interface ReaderSourceSwitchOverlayInput {
  readonly opacity: number;
  readonly theme: ReaderAppearanceTheme;
  readonly expanded: boolean;
}

@Builder
export function ReaderSourceSwitchOverlay($$: ReaderSourceSwitchOverlayInput) {
  SourceSwitchCompletionOverlay({ washOpacity: $$.opacity, paperTheme: $$.theme, expanded: $$.expanded })
    .zIndex(1).hitTestBehavior(HitTestMode.None);
}
