// DiscoverComponents — P0 discover demo components.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, RadiusTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';

@Component
export struct SearchEntry {
  build() {
    Row() {
      Image($r('app.media.ui_icon_search_dark')).width(18).height(18)
      Text('搜索书名 / 作者')
        .fontSize(ReaderTypography.bookMeta().fontSize)
        .fontColor(ColorTokens.muted)
        .margin({ left: SpacingTokens.xs })
    }
    .width('100%')
    .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.sm, bottom: SpacingTokens.sm })
    .backgroundColor(ColorTokens.surface)
    .borderRadius(RadiusTokens.control)
    .margin({ left: SpacingTokens.md, right: SpacingTokens.md })
  }
}

@Component
export struct SourceTypeSegment {
  build() {
    Row() {
      Text('全部').fontSize(ReaderTypography.bookMeta().fontSize)
        .fontColor(ColorTokens.paper).backgroundColor(ColorTokens.primary)
        .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
        .borderRadius(RadiusTokens.control).layoutWeight(1).textAlign(TextAlign.Center)
      Text('书源').fontSize(ReaderTypography.bookMeta().fontSize)
        .fontColor(ColorTokens.controlInk).backgroundColor(ColorTokens.metaBg)
        .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
        .borderRadius(RadiusTokens.control).layoutWeight(1).textAlign(TextAlign.Center).margin({ left: SpacingTokens.xs })
      Text('订阅').fontSize(ReaderTypography.bookMeta().fontSize)
        .fontColor(ColorTokens.controlInk).backgroundColor(ColorTokens.metaBg)
        .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
        .borderRadius(RadiusTokens.control).layoutWeight(1).textAlign(TextAlign.Center).margin({ left: SpacingTokens.xs })
    }
    .width('100%')
    .margin({ left: SpacingTokens.md, right: SpacingTokens.md })
  }
}

@Component
export struct CurrentSourceCard {
  build() {
    Row() {
      Text('当前书源').fontSize(ReaderTypography.bookMeta().fontSize).fontColor(ColorTokens.muted)
      Blank()
      Text('默认书源').fontSize(ReaderTypography.bookTitle().fontSize).fontColor(ColorTokens.ink)
    }
    .width('100%')
    .padding(SpacingTokens.cardPadding)
    .backgroundColor(ColorTokens.surface)
    .borderRadius(RadiusTokens.card)
    .margin({ left: SpacingTokens.md, right: SpacingTokens.md })
  }
}

@Component
export struct SourceCategoryChips {
  private chips: string[] = ['小说', '科技', '历史', '人文'];

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
export struct DiscoveryContentCard {
  build() {
    Column() {
      Text('发现内容').fontSize(ReaderTypography.bookTitle().fontSize).fontColor(ColorTokens.ink)
      Text('精选好书与热门书单').fontSize(ReaderTypography.bookMeta().fontSize).fontColor(ColorTokens.muted).margin({ top: 2 })
    }
    .width('100%')
    .padding(SpacingTokens.cardPadding)
    .backgroundColor(ColorTokens.surface)
    .borderRadius(RadiusTokens.card)
    .margin({ left: SpacingTokens.md, right: SpacingTokens.md })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceStatusBar {
  build() {
    Row() {
      Text('书源状态：就绪').fontSize(ReaderTypography.bookMeta().fontSize).fontColor(ColorTokens.muted)
    }
    .width('100%')
    .padding({ left: SpacingTokens.md, top: SpacingTokens.sm })
  }
}
