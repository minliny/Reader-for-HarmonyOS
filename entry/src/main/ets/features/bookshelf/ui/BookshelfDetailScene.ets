import type { RetainedShareFile } from '../../reading/application/ReaderShareActions';
import type { ReadingBookDetail } from '../../reading/presentation/ReadingBookDetail';
import type { LocalReadingTocEntry } from '../../reading/application/LocalReadingFlowGateway';
import { ReadingEntryPresentation, remoteContentVerdictLabel } from '../../reading/presentation/ReadingEntryPresentation';
import { BookshelfDetailPresentation } from '../presentation/BookshelfDetailPresentation';
import { BookshelfMutationPresentation } from '../presentation/BookshelfMutationPresentation';
import { LocalBookDetail } from '../../reading/ui/LocalBookDetail';

export interface BookshelfDetailScenePorts {
  captureAction: (identity: string) => (() => boolean);
  captureDocumentSave?: (identity: string) => (() => boolean);
  retainedShareFile?: RetainedShareFile;
  openReading: (chapterIndex?: number) => void;
  openDirectory: () => void;
  retryCatalog: () => void;
  openSourceSwitch: (focusId?: string) => void;
  projectCurrentChapter?: (identity: string) => void;
  openDownloads?: () => void;
  openGroup?: (identity: string, focusId?: string) => void;
  registerMoreBack?: (handler: (() => boolean) | undefined, identity: string) => void;
  back: () => void;
}

@Component
export struct BookshelfDetailScene {
  @ObjectLink @Watch('onEntryChanged') entry: ReadingEntryPresentation;
  @ObjectLink detail: BookshelfDetailPresentation;
  @ObjectLink mutations: BookshelfMutationPresentation;
  @Prop identity: string = '';
  @Prop foreground: boolean = false;
  @Prop directoryRetained: boolean = false;
  @Prop mutationEnabled: boolean = false;
  ports: BookshelfDetailScenePorts | undefined;

  // Adapt stable feature DTO references to the V1 child @Prop source contract.
  // Membership/busy updates still reach the detail, while the SDK can retain
  // its existing observed book/TOC sources until those inputs really change.
  @State private bodyBook: ReadingBookDetail | undefined = undefined;
  @State private bodyToc: LocalReadingTocEntry[] = [];
  private sourceBook: ReadingBookDetail | undefined = undefined;
  private sourceToc: LocalReadingTocEntry[] | undefined = undefined;

  aboutToAppear(): void { this.onEntryChanged(); }

  private onEntryChanged(): void {
    const book = this.entry.book, toc = this.entry.toc;
    // The visible owner retires first on Back. Keep the departing visual data
    // until Navigation removes its lane. The unqualified actions stay fenced.
    if (book === undefined) return;
    if (book !== this.sourceBook) {
      const previous = this.sourceBook;
      this.sourceBook = book;
      this.bodyBook = book;
      if (previous?.sourceId !== book.sourceId || previous?.bookId !== book.bookId) {
        const identity = this.identity;
        void Promise.resolve().then((): void => {
          if (identity === this.identity && this.sourceBook?.sourceId === book.sourceId &&
            this.sourceBook?.bookId === book.bookId) this.ports?.projectCurrentChapter?.(identity);
        });
      }
    }
    if (toc !== this.sourceToc) {
      this.sourceToc = toc;
      this.bodyToc = toc;
    }
  }

  private detailKey(book: ReadingBookDetail): string {
    return JSON.stringify([book.sourceId, book.bookId]);
  }

  private detailInputCurrent(key: string): boolean {
    return this.foreground && this.entry.book !== undefined && this.detailKey(this.entry.book) === key &&
      this.ports?.captureAction(this.identity)() === true;
  }

  build() {
    if (this.bodyBook !== undefined) {
      ForEach([this.detailKey(this.bodyBook)], (key: string): void => {
        this.detailSurface((): boolean => this.detailInputCurrent(key));
      }, (key: string): string => key);
    }
  }

  @Builder
  private detailSurface(current: () => boolean) {
    if (this.bodyBook !== undefined) {
      LocalBookDetail({
        book: this.bodyBook,
        directoryFocusContext: this.foreground ? 'detail' : this.directoryRetained ? 'directory' : 'inactive',
        toc: this.bodyToc,
        currentChapterIndex: this.bodyBook.contentKind === 'manga' ?
          this.bodyBook.mangaPosition?.chapterIndex ?? -1 : this.entry.directoryCurrentChapterIndex,
        groupEnabled: this.entry.inBookshelf && this.ports?.openGroup !== undefined,
        downloadsEnabled: this.ports?.openDownloads !== undefined,
        sourceSwitchEnabled: this.detail.sourceSwitchEnabled(this.bodyBook),
        readingEnabled: this.entry.verdict === 'readable',
        readingBlockedReason: remoteContentVerdictLabel(this.entry.verdict),
        inBookshelf: this.entry.inBookshelf,
        loadingMessage: this.entry.loadingMessage,
        catalogBusy: this.entry.catalogBusy,
        removalEnabled: this.mutationEnabled,
        removing: this.mutations.snapshot.removalKey.length > 0,
        adding: this.detail.admission(this.bodyBook).adding,
        cancellingAdd: this.detail.admission(this.bodyBook).cancelling,
        shelfMessage: this.detail.message(this.bodyBook),
        isDetailActionCurrent: current,
        captureDocumentSave: (): (() => boolean) => this.ports?.captureDocumentSave?.(this.identity) ?? current,
        retainedShareFile: this.ports?.retainedShareFile,
        onContinue: (): void => { if (current?.() === true) this.ports?.openReading(); },
        onSelectChapter: (chapterIndex: number): void => {
          if (current?.() === true) this.ports?.openReading(chapterIndex);
        },
        onOpenDirectory: (): void => { if (current?.() === true) this.ports?.openDirectory(); },
        onRetryCatalog: (): void => { if (current?.() === true) this.ports?.retryCatalog(); },
        onOpenDownloads: (): void => { if (current?.() === true) this.ports?.openDownloads?.(); },
        onOpenGroup: (focusId: string): void => { if (current()) this.ports?.openGroup?.(this.identity, focusId); },
        onMoreBack: (handler: (() => boolean) | undefined, lease: string): void => {
          if (handler === undefined || current?.() === true) this.ports?.registerMoreBack?.(handler, lease);
        },
        onSwitchSource: (focusId?: string): void => { if (current?.() === true) this.ports?.openSourceSwitch(focusId); },
        admissionIdentity: this.identity,
        onRemove: (requestedIdentity?: string): void => {
          if (requestedIdentity === this.identity && current()) this.detail.request(this.identity);
        },
        onCancelAdd: (requestedIdentity?: string): void => {
          if (requestedIdentity === this.identity && current()) this.detail.cancel(this.identity);
        },
        onBack: (): void => { if (current?.() === true) this.ports?.back(); },
      })
        .width('100%').height('100%')
        .enabled(this.foreground)
        .focusable(this.foreground)
        .hitTestBehavior(this.foreground ? HitTestMode.Default : HitTestMode.None)
        .customProperty('readerLayoutDebugExcluded', !this.foreground)
        .accessibilityLevel(this.foreground ? 'auto' : 'no-hide-descendants');
    }
  }
}
