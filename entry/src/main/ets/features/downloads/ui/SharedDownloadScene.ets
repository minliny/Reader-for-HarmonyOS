import { SharedDownloadPage } from './SharedDownloadPage';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { SharedDownloadSnapshot } from '../application/SharedDownloadHost';
import { SharedDownloadPresentation, type DownloadReadingEntry } from '../presentation/SharedDownloadPresentation';
import type { DownloadBookView, DownloadReadingTarget } from '../presentation/SharedDownloadProjection';
import type { SharedDownloadReadingControl, SharedDownloadReadingFocus, SharedDownloadUiIntent,
  SharedDownloadViewState } from '../presentation/SharedDownloadUiContract';

interface SharedDownloadScenePaint {
  identity: string;
  snapshot: SharedDownloadSnapshot;
  storagePolicyBusy: boolean;
  storageCleanupBusy: boolean;
  batchRecovery: ReaderRecoveryView;
  initialView: SharedDownloadViewState;
}

@Component
export struct SharedDownloadScene {
  @ObjectLink @Watch('capturePaint') presentation: SharedDownloadPresentation;
  @Prop reduceMotion: boolean = false;
  @Prop covered: boolean = false;
  @Prop embeddedWide: boolean = false;
  @Prop @Watch('capturePaint') active: boolean = true;
  isPaintCurrent: (() => boolean) | undefined = undefined;
  onBack: () => void = (): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, blocksSettingsSwitch?: () => boolean) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  onRead: (entry: DownloadReadingEntry) => void = (_entry: DownloadReadingEntry): void => {};
  onFeedback: (message: string) => void = (_message: string): void => {};

  @State private painted: SharedDownloadScenePaint | undefined = undefined;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.capturePaint();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.painted = undefined;
  }

  private capturePaint(): void {
    const identity = this.presentation.identity;
    if (!this.mounted || !this.inputIsCurrent(identity)) return;
    // Retiring business operations must not remove the old page from the transition.
    this.painted = { identity, snapshot: this.presentation.snapshot, storagePolicyBusy: this.presentation.storagePolicyBusy,
      storageCleanupBusy: this.presentation.storageCleanupBusy, batchRecovery: this.presentation.batchRecovery,
      initialView: this.presentation.initialView() };
  }

  private inputIsCurrent(identity: string): boolean {
    return this.active !== false && this.isPaintCurrent?.() !== false && this.presentation.isCurrent(identity);
  }

  build() {
    ForEach(this.painted === undefined ? [] : [this.painted.identity], (identity: string): void => {
      SharedDownloadPage({
        books: this.painted?.snapshot.books ?? [],
        loading: this.painted?.snapshot.loading ?? false,
        error: this.painted?.snapshot.error ?? '',
        storageSummary: this.painted?.snapshot.storageSummary ?? {},
        storagePolicy: this.painted?.snapshot.storagePolicy,
        storagePolicyBusy: this.painted?.storagePolicyBusy ?? false,
        storageCleanupBusy: this.painted?.storageCleanupBusy ?? false,
        batchRecovery: this.painted?.batchRecovery ?? this.presentation.batchRecovery,
        reduceMotion: this.reduceMotion,
        covered: this.covered,
        embeddedWide: this.embeddedWide,
        presentationIdentity: identity,
        isOpeningCurrent: (): boolean => this.inputIsCurrent(identity),
        initialViewState: this.painted?.initialView ?? this.presentation.initialView(),
        takeReadingFocus: (): SharedDownloadReadingFocus | undefined =>
          this.inputIsCurrent(identity) ? this.presentation.takeReadingFocus(identity) : undefined,
        onTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string, blocksSettingsSwitch?: () => boolean): void => {
          if (this.inputIsCurrent(identity)) this.onTemporaryBackBridge(handler, bridgeIdentity, blocksSettingsSwitch);
        },
        onViewStateChanged: (state: SharedDownloadViewState): void => {
          if (this.inputIsCurrent(identity)) this.presentation.updateView(identity, state);
        },
        onBack: (): void => { if (this.inputIsCurrent(identity)) this.onBack(); },
        onRefresh: (): void => {
          if (this.active !== false && this.isPaintCurrent?.() !== false) this.presentation.refresh(identity);
        },
        onRefreshBatchRecovery: (generation: number): void => {
          if (this.inputIsCurrent(identity)) this.presentation.refreshBatchRecovery(identity, generation);
        },
        onRefreshStorage: (): void => {
          if (this.inputIsCurrent(identity)) this.presentation.refreshStorage(identity);
        },
        onOpenBook: (book: DownloadBookView): void => {
          if (this.inputIsCurrent(identity)) this.presentation.refreshBook(identity, book);
        },
        onReadTarget: (target: DownloadReadingTarget, current: () => boolean, control: SharedDownloadReadingControl): void => {
          if (this.inputIsCurrent(identity)) void this.presentation.read(identity, target, this.onRead, this.onFeedback, current, control);
        },
        onIntent: (intent: SharedDownloadUiIntent): void => {
          if (this.inputIsCurrent(identity)) void this.presentation.applyIntent(identity, intent, this.onFeedback);
        },
      });
    }, (identity: string): string => identity);
  }
}
