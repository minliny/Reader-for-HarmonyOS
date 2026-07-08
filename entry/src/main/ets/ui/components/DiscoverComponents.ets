// DiscoverComponents — discover skeleton ported from render-runtime.js
// mainTabDiscover() DOM: .fd-discover-source-bar → .fd-discover-entry-row →
// .fd-filter-control → .fd-discover-list-head → .fd-discover-book-list.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';

// .fd-discover-source-bar: min-height 58, grid 34/1fr/18, padding 10 12, border,
// radius-md, surface, soft-shadow. icon 34 circle primary-tint, strong 15, small 11.
@Component
export struct DiscoverSourceBar {
  build() {
    Row() {
      Stack()
        .width(34).height(34)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Column() {
        Text('默认书源')
          .fontSize(15)
          .fontColor(ColorTokens.ink)
        Text('小说 · 已启用')
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .margin({ top: 3 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 10 })
      Image($r('app.media.reader_icon_more_dark'))
        .width(18).height(18)
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

// .fd-discover-entry-row: horizontal scroll of entry chips (排行榜/畅销/分类/...),
//   min 32, pill, 12/800, surface/ink; active = primary.
@Component
export struct DiscoverEntryRow {
  private entries: string[] = ['排行榜', '畅销', '分类', '书源', '完本', '最新', '新书'];
  private active: string = '排行榜';

  build() {
    Scroll() {
      Row() {
        ForEach(this.entries, (e: string) => {
          Text(e)
            .fontSize(12)
            .fontWeight(800)
            .fontColor(e === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .backgroundColor(e === this.active ? ColorTokens.primary : ColorTokens.metaBg)
            .height(32)
            .padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .margin({ right: 7 })
        }, (e: string) => e)
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width('100%')
  }
}

// .fd-filter-trigger: min 34, grid 16/auto/1fr/14, padding 0 10, border, radius-md,
//   surface-soft, 12/900. filter icon + "筛选" + em (active) + chevron.
@Component
export struct DiscoverFilterTrigger {
  build() {
    Row() {
      Image($r('app.media.reader_icon_more_dark')).width(16).height(16)
      Text('筛选')
        .fontSize(12)
        .fontWeight(900)
        .fontColor(ColorTokens.controlInk)
        .margin({ left: 7 })
      Text('全部 · 最近更新')
        .fontSize(11)
        .fontColor(ColorTokens.muted)
        .margin({ left: 7 })
        .layoutWeight(1)
        .textAlign(TextAlign.End)
      Image($r('app.media.reader_icon_more_dark')).width(14).height(14).margin({ left: 7 })
    }
    .width('100%')
    .height(34)
    .padding({ left: 10, right: 10 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.metaBg)
    .alignItems(VerticalAlign.Center)
  }
}

// .fd-discover-list-head: h2 15.
@Component
export struct DiscoverListHead {
  build() {
    Row() {
      Text('排行榜')
        .fontSize(15)
        .fontColor(ColorTokens.ink)
    }
    .width('100%')
    .padding({ left: 2 })
  }
}

// .fd-discover-book-list > .fd-discover-book-row: min 108, grid 52/1fr, gap 11,
//   padding 12, border-top. img 52×74 radius-xs. h3 15, small 11, em 11 primary, p 12 clamp 2.
@Component
export struct DiscoverBookRow {
  @Prop title: string = '三体';
  @Prop author: string = '刘慈欣';
  @Prop kind: string = '科幻';
  @Prop latest: string = '第3部';
  @Prop intro: string = '宇宙是一块黑暗森林。';

  build() {
    Row() {
      Image($r('app.media.bookshelf_cover_three_body'))
        .width(52).height(74)
        .objectFit(ImageFit.Cover)
        .borderRadius(DemoAliasTokens.radiusXs)
      Column() {
        Text(this.title)
          .fontSize(15)
          .fontColor(ColorTokens.ink)
        Text(`${this.author} · ${this.kind}`)
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .margin({ top: 3 })
        Text(this.latest)
          .fontSize(11)
          .fontColor(ColorTokens.primaryDark)
          .margin({ top: 3 })
        Text(this.intro)
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
    .padding({ top: 12, bottom: 12, left: 12, right: 12 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' }))
  }
}

// .fd-discover-book-list: card wrapping the book rows.
@Component
export struct DiscoverBookList {
  private books: Array<[string, string, string, string, string]> = [
    ['三体', '刘慈欣', '科幻', '第3部', '宇宙是一块黑暗森林，每个文明都是带枪的猎人。'],
    ['基地', '阿西莫夫', '科幻', '完结', '银河帝国的衰亡与心理史学的预言。'],
    ['球状闪电', '刘慈欣', '科幻', '更新中', '一个少年对球状闪电的追寻，揭开量子物理的奥秘。'],
  ];

  build() {
    Column() {
      ForEach(this.books, (b: [string, string, string, string, string], i: number) => {
        DiscoverBookRow({ title: b[0], author: b[1], kind: b[2], latest: b[3], intro: b[4] })
      }, (b: [string, string, string, string, string], i: number) => `${b[0]}-${i}`)
    }
    .width('100%')
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
  }
}
