import { BookshelfDetailNotice } from '../../features/bookshelf/ui/BookshelfDetailNotice';
import { BookshelfDetailPresentation } from '../../features/bookshelf/presentation/BookshelfDetailPresentation';
import { ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import { ReaderRecoveryNotice } from '../../ui/feedback/ReaderRecoveryNotice';
import type { ReaderRecoveryView } from '../../ui/feedback/ReaderRecoveryView';

/** Presents each current recovery view in the shared nonmodal root slot. */
@Component
export struct ReaderJourneyRecoveryNotices {
  @ObjectLink reading: ReadingEntryPresentation;
  @ObjectLink detail: BookshelfDetailPresentation;
  @Prop topInset: number = 0;
  @Prop interactive: boolean = true;
  canInteract: () => boolean = (): boolean => true;
  @Prop startupRecoveryVisible: boolean = false;
  @Prop startupRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop mangaRecoveryVisible: boolean = false;
  @Prop mangaRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop mangaRecoveryActionLabel: string = '';
  @Prop mangaRecoveryBusy: boolean = false;
  onMangaRecovery: (generation: number) => void = (_generation: number): void => {};

  private detailNoticeVisible(): boolean {
    return this.detail.addRecovery() !== undefined || this.detail.removalRecovery() !== undefined;
  }

  build() {
    if (this.interactive && ((this.startupRecoveryVisible && this.startupRecovery.visible) ||
      this.reading.recoveryNoticeVisible() || this.detailNoticeVisible() ||
      (this.mangaRecoveryVisible && this.mangaRecovery.visible))) {
      Column({ space: 8 }) {
        if (this.startupRecoveryVisible && this.startupRecovery.visible) {
          ReaderRecoveryNotice({ view: this.startupRecovery, tag: '旧版数据', actionLabel: '' });
        }
        if (this.detailNoticeVisible()) {
          BookshelfDetailNotice({ presentation: this.detail,
            canInteract: (): boolean => this.interactive && this.canInteract() });
        }
        if (this.reading.recoveryNoticeVisible()) {
          ForEach([this.reading.recoveryNotice.generation], (generation: number): void => {
            ReaderRecoveryNotice({ view: this.reading.recoveryNotice, actionLabel: this.reading.recoveryActionLabel,
              onReconcile: (_expected: number): void => {
                if (this.interactive && this.canInteract()) this.reading.retryRecoveryNotice(generation);
              } });
          }, (generation: number): string => generation.toString());
        }
        if (this.mangaRecoveryVisible && this.mangaRecovery.visible) {
          ForEach([this.mangaRecovery.generation], (generation: number): void => {
            ReaderRecoveryNotice({ view: this.mangaRecovery, tag: '漫画换源',
              actionLabel: this.mangaRecoveryActionLabel, busy: this.mangaRecoveryBusy,
              onReconcile: (_expected: number): void => {
                if (this.interactive && this.canInteract() && this.mangaRecoveryVisible) this.onMangaRecovery(generation);
              } });
          }, (generation: number): string => generation.toString());
        }
      }
      .width('100%').padding({ left: 16, right: 16, top: this.topInset + 12 })
      .align(Alignment.Top).zIndex(220).hitTestBehavior(HitTestMode.Transparent);
    }
  }
}
