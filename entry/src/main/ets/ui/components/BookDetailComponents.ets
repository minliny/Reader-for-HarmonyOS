// BookDetailComponents — P0 book-detail demo components.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, RadiusTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

@Component
export struct BookTitleAuthor {
  build() {
    Column() {
      Text('三体')
        .fontSize(ReaderTypography.pageTitle().fontSize)
        .fontColor(ColorTokens.ink)
        .fontWeight(ReaderTypography.pageTitle().fontWeight)
      Text('刘慈欣')
        .fontSize(ReaderTypography.bookMeta().fontSize)
        .fontColor(ColorTokens.muted)
        .margin({ top: 2 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
    .padding({ top: SpacingTokens.md, bottom: SpacingTokens.md })
  }
}

@Component
export struct DirectoryPreview {
  private chapters: string[] = ['第一章 科学边界', '第二章 疯狂年代', '第三章 红岸之一'];

  build() {
    Column() {
      Text('目录')
        .fontSize(ReaderTypography.sectionTitle().fontSize)
        .fontColor(ColorTokens.ink)
        .fontWeight(ReaderTypography.sectionTitle().fontWeight)
      ForEach(this.chapters, (c: string) => {
        Text(c)
          .fontSize(ReaderTypography.bookTitle().fontSize)
          .fontColor(ColorTokens.controlInk)
          .padding({ top: SpacingTokens.xs, bottom: SpacingTokens.xs })
      }, (c: string) => c)
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
export struct BookIntro {
  build() {
    Text('文化大革命如火如荼地进行，叶文洁在雷达峰向宇宙发出了人类第一条信息……')
      .fontSize(ReaderTypography.bookMeta().fontSize)
      .fontColor(ColorTokens.controlInk)
      .width('100%')
      .padding(SpacingTokens.cardPadding)
      .backgroundColor(ColorTokens.surface)
      .borderRadius(RadiusTokens.card)
      .margin({ left: SpacingTokens.md, right: SpacingTokens.md })
  }
}

@Component
export struct ReadButton {
  build() {
    Text('开始阅读')
      .fontSize(ReaderTypography.sectionTitle().fontSize)
      .fontColor(ColorTokens.paper)
      .fontWeight(ReaderTypography.sectionTitle().fontWeight)
      .width('100%')
      .textAlign(TextAlign.Center)
      .padding({ top: SpacingTokens.sm, bottom: SpacingTokens.sm })
      .backgroundColor(ColorTokens.primary)
      .borderRadius(RadiusTokens.control)
      .margin({ left: SpacingTokens.md, right: SpacingTokens.md })
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' }))
  }
}

@Component
export struct AddToShelfButton {
  build() {
    Text('加入书架')
      .fontSize(ReaderTypography.bookTitle().fontSize)
      .fontColor(ColorTokens.primary)
      .width('100%')
      .textAlign(TextAlign.Center)
      .padding({ top: SpacingTokens.sm, bottom: SpacingTokens.sm })
      .backgroundColor(ColorTokens.metaBg)
      .borderRadius(RadiusTokens.control)
      .margin({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs })
      .onClick(() => ReaderUiStore.dispatch({ type: 'set-page-state', pageState: 'default' }))
  }
}
