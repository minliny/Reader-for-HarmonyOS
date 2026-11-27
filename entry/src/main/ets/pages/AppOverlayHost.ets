import type { ReaderRoute } from '../app/navigation/ReaderNavigation';
import { JsonImportDialog } from '../app/composition/JsonImportDialog';
import { JsonImportPresentation, type JsonImportOpening } from '../app/composition/JsonImportPresentation';
import { ReaderJourneyRecoveryNotices } from '../app/composition/ReaderJourneyRecoveryNotices';
import { ReaderLayoutDebugOverlay } from '../app/composition/ReaderLayoutDebugOverlay';
import type { ReaderSourceSwitchActions } from '../app/composition/ReaderSourceSwitchActions';
import { ReaderSourceSwitchSurfaces } from '../app/composition/ReaderSourceSwitchSurfaces';
import { BookRemovalDialogHost } from '../features/bookshelf/ui/BookRemovalDialogHost';
import { BookshelfGroupDialog } from '../features/bookshelf/ui/BookshelfGroupDialog';
import { BookshelfImportScene } from '../features/bookshelf/ui/BookshelfImportScene';
import type { BookRemovalDialogPresentation } from '../features/bookshelf/presentation/BookRemovalDialogPresentation';
import type { BookshelfDetailPresentation } from '../features/bookshelf/presentation/BookshelfDetailPresentation';
import type { BookshelfGroupPresentation } from '../features/bookshelf/presentation/BookshelfGroupPresentation';
import type { BookshelfMutationPresentation } from '../features/bookshelf/presentation/BookshelfMutationPresentation';
import type { MangaSourceSwitchPresentation } from '../features/manga/presentation/MangaSourceSwitchPresentation';
import type { ReadingEntryPresentation } from '../features/reading/presentation/ReadingEntryPresentation';
import type { SourceSwitchPresentation } from '../features/source/presentation/SourceSwitchPresentation';
import type { ReaderRecoveryView } from '../ui/feedback/ReaderRecoveryView';
import { ReaderTransientToast } from '../ui/feedback/ReaderTransientToast';
import { READER_LAYOUT_DEBUG_BUILD } from '../ui/foundation/ReaderLayoutInvariantSignals';
import { ArkWebExecutionHost, type ArkWebInteractiveBounds } from '../ui/platform/ArkWebExecutionHost';

export interface AppWindowOverlayInput {
  readonly bookRemoval: BookRemovalDialogPresentation;
  readonly webBounds: ArkWebInteractiveBounds | undefined;
  readonly topInset: number;
  readonly onWebBack: (handler: (() => boolean) | undefined) => void;
  readonly onWebInputCaptured: (captured: boolean) => void;
}

/** Window peers stay above the complete route input and accessibility boundary. */
@Builder
export function AppWindowOverlays($$: AppWindowOverlayInput) {
  Stack({ alignContent: Alignment.TopStart }) {
    BookRemovalDialogHost({ presentation: $$.bookRemoval });
  }.width('100%').height('100%')
    .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.ALL])
    .hitTestBehavior(HitTestMode.Transparent);
  Stack({ alignContent: Alignment.TopStart }) {
    ArkWebExecutionHost({
      interactiveBounds: $$.webBounds,
      onBackBridge: $$.onWebBack,
      onInputCaptureChange: $$.onWebInputCaptured,
    });
  }.width('100%').height('100%').padding({ top: $$.topInset })
    .hitTestBehavior(HitTestMode.Transparent);
}

export interface AppSourceOverlayInput {
  readonly entry: ReadingEntryPresentation;
  readonly source: SourceSwitchPresentation;
  readonly manga: MangaSourceSwitchPresentation;
  readonly actions: ReaderSourceSwitchActions;
  readonly entryPickerAllowed: boolean;
  readonly interactive: boolean;
  readonly consumeTopInset: boolean;
}

export interface AppModalOverlayInput {
  readonly groups: BookshelfGroupPresentation;
  readonly imports: BookshelfMutationPresentation;
  readonly json: JsonImportPresentation;
  readonly expandedLayout: boolean;
  readonly groupInput: () => boolean;
  readonly canRestoreImportFocus: () => boolean;
  readonly canUseJson: () => boolean;
  readonly canRestoreJsonFocus: (opening: JsonImportOpening) => boolean;
}

export interface AppFeedbackOverlayInput {
  readonly detail: BookshelfDetailPresentation;
  readonly messageTopInset: number;
  readonly startupVisible: boolean;
  readonly startup: ReaderRecoveryView;
  readonly interactive: boolean;
  readonly canInteract: () => boolean;
  readonly mangaVisible: boolean;
  readonly canRetryManga: () => boolean;
  readonly firstContentRequired: boolean;
  readonly pageInputEnabled: boolean;
}

export interface AppOverlayHostInput {
  readonly route: ReaderRoute;
  readonly generation: number;
  readonly reduceMotion: boolean;
  readonly topInset: number;
  readonly sourceSwitch: AppSourceOverlayInput;
  readonly modals: AppModalOverlayInput;
  readonly feedback: AppFeedbackOverlayInput;
}

/** Keeps source switching, modal focus, and short feedback in the existing root stacking order. */
@Builder
export function AppOverlayHost($$: AppOverlayHostInput) {
  Stack({ alignContent: Alignment.TopStart }) {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderSourceSwitchSurfaces({
        reading: $$.sourceSwitch.entry, source: $$.sourceSwitch.source, manga: $$.sourceSwitch.manga,
        entryPickerAllowed: $$.sourceSwitch.entryPickerAllowed,
        interactive: $$.sourceSwitch.interactive, reduceMotion: $$.reduceMotion,
        consumeTopInset: $$.sourceSwitch.consumeTopInset, actions: $$.sourceSwitch.actions,
      });
    }.width('100%').height('100%').padding({ top: $$.topInset })
      .hitTestBehavior(HitTestMode.Transparent);
    Stack({ alignContent: Alignment.TopStart }) {
      if ($$.route === 'bookshelf' || $$.route === 'detail') {
        BookshelfGroupDialog({ presentation: $$.modals.groups, isInputAllowed: $$.modals.groupInput });
      }
      if ($$.route === 'bookshelf') {
        BookshelfImportScene({ presentation: $$.modals.imports, navigation: $$.generation,
          reduceMotion: $$.reduceMotion, canRestoreFocus: $$.modals.canRestoreImportFocus });
      }
      if ($$.modals.json.opening !== undefined) {
        ForEach([$$.modals.json.opening], (opening: JsonImportOpening): void => {
          JsonImportDialog({
            title: opening.title, description: opening.description, expandedLayout: $$.modals.expandedLayout,
            openingId: opening.id,
            captureFocusReturn: () => $$.modals.json.captureFocusReturn(opening.id, (): boolean =>
              $$.modals.canRestoreJsonFocus(opening)),
            isInputAllowed: (): boolean => $$.modals.canUseJson() && $$.modals.json.isOpeningCurrent(opening.id),
            onDismiss: (): void => $$.modals.json.dismiss(opening.id),
            onSelectLocal: (): void => {
              if ($$.modals.canUseJson() && $$.modals.json.opening?.id === opening.id) $$.modals.json.submit(opening.id);
            },
            onImportOnline: (url: string): void => {
              if ($$.modals.canUseJson() && $$.modals.json.opening?.id === opening.id) $$.modals.json.submit(opening.id, url);
            },
          });
        }, (opening: JsonImportOpening): string => opening.id.toString());
      }
    }.width('100%').height('100%')
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.ALL])
      .hitTestBehavior(HitTestMode.Transparent);
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderJourneyRecoveryNotices({
        reading: $$.sourceSwitch.entry, detail: $$.feedback.detail, topInset: $$.feedback.messageTopInset,
        startupRecoveryVisible: $$.feedback.startupVisible, startupRecovery: $$.feedback.startup,
        interactive: $$.feedback.interactive, canInteract: $$.feedback.canInteract,
        mangaRecoveryVisible: $$.feedback.mangaVisible,
        mangaRecovery: $$.sourceSwitch.source.mangaRecovery,
        mangaRecoveryActionLabel: $$.sourceSwitch.source.mangaRecoveryActionLabel,
        mangaRecoveryBusy: $$.sourceSwitch.source.mangaRecoveryBusy,
        onMangaRecovery: (generation: number): void => {
          if ($$.feedback.canRetryManga()) $$.sourceSwitch.source.retryMangaRecovery(generation);
        },
      });
      // The geometry guide outlines mounted page surfaces without taking input.
      if (typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD) {
        ReaderLayoutDebugOverlay({ route: $$.route, requiresHeader: $$.route !== 'reading',
          requiresControl: $$.route === 'bookshelf' || $$.route === 'detail',
          requiresFirstContent: $$.feedback.firstContentRequired,
          mainInputEnabled: $$.feedback.pageInputEnabled });
      }
      ReaderTransientToast()
    }
    .width('100%').height('100%').padding({ top: $$.topInset })
    .zIndex(2).hitTestBehavior(HitTestMode.Transparent);
  }.width('100%').height('100%').zIndex(2).hitTestBehavior(HitTestMode.Transparent);
}
