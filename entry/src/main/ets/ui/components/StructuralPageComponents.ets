// StructuralPageComponents — semantic page/section components for normalized
// handoff pages that should not be counted as generic scaffold.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';

@Component
struct StructureCard {
  @Prop title: string = '标题';
  @Prop message: string = '';

  build() {
    Column() {
      Text(this.title)
        .fontSize(ReaderTypography.sectionTitle().fontSize)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
      if (this.message.length > 0) {
        Text(this.message)
          .fontSize(ReaderTypography.bookMeta().fontSize)
          .fontColor(ColorTokens.muted)
          .lineHeight(20)
          .margin({ top: 6 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding({ top: 16, bottom: 16, left: 18, right: 18 })
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct StructureRow {
  @Prop title: string = '条目';
  @Prop detail: string = '';
  @Prop chip: string = '';

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
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
        Text(this.chip)
          .fontSize(11)
          .fontWeight(700)
          .fontColor(ColorTokens.primary)
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
      } else {
        Text('›')
          .fontSize(20)
          .fontColor(ColorTokens.muted)
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: 18, right: 18, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
  }
}

@Component
struct PrimaryAction {
  @Prop label: string = '操作';

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(DemoAliasTokens.onPrimary)
      .height(40)
      .padding({ left: 18, right: 18 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.primary)
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
          .width(38)
          .height(38)
          .color(ColorTokens.primary)
          .margin({ bottom: 14 })
      }
      Text(this.title)
        .fontSize(20)
        .fontWeight(800)
        .fontColor(ColorTokens.ink)
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
          .margin({ top: 18 })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 260 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .padding({ left: 28, right: 28, top: 30, bottom: 30 })
    .borderRadius(DemoAliasTokens.radiusXl)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
export struct AppShellStructure {
  @Prop title: string = 'Reader for Android';
  @Prop message: string = '统一承载书架、发现、RSS、设置与阅读页入口。';
  private entries: string[] = ['书架', '发现', 'RSS', '设置', '搜索入口', '书源管理入口', '阅读页入口', 'WebDAV / 同步入口'];

  build() {
    Column() {
      StructureCard({ title: this.title, message: this.message })
      Text('核心入口')
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .margin({ top: 14, bottom: 8 })
      ForEach(this.entries, (entry: string) => {
        StructureRow({ title: entry })
          .margin({ bottom: 8 })
      }, (entry: string) => entry)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10, bottom: 14 })
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
    .padding({ left: 20, right: 20, top: 10, bottom: 14 })
  }
}

@Component
export struct SearchHomePage {
  @Prop placeholder: string = '搜索书名/作者';

  build() {
    Column() {
      Row() {
        Text('⌕')
          .fontSize(20)
          .fontColor(ColorTokens.muted)
        Text(this.placeholder)
          .fontSize(15)
          .fontColor(ColorTokens.muted)
          .margin({ left: 10 })
      }
      .width('100%')
      .height(48)
      .padding({ left: 16, right: 16 })
      .borderRadius(DemoAliasTokens.radiusLg)
      .backgroundColor(ColorTokens.metaBg)
      StructureCard({ title: '搜索历史', message: '深空信号 · 三体 · 基地' })
        .margin({ top: 12 })
      StructureCard({ title: '搜索范围', message: '书名、作者、书源结果统一入口。' })
        .margin({ top: 10 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SearchResultsPage {
  @Prop query: string = '深空信号';
  private results: string[] = ['深空信号', '深空信号', '深空信号', '深空信号'];

  build() {
    Column() {
      Row() {
        Text('⌕')
          .fontSize(18)
          .fontColor(ColorTokens.muted)
        Text(this.query)
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .margin({ left: 8 })
      }
      .width('100%')
      .height(46)
      .padding({ left: 16, right: 16 })
      .borderRadius(DemoAliasTokens.radiusLg)
      .backgroundColor(ColorTokens.metaBg)
      .margin({ bottom: 12 })

      ForEach(this.results, (title: string, idx: number) => {
        StructureRow({ title: title, detail: '作者 星港 · 3 个书源可用', chip: '可加入书架' })
          .margin({ bottom: idx === this.results.length - 1 ? 0 : 8 })
      }, (title: string, idx: number) => `${title}-${idx}`)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
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
    .padding({ left: 20, right: 20, top: 24 })
  }
}

@Component
export struct BookTocPreviewPage {
  private chapters: string[] = ['第 1 章 深空来信', '第 2 章 观察者', '第 3 章 低语'];

  build() {
    Column() {
      StructureCard({ title: '目录预览', message: '显示最近章节，完整目录在阅读页内打开。' })
      ForEach(this.chapters, (chapter: string) => {
        StructureRow({ title: chapter, detail: '约 12 分钟阅读' })
          .margin({ top: 8 })
      }, (chapter: string) => chapter)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}

@Component
export struct BookshelfEmptyPage {
  @Prop title: string = '书架为空';
  @Prop message: string = '导入本地书籍或从书源搜索后加入书架。';

  build() {
    Column() {
      StatePanel({ title: this.title, message: this.message, action: '去搜索' })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24 })
  }
}

@Component
export struct SourceManagementPage {
  private sources: string[] = ['阅读书源 1', '阅读书源 2', '阅读书源 3'];

  build() {
    Column() {
      StructureCard({ title: '书源管理', message: '启用、排序、测试和编辑书源。' })
      ForEach(this.sources, (source: string, idx: number) => {
        StructureRow({ title: source, detail: idx === 0 ? '默认 · 可用' : '已启用 · 待测试', chip: idx === 0 ? '默认' : '启用' })
          .margin({ top: 8 })
      }, (source: string) => source)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}

@Component
export struct SourceDetailPage {
  @Prop title: string = '阅读书源 1';

  build() {
    Column() {
      StructureCard({ title: this.title, message: 'https://example.com · 搜索/详情/目录规则完整。' })
      StructureRow({ title: '规则状态', detail: '搜索、详情、目录、正文均可测试', chip: '正常' })
        .margin({ top: 8 })
      StructureRow({ title: '编辑书源', detail: '打开规则编辑器' })
        .margin({ top: 8 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}

@Component
export struct SourceImportOptionsPage {
  build() {
    Column() {
      StructureCard({ title: '导入书源', message: '支持 URL、剪贴板、本地文件和远端订阅。' })
      StructureRow({ title: '从 URL 导入', detail: '粘贴书源订阅地址' })
        .margin({ top: 8 })
      StructureRow({ title: '从剪贴板导入', detail: '读取复制的书源 JSON' })
        .margin({ top: 8 })
      StructureRow({ title: '从本地文件导入', detail: '选择 JSON / TXT 文件' })
        .margin({ top: 8 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
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
    .padding({ left: 20, right: 20, top: 24 })
  }
}

@Component
export struct SourceSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '书源设置', message: '管理书源更新、并发和调试策略。' })
      StructureRow({ title: '书源管理', detail: '查看、导入、启停书源' })
        .margin({ top: 8 })
      StructureRow({ title: '测试设置', detail: '配置搜索和正文测试' })
        .margin({ top: 8 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}

@Component
export struct SourceTestResultPage {
  build() {
    Column() {
      StructureCard({ title: '测试结果', message: '最近一次书源规则检查。' })
      StructureRow({ title: '搜索规则', detail: '返回 12 条结果', chip: '通过' })
        .margin({ top: 8 })
      StructureRow({ title: '详情规则', detail: '解析书名、作者、目录', chip: '通过' })
        .margin({ top: 8 })
      StructureRow({ title: '正文规则', detail: '正文段落可读', chip: '通过' })
        .margin({ top: 8 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}

@Component
export struct WebDavConfigPage {
  build() {
    Column() {
      StructureCard({ title: 'WebDAV 配置', message: '连接云端备份目录。' })
      StructureRow({ title: '服务器地址', detail: 'https://dav.example.com' })
        .margin({ top: 8 })
      StructureRow({ title: '用户名', detail: 'reader@example.com' })
        .margin({ top: 8 })
      PrimaryAction({ label: '测试连接' })
        .margin({ top: 14 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SyncSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '同步设置', message: 'WebDAV、备份、恢复和同步状态入口。' })
      StructureRow({ title: 'WebDAV 配置', detail: '连接远端存储' })
        .margin({ top: 8 })
      StructureRow({ title: '备份与恢复', detail: '上传、下载、冲突处理' })
        .margin({ top: 8 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}

@Component
export struct SyncErrorPage {
  @Prop title: string = '同步冲突';
  @Prop message: string = '本地与云端版本不一致，请选择处理方式。';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message, action: '处理冲突' })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24 })
  }
}

@Component
export struct SyncProgressPage {
  @Prop title: string = '同步中';
  @Prop progress: number = 0.64;

  build() {
    Column() {
      StructureCard({ title: this.title, message: '正在上传书架、阅读进度和配置。' })
      Stack({ alignContent: Alignment.Start }) {
        Row()
          .width('100%')
          .height(8)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Row()
          .width(`${Math.round(this.progress * 100)}%`)
          .height(8)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
      }
      .width('100%')
      .height(8)
      .margin({ top: 14 })
      Text(`${Math.round(this.progress * 100)}%`)
        .fontSize(12)
        .fontColor(ColorTokens.muted)
        .margin({ top: 8 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RemoteWebDavBooksPage {
  private books: string[] = ['三体.epub', '基地.txt', '球状闪电.epub'];

  build() {
    Column() {
      StructureCard({ title: '远端书籍', message: '从 WebDAV 备份中选择要恢复的书籍。' })
      ForEach(this.books, (book: string) => {
        StructureRow({ title: book, detail: '最近同步 · 可恢复' })
          .margin({ top: 8 })
      }, (book: string) => book)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}

@Component
export struct RssDetailPage {
  @Prop title: string = 'AI 周报：端侧模型更新';

  build() {
    Column() {
      StructureCard({ title: this.title, message: '来源：Tech Feed · 12 分钟前' })
      Text('端侧模型、阅读体验和同步能力的最新进展摘要。')
        .fontSize(17)
        .lineHeight(28)
        .fontColor(ColorTokens.ink)
        .margin({ top: 14 })
      PrimaryAction({ label: '打开原文' })
        .margin({ top: 16 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
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
    .padding({ left: 20, right: 20, top: 24 })
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
    .padding({ left: 20, right: 20, top: 24 })
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
    .padding({ left: 20, right: 20, top: 24 })
  }
}

@Component
export struct OfflineStatePage {
  @Prop title: string = '当前离线';
  @Prop message: string = '检查网络后再继续同步或搜索。';

  build() {
    Column() {
      StatePanel({ variant: 'offline', title: this.title, message: this.message })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24 })
  }
}

@Component
export struct PermissionRequiredPage {
  @Prop title: string = '需要权限';
  @Prop message: string = '授予存储或通知权限后才能继续。';
  @Prop action: string = '去授权';

  build() {
    Column() {
      StatePanel({ variant: 'permission', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24 })
  }
}

@Component
export struct AboutVersionPage {
  @Prop title: string = 'Reader';
  @Prop version: string = '0.1.0';

  build() {
    Column() {
      StructureCard({ title: this.title, message: `版本 ${this.version}` })
      StructureRow({ title: '隐私政策', detail: '查看本地数据与同步说明' })
        .margin({ top: 8 })
      StructureRow({ title: '开源许可', detail: '查看第三方组件许可' })
        .margin({ top: 8 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}

@Component
export struct LocalBookImportPage {
  build() {
    Column() {
      StructureCard({ title: '本地导入', message: '导入 TXT / EPUB 文件并加入书架。' })
      StructureRow({ title: '选择文件', detail: '从本地存储选择一本或多本书籍' })
        .margin({ top: 8 })
      StructureRow({ title: '导入目录', detail: '扫描目录并批量加入书架' })
        .margin({ top: 8 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}

@Component
export struct ReadingSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '阅读设置', message: '字体、主题、布局、翻页和调试入口。' })
      StructureRow({ title: '字体与排版', detail: '字号、行距、段距' })
        .margin({ top: 8 })
      StructureRow({ title: '主题与亮度', detail: '纸张、夜间、护眼' })
        .margin({ top: 8 })
      StructureRow({ title: '翻页方式', detail: '滑动、点击、仿真' })
        .margin({ top: 8 })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 10 })
  }
}
