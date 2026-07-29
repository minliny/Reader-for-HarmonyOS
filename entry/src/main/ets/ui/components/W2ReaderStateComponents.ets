// W2ReaderStateComponents — 专用 ArkUI 页面 for the 6 W2 reader content/TOC
// state routes:
//   reader-content-loading / reader-content-offline / reader-content-error
//   reader-toc-loading / reader-toc-offline / reader-toc-error
//
// These routes were previously rendered by Contract25StateCard (a generic
// "功能暂不可用" scaffold).  Each route now has its own dedicated @Component
// that reads real Core state (currentBook, chapterContent, chapterToc,
// errorCode, errorMessage, loading) and renders a route-specific state body
// with honest context and retry actions.
//
// Honesty contract:
//   - Real Core-backed state (loading, errorCode, currentBook, chapterToc) is
//     read from AppStorage and displayed.
//   - If Core has not returned data for a field, the page says so explicitly
//     instead of fabricating fixture content.
//   - No fixed text impersonates chapter titles, error details, or TOC entries.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail, ChapterTocEntry } from '../store/ReaderUiState';

// ── Shared W2 state header ──
@Component
struct W2StateHeader {
  @Prop iconGlyph: string = '⚠';
  @Prop title: string = '';
  @Prop summary: string = '';

  build() {
    Row({ space: 12 }) {
      Stack({ alignContent: Alignment.Center }) {
        Text(this.iconGlyph)
          .fontSize(20)
          .fontWeight(800)
          .fontColor(ColorTokens.accent)
      }
      .width(40)
      .height(40)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.surfaceSoft)

      Column() {
        Text(this.title)
          .fontSize(17)
          .fontWeight(800)
          .fontColor(ColorTokens.ink)
          .fontFamily(ReaderTypography.serifFamily())
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.summary.length > 0) {
          Text(this.summary)
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .lineHeight(18)
            .margin({ top: 4 })
            .maxLines(3)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
  }
}

// ── Shared W2 info row ──
@Component
struct W2InfoRow {
  @Prop label: string = '';
  @Prop value: string = '';

  build() {
    Row() {
      Text(this.label)
        .fontSize(11)
        .fontColor(ColorTokens.muted)
        .layoutWeight(1)
      Text(this.value)
        .fontSize(12)
        .fontWeight(700)
        .fontColor(ColorTokens.controlInk)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 8, bottom: 8 })
    .borderRadius(DemoAliasTokens.radiusSm)
    .backgroundColor(ColorTokens.floatingControlBg)
    .alignItems(VerticalAlign.Center)
  }
}

// ── Shared W2 action button ──
@Component
struct W2ActionButton {
  @Prop label: string = '';
  @Prop primary: boolean = false;
  @Prop warning: boolean = false;
  onTap: () => void = () => {};

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(850)
      .fontColor(this.primary || this.warning ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(40)
      .layoutWeight(1)
      .textAlign(TextAlign.Center)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.warning
        ? ColorTokens.accent
        : (this.primary ? ColorTokens.primary : ColorTokens.metaBg))
      .border({ width: this.primary || this.warning ? 0 : 1, color: ColorTokens.border })
      .onClick(() => this.onTap())
  }
}

// ── Shared W2 honest-pending notice ──
@Component
struct W2CorePendingNotice {
  @Prop detail: string = '';

  build() {
    Column() {
      Text('Core 数据尚未返回')
        .fontSize(13)
        .fontWeight(800)
        .fontColor(ColorTokens.accent)
      Text(this.detail)
        .fontSize(12)
        .fontColor(ColorTokens.muted)
        .lineHeight(18)
        .margin({ top: 6 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surfaceSoft)
    .border({ width: 1, color: ColorTokens.border })
  }
}

// =============================================================================
// 1. reader-content-loading — 正文加载中
//    Core: chapter.load 正在运行；读取 loading + currentBook + currentChapterTitle
// =============================================================================
@Component
export struct ReaderContentLoadingPage {
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private chapterLabel(): string {
    if (this.currentChapterTitle.length > 0) return this.currentChapterTitle;
    if (this.currentBook !== null && this.currentBook.latestChapter.length > 0) {
      return this.currentBook.latestChapter;
    }
    return '未返回章节标题';
  }

  private stepLabel(): string {
    if (this.chapterContent.length > 0) return '已收到部分正文，等待完整返回';
    if (this.loading) return 'Core chapter.load 正在运行';
    return '等待 Core 响应';
  }

  build() {
    Column({ space: 12 }) {
      W2StateHeader({
        iconGlyph: '↻',
        title: '正在加载章节正文',
        summary: '正在从 Core 拉取所选章节的正文内容，请稍候。加载期间不会展示固定示例文本。',
      })
      Column({ space: 6 }) {
        W2InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W2InfoRow({ label: '当前章节', value: this.chapterLabel() })
        W2InfoRow({ label: '当前步骤', value: this.stepLabel() })
      }
      .width('100%')
      if (this.loading) {
        Row({ space: 10 }) {
          LoadingProgress()
            .width(20)
            .height(20)
            .color(ColorTokens.primary)
          Text('Core chapter.load 正在运行…')
            .fontSize(12)
            .fontColor(ColorTokens.muted)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      Row({ space: 10 }) {
        W2ActionButton({
          label: '返回阅读',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
        W2ActionButton({
          label: '返回书架',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 2. reader-content-offline — 正文离线
//    Core: chapter.load 因网络不可用而失败；读取 currentBook + errorCode。
// =============================================================================
@Component
export struct ReaderContentOfflinePage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.errorCode') errorCode: string = '';
  @StorageProp('reader.errorMessage') errorMessage: string = '';

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private chapterLabel(): string {
    if (this.currentChapterTitle.length > 0) return this.currentChapterTitle;
    return '未返回章节标题';
  }

  private errorLabel(): string {
    if (this.errorCode.length > 0) return `${this.errorCode}：${this.errorMessage}`;
    return 'Core 未返回错误码（可能是 Host 网络层断言）';
  }

  build() {
    Column({ space: 12 }) {
      W2StateHeader({
        iconGlyph: '⚠',
        title: '正文离线',
        summary: '网络不可用或书源无法访问，无法加载本章正文。请检查网络后重试。',
      })
      Column({ space: 6 }) {
        W2InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W2InfoRow({ label: '当前章节', value: this.chapterLabel() })
        W2InfoRow({ label: '错误信息', value: this.errorLabel() })
      }
      .width('100%')
      Row({ space: 10 }) {
        W2ActionButton({
          label: '重试加载',
          primary: true,
          onTap: () => {
            ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' });
            ReaderUiStore.dispatch({ type: 'retry-last-operation' });
          },
        })
        W2ActionButton({
          label: '返回书架',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 3. reader-content-error — 正文解析错误
//    Core: chapter.load 返回解析失败；读取 errorCode + errorMessage。
// =============================================================================
@Component
export struct ReaderContentErrorPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.errorCode') errorCode: string = '';
  @StorageProp('reader.errorMessage') errorMessage: string = '';

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private chapterLabel(): string {
    if (this.currentChapterTitle.length > 0) return this.currentChapterTitle;
    return '未返回章节标题';
  }

  private errorLabel(): string {
    if (this.errorCode.length > 0) return this.errorCode;
    return '未返回错误码';
  }

  private errorDetail(): string {
    if (this.errorMessage.length > 0) return this.errorMessage;
    return 'Core 未返回详细错误信息';
  }

  build() {
    Column({ space: 12 }) {
      W2StateHeader({
        iconGlyph: '⚠',
        title: '正文解析错误',
        summary: 'Core 返回的章节正文无法解析或为空。可以尝试切换书源或返回书架。',
      })
      Column({ space: 6 }) {
        W2InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W2InfoRow({ label: '当前章节', value: this.chapterLabel() })
        W2InfoRow({ label: '错误码', value: this.errorLabel() })
        W2InfoRow({ label: '错误详情', value: this.errorDetail() })
      }
      .width('100%')
      Row({ space: 10 }) {
        W2ActionButton({
          label: '换源重试',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-switch' }),
        })
        W2ActionButton({
          label: '返回书架',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 4. reader-toc-loading — 目录加载中
//    Core: book.toc 正在运行；读取 currentBook + chapterToc。
// =============================================================================
@Component
export struct ReaderTocLoadingPage {
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private tocCount(): string {
    return `${this.chapterToc.length} 条`;
  }

  private stepLabel(): string {
    if (this.chapterToc.length > 0) return '已收到部分目录，等待完整返回';
    if (this.loading) return 'Core book.toc 正在运行';
    return '等待 Core 响应';
  }

  build() {
    Column({ space: 12 }) {
      W2StateHeader({
        iconGlyph: '↻',
        title: '正在加载目录',
        summary: '正在从 Core 拉取本书的章节目录，请稍候。加载期间不会展示固定示例章节。',
      })
      Column({ space: 6 }) {
        W2InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W2InfoRow({ label: '已收到目录', value: this.tocCount() })
        W2InfoRow({ label: '当前步骤', value: this.stepLabel() })
      }
      .width('100%')
      if (this.loading) {
        Row({ space: 10 }) {
          LoadingProgress()
            .width(20)
            .height(20)
            .color(ColorTokens.primary)
          Text('Core book.toc 正在运行…')
            .fontSize(12)
            .fontColor(ColorTokens.muted)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      Row({ space: 10 }) {
        W2ActionButton({
          label: '返回阅读',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
        W2ActionButton({
          label: '返回书架',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 5. reader-toc-offline — 目录离线
//    Core: book.toc 因网络不可用而失败；读取 currentBook + errorCode。
// =============================================================================
@Component
export struct ReaderTocOfflinePage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.errorCode') errorCode: string = '';
  @StorageProp('reader.errorMessage') errorMessage: string = '';

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private errorLabel(): string {
    if (this.errorCode.length > 0) return `${this.errorCode}：${this.errorMessage}`;
    return 'Core 未返回错误码（可能是 Host 网络层断言）';
  }

  build() {
    Column({ space: 12 }) {
      W2StateHeader({
        iconGlyph: '⚠',
        title: '目录离线',
        summary: '网络不可用或书源无法访问，无法加载章节目录。请检查网络后重试。',
      })
      Column({ space: 6 }) {
        W2InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W2InfoRow({ label: '错误信息', value: this.errorLabel() })
      }
      .width('100%')
      Row({ space: 10 }) {
        W2ActionButton({
          label: '重试加载',
          primary: true,
          onTap: () => {
            ReaderUiStore.dispatch({ type: 'retry-last-operation' });
          },
        })
        W2ActionButton({
          label: '返回书架',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 6. reader-toc-error — 目录解析错误
//    Core: book.toc 返回解析失败；读取 errorCode + errorMessage。
// =============================================================================
@Component
export struct ReaderTocErrorPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.errorCode') errorCode: string = '';
  @StorageProp('reader.errorMessage') errorMessage: string = '';

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private errorLabel(): string {
    if (this.errorCode.length > 0) return this.errorCode;
    return '未返回错误码';
  }

  private errorDetail(): string {
    if (this.errorMessage.length > 0) return this.errorMessage;
    return 'Core 未返回详细错误信息';
  }

  build() {
    Column({ space: 12 }) {
      W2StateHeader({
        iconGlyph: '⚠',
        title: '目录解析错误',
        summary: 'Core 返回的目录数据无法解析或为空。可以尝试切换书源或返回书架。',
      })
      Column({ space: 6 }) {
        W2InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W2InfoRow({ label: '错误码', value: this.errorLabel() })
        W2InfoRow({ label: '错误详情', value: this.errorDetail() })
      }
      .width('100%')
      Row({ space: 10 }) {
        W2ActionButton({
          label: '换源重试',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-switch' }),
        })
        W2ActionButton({
          label: '返回书架',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
