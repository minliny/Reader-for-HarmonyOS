// RssComponents — ported from frontend-demo (styles/00-foundation.css
// .fd-rss-summary-card / .fd-rss-mode-row / .fd-rss-source-strip /
// .fd-rss-article-row). Cards: border, radius-md(8), surface, soft-shadow.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';

// .fd-rss-summary-card: min-height 62, grid 34/1fr/auto, padding 10 12, border,
// radius-md, surface, soft-shadow. icon-box 34, strong 15, small 11, button pill.
@Component
export struct SubscriptionSummaryCard {
  build() {
    Row() {
      Stack()
        .width(34).height(34)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Column() {
        Text('12 订阅')
          .fontSize(15)
          .fontColor(ColorTokens.ink)
        Text('28 未读')
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .margin({ top: 3 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 10 })
      Text('管理')
        .fontSize(11)
        .fontWeight(850)
        .fontColor(DemoAliasTokens.onPrimary)
        .backgroundColor(ColorTokens.primary)
        .height(30)
        .padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .height(62)
    .padding({ left: 12, right: 12 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(VerticalAlign.Center)
  }
}

// .fd-rss-mode-row buttons: min 30, pill, 12/850; active = primary/on-primary.
@Component
export struct FeedStatusChips {
  private chips: string[] = ['全部', '未读', '星标'];

  build() {
    Row() {
      ForEach(this.chips, (c: string) => {
        Text(c)
          .fontSize(12)
          .fontWeight(850)
          .fontColor(c === '全部' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .backgroundColor(c === '全部' ? ColorTokens.primary : ColorTokens.metaBg)
          .height(30)
          .padding({ left: 10, right: 10 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .margin({ right: 6 })
      }, (c: string) => c)
    }
    .width('100%')
  }
}

// .fd-rss-source-strip buttons: 138px, min-height 58, grid 26/1fr, border, radius-md.
@Component
export struct FeedSourceChips {
  private chips: string[] = ['全部', 'Hacker News', '阮一峰'];

  build() {
    Scroll() {
      Row() {
        ForEach(this.chips, (c: string) => {
          Row() {
            Stack()
              .width(26).height(26)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.metaBg)
            Text(c)
              .fontSize(12)
              .fontColor(ColorTokens.ink)
              .margin({ left: 8 })
          }
          .width(138)
          .height(58)
          .padding(8)
          .border({ width: 1, color: ColorTokens.border })
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(DemoAliasTokens.surface)
          .alignItems(VerticalAlign.Center)
          .margin({ right: 6 })
        }, (c: string) => c)
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .width('100%')
  }
}

// .fd-rss-article-row: min-height 84, grid 10/1fr/18, padding 10 12, border-top.
//   i 7×7 dot (unread=primary), strong 13, small 10, p 11 line-clamp 2.
@Component
export struct RssEntryItem {
  build() {
    Row() {
      Circle().width(7).height(7).fill(ColorTokens.primary)
      Column() {
        Text('示例条目')
          .fontSize(13)
          .fontColor(ColorTokens.ink)
        Text('这是一个 RSS 条目的摘要内容。')
          .fontSize(10)
          .fontColor(ColorTokens.muted)
          .margin({ top: 4 })
        Text('更多内容详见原文。')
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 5 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 8 })
    }
    .width('100%')
    .height(84)
    .padding({ left: 12, right: 12 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-detail' }))
  }
}

@Component
export struct UnreadIndicator {
  build() {
    Circle().width(7).height(7).fill(ColorTokens.rssUnread)
  }
}
