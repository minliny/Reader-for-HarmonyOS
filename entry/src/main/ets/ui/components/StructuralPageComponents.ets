// StructuralPageComponents — semantic page/section components for normalized
// handoff pages that should not be counted as generic scaffold.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

interface RowEntry {
  title: string;
  detail: string;
  chip: string;
}

interface SelectableBookEntry {
  title: string;
  detail: string;
  group: string;
  selected: boolean;
}

interface DirectoryEntry {
  title: string;
  marker: string;
}

@Component
struct HandoffStatusChip {
  @Prop label: string = '';

  build() {
    if (this.label.length > 0) {
      Text(this.label)
        .fontSize(12)
        .fontWeight(600)
        .fontColor(ColorTokens.primary)
        .height(24)
        .padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .border({ width: 1, color: ColorTokens.primary })
        .backgroundColor(ColorTokens.paper)
    }
  }
}

@Component
struct StructureCard {
  @Prop title: string = '标题';
  @Prop message: string = '';
  @Prop chip: string = '';

  build() {
    Column() {
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.controlInk)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.message.length > 0) {
        Text(this.message)
          .fontSize(14)
          .fontColor(ColorTokens.muted)
          .lineHeight(20)
          .margin({ top: 8 })
      }
      if (this.chip.length > 0) {
        HandoffStatusChip({ label: this.chip })
          .margin({ top: 10 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(14)
    .borderRadius(16)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
  }
}

@Component
struct StructureRow {
  @Prop title: string = '条目';
  @Prop detail: string = '';
  @Prop chip: string = '';
  @Prop showChevron: boolean = true;

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(14)
          .fontWeight(600)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.detail.length > 0) {
          Text(this.detail)
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 4 })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      if (this.chip.length > 0) {
        HandoffStatusChip({ label: this.chip })
      } else if (this.showChevron) {
        Text('›')
          .fontSize(20)
          .fontColor(ColorTokens.controlInk)
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 48 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(14)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SwitchRow {
  @Prop title: string = '条目';
  @Prop chip: string = '';
  @Prop switchOn: boolean = true;

  build() {
    Row() {
      Text(this.title)
        .fontSize(14)
        .fontWeight(600)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.chip.length > 0) {
        HandoffStatusChip({ label: this.chip })
      } else {
        HandoffSwitch({ on: this.switchOn })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 48 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(14)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct PrimaryAction {
  @Prop label: string = '操作';

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(700)
      .fontColor(DemoAliasTokens.onPrimary)
      .height(40)
      .padding({ left: 16, right: 16 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.primary)
      .textAlign(TextAlign.Center)
  }
}

@Component
struct BookshelfToolCover {
  @Prop selected: boolean = false;

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Image($r('app.media.bookshelf_cover_three_body'))
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Cover)
      if (this.selected) {
        Column() {
          Image($r('app.media.ui_icon_check_white'))
            .width(13)
            .height(13)
        }
        .width(22)
        .height(22)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .margin({ top: 5, right: 5 })
      }
    }
    .width(46)
    .aspectRatio(2 / 3)
    .borderRadius(DemoAliasTokens.radiusSm)
    .clip(true)
    .backgroundColor(ColorTokens.metaBg)
  }
}

@Component
struct BookshelfToolBookRow {
  @Prop title: string = '三体';
  @Prop detail: string = '刘慈欣';
  @Prop group: string = '';
  @Prop selected: boolean = false;

  build() {
    Row() {
      BookshelfToolCover({ selected: this.selected })
      Column() {
        Text(this.title)
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .fontFamily(ReaderTypography.serifFamily())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.detail)
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 5 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 12, right: 10 })

      if (this.group.length > 0) {
        HandoffStatusChip({ label: this.group })
      }
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: this.selected ? ColorTokens.primary : ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
  }
}

@Component
struct DirectorySegmentButton {
  @Prop label: string = '目录';
  @Prop active: boolean = false;

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(this.active ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(34)
      .layoutWeight(1)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.active ? ColorTokens.primary : DemoAliasTokens.surface)
      .textAlign(TextAlign.Center)
  }
}

@Component
struct DirectoryChapterRow {
  @Prop title: string = '第一章';
  @Prop marker: string = '';

  build() {
    Row() {
      Text(this.title)
        .fontSize(14)
        .fontWeight(600)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.marker.length > 0) {
        HandoffStatusChip({ label: this.marker })
      }
      Image($r('app.media.reader_icon_chevron_chapter'))
        .width(18)
        .height(18)
        .margin({ left: 8 })
    }
    .width('100%')
    .constraintSize({ minHeight: 52 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' }))
  }
}

@Component
struct SearchBox {
  @Prop label: string = '搜索书名或作者';

  build() {
    Row() {
      Image($r('app.media.bookshelf_icon_search_dark'))
        .width(20)
        .height(20)
      Text(this.label)
        .fontSize(14)
        .fontColor(ColorTokens.controlInk)
        .margin({ left: 8 })
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .height(44)
    .padding({ left: 12, right: 12 })
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(ColorTokens.metaBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SectionTitle {
  @Prop title: string = '标题';

  build() {
    Text(this.title)
      .fontSize(15)
      .fontWeight(700)
      .fontColor(ColorTokens.controlInk)
  }
}

@Component
struct FormField {
  @Prop placeholder: string = '输入内容';
  @Prop value: string = '';

  build() {
    TextInput({ text: this.value, placeholder: this.placeholder })
      .fontSize(14)
      .fontColor(ColorTokens.ink)
      .height(42)
      .padding({ left: 12, right: 12 })
      .borderRadius(14)
      .backgroundColor(ColorTokens.metaBg)
      .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct HandoffSwitch {
  @Prop on: boolean = true;

  build() {
    Row() {
      if (this.on) {
        Blank()
          .layoutWeight(1)
      }
      Row()
        .width(20)
        .height(20)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.paper)
        .shadow({ radius: 3, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 1 })
      if (!this.on) {
        Blank()
          .layoutWeight(1)
      }
    }
    .width(42)
    .height(24)
    .padding(2)
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(this.on ? ColorTokens.primary : ColorTokens.metaBg)
  }
}

@Component
struct ProgressSummaryCard {
  @Prop title: string = '同步正常';
  @Prop message: string = '深空信号 · 25% · 刚刚同步';
  @Prop chip: string = '已同步';
  @Prop progress: number = 0.64;

  build() {
    Column() {
      StructureCard({ title: this.title, message: this.message, chip: this.chip })
      Stack({ alignContent: Alignment.Start }) {
        Row()
          .width('100%')
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Row()
          .width(`${Math.round(this.progress * 100)}%`)
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
      }
      .width('100%')
      .height(4)
      .margin({ top: 10 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

interface RestoreStepEntry {
  title: string;
  detail: string;
  chip: string;
  progress: number;
  done: boolean;
  active: boolean;
}

@Component
struct SecondaryAction {
  @Prop label: string = '操作';
  @Prop primary: boolean = false;
  @Prop route: RouteId = 'settings';

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(this.primary ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(40)
      .layoutWeight(1)
      .padding({ left: 12, right: 12 })
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.primary ? ColorTokens.primary : ColorTokens.metaBg)
      .border({ width: this.primary ? 0 : 1, color: ColorTokens.border })
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: this.route }))
  }
}

@Component
struct ActionPair {
  @Prop left: string = '取消';
  @Prop right: string = '确认';
  @Prop leftRoute: RouteId = 'settings';
  @Prop rightRoute: RouteId = 'settings';

  build() {
    Row() {
      SecondaryAction({ label: this.left, route: this.leftRoute })
      SecondaryAction({ label: this.right, route: this.rightRoute, primary: true })
        .margin({ left: 10 })
    }
    .width('100%')
  }
}

@Component
struct RestoreSummaryGrid {
  private rows: RowEntry[] = [
    { title: '备份来源', detail: 'WebDAV · 2026-06-23 08:00', chip: '' },
    { title: '恢复范围', detail: '书架与分组、阅读进度、设置、书源配置', chip: '' },
    { title: '预计影响', detail: '128 本书 · 96 条阅读进度 等 4 项', chip: '' },
    { title: '可回退点', detail: '恢复前自动生成本地快照', chip: '' },
  ];

  build() {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
      ForEach(this.rows, (entry: RowEntry, idx: number) => {
        Column() {
          Text(entry.title)
            .fontSize(10)
            .fontColor(ColorTokens.muted)
          Text(entry.detail)
            .fontSize(12)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .margin({ top: 5 })
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .width('48%')
        .padding(10)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.metaBg)
        .margin({ bottom: 8 })
        .alignItems(HorizontalAlign.Start)
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
  }
}

@Component
struct RestoreStageRow {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop chip: string = '';
  @Prop progress: number = 0;
  @Prop done: boolean = false;
  @Prop active: boolean = false;

  build() {
    Column() {
      Row() {
        Circle()
          .width(9)
          .height(9)
          .fill(this.done || this.active ? ColorTokens.primary : ColorTokens.border)
        Column() {
          Text(this.title)
            .fontSize(13)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
          Text(this.detail)
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .margin({ top: 4 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .margin({ left: 10 })
        HandoffStatusChip({ label: this.chip })
      }
      .width('100%')
      Stack({ alignContent: Alignment.Start }) {
        Row()
          .width('100%')
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Row()
          .width(`${Math.round(this.progress * 100)}%`)
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(this.active ? ColorTokens.primary : ColorTokens.border)
      }
      .width('100%')
      .height(4)
      .margin({ top: 9 })
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(this.active ? ColorTokens.surfaceSoft : ColorTokens.floatingControlBg)
    .border({ width: 1, color: this.active ? ColorTokens.primary : ColorTokens.border })
  }
}

@Component
struct SyncBackupRecordRow {
  @Prop source: string = '';
  @Prop detail: string = '';
  @Prop chip: string = '';
  @Prop groupStart: string = '';

  build() {
    Column() {
      if (this.groupStart.length > 0) {
        Text(this.groupStart)
          .fontSize(12)
          .fontWeight(900)
          .fontColor(ColorTokens.muted)
          .margin({ bottom: 6 })
      }
      Row() {
        Stack()
          .width(30)
          .height(30)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Column() {
          Text(this.source)
            .fontSize(13)
            .fontWeight(850)
            .fontColor(ColorTokens.controlInk)
          Text(this.detail)
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .margin({ top: 4 })
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .margin({ left: 10 })
        HandoffStatusChip({ label: this.chip })
      }
      .width('100%')
      .padding(12)
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(ColorTokens.floatingControlBg)
      .border({ width: 1, color: ColorTokens.border })
      .alignItems(VerticalAlign.Center)
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'restore-confirm' }))
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct StatePanel {
  @Prop title: string = '暂无内容';
  @Prop message: string = '';
  @Prop action: string = '';
  @Prop variant: string = 'empty';

  build() {
    Column() {
      if (this.variant === 'loading') {
        LoadingProgress()
          .width(34)
          .height(34)
          .color(ColorTokens.primary)
          .margin({ bottom: 12 })
      }
      Text(this.title)
        .fontSize(20)
        .fontWeight(700)
        .fontColor(ColorTokens.controlInk)
        .textAlign(TextAlign.Center)
      if (this.message.length > 0) {
        Text(this.message)
          .fontSize(14)
          .fontColor(ColorTokens.muted)
          .lineHeight(20)
          .textAlign(TextAlign.Center)
          .margin({ top: 8 })
      }
      if (this.action.length > 0) {
        PrimaryAction({ label: this.action })
          .margin({ top: 12 })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 640 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .padding({ left: 12, right: 12, top: 32, bottom: 32 })
  }
}

@Component
export struct AppShellStructure {
  @Prop title: string = 'Reader for Android';
  @Prop message: string = '统一承载书架、发现、RSS、设置与阅读页入口。';
  private entries: RowEntry[] = [
    { title: '书架', detail: '主书架与继续阅读', chip: '' },
    { title: '发现', detail: '书源发现与分类浏览', chip: '' },
    { title: 'RSS', detail: '订阅与文章阅读', chip: '' },
    { title: '设置', detail: '全局设置、同步与书源', chip: '' },
    { title: '搜索入口', detail: '按书名、作者与书源搜索', chip: '' },
    { title: '书源管理入口', detail: '维护搜索、目录与正文规则', chip: '' },
    { title: '阅读页入口', detail: '进入阅读器与控制层', chip: '' },
    { title: 'WebDAV / 同步入口', detail: '备份、恢复与阅读进度同步', chip: '' },
  ];

  build() {
    Column() {
      StructureCard({ title: this.title, message: this.message })
      SectionTitle({ title: '核心入口' })
        .margin({ top: 14, bottom: 10 })
      ForEach(this.entries, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, detail: entry.detail })
          .margin({ bottom: idx === this.entries.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct MainTabsStructure {
  @Prop title: string = '主导航';
  @Prop message: string = '底部四项：书架、发现、RSS、设置。';

  build() {
    Column() {
      StructureCard({ title: this.title, message: this.message })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SearchHomePage {
  @Prop placeholder: string = '搜索书名或作者';

  build() {
    Column() {
      SearchBox({ label: this.placeholder })
      Column() {
        SectionTitle({ title: '最近搜索' })
        StructureRow({ title: '深空信号', showChevron: true })
          .margin({ top: 10 })
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .margin({ top: 14 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SearchResultsPage {
  @Prop query: string = '深空信号';
  private results: RowEntry[] = [
    { title: '深空信号', detail: '作者 星港 · 3 个书源可用', chip: '可加入书架' },
    { title: '深空信号', detail: '作者 星港 · 3 个书源可用', chip: '可加入书架' },
    { title: '深空信号', detail: '作者 星港 · 3 个书源可用', chip: '可加入书架' },
    { title: '深空信号', detail: '作者 星港 · 3 个书源可用', chip: '可加入书架' },
  ];

  build() {
    Column() {
      SearchBox({ label: this.query })
      ForEach(this.results, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, detail: entry.detail, chip: entry.chip, showChevron: false })
          .margin({ top: idx === 0 ? 14 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SearchStatePage {
  @Prop variant: string = 'empty';
  @Prop title: string = '暂无结果';
  @Prop message: string = '换个关键词后重试。';
  @Prop action: string = '';

  build() {
    Column() {
      StatePanel({ variant: this.variant, title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct BookTocPreviewPage {
  private chapters: RowEntry[] = [
    { title: '第1章：深空信号', detail: '', chip: '可读' },
    { title: '第2章：深空信号', detail: '', chip: '可读' },
    { title: '第3章：深空信号', detail: '', chip: '可读' },
    { title: '第4章：深空信号', detail: '', chip: '可读' },
    { title: '第5章：深空信号', detail: '', chip: '可读' },
    { title: '第6章：深空信号', detail: '', chip: '可读' },
  ];

  build() {
    Column() {
      SectionTitle({ title: '目录预览' })
      ForEach(this.chapters, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, chip: entry.chip, showChevron: false })
          .margin({ top: idx === 0 ? 10 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookshelfEmptyPage {
  @Prop title: string = '书架还是空的';
  @Prop message: string = '导入本地书籍或通过搜索加入书架。';

  build() {
    Column() {
      StatePanel({ title: this.title, message: this.message, action: '导入本地书' })
    }
    .width('100%')
  }
}

@Component
export struct BookMoreMenuPage {
  @Prop title: string = '深空信号';
  @Prop subtitle: string = '本地书籍';
  private actions: RowEntry[] = [
    { title: '详情', detail: '', chip: '' },
    { title: '移动分组', detail: '', chip: '' },
    { title: '下载 / 缓存', detail: '', chip: '' },
    { title: '重新扫描', detail: '', chip: '' },
    { title: '移出书架', detail: '', chip: '' },
  ];

  build() {
    Column() {
      StructureCard({ title: this.title, message: this.subtitle })
      ForEach(this.actions, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title })
          .margin({ top: idx === 0 ? 12 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookGroupManagementPage {
  private groups: RowEntry[] = [
    { title: '默认分组', detail: '', chip: '12 本' },
    { title: '科幻', detail: '', chip: '4 本' },
    { title: '待读', detail: '', chip: '7 本' },
  ];

  build() {
    Column() {
      ForEach(this.groups, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, chip: entry.chip, showChevron: false })
          .margin({ bottom: idx === this.groups.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
      PrimaryAction({ label: '新建分组' })
        .margin({ top: 12 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct GroupManagementPage {
  private groups: RowEntry[] = [
    { title: '默认分组', detail: '8 本 · 当前分组', chip: '管理' },
    { title: '追更', detail: '5 本 · 置顶显示', chip: '管理' },
    { title: '本地书', detail: '2 本 · 导入书籍', chip: '管理' },
    { title: '资料', detail: '3 本 · 可重命名', chip: '管理' },
  ];
  private assignments: SelectableBookEntry[] = [
    { title: '三体', detail: '刘慈欣 · 当前分组', group: '默认分组', selected: false },
    { title: '基地', detail: '阿西莫夫 · 当前分组', group: '追更', selected: false },
    { title: '球状闪电', detail: '刘慈欣 · 当前分组', group: '本地书', selected: false },
    { title: '深空信号', detail: '星港 · 当前分组', group: '资料', selected: false },
  ];

  build() {
    Column() {
      SectionTitle({ title: '分组列表' })
      ForEach(this.groups, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, detail: entry.detail, chip: entry.chip, showChevron: false })
          .margin({ top: idx === 0 ? 10 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)

      SectionTitle({ title: '书籍归属' })
        .margin({ top: 16 })
      ForEach(this.assignments, (entry: SelectableBookEntry, idx: number) => {
        BookshelfToolBookRow({
          title: entry.title,
          detail: entry.detail,
          group: entry.group,
          selected: entry.selected,
        })
          .margin({ top: idx === 0 ? 10 : 8 })
      }, (entry: SelectableBookEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookBatchManagementPage {
  private selectedBooks: SelectableBookEntry[] = [
    { title: '三体', detail: '刘慈欣 · 继续阅读', group: '追更', selected: true },
    { title: '基地', detail: '阿西莫夫 · 第一章', group: '默认分组', selected: true },
    { title: '球状闪电', detail: '刘慈欣 · 未读', group: '本地书', selected: true },
    { title: '长夜余火', detail: '爱潜水的乌贼 · 已读', group: '追更', selected: false },
    { title: '人间词话', detail: '王国维 · 本地导入', group: '资料', selected: false },
    { title: 'Android 开发笔记', detail: '本地书籍 · 最近导入', group: '资料', selected: false },
  ];

  build() {
    Column() {
      StructureCard({
        title: '已选 3 本',
        message: '长按书籍或从更多菜单进入，选择后统一移动分组、删除或取消选择。',
        chip: '全选',
      })

      SectionTitle({ title: '书架书籍' })
        .margin({ top: 14 })
      ForEach(this.selectedBooks, (entry: SelectableBookEntry, idx: number) => {
        BookshelfToolBookRow({
          title: entry.title,
          detail: entry.detail,
          group: entry.group,
          selected: entry.selected,
        })
          .margin({ top: idx === 0 ? 10 : 8 })
      }, (entry: SelectableBookEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookDirectoryPage {
  private chapters: DirectoryEntry[] = [
    { title: '第 1 章 科学边界', marker: '当前' },
    { title: '第 2 章 台球', marker: '' },
    { title: '第 3 章 射手和农场主', marker: '' },
    { title: '第 34 章 旧地图', marker: '已缓存' },
    { title: '第 36 章 灯塔之后', marker: '书签' },
  ];

  build() {
    Column() {
      StructureCard({ title: '三体', message: '刘慈欣 · 共 6 章', chip: '继续阅读' })
      Row({ space: 8 }) {
        DirectorySegmentButton({ label: '目录', active: true })
        DirectorySegmentButton({ label: '书签', active: false })
      }
      .width('100%')
      .padding(4)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.metaBg)
      .margin({ top: 12 })

      ForEach(this.chapters, (entry: DirectoryEntry, idx: number) => {
        DirectoryChapterRow({ title: entry.title, marker: entry.marker })
          .margin({ top: idx === 0 ? 12 : 8 })
      }, (entry: DirectoryEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceManagementPage {
  private tools: Array<[string, string, RouteId]> = [
    ['导入预览', '从网络导入书源并处理冲突', 'source-import-preview'],
    ['分组管理', '筛选和批量整理书源', 'source-groups'],
    ['书源检测', '站点、搜索、详情、目录、正文规则检测', 'source-detect'],
    ['正文调测', '运行正文模块并查看日志', 'source-debug'],
  ];
  private sources: RowEntry[] = [
    { title: '阅读书源 1', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
    { title: '阅读书源 2', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
    { title: '阅读书源 3', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
    { title: '阅读书源 4', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
    { title: '阅读书源 5', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
  ];

  build() {
    Column() {
      StructureCard({ title: '书源工具', message: '导入、分组、检测和调测都从这里进入。' })
      ForEach(this.tools, (entry: [string, string, RouteId], idx: number) => {
        StructureRow({ title: entry[0], detail: entry[1] })
          .margin({ top: idx === 0 ? 12 : 8 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: entry[2] }))
      }, (entry: [string, string, RouteId], idx: number) => `${entry[0]}-${idx}`)
      SectionTitle({ title: '启用书源' })
        .margin({ top: 14, bottom: 10 })
      ForEach(this.sources, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, detail: entry.detail, showChevron: false })
          .margin({ bottom: idx === this.sources.length - 1 ? 0 : 10 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDetailPage {
  @Prop title: string = '阅读书源 1';

  build() {
    Column() {
      StructureCard({ title: this.title, message: '搜索、目录、正文规则均正常。', chip: '已启用' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceImportOptionsPage {
  build() {
    Column() {
      StatePanel({ title: '导入书源', message: '从 URL、剪贴板或本地文件导入。', action: '选择导入方式' })
    }
    .width('100%')
  }
}

@Component
export struct SourceDisabledState {
  @Prop title: string = '书源已停用';
  @Prop message: string = '该书源 disabled / error，请在书源详情中修复。';
  @Prop action: string = '查看详情';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct SourceFormPage {
  @Prop action: string = '保存';
  @Prop editing: boolean = false;

  build() {
    Column() {
      FormField({ placeholder: '书源名称', value: this.editing ? '阅读书源 1' : '' })
      FormField({ placeholder: '书源 URL', value: this.editing ? 'https://example.com' : '' })
        .margin({ top: 10 })
      PrimaryAction({ label: this.action })
        .margin({ top: 10 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '书源设置', message: '管理搜索、目录和正文规则。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceTestResultPage {
  private tests: RowEntry[] = [
    { title: '搜索规则', detail: '', chip: '通过' },
    { title: '目录规则', detail: '', chip: '通过' },
    { title: '正文规则', detail: '', chip: '通过' },
    { title: '封面规则', detail: '', chip: '通过' },
  ];

  build() {
    Column() {
      ForEach(this.tests, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, chip: entry.chip, showChevron: false })
          .margin({ bottom: idx === this.tests.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
  }
}

@Component
export struct WebDavConfigPage {
  build() {
    Column() {
      FormField({ placeholder: '服务器地址' })
      FormField({ placeholder: '用户名' })
        .margin({ top: 10 })
      FormField({ placeholder: '密码' })
        .margin({ top: 10 })
      PrimaryAction({ label: '登录并测试' })
        .margin({ top: 10 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SyncSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '同步设置', message: '管理 WebDAV、备份和阅读进度同步。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SyncBackupPage {
  @Prop variant: string = 'default';
  private backups: RowEntry[] = [
    { title: 'WebDAV', detail: '2026-06-23 08:00 · 完整备份 · 12.8 MB · 书架、进度、设置、书源', chip: '最新' },
    { title: '本地', detail: '2026-06-23 10:30 · 完整备份 · 本机文件', chip: '本机' },
    { title: 'WebDAV', detail: '2026-06-21 22:30 · 书架与设置 · 8.6 MB', chip: '局部' },
    { title: 'WebDAV', detail: '2026-06-16 02:00 · 完整备份 · 历史记录', chip: '历史' },
  ];

  build() {
    Column() {
      if (this.variant === 'loading') {
        ProgressSummaryCard({ title: '正在同步备份', message: '正在连接 WebDAV 并校验备份目录。', chip: '进行中', progress: 0.42 })
        RestoreStageRow({ title: '连接 WebDAV', detail: 'https://dav.example.com/reader/backup', chip: '进行中', progress: 0.42, active: true })
          .margin({ top: 12 })
      } else {
        StructureCard({ title: 'WebDAV 配置', message: 'https://dav.example.com/reader/backup · reader@example.com · /ReaderBackup/ReaderAndroid', chip: '已配置' })
        Row() {
          SecondaryAction({ label: '测试网络连通性', route: 'sync-backup' })
          SecondaryAction({ label: '保存配置', route: 'sync-backup', primary: true })
            .margin({ left: 10 })
        }
        .width('100%')
        .margin({ top: 10 })
        SectionTitle({ title: '恢复数据' })
          .margin({ top: 16, bottom: 10 })
        ForEach(this.backups, (entry: RowEntry, idx: number) => {
          SyncBackupRecordRow({
            source: entry.title,
            detail: entry.detail,
            chip: entry.chip,
            groupStart: idx === 0 ? '最近备份' : (idx === 2 ? '历史备份' : ''),
          })
            .margin({ bottom: idx === this.backups.length - 1 ? 0 : 8 })
        }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RestoreConfirmPage {
  @Prop variant: string = 'default';
  private scopes: RowEntry[] = [
    { title: '书架与分组', detail: '恢复书架书籍、分组和排序', chip: '128 本书' },
    { title: '阅读进度', detail: '恢复章节位置和阅读进度', chip: '96 条' },
    { title: '阅读与 App 设置', detail: '恢复主题、排版和通用设置', chip: '设置' },
    { title: '书源配置', detail: '恢复书源、分组和启用状态', chip: '12 个书源' },
  ];

  private titleText(): string {
    if (this.variant === 'scopes') return '恢复范围';
    return this.variant === 'preview' ? '恢复预览' : '确认恢复数据';
  }

  build() {
    Column() {
      StructureCard({
        title: this.titleText(),
        message: '将使用选中的备份覆盖本机同类数据。恢复前会创建本地快照，取消不会改变当前数据。',
        chip: '待确认',
      })
      RestoreSummaryGrid()
        .margin({ top: 12 })
      SectionTitle({ title: '选择恢复范围' })
        .margin({ top: 14, bottom: 10 })
      ForEach(this.scopes, (entry: RowEntry, idx: number) => {
        SwitchRow({ title: entry.title, chip: entry.chip })
          .margin({ bottom: 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
      StructureCard({ title: '覆盖提醒', message: '冲突项会在恢复过程中单独确认，不会静默覆盖。' })
        .margin({ top: 4, bottom: 12 })
      ActionPair({ left: '取消', right: '开始恢复', leftRoute: 'sync-backup', rightRoute: 'restore-progress' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RestoreProgressPage {
  @Prop variant: string = 'default';
  private steps: RestoreStepEntry[] = [
    { title: '下载备份', detail: '12.8 MB · WebDAV', chip: '完成', progress: 1, done: true, active: false },
    { title: '校验文件', detail: 'manifest、hash、版本兼容', chip: '完成', progress: 1, done: true, active: false },
    { title: '合并数据', detail: '书架 128 本 · 进度 96 条', chip: '进行中', progress: 0.68, done: false, active: true },
    { title: '写入设置', detail: '等待合并完成', chip: '等待', progress: 0, done: false, active: false },
  ];

  build() {
    Column() {
      ProgressSummaryCard({
        title: this.variant === 'running' ? '恢复任务运行中' : '正在恢复',
        message: '当前正在合并书架和阅读进度。离开页面不会中断恢复，完成后会进入结果状态。',
        chip: '68%',
        progress: 0.68,
      })
      SectionTitle({ title: '恢复阶段' })
        .margin({ top: 14, bottom: 10 })
      ForEach(this.steps, (step: RestoreStepEntry, idx: number) => {
        RestoreStageRow({
          title: step.title,
          detail: step.detail,
          chip: step.chip,
          progress: step.progress,
          done: step.done,
          active: step.active,
        })
          .margin({ bottom: 8 })
      }, (step: RestoreStepEntry, idx: number) => `${step.title}-${idx}`)
      ActionPair({ left: '处理冲突', right: '查看结果', leftRoute: 'restore-conflict', rightRoute: 'restore-result' })
        .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RestoreConflictPage {
  private conflicts: RowEntry[] = [
    { title: '分组：玄幻连载', detail: '本地 42 本 · 远程 46 本', chip: '使用备份' },
    { title: '阅读进度：长夜余火', detail: '本地第 32 章 · 远程第 35 章', chip: '远程进度' },
    { title: '阅读设置：浅色主题', detail: '本地字号 18 · 远程字号 17', chip: '备份设置' },
  ];

  build() {
    Column() {
      StructureCard({ title: '选择冲突处理方式', message: '以下项目本地和备份均有更新。请选择保留本地或使用备份，选择后恢复会继续。', chip: '3 项冲突' })
      SectionTitle({ title: '冲突列表' })
        .margin({ top: 14, bottom: 10 })
      ForEach(this.conflicts, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, detail: entry.detail, chip: entry.chip, showChevron: false })
          .margin({ bottom: 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
      ActionPair({ left: '返回进度', right: '应用选择', leftRoute: 'restore-progress', rightRoute: 'restore-result' })
        .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RestoreResultPage {
  private results: RowEntry[] = [
    { title: '书架与分组', detail: '已恢复 128 本书和 12 个分组', chip: '成功' },
    { title: '阅读进度', detail: '已恢复 96 条进度记录', chip: '成功' },
    { title: '书源配置', detail: '1 条旧版规则字段不兼容', chip: '跳过' },
  ];

  build() {
    Column() {
      StructureCard({ title: '恢复完成', message: '书架、分组和阅读进度已恢复。1 条书源配置因版本不兼容被跳过，可在日志中查看详情。', chip: '部分成功' })
      RestoreSummaryGrid()
        .margin({ top: 12 })
      SectionTitle({ title: '恢复结果明细' })
        .margin({ top: 14, bottom: 10 })
      ForEach(this.results, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, detail: entry.detail, chip: entry.chip, showChevron: false })
          .margin({ bottom: 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
      ActionPair({ left: '查看日志', right: '返回同步页', leftRoute: 'sync-backup', rightRoute: 'sync-backup' })
        .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct GlobalSettingsPage {
  private entries: RowEntry[] = [
    { title: '阅读设置入口', detail: '', chip: '' },
    { title: '书源设置入口', detail: '', chip: '' },
    { title: '同步设置入口', detail: '', chip: '' },
    { title: 'WebDAV 设置入口', detail: '', chip: '' },
    { title: '备份恢复入口', detail: '', chip: '' },
    { title: '关于版本', detail: '', chip: '' },
  ];

  build() {
    Column() {
      ForEach(this.entries, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title })
          .margin({ bottom: idx === this.entries.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BackupSettingsPage {
  build() {
    Column() {
      SwitchRow({ title: '自动备份', switchOn: true })
      SwitchRow({ title: '备份到 WebDAV', chip: '已开启' })
        .margin({ top: 8 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SyncErrorPage {
  @Prop title: string = '同步失败';
  @Prop message: string = 'WebDAV auth error，请重新登录。';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message, action: '重新登录' })
    }
    .width('100%')
  }
}

@Component
export struct SyncProgressPage {
  @Prop title: string = '同步正常';
  @Prop progress: number = 0.64;

  build() {
    Column() {
      ProgressSummaryCard({ title: this.title, message: '深空信号 · 25% · 刚刚同步', chip: '已同步', progress: this.progress })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RemoteWebDavBooksPage {
  private books: RowEntry[] = [
    { title: '远程书籍 1', detail: '', chip: '可下载' },
    { title: '远程书籍 2', detail: '', chip: '可下载' },
    { title: '远程书籍 3', detail: '', chip: '可下载' },
    { title: '远程书籍 4', detail: '', chip: '可下载' },
  ];

  build() {
    Column() {
      ForEach(this.books, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, chip: entry.chip, showChevron: false })
          .margin({ bottom: idx === this.books.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
  }
}

@Component
export struct RssDetailPage {
  @Prop title: string = '深空信号更新';

  build() {
    Column() {
      StructureCard({ title: this.title, message: '来自订阅源的章节更新与说明。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RssEmptyState {
  @Prop title: string = '暂无订阅';
  @Prop message: string = '添加 RSS 源后会在这里显示最新文章。';
  @Prop action: string = '添加订阅';

  build() {
    Column() {
      StatePanel({ title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct RssErrorState {
  @Prop title: string = '刷新失败';
  @Prop message: string = '订阅源暂时无法访问。';
  @Prop action: string = '重试';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct RssSubscriptionManagementPage {
  private subscriptions: RowEntry[] = [
    { title: '订阅源 1', detail: '', chip: '' },
    { title: '订阅源 2', detail: '', chip: '' },
    { title: '订阅源 3', detail: '', chip: '' },
    { title: '订阅源 4', detail: '', chip: '' },
  ];

  build() {
    Column() {
      ForEach(this.subscriptions, (entry: RowEntry, idx: number) => {
        SwitchRow({ title: entry.title, switchOn: true })
          .margin({ bottom: idx === this.subscriptions.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct GlobalStatePage {
  @Prop variant: string = 'empty';
  @Prop title: string = '暂无内容';
  @Prop message: string = '';
  @Prop action: string = '';

  build() {
    Column() {
      StatePanel({ variant: this.variant, title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct OfflineStatePage {
  @Prop title: string = '当前离线';
  @Prop message: string = '可继续阅读已缓存书籍。';

  build() {
    Column() {
      StatePanel({ variant: 'offline', title: this.title, message: this.message })
    }
    .width('100%')
  }
}

@Component
export struct PermissionRequiredPage {
  @Prop title: string = '需要存储权限';
  @Prop message: string = '授予权限后可导入本地书籍。';
  @Prop action: string = '授予权限';

  build() {
    Column() {
      StatePanel({ variant: 'permission', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct AboutVersionPage {
  @Prop title: string = 'Reader for Android';
  @Prop version: string = '1.0.0';

  build() {
    Column() {
      StatePanel({ title: this.title, message: `版本 ${this.version} · normalized handoff` })
    }
    .width('100%')
  }
}

@Component
export struct AboutFeedbackPage {
  private rows: RowEntry[] = [
    { title: '检查更新', detail: '已是最新', chip: '' },
    { title: '源码仓库', detail: 'Reader 多端前端与 Core 仓库', chip: '' },
    { title: '开源许可', detail: '查看第三方依赖与许可文本', chip: '' },
    { title: '参与贡献', detail: '提交问题、反馈体验或参与适配', chip: '' },
  ];

  build() {
    Column() {
      SectionTitle({ title: '项目信息' })
      ForEach(this.rows, (entry: RowEntry, idx: number) => {
        StructureRow({
          title: entry.title,
          detail: entry.detail,
          chip: entry.chip,
          showChevron: entry.title !== '检查更新',
        })
          .margin({ top: idx === 0 ? 10 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct LocalBookImportPage {
  build() {
    Column() {
      StatePanel({ title: '选择本地文件', message: '支持 txt、epub 和常见文本文件，导入后进入书架。', action: '选择文件' })
    }
    .width('100%')
  }
}

@Component
export struct ReadingSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '阅读设置', message: '进入阅读页内的显示、行为与控制层设置。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
