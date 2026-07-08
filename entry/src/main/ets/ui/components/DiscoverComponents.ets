// DiscoverComponents — discover skeleton ported from render-runtime.js
// mainTabDiscover() DOM: .fd-discover-source-bar → .fd-discover-entry-row →
// .fd-filter-control → .fd-discover-list-head → .fd-discover-book-list.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';

interface DiscoverBulkSourceEntry {
  name: string;
  meta: string;
  badge: string;
  selected: boolean;
  tone: string;
}

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
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'discover-source-bulk' }))
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

@Component
struct DiscoverStateAction {
  @Prop label: string = '操作';
  @Prop primary: boolean = false;

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
  }
}

@Component
struct DiscoverStateCard {
  @Prop variant: string = 'empty';
  @Prop title: string = '当前没有内容';
  @Prop message: string = '';
  @Prop action: string = '';

  private iconName(): string {
    if (this.variant === 'error') {
      return 'ui_icon_info_primary';
    }
    if (this.variant === 'no-results') {
      return 'ui_icon_search_primary';
    }
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
      if (this.action.length > 0) {
        Row({ space: 8 }) {
          DiscoverStateAction({ label: this.action, primary: true })
          if (this.variant === 'empty') {
            DiscoverStateAction({ label: '导入书源' })
          } else if (this.variant === 'error') {
            DiscoverStateAction({ label: '切换书源' })
            DiscoverStateAction({ label: '编辑源' })
          } else if (this.variant === 'no-results') {
            DiscoverStateAction({ label: '切换入口' })
            DiscoverStateAction({ label: '刷新' })
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
export struct DiscoverStatePage {
  @Prop variant: string = 'empty';
  @Prop title: string = '当前没有启用发现的书源';
  @Prop message: string = '启用发现后，可以在这里浏览书源提供的排行榜、分类和书单。';
  @Prop action: string = '';

  build() {
    Column() {
      if (this.variant === 'loading') {
        DiscoverSourceBar()
        DiscoverEntryRow()
          .margin({ top: 12 })
        DiscoverFilterTrigger()
          .margin({ top: 10 })
        DiscoverListHead()
          .margin({ top: 14, bottom: 8 })
        DiscoverSkeletonList()
      } else if (this.variant === 'error') {
        DiscoverSourceBar()
        DiscoverStateCard({
          variant: this.variant,
          title: this.title,
          message: this.message,
          action: this.action,
        })
          .margin({ top: 12 })
        DiscoverBookList()
          .margin({ top: 12 })
      } else {
        DiscoverStateCard({
          variant: this.variant,
          title: this.title,
          message: this.message,
          action: this.action,
        })
          .margin({ top: 56 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct DiscoverBulkChip {
  @Prop label: string = '筛选';
  @Prop active: boolean = false;

  build() {
    Text(this.label)
      .fontSize(12)
      .fontWeight(800)
      .fontColor(this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
      .height(32)
      .padding({ left: 12, right: 12 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.active ? ColorTokens.primary : ColorTokens.metaBg)
      .margin({ right: 7 })
  }
}

@Component
struct DiscoverBulkSourceRow {
  @Prop name: string = '优书网';
  @Prop meta: string = '默认分组 · 120ms';
  @Prop badge: string = '可用';
  @Prop selected: boolean = false;
  @Prop tone: string = 'normal';

  private badgeColor(): string {
    if (this.tone === 'warning') {
      return ColorTokens.accent;
    }
    if (this.tone === 'muted') {
      return ColorTokens.muted;
    }
    return ColorTokens.primary;
  }

  build() {
    Row() {
      Stack() {
        if (this.selected) {
          Image($r('app.media.ui_icon_check_white'))
            .width(14)
            .height(14)
        }
      }
      .width(26)
      .height(26)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.selected ? ColorTokens.primary : ColorTokens.metaBg)
      .border({ width: 1, color: this.selected ? ColorTokens.primary : ColorTokens.border })
      .margin({ right: 10 })

      Column() {
        Text(this.name)
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.meta)
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Text(this.badge)
        .fontSize(11)
        .fontWeight(800)
        .fontColor(this.badgeColor())
        .height(26)
        .padding({ left: 9, right: 9 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 12, bottom: 12 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct DiscoverBulkHeadCard {
  build() {
    Column() {
      Text('发现源管理')
        .fontSize(16)
        .fontWeight(800)
        .fontColor(ColorTokens.ink)
      Text('选择启用发现的书源，批量启用、禁用或刷新入口。')
        .fontSize(13)
        .lineHeight(19)
        .fontColor(ColorTokens.muted)
        .margin({ top: 8 })
      Text('已选 3 个')
        .fontSize(12)
        .fontWeight(800)
        .fontColor(ColorTokens.primary)
        .height(24)
        .padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .margin({ top: 10 })
    }
    .width('100%')
    .padding(14)
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct DiscoverSourceBulkPage {
  private chips: string[] = ['已启用发现', '有发现未启用', '需登录', '异常'];
  private sources: DiscoverBulkSourceEntry[] = [
    { name: '优书网', meta: '默认分组 · 120ms · 已启用发现', badge: '可用', selected: true, tone: 'normal' },
    { name: '起点导入', meta: '正版 · 180ms · 已启用发现', badge: '可用', selected: true, tone: 'normal' },
    { name: '轻小说文库', meta: '需登录 · 发现可用', badge: '需处理', selected: true, tone: 'warning' },
    { name: '本地聚合源', meta: '维护中 · 暂停发现', badge: '暂停', selected: false, tone: 'muted' },
    { name: '失效示例源', meta: '解析失败 · exploreUrl 异常', badge: '需处理', selected: false, tone: 'warning' },
  ];

  build() {
    Column() {
      DiscoverBulkHeadCard()

      Row() {
        Text('取消')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
        Text('已选 3 个')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.controlInk)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
        Text('全选')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
      }
      .width('100%')
      .height(38)
      .alignItems(VerticalAlign.Center)
      .margin({ top: 12 })

      Row() {
        Image($r('app.media.ui_icon_search_muted'))
          .width(18)
          .height(18)
        Text('搜索书源名称或分组')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .margin({ left: 8 })
      }
      .width('100%')
      .height(42)
      .padding({ left: 12, right: 12 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.metaBg)
      .alignItems(VerticalAlign.Center)

      Scroll() {
        Row() {
          ForEach(this.chips, (chip: string, index: number) => {
            DiscoverBulkChip({ label: chip, active: index === 0 })
          }, (chip: string) => chip)
        }
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')
      .margin({ top: 10 })

      ForEach(this.sources, (source: DiscoverBulkSourceEntry, index: number) => {
        DiscoverBulkSourceRow({
          name: source.name,
          meta: source.meta,
          badge: source.badge,
          selected: source.selected,
          tone: source.tone,
        })
          .margin({ top: index === 0 ? 12 : 8 })
      }, (source: DiscoverBulkSourceEntry, index: number) => `${source.name}-${index}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct DiscoverSubpageBadge {
  @Prop label: string = '可用';
  @Prop tone: string = 'normal';

  build() {
    Text(this.label)
      .fontSize(11)
      .fontWeight(800)
      .fontColor(this.tone === 'warning' ? ColorTokens.accent : ColorTokens.primaryDark)
      .height(26)
      .padding({ left: 10, right: 10 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.metaBg)
      .border({ width: 1, color: this.tone === 'warning' ? ColorTokens.accent : ColorTokens.border })
  }
}

@Component
struct DiscoverSubpageHead {
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop badge: string = '';
  @Prop tone: string = 'normal';

  build() {
    Row() {
      Image($r('app.media.ui_icon_source_stack_primary'))
        .width(32)
        .height(32)
      Column() {
        Text(this.title)
          .fontSize(17)
          .fontWeight(850)
          .fontColor(ColorTokens.ink)
        Text(this.message)
          .fontSize(12)
          .lineHeight(18)
          .fontColor(ColorTokens.muted)
          .margin({ top: 5 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 12, right: 10 })
      if (this.badge.length > 0) {
        DiscoverSubpageBadge({ label: this.badge, tone: this.tone })
      }
    }
    .width('100%')
    .padding(14)
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct DiscoverLoginInfoRow {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop badge: string = '';
  @Prop tone: string = 'normal';
  @Prop switchOn: boolean = false;

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(14)
          .fontWeight(800)
          .fontColor(ColorTokens.ink)
        Text(this.detail)
          .fontSize(11)
          .lineHeight(16)
          .fontColor(ColorTokens.muted)
          .margin({ top: 4 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      if (this.switchOn) {
        Row() {
          Blank().layoutWeight(1)
          Row()
            .width(20)
            .height(20)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.paper)
        }
        .width(42)
        .height(24)
        .padding(2)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
      } else {
        DiscoverSubpageBadge({ label: this.badge, tone: this.tone })
      }
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 12, bottom: 12 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct DiscoverSubpageAction {
  @Prop label: string = '';
  @Prop primary: boolean = false;

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(850)
      .fontColor(this.primary ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(40)
      .layoutWeight(1)
      .textAlign(TextAlign.Center)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.primary ? ColorTokens.primary : ColorTokens.metaBg)
      .border({ width: this.primary ? 0 : 1, color: ColorTokens.border })
  }
}

@Component
export struct DiscoverSourceLoginPage {
  build() {
    Column() {
      DiscoverSubpageHead({
        title: '轻小说文库',
        message: '该书源的发现入口需要登录态，登录后返回当前入口并刷新列表。',
        badge: '需登录',
        tone: 'warning',
      })
      DiscoverLoginInfoRow({ title: '登录状态', detail: '未登录 · 最近检测 10:32', badge: '需登录', tone: 'warning' })
        .margin({ top: 12 })
      DiscoverLoginInfoRow({ title: '适用范围', detail: '发现入口、详情页、目录页', badge: '当前源' })
        .margin({ top: 8 })
      DiscoverLoginInfoRow({ title: 'Cookie 保存', detail: '仅保存在本机书源配置中', switchOn: true })
        .margin({ top: 8 })

      Row() {
        DiscoverSubpageAction({ label: '打开网页登录', primary: true })
        DiscoverSubpageAction({ label: '保存登录信息' })
          .margin({ left: 8 })
      }
      .width('100%')
      .margin({ top: 12 })
      DiscoverSubpageAction({ label: '重新检测' })
        .margin({ top: 8 })
      Text('返回发现页后，当前书源和当前入口保持不变，只刷新内容列表。')
        .fontSize(12)
        .lineHeight(18)
        .fontColor(ColorTokens.muted)
        .margin({ top: 12 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct DiscoverRuleFieldRow {
  @Prop label: string = '';
  @Prop value: string = '';

  build() {
    Row() {
      Text(this.label)
        .fontSize(11)
        .fontWeight(800)
        .fontColor(ColorTokens.muted)
        .width(86)
      Text(this.value)
        .fontSize(12)
        .fontWeight(800)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct DiscoverRuleModuleTabs {
  private modules: string[] = ['基本', '搜索', '详情', '目录', '正文', '发现', '高级'];

  build() {
    Scroll() {
      Row() {
        ForEach(this.modules, (item: string) => {
          Text(item)
            .fontSize(12)
            .fontWeight(850)
            .fontColor(item === '发现' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .height(32)
            .padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(item === '发现' ? ColorTokens.primary : ColorTokens.metaBg)
            .margin({ right: 7 })
        }, (item: string) => item)
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width('100%')
  }
}

@Component
export struct DiscoverRuleTestPage {
  private fields: Array<[string, string]> = [
    ['exploreUrl', '@js: 首页入口 + 分类入口'],
    ['bookList', '.result-list li'],
    ['name', '.book-title@text'],
    ['author', '.author@text'],
    ['kind', '.tag@text'],
    ['intro', '.intro@text'],
    ['lastChapter', '.last@text'],
    ['coverUrl', 'img@src'],
    ['bookUrl', 'a@href'],
  ];

  build() {
    Column() {
      DiscoverSubpageHead({ title: '优书网', message: '正在编辑：发现规则', badge: '已启用发现' })
      DiscoverRuleModuleTabs()
        .margin({ top: 12 })
      ForEach(this.fields, (field: [string, string], index: number) => {
        DiscoverRuleFieldRow({ label: field[0], value: field[1] })
          .margin({ top: index === 0 ? 12 : 7 })
      }, (field: [string, string], index: number) => `${field[0]}-${index}`)

      Column() {
        Text('测试输入')
          .fontSize(15)
          .fontWeight(850)
          .fontColor(ColorTokens.ink)
        DiscoverRuleFieldRow({ label: '入口 URL', value: 'https://example.com/rank/allvisit_1.html' })
          .margin({ top: 10 })
        DiscoverRuleFieldRow({ label: 'HTML 片段', value: '<li class=\"book\">长夜余火</li>' })
          .margin({ top: 7 })
        DiscoverSubpageAction({ label: '测试入口', primary: true })
          .margin({ top: 10 })
      }
      .width('100%')
      .padding(12)
      .borderRadius(DemoAliasTokens.radiusLg)
      .backgroundColor(DemoAliasTokens.surface)
      .border({ width: 1, color: ColorTokens.border })
      .margin({ top: 12 })
      .alignItems(HorizontalAlign.Start)

      Column() {
        Text('测试结果')
          .fontSize(15)
          .fontWeight(850)
          .fontColor(ColorTokens.ink)
        DiscoverLoginInfoRow({ title: '生成 5 个入口', detail: '排行榜、分类、完本、最新、书单', badge: '通过' })
          .margin({ top: 10 })
        DiscoverLoginInfoRow({ title: '解析到 18 本书', detail: '首条：长夜余火 · 爱潜水的乌贼', badge: '通过' })
          .margin({ top: 8 })
      }
      .width('100%')
      .padding(12)
      .borderRadius(DemoAliasTokens.radiusLg)
      .backgroundColor(DemoAliasTokens.surface)
      .border({ width: 1, color: ColorTokens.border })
      .margin({ top: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
