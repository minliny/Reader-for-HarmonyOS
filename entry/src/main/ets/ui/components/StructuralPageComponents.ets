// StructuralPageComponents — semantic page/section components for normalized
// handoff pages that should not be counted as generic scaffold.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';

interface RowEntry {
  title: string;
  detail: string;
  chip: string;
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

  build() {
    TextInput({ placeholder: this.placeholder })
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
    .constraintSize({ minHeight: 520 })
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
    { title: '第 1 章 深空来信', detail: '约 12 分钟阅读', chip: '' },
    { title: '第 2 章 观察者', detail: '约 10 分钟阅读', chip: '' },
    { title: '第 3 章 低语', detail: '约 14 分钟阅读', chip: '' },
  ];

  build() {
    Column() {
      SectionTitle({ title: '目录预览' })
      ForEach(this.chapters, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, detail: entry.detail })
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
export struct SourceManagementPage {
  private sources: RowEntry[] = [
    { title: '阅读书源 1', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
    { title: '阅读书源 2', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
    { title: '阅读书源 3', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
    { title: '阅读书源 4', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
    { title: '阅读书源 5', detail: '启用 · 搜索 / 目录 / 正文可用', chip: '' },
  ];

  build() {
    Column() {
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
