// BookDetailComponents — book-detail demo components ported from frontend-demo
// (styles/00-foundation.css .fd-book-hero + styles/04-settings-source.css
// .fd-book-source-card / .fd-book-summary-card / .fd-book-operation-card /
// .fd-chapter-list). Cards: border 1 border, radius-md(8), surface bg, soft-shadow.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

// fd-book-hero title block: title serif (page-title 20/700), author 14 muted.
@Component
export struct BookTitleAuthor {
  build() {
    Column() {
      Text('三体')
        .fontSize(20)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .fontFamily(ReaderTypography.serifFamily())
      Text('刘慈欣')
        .fontSize(14)
        .fontColor(ColorTokens.muted)
        .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding({ top: 14, bottom: 14 })
  }
}

// fd-chapter-list: card (border, radius-md, surface, soft-shadow), h2 15/700,
// chapter rows (13 strong, border-top between). padding 14.
@Component
export struct DirectoryPreview {
  private chapters: string[] = ['第一章 科学边界', '第二章 疯狂年代', '第三章 红岸之一'];

  build() {
    Column() {
      Text('目录')
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .margin({ bottom: 8 })
      ForEach(this.chapters, (c: string, i: number) => {
        Text(c)
          .fontSize(13)
          .fontColor(ColorTokens.controlInk)
          .padding({ top: 10, bottom: 10 })
          .width('100%')
          .border(i > 0 ? { width: { top: 1 }, color: ColorTokens.border } : { width: 0 })
      }, (c: string, i: number) => `${c}-${i}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(14)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
  }
}

// fd-book-summary-card: card, h2 15/700, p 13 muted line-clamp 4 (1.65). padding 14, gap 8.
@Component
export struct BookIntro {
  build() {
    Column() {
      Text('简介')
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
      Text('文化大革命如火如荼地进行，叶文洁在雷达峰向宇宙发出了人类第一条信息……')
        .fontSize(13)
        .fontColor(ColorTokens.muted)
        .lineHeight(1.65 * 13)
        .maxLines(4)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 8 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(14)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
  }
}

// fd-book-source-card button: pill, primary bg, on-primary, 12/900.
@Component
export struct ReadButton {
  build() {
    Text('开始阅读')
      .fontSize(13)
      .fontWeight(900)
      .fontColor(DemoAliasTokens.onPrimary)
      .backgroundColor(ColorTokens.primary)
      .borderRadius(DemoAliasTokens.radiusPill)
      .width('100%')
      .height(44)
      .textAlign(TextAlign.Center)
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' }))
  }
}

// secondary action: surface bg, ink, pill, border.
@Component
export struct AddToShelfButton {
  build() {
    Text('加入书架')
      .fontSize(13)
      .fontWeight(900)
      .fontColor(ColorTokens.ink)
      .backgroundColor(DemoAliasTokens.surface)
      .border({ width: 1, color: ColorTokens.border })
      .borderRadius(DemoAliasTokens.radiusPill)
      .width('100%')
      .height(44)
      .textAlign(TextAlign.Center)
      .margin({ top: 10 })
      .onClick(() => ReaderUiStore.dispatch({ type: 'set-page-state', pageState: 'default' }))
  }
}
