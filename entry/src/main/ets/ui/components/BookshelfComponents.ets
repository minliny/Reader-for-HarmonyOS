// BookshelfComponents — P0 bookshelf demo components, ported 1:1 from
// frontend-demo/styles/00-foundation.css (.fd-continue-card / .fd-book-grid /
// .fd-book-card / .fd-book-cover-frame / .fd-chip-row / .fd-section-head).
// All sizes are demo vp values (lint allows plain numbers); colors via tokens.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SpacingTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

// .fd-chip-row: flex wrap, gap 8, min-height 34. Chips: min 56×34, padding 0 12,
// pill, surface bg, ink 14/700; active = primary bg / on-primary.
@Component
export struct ShelfChipGroup {
  private chips: string[] = ['全部', '在读', '已读', '本地'];
  private active: string = '全部';

  build() {
    Row() {
      ForEach(this.chips, (c: string) => {
        Text(c)
          .fontSize(14)
          .fontWeight(700)
          .fontColor(c === this.active ? DemoAliasTokens.onPrimary : ColorTokens.ink)
          .backgroundColor(c === this.active ? ColorTokens.primary : DemoAliasTokens.surface)
          .borderRadius(DemoAliasTokens.radiusPill)
          .padding({ left: 12, right: 12, top: 8, bottom: 8 })
          .height(34)
          .margin({ right: 8 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-page-state', pageState: 'default' }))
      }, (c: string) => c)
    }
    .width('100%')
    .height(34)
  }
}

// .fd-continue-card: grid 62px 1fr 82px; gap 14; min-height 100; padding 10 16;
// border 1 border; radius-md(8); surface bg; soft-shadow.
//   cover: 62px, aspect-ratio 2/3, radius-sm(6).
//   label (h2 "继续阅读"): sans 13/900 primary.
//   title (strong): serif 20, line-clamp 2.
//   author: muted 14, line-clamp 2.
//   action button (.fd-continue-action-button): min 74×40, padding 0 14, pill,
//     primary bg, on-primary 13/800.
@Component
export struct ContinueReadingCard {
  build() {
    Row() {
      // cover (62px, aspect 2/3)
      Stack() {
        Image($r('app.media.bookshelf_cover_three_body'))
          .width('100%').height('100%')
          .objectFit(ImageFit.Cover)
      }
      .width(62)
      .aspectRatio(2 / 3)
      .borderRadius(DemoAliasTokens.radiusSm)
      .backgroundColor(ColorTokens.metaBg)

      // content: label + title + author
      Column() {
        Text('继续阅读')
          .fontSize(13)
          .fontWeight(900)
          .fontColor(ColorTokens.primary)
          .fontFamily(ReaderTypography.sansFamily())
        Text('示例书')
          .fontSize(20)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .fontFamily(ReaderTypography.serifFamily())
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 6 })
        Text('示例作者')
          .fontSize(14)
          .fontColor(ColorTokens.muted)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 5 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 14, right: 14 })

      // action button (min 74×40, pill, primary)
      Text('续读')
        .fontSize(13)
        .fontWeight(800)
        .fontColor(DemoAliasTokens.onPrimary)
        .backgroundColor(ColorTokens.primary)
        .borderRadius(DemoAliasTokens.radiusPill)
        .height(40)
        .padding({ left: 14, right: 14 })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' }))
    }
    .width('100%')
    .padding({ top: 10, bottom: 10, left: 16, right: 16 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
  }
}

// .fd-section-head: flex space-between, gap 12, min-height 38. h2 15px.
//   button (more): 34×34 circle, transparent bg, muted.
@Component
export struct ShelfSectionHeader {
  build() {
    Row() {
      Text('我的书架')
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
      Blank()
      Image($r('app.media.reader_icon_more_dark'))
        .width(34).height(34)
    }
    .width('100%')
    .height(38)
  }
}

// .fd-book-cover-frame: width 100%, aspect-ratio 2/3, radius-md(8), surface bg,
// soft-shadow. img fills (object-fit cover).
@Component
export struct BookCover {
  build() {
    Stack() {
      Image($r('app.media.bookshelf_cover_three_body'))
        .width('100%').height('100%')
        .objectFit(ImageFit.Cover)
    }
    .width('100%')
    .aspectRatio(2 / 3)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 6 })
  }
}

// .fd-book-card (cover mode): grid, align-content start, gap 6.
//   cover (100%, aspect 2/3) → title (serif 15, line-clamp 2) → meta (12 muted).
@Component
export struct BookCard {
  @Prop title: string = '三体';
  @Prop author: string = '刘慈欣';

  build() {
    Column() {
      BookCover()
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .fontFamily(ReaderTypography.serifFamily())
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })
      Text(this.author)
        .fontSize(12)
        .fontColor(ColorTokens.muted)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .alignItems(HorizontalAlign.Start)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' }))
  }
}

// .fd-book-grid: grid-template-columns repeat(3, 1fr); gap 16px 30px.
// Renders 3 demo BookCards.
@Component
export struct BookGrid {
  private books: Array<[string, string]> = [
    ['三体', '刘慈欣'],
    ['基地', '阿西莫夫'],
    ['球状闪电', '刘慈欣'],
  ];

  build() {
    Grid() {
      ForEach(this.books, (b: [string, string], i: number) => {
        GridItem() {
          BookCard({ title: b[0], author: b[1] })
        }
      }, (b: [string, string], i: number) => `${b[0]}-${i}`)
    }
    .columnsTemplate('1fr 1fr 1fr')
    .rowsGap(16)
    .columnsGap(30)
    .width('100%')
  }
}
