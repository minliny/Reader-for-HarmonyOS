// DiscoverComponents — Core-backed discovery UI.
//
// The demo still owns the visual language, but every displayed source,
// category and book now comes from Core source.list -> source.exploreKinds ->
// source.explore.  There is deliberately no default source/ranking/fixed book
// fallback: an unavailable Core capability is shown as unavailable instead.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { CoreDiscoverBook, CoreDiscoverKind, CoreSourceEntry } from '../store/ReaderUiState';
import { SourceCoverImage } from './SourceCoverImage';

@Component
export struct DiscoverSourceBar {
  @StorageProp('reader.discoverSources') discoverSources: CoreSourceEntry[] = [];
  @StorageProp('reader.discoverSourceId') discoverSourceId: string = '';

  private selectedSource(): CoreSourceEntry | null {
    for (let i = 0; i < this.discoverSources.length; i++) {
      if (this.discoverSources[i].sourceId === this.discoverSourceId) {
        return this.discoverSources[i];
      }
    }
    return null;
  }

  private sourceTitle(): string {
    const source = this.selectedSource();
    return source === null ? '暂无可用发现书源' : source.name;
  }

  private sourceMeta(): string {
    const source = this.selectedSource();
    if (source === null) return '请导入并启用支持发现的 Core 书源';
    if (this.discoverSources.length > 1) {
      return `sourceId: ${source.sourceId} · 点按切换（${this.discoverSources.length}）`;
    }
    return `sourceId: ${source.sourceId} · 已启用发现`;
  }

  private openSelectedOrImport(): void {
    if (this.discoverSources.length > 0) {
      ReaderUiStore.dispatch({ type: 'discover-source-cycle' });
    } else {
      ReaderUiStore.dispatch({ type: 'route-push', id: 'source-import-options' });
    }
  }

  build() {
    Row() {
      Stack()
        .width(34)
        .height(34)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Column() {
        Text(this.sourceTitle())
          .fontSize(15)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.sourceMeta())
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .margin({ top: 3 })
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 10 })
      .onClick(() => this.openSelectedOrImport())
      Image($r('app.media.reader_icon_more_dark'))
        .width(18)
        .height(18)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-management' }))
    }
    .width('100%')
    .height(58)
    .padding({ left: 12, right: 12 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(VerticalAlign.Center)
  }
}

// Core can return grouping headers with an empty URL.  Those headers remain
// visible, but only a non-empty Core URL is an executable discovery entry.
@Component
export struct DiscoverEntryRow {
  @StorageProp('reader.discoverKinds') discoverKinds: CoreDiscoverKind[] = [];
  @StorageProp('reader.discoverKindUrl') discoverKindUrl: string = '';

  private label(kind: CoreDiscoverKind): string {
    return kind.title.length > 0 ? kind.title : '未命名入口';
  }

  private isExecutable(kind: CoreDiscoverKind): boolean {
    return kind.url.length > 0;
  }

  build() {
    if (this.discoverKinds.length > 0) {
      Scroll() {
        Row() {
          ForEach(this.discoverKinds, (kind: CoreDiscoverKind, index: number) => {
            Text(this.label(kind))
              .fontSize(12)
              .fontWeight(800)
              .fontColor(this.isExecutable(kind) && kind.url === this.discoverKindUrl
                ? DemoAliasTokens.onPrimary : (this.isExecutable(kind) ? ColorTokens.controlInk : ColorTokens.muted))
              .backgroundColor(this.isExecutable(kind) && kind.url === this.discoverKindUrl
                ? ColorTokens.primary : ColorTokens.metaBg)
              .height(32)
              .padding({ left: 12, right: 12 })
              .borderRadius(DemoAliasTokens.radiusPill)
              .margin({ right: 7 })
              .onClick(() => {
                if (this.isExecutable(kind)) {
                  ReaderUiStore.dispatch({ type: 'discover-kind-select', discoverKindUrl: kind.url });
                }
              })
          }, (kind: CoreDiscoverKind, index: number) => `${kind.url}-${kind.title}-${index}`)
        }
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')
    } else {
      Blank().height(0)
    }
  }
}

// The old sort control advertised rankings the Core protocol does not provide.
// Keep the compact demo control shape, but make it an explicit reload of the
// currently selected Core entry and state that Core preserves source order.
@Component
export struct DiscoverFilterTrigger {
  @StorageProp('reader.discoverSourceId') discoverSourceId: string = '';
  @StorageProp('reader.discoverKindUrl') discoverKindUrl: string = '';
  @StorageProp('reader.discoverKindTitle') discoverKindTitle: string = '';

  build() {
    if (this.discoverSourceId.length > 0 && this.discoverKindUrl.length > 0) {
      Row() {
        Text('当前入口')
          .fontSize(12)
          .fontWeight(900)
          .fontColor(ColorTokens.controlInk)
        Text(this.discoverKindTitle.length > 0 ? this.discoverKindTitle : 'Core 入口')
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .margin({ left: 7 })
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text('Core 顺序 · 刷新')
          .fontSize(11)
          .fontColor(ColorTokens.primaryDark)
          .onClick(() => ReaderUiStore.dispatch({ type: 'discover-refresh' }))
      }
      .width('100%')
      .height(34)
      .padding({ left: 10, right: 10 })
      .border({ width: 1, color: ColorTokens.border })
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(ColorTokens.metaBg)
      .alignItems(VerticalAlign.Center)
    } else {
      Blank().height(0)
    }
  }
}

@Component
export struct DiscoverListHead {
  @StorageProp('reader.discoverLoading') discoverLoading: boolean = false;
  @StorageProp('reader.discoverError') discoverError: string = '';
  @StorageProp('reader.discoverSourceId') discoverSourceId: string = '';
  @StorageProp('reader.discoverKindUrl') discoverKindUrl: string = '';
  @StorageProp('reader.discoverKindTitle') discoverKindTitle: string = '';
  @StorageProp('reader.discoverBooks') discoverBooks: CoreDiscoverBook[] = [];

  build() {
    if (!this.discoverLoading && this.discoverError.length === 0 &&
      this.discoverSourceId.length > 0 && this.discoverKindUrl.length > 0) {
      Row() {
        Text(this.discoverKindTitle.length > 0 ? this.discoverKindTitle : '发现结果')
          .fontSize(15)
          .fontColor(ColorTokens.ink)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`${this.discoverBooks.length} 本`)
          .fontSize(11)
          .fontColor(ColorTokens.muted)
      }
      .width('100%')
      .padding({ left: 2 })
    } else {
      Blank().height(0)
    }
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

  private authorKind(): string {
    if (this.kind.length > 0) return `${this.author} · ${this.kind}`;
    return this.author;
  }

  build() {
    Row() {
      Stack() {
        SourceCoverImage({ sourceId: this.sourceId, coverUrl: this.coverUrl })
        if (this.coverUrl.length === 0) {
          Text('书')
            .fontSize(16)
            .fontWeight(800)
            .fontColor(ColorTokens.primaryDark)
        }
      }
      .width(52)
      .height(74)
      .borderRadius(DemoAliasTokens.radiusXs)
      .backgroundColor(ColorTokens.metaBg)
      Column() {
        Text(this.title)
          .fontSize(15)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.authorKind())
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .margin({ top: 3 })
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.latest.length > 0) {
          Text(this.latest)
            .fontSize(11)
            .fontColor(ColorTokens.primaryDark)
            .margin({ top: 3 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        if (this.intro.length > 0) {
          Text(this.intro)
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 5 })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 11 })
    }
    .width('100%')
    .padding({ top: 12, bottom: 12, left: 12, right: 12 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .onClick(() => {
      if (this.sourceId.length === 0 || this.bookUrl.length === 0) return;
      ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
      ReaderUiStore.dispatch({ type: 'book-detail-load', bookId: this.bookUrl, sourceId: this.sourceId });
    })
  }
}

@Component
struct DiscoverStateAction {
  @Prop label: string = '';
  @Prop action: string = '';
  @Prop primary: boolean = false;

  private run(): void {
    if (this.action === 'discover-refresh') {
      ReaderUiStore.dispatch({ type: 'discover-refresh' });
    } else if (this.action === 'source-import') {
      ReaderUiStore.dispatch({ type: 'route-push', id: 'source-import-options' });
    } else if (this.action === 'source-management') {
      ReaderUiStore.dispatch({ type: 'route-push', id: 'source-management' });
    } else if (this.action === 'discover-home') {
      ReaderUiStore.dispatch({ type: 'route-replace', id: 'discover' });
    }
  }

  build() {
    Text(this.label)
      .fontSize(12)
      .fontWeight(800)
      .fontColor(this.primary ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(34)
      .padding({ left: 14, right: 14 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.primary ? ColorTokens.primary : ColorTokens.metaBg)
      .border({ width: this.primary ? 0 : 1, color: ColorTokens.border })
      .textAlign(TextAlign.Center)
      .onClick(() => this.run())
  }
}

@Component
struct DiscoverStateCard {
  @Prop variant: string = 'empty';
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop primaryLabel: string = '';
  @Prop primaryAction: string = '';
  @Prop secondaryLabel: string = '';
  @Prop secondaryAction: string = '';

  private iconName(): string {
    if (this.variant === 'error') return 'ui_icon_info_primary';
    if (this.variant === 'no-results') return 'ui_icon_search_primary';
    return 'ui_icon_source_stack_primary';
  }

  build() {
    Column() {
      Image($r(`app.media.${this.iconName()}`))
        .width(36)
        .height(36)
      Text(this.title)
        .fontSize(18)
        .fontWeight(800)
        .fontColor(ColorTokens.ink)
        .textAlign(TextAlign.Center)
        .margin({ top: 12 })
      Text(this.message)
        .fontSize(13)
        .lineHeight(19)
        .fontColor(ColorTokens.muted)
        .textAlign(TextAlign.Center)
        .margin({ top: 8 })
      if (this.primaryLabel.length > 0 || this.secondaryLabel.length > 0) {
        Row({ space: 8 }) {
          if (this.primaryLabel.length > 0) {
            DiscoverStateAction({ label: this.primaryLabel, action: this.primaryAction, primary: true })
          }
          if (this.secondaryLabel.length > 0) {
            DiscoverStateAction({ label: this.secondaryLabel, action: this.secondaryAction })
          }
        }
        .justifyContent(FlexAlign.Center)
        .width('100%')
        .margin({ top: 14 })
      }
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24, bottom: 24 })
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(HorizontalAlign.Center)
  }
}

@Component
struct DiscoverSkeletonList {
  private rows: number[] = [0, 1, 2];

  build() {
    Column() {
      ForEach(this.rows, (row: number) => {
        Row() {
          Column()
            .width(52)
            .height(74)
            .borderRadius(DemoAliasTokens.radiusXs)
            .backgroundColor(ColorTokens.metaBg)
          Column({ space: 8 }) {
            Column().width('72%').height(14).borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.metaBg)
            Column().width('48%').height(12).borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.metaBg)
            Column().width('90%').height(12).borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.metaBg)
            Column().width('64%').height(12).borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.metaBg)
          }
          .layoutWeight(1)
          .margin({ left: 11 })
        }
        .width('100%')
        .padding({ left: 12, right: 12, top: 12, bottom: 12 })
        .border({ width: { top: row === 0 ? 0 : 1 }, color: ColorTokens.border })
      }, (row: number) => `${row}`)
    }
    .width('100%')
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
  }
}

@Component
export struct DiscoverBookList {
  @StorageProp('reader.discoverSources') discoverSources: CoreSourceEntry[] = [];
  @StorageProp('reader.discoverKinds') discoverKinds: CoreDiscoverKind[] = [];
  @StorageProp('reader.discoverBooks') discoverBooks: CoreDiscoverBook[] = [];
  @StorageProp('reader.discoverLoading') discoverLoading: boolean = false;
  @StorageProp('reader.discoverLoaded') discoverLoaded: boolean = false;
  @StorageProp('reader.discoverError') discoverError: string = '';

  private hasExecutableKind(): boolean {
    for (let i = 0; i < this.discoverKinds.length; i++) {
      if (this.discoverKinds[i].url.length > 0) return true;
    }
    return false;
  }

  build() {
    if (this.discoverLoading || !this.discoverLoaded) {
      DiscoverSkeletonList()
    } else if (this.discoverError.length > 0) {
      DiscoverStateCard({
        variant: 'error',
        title: 'Core 发现请求失败',
        message: this.discoverError,
        primaryLabel: '重试',
        primaryAction: 'discover-refresh',
        secondaryLabel: '书源管理',
        secondaryAction: 'source-management',
      })
    } else if (this.discoverSources.length === 0) {
      DiscoverStateCard({
        variant: 'empty',
        title: '暂无可用发现书源',
        message: 'Core source.list 未返回已启用且 enabledExplore=true 的书源。导入支持发现的书源后可在这里浏览。',
        primaryLabel: '导入书源',
        primaryAction: 'source-import',
        secondaryLabel: '书源管理',
        secondaryAction: 'source-management',
      })
    } else if (!this.hasExecutableKind()) {
      DiscoverStateCard({
        variant: 'empty',
        title: '当前书源没有可执行分类',
        message: 'Core source.exploreKinds 未返回可请求的入口 URL。请检查该已导入书源的发现规则。',
        primaryLabel: '刷新',
        primaryAction: 'discover-refresh',
        secondaryLabel: '书源管理',
        secondaryAction: 'source-management',
      })
    } else if (this.discoverBooks.length === 0) {
      DiscoverStateCard({
        variant: 'no-results',
        title: '当前入口没有返回书籍',
        message: 'Core source.explore 已完成，但该入口没有可打开的 bookUrl 条目。',
        primaryLabel: '刷新',
        primaryAction: 'discover-refresh',
        secondaryLabel: '书源管理',
        secondaryAction: 'source-management',
      })
    } else {
      Column() {
        ForEach(this.discoverBooks, (book: CoreDiscoverBook, index: number) => {
          DiscoverBookRow({
            sourceId: book.sourceId,
            bookUrl: book.bookUrl,
            title: book.title,
            author: book.author,
            kind: book.kind,
            latest: book.lastChapter,
            intro: book.intro,
            coverUrl: book.coverUrl,
          })
        }, (book: CoreDiscoverBook, index: number) => `${book.sourceId}-${book.bookUrl}-${index}`)
      }
      .width('100%')
      .border({ width: 1, color: ColorTokens.border })
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
      .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    }
  }
}

// Generated contract state routes still instantiate this component.  Ignore
// their old fixture copy and render the same live Core state as the main tab.
@Component
export struct DiscoverStatePage {
  @Prop variant: string = 'empty';
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop action: string = '';

  build() {
    Column() {
      DiscoverSourceBar()
      DiscoverEntryRow()
        .margin({ top: 12 })
      DiscoverFilterTrigger()
        .margin({ top: 10 })
      DiscoverListHead()
        .margin({ top: 14, bottom: 8 })
      DiscoverBookList()
        .margin({ top: 8 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// The generated routes remain addressable for navigation compatibility, but
// their previous fixture-only workflows are deliberately unavailable until a
// corresponding Core/Host capability is exposed.
@Component
struct DiscoverUnavailablePage {
  @Prop title: string = '';
  @Prop message: string = '';

  build() {
    DiscoverStateCard({
      variant: 'empty',
      title: this.title,
      message: this.message,
      primaryLabel: '书源管理',
      primaryAction: 'source-management',
      secondaryLabel: '返回发现',
      secondaryAction: 'discover-home',
    })
  }
}

@Component
export struct DiscoverSourceBulkPage {
  build() {
    DiscoverUnavailablePage({
      title: '发现源批量启停不可用',
      message: '当前 Core/Host 未提供书源批量启停命令。此页不会伪造可启用、禁用或刷新结果，请使用书源管理中的已接入操作。',
    })
  }
}

@Component
export struct DiscoverSourceLoginPage {
  build() {
    DiscoverUnavailablePage({
      title: '书源登录流程不可用',
      message: '当前 Core/Host 未暴露书源登录态协商能力。此页不会显示伪网页登录、Cookie 保存或登录成功状态。',
    })
  }
}

@Component
export struct DiscoverRuleTestPage {
  build() {
    DiscoverUnavailablePage({
      title: '发现规则编辑与测试不可用',
      message: 'Core 已可执行已持久化书源的 source.exploreKinds/source.explore，但当前 Host 未接入规则编辑或调试写入能力。',
    })
  }
}
