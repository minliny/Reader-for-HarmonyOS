// BookshelfComponents — P0 bookshelf demo components.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, RadiusTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

@Component
export struct ShelfChipGroup {
  private chips: string[] = ['全部', '在读', '已读', '本地'];

  build() {
    Scroll() {
      Row() {
        ForEach(this.chips, (c: string) => {
          Text(c)
            .fontSize(ReaderTypography.bookMeta().fontSize)
            .fontColor(c === '全部' ? ColorTokens.paper : ColorTokens.controlInk)
            .backgroundColor(c === '全部' ? ColorTokens.primary : ColorTokens.metaBg)
            .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
            .borderRadius(RadiusTokens.control)
            .margin({ right: SpacingTokens.xs })
        }, (c: string) => c)
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .width('100%')
    .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
  }
}

@Component
export struct ContinueReadingCard {
  build() {
    Row() {
      Column() {
        Text('继续阅读')
          .fontSize(ReaderTypography.bookMeta().fontSize)
          .fontColor(ColorTokens.muted)
        Text('示例书')
          .fontSize(ReaderTypography.bookTitle().fontSize)
          .fontColor(ColorTokens.ink)
          .fontWeight(ReaderTypography.bookTitle().fontWeight)
          .margin({ top: 2 })
        Text('已读 42%')
          .fontSize(ReaderTypography.bookMeta().fontSize)
          .fontColor(ColorTokens.primary)
          .margin({ top: 2 })
      }
      .alignItems(HorizontalAlign.Start)
      Blank()
      Text('续读')
        .fontSize(ReaderTypography.bookMeta().fontSize)
        .fontColor(ColorTokens.paper)
        .backgroundColor(ColorTokens.primary)
        .padding({ left: SpacingTokens.lg, right: SpacingTokens.lg, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
        .borderRadius(RadiusTokens.control)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' }))
    }
    .width('100%')
    .padding(SpacingTokens.cardPadding)
    .backgroundColor(ColorTokens.surface)
    .borderRadius(RadiusTokens.card)
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct ShelfSectionHeader {
  build() {
    Text('我的书架')
      .fontSize(ReaderTypography.sectionTitle().fontSize)
      .fontColor(ColorTokens.ink)
      .fontWeight(ReaderTypography.sectionTitle().fontWeight)
      .width('100%')
      .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.sm, bottom: SpacingTokens.xs })
  }
}

@Component
export struct BookCover {
  build() {
    Stack() {
      Image($r('app.media.bookshelf_cover_three_body')).width('100%').height('100%')
    }
    .width(74).height(106)
    .borderRadius(RadiusTokens.card)
    .backgroundColor(ColorTokens.metaBg)
  }
}

@Component
export struct BookCard {
  build() {
    Row() {
      BookCover()
      Column() {
        Text('三体')
          .fontSize(ReaderTypography.bookTitle().fontSize)
          .fontColor(ColorTokens.ink)
          .fontWeight(ReaderTypography.bookTitle().fontWeight)
        Text('刘慈欣')
          .fontSize(ReaderTypography.bookMeta().fontSize)
          .fontColor(ColorTokens.muted)
          .margin({ top: 2 })
        Text('已读 42%')
          .fontSize(ReaderTypography.bookMeta().fontSize)
          .fontColor(ColorTokens.primary)
          .margin({ top: 2 })
      }
      .alignItems(HorizontalAlign.Start)
      .margin({ left: SpacingTokens.sm })
      .layoutWeight(1)
      Blank()
      Image($r('app.media.reader_icon_more_dark'))
        .width(20).height(20)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' }))
    }
    .width('100%')
    .padding(SpacingTokens.cardPadding)
    .backgroundColor(ColorTokens.surface)
    .borderRadius(RadiusTokens.card)
    .alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' }))
  }
}
