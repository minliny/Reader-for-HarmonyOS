import type { UIContext } from '@ohos.arkui.UIContext';
import type { AnimatorResult } from '@ohos.animator';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderSourceSwitchReveal } from '../presentation/ReaderSourceSwitchReveal';
import { createReaderSourceSwitchWash } from './ReaderSourceSwitchWash';
import type { SourceSwitchCompletionPresentation } from '../../source/presentation/SourceSwitchCompletionPresentation';
import { SourceSwitchCompletionOverlay } from '../../source/ui/SourceSwitchCompletionOverlay';
import type { ReaderAppearanceTheme } from '../application/ReaderAppearanceState';

export interface ReaderSourceSwitchRevealEnvironment {
  readonly completion: () => SourceSwitchCompletionPresentation | undefined;
  readonly lifecycle: () => number;
  readonly selection: () => number;
  readonly mounted: () => boolean;
  readonly disqualified: (completion: SourceSwitchCompletionPresentation) => boolean;
  readonly currentPage: (completion: SourceSwitchCompletionPresentation) => boolean;
  readonly revision: (continuous: boolean) => number;
  readonly anchorCurrent: (completion: SourceSwitchCompletionPresentation) => boolean;
  readonly continuous: () => boolean;
  readonly reducedMotion: () => boolean;
  readonly uiContext: () => UIContext;
  readonly publishOpacity: (opacity: number) => void;
  readonly publishSelection: (selection: number) => void;
  readonly visible: () => boolean;
}

/** Owns the native wash actor and feedback lifetime for a single eligible
 * durable completion. Mounted stage and page identities arrive as facts. */
export class ReadingSourceSwitchOverlayHost {
  private readonly reveal: ReaderSourceSwitchReveal = new ReaderSourceSwitchReveal();
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private animator: AnimatorResult | undefined = undefined;
  private readonly environment: ReaderSourceSwitchRevealEnvironment;

  constructor(environment: ReaderSourceSwitchRevealEnvironment) {
    this.environment = environment;
  }

  present(revision: number, selection: number, continuous: boolean): void {
    this.reveal.present(revision, selection, continuous);
  }

  current(completion: SourceSwitchCompletionPresentation): boolean {
    const scope = this.environment;
    const continuous = scope.continuous();
    return scope.currentPage(completion) && this.reveal.matches(completion, scope.selection(), scope.lifecycle(),
      scope.revision(continuous), continuous) && scope.anchorCurrent(completion);
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
    if (!this.reveal.pendingAt(scope.selection(), scope.lifecycle()) || scope.disqualified(completion)) {
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
