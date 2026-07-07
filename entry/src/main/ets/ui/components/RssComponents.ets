// RssComponents — P0 RSS demo components.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, RadiusTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

@Component
export struct SubscriptionSummaryCard {
  build() {
    Row() {
      Column() {
        Text('12').fontSize(ReaderTypography.pageTitle().fontSize).fontColor(ColorTokens.primary)
        Text('订阅').fontSize(ReaderTypography.bookMeta().fontSize).fontColor(ColorTokens.muted)
      }.alignItems(HorizontalAlign.Center)
      Blank()
      Column() {
        Text('28').fontSize(ReaderTypography.pageTitle().fontSize).fontColor(ColorTokens.rssUnread)
        Text('未读').fontSize(ReaderTypography.bookMeta().fontSize).fontColor(ColorTokens.muted)
      }.alignItems(HorizontalAlign.Center)
    }
    .width('100%')
    .padding(SpacingTokens.cardPadding)
    .backgroundColor(ColorTokens.surface)
    .borderRadius(RadiusTokens.card)
    .margin({ left: SpacingTokens.md, right: SpacingTokens.md })
  }
}

@Component
export struct FeedStatusChips {
  private chips: string[] = ['全部', '未读', '星标'];

  build() {
    Row() {
      ForEach(this.chips, (c: string) => {
        Text(c)
          .fontSize(ReaderTypography.bookMeta().fontSize)
          .fontColor(c === '全部' ? ColorTokens.paper : ColorTokens.controlInk)
          .backgroundColor(c === '全部' ? ColorTokens.primary : ColorTokens.metaBg)
          .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
          .borderRadius(RadiusTokens.control)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .margin({ right: SpacingTokens.xs })
      }, (c: string) => c)
    }
    .width('100%')
    .margin({ left: SpacingTokens.md, right: SpacingTokens.md })
  }
}

@Component
export struct FeedSourceChips {
  private chips: string[] = ['全部', 'Hacker News', '阮一峰'];

  build() {
    Scroll() {
      Row() {
        ForEach(this.chips, (c: string) => {
          Text(c)
            .fontSize(ReaderTypography.bookMeta().fontSize)
            .fontColor(ColorTokens.controlInk)
            .backgroundColor(ColorTokens.metaBg)
            .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
            .borderRadius(RadiusTokens.control)
            .margin({ right: SpacingTokens.xs })
        }, (c: string) => c)
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .width('100%')
    .margin({ left: SpacingTokens.md, right: SpacingTokens.md })
  }
}

@Component
export struct RssEntryItem {
  build() {
    Row() {
      Column() {
        Text('示例条目').fontSize(ReaderTypography.bookTitle().fontSize).fontColor(ColorTokens.ink)
        Text('这是一个 RSS 条目的摘要内容。').fontSize(ReaderTypography.bookMeta().fontSize).fontColor(ColorTokens.muted).margin({ top: 2 })
      }
      .alignItems(HorizontalAlign.Start).layoutWeight(1)
      UnreadIndicator()
    }
    .width('100%')
    .padding(SpacingTokens.cardPadding)
    .backgroundColor(ColorTokens.surface)
    .borderRadius(RadiusTokens.card)
    .margin({ left: SpacingTokens.md, right: SpacingTokens.md, bottom: SpacingTokens.xs })
    .alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-detail' }))
  }
}

@Component
export struct UnreadIndicator {
  build() {
    Circle().width(8).height(8).fill(ColorTokens.rssUnread).margin({ left: SpacingTokens.xs })
  }
}
