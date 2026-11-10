import type { MangaSourceSwitchPresentation } from '../../features/manga/presentation/MangaSourceSwitchPresentation';
import type { SourceSwitchCandidate } from '../../features/source/application/SourceSwitchGateway';
import type { SourceSwitchPresentation, SourceSwitchWorkflowPorts } from '../../features/source/presentation/SourceSwitchPresentation';

export interface ReaderSourceSwitchActions {
  back: () => void;
  close: (scope?: number) => void;
  stop: (scope?: number) => void;
  retry: (scope?: number) => void;
  refresh: (scope?: number) => void;
  select: (candidate: SourceSwitchCandidate, scope?: number) => void;
  rollback: (scope?: number) => void;
  retryFailure: (scope?: number) => void;
  dismissFailure: (scope?: number) => void;
}

/** Both picker surfaces forward intents to the same active feature owners. */
export function readerSourceSwitchActions(source: () => SourceSwitchPresentation,
  manga: () => MangaSourceSwitchPresentation, isManga: () => boolean,
  workflow: () => SourceSwitchWorkflowPorts): ReaderSourceSwitchActions {
  const forCurrentKind = (scope: number | undefined, mangaAction: () => void, textAction: () => void): void => {
    if (!isManga()) {
      textAction();
      return;
    }
    if (source().matchesScope(scope)) mangaAction();
  };
  return {
    back: (): void => {
      const presentation = source();
      // The root has already consumed this modal Back; Native exit still owns the layer.
      if (!presentation.visible && presentation.surfaceAttached) return;
      if (isManga()) manga().close();
      else presentation.host()?.consumeBack(presentation.scopeId);
    },
    close: (scope?: number): void => forCurrentKind(scope, (): void => manga().close(), (): void => source().close(scope)),
    stop: (scope?: number): void => source().stop(scope),
    retry: (scope?: number): void => source().retry(scope),
    refresh: (scope?: number): void => source().refresh(scope, workflow()),
    select: (candidate: SourceSwitchCandidate, scope?: number): void =>
      forCurrentKind(scope, (): void => manga().pick(candidate), (): void => source().pickText(candidate, scope)),
    rollback: (scope?: number): void => source().rollback(scope),
    retryFailure: (scope?: number): void =>
      forCurrentKind(scope, (): void => { manga().retryFailure(); }, (): void => { source().retryTextFailure(scope); }),
    dismissFailure: (scope?: number): void =>
      forCurrentKind(scope, (): void => manga().dismissFailure(), (): void => { source().dismissTextFailure(scope); }),
  };
}
