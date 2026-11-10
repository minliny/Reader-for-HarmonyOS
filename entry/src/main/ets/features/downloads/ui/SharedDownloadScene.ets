import { SharedDownloadPage } from './SharedDownloadPage';
import { SharedDownloadPresentation, type DownloadReadingEntry } from '../presentation/SharedDownloadPresentation';
import type { DownloadBookView, DownloadReadingTarget } from '../presentation/SharedDownloadProjection';
import type { SharedDownloadReadingControl, SharedDownloadReadingFocus, SharedDownloadUiIntent,
  SharedDownloadViewState } from '../presentation/SharedDownloadUiContract';

@Component
export struct SharedDownloadScene {
  @ObjectLink presentation: SharedDownloadPresentation;
  @Prop reduceMotion: boolean = false;
  @Prop covered: boolean = false;
  onBack: () => void = (): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  onRead: (entry: DownloadReadingEntry) => void = (_entry: DownloadReadingEntry): void => {};
  onFeedback: (message: string) => void = (_message: string): void => {};

  build() {
    ForEach(this.presentation.identity.length > 0 ? [this.presentation.identity] : [], (identity: string): void => {
      SharedDownloadPage({
        books: this.presentation.snapshot.books,
        loading: this.presentation.snapshot.loading,
        error: this.presentation.snapshot.error,
        storageSummary: this.presentation.snapshot.storageSummary,
        storagePolicy: this.presentation.snapshot.storagePolicy,
        storagePolicyBusy: this.presentation.storagePolicyBusy,
        storageCleanupBusy: this.presentation.storageCleanupBusy,
        batchRecovery: this.presentation.batchRecovery,
        reduceMotion: this.reduceMotion,
        covered: this.covered,
        presentationIdentity: identity,
        isOpeningCurrent: (): boolean => this.presentation.isCurrent(identity),
        initialViewState: this.presentation.initialView(),
        takeReadingFocus: (): SharedDownloadReadingFocus | undefined => this.presentation.takeReadingFocus(identity),
        onTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string): void => {
          if (this.presentation.isCurrent(identity)) this.onTemporaryBackBridge(handler, bridgeIdentity);
        },
        onViewStateChanged: (state: SharedDownloadViewState): void => this.presentation.updateView(identity, state),
        onBack: (): void => { if (this.presentation.isCurrent(identity)) this.onBack(); },
        onRefresh: (): void => this.presentation.refresh(identity),
        onRefreshBatchRecovery: (generation: number): void => this.presentation.refreshBatchRecovery(identity, generation),
        onRefreshStorage: (): void => this.presentation.refreshStorage(identity),
        onOpenBook: (book: DownloadBookView): void => this.presentation.refreshBook(identity, book),
        onReadTarget: (target: DownloadReadingTarget, current: () => boolean, control: SharedDownloadReadingControl): void => {
          void this.presentation.read(identity, target, this.onRead, this.onFeedback, current, control);
        },
        onIntent: (intent: SharedDownloadUiIntent): void => {
          void this.presentation.applyIntent(identity, intent, this.onFeedback);
        },
      });
    }, (identity: string): string => identity);
  }
}
