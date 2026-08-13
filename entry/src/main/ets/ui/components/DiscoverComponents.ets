// DiscoverComponents — the admitted Discover surface is rendered from the
// current Figma Phone/Tablet master.  Core owns all source, category and book
// values; no Figma sample book, latency, source id or locally invented state
// card is allowed into the visible route.
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { CoreDiscoverBook, CoreDiscoverKind, CoreSourceEntry } from '../store/ReaderUiState';
import { SourceCoverImage } from './SourceCoverImage';

@Component
export struct DiscoverSourceBar {
  @StorageProp('reader.discoverSources') sources: CoreSourceEntry[] = [];
  @StorageProp('reader.discoverSourceId') sourceId: string = '';

  private selectedSource(): CoreSourceEntry | null {
    for (let index = 0; index < this.sources.length; index += 1) {
      if (this.sources[index].sourceId === this.sourceId) return this.sources[index];
    }
    return null;
  }

  private sourceTitle(): string {
    const source = this.selectedSource();
    return source === null ? '' : source.name;
  }

  private sourceMeta(): string {
    const source = this.selectedSource();
    if (source === null) return '';
    return source.enabled ? '已启用发现' : '发现未启用';
  }

  private cycleSource(): void {
    if (this.sources.length > 1) ReaderUiStore.dispatch({ type: 'discover-source-cycle' });
  }

  build() {
    if (this.selectedSource() === null) {
      // The current Figma source card has no empty-state variant.  Do not turn
      // missing Core data into a generic status card.
      Column().width(0).height(0)
    } else {
      Row() {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.discover_source_layers')).width(20).height(20)
        }
        .width(34)
        .height(34)
        .borderRadius(17)
        .backgroundColor(ReaderUiVisualTokens.discoverSourceIconSurface)
        Column() {
          Text(this.sourceTitle())
            .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
            .fontSize(ReaderUiVisualTokens.discoverTitleSize)
            .fontWeight(700)
            .fontColor(ReaderUiVisualTokens.discoverHeaderInk)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          if (this.sourceMeta().length > 0) {
            Text(this.sourceMeta())
              .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
              .fontSize(ReaderUiVisualTokens.discoverMetaSize)
              .fontWeight(650)
              .fontColor(ReaderUiVisualTokens.discoverMuted)
              .margin({ top: 3 })
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
        .margin({ left: 10 })
        Text('⌄')
          .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
          .fontSize(18)
          .fontColor(ReaderUiVisualTokens.discoverHeaderInk)
          .width(20)
          .textAlign(TextAlign.Center)
      }
      .width('100%')
      .height(ReaderUiVisualTokens.discoverSourceCardHeight)
      .padding({ left: 12, right: 12 })
      .border({ width: 1, color: ReaderUiVisualTokens.discoverSourceCardBorder })
      .borderRadius(ReaderUiVisualTokens.discoverResultRadius)
      .backgroundColor(ReaderUiVisualTokens.discoverSourceCardSurface)
      .alignItems(VerticalAlign.Center)
      .accessibilityText(`${this.sourceTitle()} ${this.sourceMeta()}`)
      .onClick(() => this.cycleSource())
    }
  }
}

@Component
export struct DiscoverEntryRow {
  @StorageProp('reader.discoverKinds') kinds: CoreDiscoverKind[] = [];
  @StorageProp('reader.discoverKindUrl') selectedUrl: string = '';

  private executable(kind: CoreDiscoverKind): boolean {
    return kind.url.trim().length > 0;
  }

  build() {
    if (this.kinds.length === 0) {
      Column().width(0).height(0)
    } else {
      Scroll() {
        Row() {
          ForEach(this.kinds, (kind: CoreDiscoverKind, index: number) => {
            Text(kind.title)
              .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
              .fontSize(12)
              .fontWeight(800)
              .fontColor(this.executable(kind) && kind.url === this.selectedUrl
                ? ReaderUiVisualTokens.discoverOnPrimary
                : ReaderUiVisualTokens.discoverInactiveChipInk)
              .height(ReaderUiVisualTokens.discoverChipHeight)
              .padding({ left: 12, right: 12 })
              .borderRadius(999)
              .backgroundColor(this.executable(kind) && kind.url === this.selectedUrl
                ? ReaderUiVisualTokens.discoverPrimary
                : ReaderUiVisualTokens.discoverInactiveChipSurface)
              .opacity(this.executable(kind) ? 1 : 0.55)
              .margin({ right: ReaderUiVisualTokens.discoverChipGap })
              .onClick(() => {
                if (this.executable(kind)) {
                  ReaderUiStore.dispatch({ type: 'discover-kind-select', discoverKindUrl: kind.url });
                }
              })
          }, (kind: CoreDiscoverKind, index: number) => `${kind.title}-${kind.url}-${index}`)
        }
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')
    }
  }
}

@Component
export struct DiscoverFilterTrigger {
  @StorageProp('reader.discoverKindTitle') kindTitle: string = '';

  build() {
    Row({ space: ReaderUiVisualTokens.discoverFilterAffordanceGap }) {
      Row() {
        Image($r('app.media.discover_filter')).width(20).height(20)
        Text('筛选')
          .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
          .fontSize(12)
          .fontWeight(900)
          .fontColor(ReaderUiVisualTokens.discoverInactiveChipInk)
          .margin({ left: ReaderUiVisualTokens.discoverFilterLabelGap })
        Text(this.kindTitle.length > 0 ? this.kindTitle : '全部')
          .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
          .fontSize(ReaderUiVisualTokens.discoverMetaSize)
          .fontWeight(800)
          .fontColor(ReaderUiVisualTokens.discoverMuted)
          .width(ReaderUiVisualTokens.discoverFilterSelectionWidth)
          .textAlign(TextAlign.End)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ left: ReaderUiVisualTokens.discoverFilterAffordanceGap })
        Image($r('app.media.discover_filter_caret'))
          .width(20)
          .height(20)
          .margin({ left: ReaderUiVisualTokens.discoverFilterAffordanceGap })
      }
      .width(ReaderUiVisualTokens.discoverFilterFieldWidth)
      .height(ReaderUiVisualTokens.discoverFilterHeight)
      .padding({
        left: ReaderUiVisualTokens.discoverFilterContentInset,
        right: ReaderUiVisualTokens.discoverFilterFieldTrailingInset,
      })
      .border({ width: 1, color: ReaderUiVisualTokens.discoverFilterBorder })
      .borderRadius(ReaderUiVisualTokens.discoverResultRadius)
      .backgroundColor(ReaderUiVisualTokens.discoverFilterSurface)
      .alignItems(VerticalAlign.Center)
      Row() {
        Image($r('app.media.discover_filter_apply_check')).width(20).height(20)
        Text('应用')
          .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
          .fontSize(12)
          .fontWeight(900)
          .fontColor(ReaderUiVisualTokens.discoverOnPrimary)
          .margin({ left: ReaderUiVisualTokens.discoverFilterActionLabelGap })
      }
      .width(ReaderUiVisualTokens.discoverFilterActionWidth)
      .height(ReaderUiVisualTokens.discoverFilterHeight)
      .padding({ left: ReaderUiVisualTokens.discoverFilterContentInset, right: ReaderUiVisualTokens.discoverFilterContentInset })
      .border({ width: 1, color: ReaderUiVisualTokens.discoverFilterActionBorder })
      .borderRadius(ReaderUiVisualTokens.discoverResultRadius)
      .linearGradient({
        angle: 90,
        colors: [
          [ReaderUiVisualTokens.discoverFilterActionStart, 0],
          [ReaderUiVisualTokens.discoverFilterActionEnd, 100],
        ],
      })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .accessibilityText(`筛选：${this.kindTitle.length > 0 ? this.kindTitle : '全部'}`)
  }
}

@Component
export struct DiscoverListHead {
  @StorageProp('reader.discoverKindTitle') kindTitle: string = '';

  build() {
    Text(this.kindTitle.length > 0 ? this.kindTitle : '发现')
      .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
      .fontSize(ReaderUiVisualTokens.discoverTitleSize)
      .fontWeight(700)
      .fontColor(ReaderUiVisualTokens.discoverHeaderInk)
      .width('100%')
      .padding({ left: 2 })
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
  }
}

@Component
export struct DiscoverBookRow {
  @Prop sourceId: string = '';
  @Prop bookUrl: string = '';
  @Prop title: string = '';
  @Prop author: string = '';
  @Prop kind: string = '';
  @Prop latest: string = '';
  @Prop intro: string = '';
  @Prop coverUrl: string = '';
  @Prop first: boolean = false;

  private authorKind(): string {
    if (this.author.length > 0 && this.kind.length > 0) return `${this.author} · ${this.kind}`;
    return this.author.length > 0 ? this.author : this.kind;
  }

  private openBook(): void {
    if (this.sourceId.length === 0 || this.bookUrl.length === 0) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
    ReaderUiStore.dispatch({ type: 'book-detail-load', bookId: this.bookUrl, sourceId: this.sourceId });
  }

  build() {
    Row() {
      Stack({ alignContent: Alignment.BottomEnd }) {
        SourceCoverImage({ sourceId: this.sourceId, coverUrl: this.coverUrl })
        Circle()
          .width(12)
          .height(12)
          .fill(ReaderUiVisualTokens.discoverResultIndicator)
          .border({ width: 2, color: ReaderUiVisualTokens.discoverSourceCardSurface })
          .margin({ right: 1, bottom: 1 })
      }
      .width(ReaderUiVisualTokens.discoverCoverWidth)
      .height(ReaderUiVisualTokens.discoverCoverHeight)
      .borderRadius(ReaderUiVisualTokens.discoverCoverRadius)
      .clip(true)
      Column() {
        Text(this.title)
          .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
          .fontSize(ReaderUiVisualTokens.discoverTitleSize)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.discoverHeaderInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.authorKind().length > 0) {
          Text(this.authorKind())
            .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
            .fontSize(ReaderUiVisualTokens.discoverMetaSize)
            .fontWeight(700)
            .fontColor(ReaderUiVisualTokens.discoverMuted)
            .margin({ top: 4 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        if (this.latest.length > 0) {
          Text(`最新：${this.latest}`)
            .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
            .fontSize(ReaderUiVisualTokens.discoverMetaSize)
            .fontWeight(700)
            .fontColor(ReaderUiVisualTokens.discoverHeaderInk)
            .margin({ top: 4 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        if (this.intro.length > 0) {
          Text(this.intro)
            .fontFamily(ReaderUiVisualTokens.discoverControlFontFamily)
            .fontSize(ReaderUiVisualTokens.discoverBodySize)
            .fontColor(ReaderUiVisualTokens.discoverBodyInk)
            .lineHeight(18)
            .margin({ top: 4 })
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 11 })
    }
    .width('100%')
    .padding({ top: 12, right: 12, bottom: 12, left: 12 })
    .border(this.first ? { width: 0 } : { width: { top: 1 }, color: ReaderUiVisualTokens.discoverSourceCardBorder })
    .alignItems(VerticalAlign.Top)
    .onClick(() => this.openBook())
  }
}

@Component
export struct DiscoverBookList {
  @StorageProp('reader.discoverBooks') books: CoreDiscoverBook[] = [];
  @StorageProp('reader.discoverLoaded') loaded: boolean = false;
  @StorageProp('reader.discoverLoading') loading: boolean = false;
  @StorageProp('reader.discoverError') error: string = '';

  build() {
    if (!this.loaded || this.loading || this.error.length > 0 || this.books.length === 0) {
      // Current Figma has no admitted empty/loading/error master for Discover.
      // Keep those states visually inert rather than making a nearby generic card.
      Column().width(0).height(0)
    } else {
      Column() {
        ForEach(this.books, (book: CoreDiscoverBook, index: number) => {
          DiscoverBookRow({
            sourceId: book.sourceId,
            bookUrl: book.bookUrl,
            title: book.title,
            author: book.author,
            kind: book.kind,
            latest: book.lastChapter,
            intro: book.intro,
            coverUrl: book.coverUrl,
            first: index === 0,
          })
        }, (book: CoreDiscoverBook, index: number) => `${book.sourceId}-${book.bookUrl}-${index}`)
      }
      .width('100%')
      .border({ width: 1, color: ReaderUiVisualTokens.discoverResultsBorder })
      .borderRadius(ReaderUiVisualTokens.discoverResultRadius)
      .backgroundColor(ReaderUiVisualTokens.discoverResultsSurface)
      .clip(true)
    }
  }
}

// The remaining generated discovery routes have no current Figma state master.
// Route admission blocks them before rendering; these compatibility exports are
// deliberately zero-sized so a future direct mount cannot resurrect old prose.
@Component
export struct DiscoverStatePage {
  @Prop variant: string = '';
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop action: string = '';
  build() { Column().width(0).height(0) }
}
@Component
export struct DiscoverSourceBulkPage { build() { Column().width(0).height(0) } }
@Component
export struct DiscoverSourceLoginPage { build() { Column().width(0).height(0) } }
@Component
export struct DiscoverRuleTestPage { build() { Column().width(0).height(0) } }
