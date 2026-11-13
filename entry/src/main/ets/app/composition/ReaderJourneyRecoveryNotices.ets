import { readerWindowMetrics } from '../../ui/foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeBottom } from '../../ui/foundation/ReaderWindowMetrics';
import { readerPageAreaLength } from '../../ui/layout/ReaderPageShell';
import { BookshelfDetailNotice } from '../../features/bookshelf/ui/BookshelfDetailNotice';
import { BookshelfDetailPresentation } from '../../features/bookshelf/presentation/BookshelfDetailPresentation';
import { ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import { ReaderRecoveryGroup } from '../../ui/feedback/ReaderRecoveryGroup';
import { ReaderRecoveryNotice } from '../../ui/feedback/ReaderRecoveryNotice';
import type { ReaderRecoveryView } from '../../ui/feedback/ReaderRecoveryView';

/** Presents each current recovery view in the shared nonmodal root slot. */
@Component
export struct ReaderJourneyRecoveryNotices {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @State private hostWidth: number = 0;
  @State private hostHeight: number = 0;
  @State private hostY: number = 0;
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
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.interactive && ((this.startupRecoveryVisible && this.startupRecovery.visible) ||
        this.reading.recoveryNoticeVisible() || this.detailNoticeVisible() ||
        (this.mangaRecoveryVisible && this.mangaRecovery.visible))) {
        Scroll() {
          Column() {
            ReaderRecoveryGroup({ content: (): void => { this.recoveryItems(); } });
          }.width('100%').padding({ left: 16, right: 16 });
        }.width('100%').constraintSize({ maxHeight: this.availableHeight() })
          .margin({ top: this.topInset + 12 }).scrollBar(BarState.Auto).clip(true)
          .align(Alignment.Top).hitTestBehavior(HitTestMode.Transparent);
      }
    }.width('100%').height('100%').zIndex(220).hitTestBehavior(HitTestMode.Transparent)
      .onAreaChange((_old: Area, next: Area): void => {
        this.hostWidth = readerPageAreaLength(next.width);
        this.hostHeight = readerPageAreaLength(next.height);
        this.hostY = readerPageAreaLength(next.globalPosition.y);
      });
  }

  @Builder
  private recoveryItems() {
    if (this.startupRecoveryVisible && this.startupRecovery.visible) {
      ReaderRecoveryNotice({ grouped: true, layoutWidthVp: this.noticeWidth(),
        view: this.startupRecovery, tag: '旧版数据', actionLabel: '' });
    }
    if (this.detailNoticeVisible()) {
      BookshelfDetailNotice({ grouped: true, follows: this.startupRecoveryVisible && this.startupRecovery.visible,
        layoutWidthVp: this.noticeWidth(), presentation: this.detail,
        canInteract: (): boolean => this.interactive && this.canInteract() });
    }
    if (this.reading.recoveryNoticeVisible()) {
      ForEach([this.reading.recoveryNotice.generation], (generation: number): void => {
        ReaderRecoveryNotice({ grouped: true,
          follows: (this.startupRecoveryVisible && this.startupRecovery.visible) || this.detailNoticeVisible(),
          layoutWidthVp: this.noticeWidth(), view: this.reading.recoveryNotice,
          actionLabel: this.reading.recoveryActionLabel,
          onReconcile: (_expected: number): void => {
            if (this.interactive && this.canInteract()) this.reading.retryRecoveryNotice(generation);
          } });
      }, (generation: number): string => generation.toString());
    }
    if (this.mangaRecoveryVisible && this.mangaRecovery.visible) {
      ForEach([this.mangaRecovery.generation], (generation: number): void => {
        ReaderRecoveryNotice({ grouped: true,
          follows: (this.startupRecoveryVisible && this.startupRecovery.visible) || this.detailNoticeVisible() || this.reading.recoveryNoticeVisible(),
          layoutWidthVp: this.noticeWidth(), view: this.mangaRecovery, tag: '漫画换源',
          actionLabel: this.mangaRecoveryActionLabel, busy: this.mangaRecoveryBusy,
          onReconcile: (_expected: number): void => {
            if (this.interactive && this.canInteract() && this.mangaRecoveryVisible) this.onMangaRecovery(generation);
          } });
      }, (generation: number): string => generation.toString());
    }
  }

  private noticeWidth(): number {
    return Math.max(0, (this.hostWidth > 0 ? this.hostWidth : readerWindowMetrics().windowRect.width) - 32);
  }

  private availableHeight(): number {
    if (this.readerWindowMetricsRevision < 0) return 0;
    const metrics = readerWindowMetrics();
    return Math.max(0, Math.min(this.hostHeight > 0 ? this.hostHeight : metrics.windowRect.height,
      metrics.windowRect.height - readerInteractiveSafeBottom(metrics, true) - this.hostY) - this.topInset - 12);
  }
}
