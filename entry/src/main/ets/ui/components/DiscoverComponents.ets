// DiscoverComponents — ported from frontend-demo (styles/00-foundation.css
// .fd-search-entry / .fd-discover-source-bar / .fd-discover-book-row /
// .fd-chip-row). Cards: border, radius-md(8), surface, soft-shadow.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';

// .fd-search-entry: min-height 44, pill, 24px icon + 14px muted text, padding 0 14.
@Component
export struct SearchEntry {
  build() {
    Row() {
      Image($r('app.media.ui_icon_search_dark')).width(24).height(24)
      Text('搜索书名 / 作者')
        .fontSize(14)
        .fontColor(ColorTokens.muted)
        .margin({ left: 10 })
    }
    .width('100%')
    .height(44)
    .padding({ left: 14, right: 14 })
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

// .fd-discover-entry-row buttons: min 32, pill, 12/800; active = primary/on-primary.
@Component
export struct SourceTypeSegment {
  build() {
    Row() {
      this.seg('全部', true)
      this.seg('书源', false)
      this.seg('订阅', false)
    }
    .width('100%')
  }

  @Builder seg(label: string, active: boolean) {
    Text(label)
      .fontSize(12)
      .fontWeight(800)
      .fontColor(active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
      .backgroundColor(active ? ColorTokens.primary : DemoAliasTokens.surface)
      .borderRadius(DemoAliasTokens.radiusPill)
      .height(32)
      .layoutWeight(1)
      .textAlign(TextAlign.Center)
      .margin({ right: 7 })
  }
}

// .fd-discover-source-bar: min-height 58, grid 34/1fr/18, padding 10 12, border,
// radius-md, surface, soft-shadow. icon-box 34 circle primary-tint, strong 15, small 11.
@Component
export struct CurrentSourceCard {
  build() {
    Row() {
      Stack()
        .width(34).height(34)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Column() {
        Text('当前书源')
          .fontSize(15)
          .fontColor(ColorTokens.ink)
        Text('默认书源')
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .margin({ top: 3 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 10 })
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

// .fd-chip-row buttons: min 32, pill, 12/800, surface/ink.
@Component
export struct SourceCategoryChips {
  private chips: string[] = ['小说', '科技', '历史', '人文'];

  build() {
    Scroll() {
      Row() {
        ForEach(this.chips, (c: string) => {
          Text(c)
            .fontSize(12)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .backgroundColor(ColorTokens.metaBg)
            .height(32)
            .padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .margin({ right: 8 })
        }, (c: string) => c)
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .width('100%')
  }
}

// .fd-discover-book-row: min-height 108, grid 52/1fr, gap 11, padding 12, border-top.
//   img 52×74, h3 15, small 11, p 12 line-clamp 2.
@Component
export struct DiscoveryContentCard {
  build() {
    Row() {
      Image($r('app.media.bookshelf_cover_three_body'))
        .width(52).height(74)
        .objectFit(ImageFit.Cover)
        .borderRadius(DemoAliasTokens.radiusXs)
      Column() {
        Text('精选好书')
          .fontSize(15)
          .fontColor(ColorTokens.ink)
        Text('热门书单')
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .margin({ top: 3 })
        Text('发现页精选内容与热门书单,持续更新。')
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 5 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 11 })
    }
    .width('100%')
    .padding(12)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' }))
  }
}

@Component
export struct SourceStatusBar {
  build() {
    Row() {
      Text('书源状态：就绪')
        .fontSize(12)
        .fontColor(ColorTokens.muted)
    }
    .width('100%')
    .padding({ left: 12, top: 12 })
  }
}
