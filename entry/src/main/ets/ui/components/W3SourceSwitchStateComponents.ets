// W3SourceSwitchStateComponents — 专用 ArkUI 页面 for the 6 W3 source-switch
// state variant routes:
//   source-switch-empty / source-switch-error / source-switch-timeout
//   source-switch-loading / source-switch-rollback / source-switch-preview
//
// These routes were previously rendered by Contract25StateCard (a generic
// "功能暂不可用" scaffold).  Each route now has its own dedicated @Component
// that reads real Core state (currentBook, availableSources, sourceSelection,
// errorCode, errorMessage, loading) and renders a route-specific state body
// with honest context and source-switch actions.
//
// Honesty contract:
//   - Real Core-backed state (availableSources, sourceSelection, currentBook,
//     loading, errorCode) is read from AppStorage and displayed.
//   - If Core has not returned candidate sources, the page says so explicitly
//     instead of fabricating fixture source names.
//   - No fixed text impersonates source names, switch results, or error details.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail, CoreSourceEntry } from '../store/ReaderUiState';

// ── Shared W3 state header ──
@Component
struct W3StateHeader {
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

// ── Shared W3 info row ──
@Component
struct W3InfoRow {
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

// ── Shared W3 action button ──
@Component
struct W3ActionButton {
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

// ── Shared W3 honest-pending notice ──
@Component
struct W3CorePendingNotice {
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
// 1. source-switch-empty — 换源空结果
//    Core: source.list 返回空或全部 disabled；读取 availableSources。
// =============================================================================
@Component
export struct SourceSwitchEmptyPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.availableSources') availableSources: CoreSourceEntry[] = [];
  @StorageProp('reader.sourcesLoaded') sourcesLoaded: boolean = false;

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private currentSourceLabel(): string {
    return this.currentBook !== null && this.currentBook.sourceName.length > 0
      ? this.currentBook.sourceName : '未知来源';
  }

  private enabledCount(): number {
    let count = 0;
    for (let i = 0; i < this.availableSources.length; i++) {
      if (this.availableSources[i].enabled) count++;
    }
    return count;
  }

  build() {
    Column({ space: 12 }) {
      W3StateHeader({
        iconGlyph: '∅',
        title: '没有可用的换源候选',
        summary: '当前书源列表为空或所有书源已禁用，无法切换到其他书源。请先在书源管理中导入并启用书源。',
      })
      Column({ space: 6 }) {
        W3InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W3InfoRow({ label: '当前来源', value: this.currentSourceLabel() })
        W3InfoRow({ label: '已启用书源', value: `${this.enabledCount()} 个` })
      }
      .width('100%')
      if (!this.sourcesLoaded) {
        W3CorePendingNotice({
          detail: 'Core 尚未返回 source.list 结果。不会显示固定的候选书源名称或 URL。',
        })
      }
      Row({ space: 10 }) {
        W3ActionButton({
          label: '书源管理',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-management' }),
        })
        W3ActionButton({
          label: '返回阅读',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 2. source-switch-error — 换源加载失败
//    Core: source.list 或 source.switch 返回错误；读取 errorCode + errorMessage。
// =============================================================================
@Component
export struct SourceSwitchErrorPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.errorCode') errorCode: string = '';
  @StorageProp('reader.errorMessage') errorMessage: string = '';

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private currentSourceLabel(): string {
    return this.currentBook !== null && this.currentBook.sourceName.length > 0
      ? this.currentBook.sourceName : '未知来源';
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
      W3StateHeader({
        iconGlyph: '⚠',
        title: '换源加载失败',
        summary: 'Core 在加载候选书源或执行切换时返回错误。可以重试或返回阅读。',
      })
      Column({ space: 6 }) {
        W3InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W3InfoRow({ label: '当前来源', value: this.currentSourceLabel() })
        W3InfoRow({ label: '错误码', value: this.errorLabel() })
        W3InfoRow({ label: '错误详情', value: this.errorDetail() })
      }
      .width('100%')
      Row({ space: 10 }) {
        W3ActionButton({
          label: '重试换源',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-switch' }),
        })
        W3ActionButton({
          label: '返回阅读',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 3. source-switch-timeout — 换源超时
//    Core: source.switch 在超时阈值内未返回；读取 loading + currentBook。
// =============================================================================
@Component
export struct SourceSwitchTimeoutPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.sourceSelection') sourceSelection: string[] = [];

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private currentSourceLabel(): string {
    return this.currentBook !== null && this.currentBook.sourceName.length > 0
      ? this.currentBook.sourceName : '未知来源';
  }

  private selectedSourceLabel(): string {
    return this.sourceSelection.length === 1 ? '已选择 1 个' : '未选择目标书源';
  }

  build() {
    Column({ space: 12 }) {
      W3StateHeader({
        iconGlyph: '⏱',
        title: '换源请求超时',
        summary: 'Core 在超时阈值内未完成书源切换。可以重试或返回阅读，当前书源未变更。',
      })
      Column({ space: 6 }) {
        W3InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W3InfoRow({ label: '当前来源', value: this.currentSourceLabel() })
        W3InfoRow({ label: '目标书源', value: this.selectedSourceLabel() })
        W3InfoRow({ label: '运行状态', value: this.loading ? 'Core 仍在运行' : '已停止' })
      }
      .width('100%')
      Row({ space: 10 }) {
        W3ActionButton({
          label: '重试换源',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-switch' }),
        })
        W3ActionButton({
          label: '返回阅读',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 4. source-switch-loading — 换源切换中
//    Core: source.switch 正在运行；读取 loading + sourceSelection。
// =============================================================================
@Component
export struct SourceSwitchLoadingPage {
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.sourceSelection') sourceSelection: string[] = [];
  @StorageProp('reader.availableSources') availableSources: CoreSourceEntry[] = [];

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private currentSourceLabel(): string {
    return this.currentBook !== null && this.currentBook.sourceName.length > 0
      ? this.currentBook.sourceName : '未知来源';
  }

  private targetSourceLabel(): string {
    if (this.sourceSelection.length !== 1) return '未选择目标书源';
    const selectedId = this.sourceSelection[0];
    for (let i = 0; i < this.availableSources.length; i++) {
      if (this.availableSources[i].sourceId === selectedId) {
        return this.availableSources[i].name;
      }
    }
    return '目标书源不在当前列表';
  }

  build() {
    Column({ space: 12 }) {
      W3StateHeader({
        iconGlyph: '↻',
        title: '正在切换书源',
        summary: 'Core 正在执行书源切换，请稍候。切换期间不会展示固定的切换结果。',
      })
      Column({ space: 6 }) {
        W3InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W3InfoRow({ label: '当前来源', value: this.currentSourceLabel() })
        W3InfoRow({ label: '目标来源', value: this.targetSourceLabel() })
      }
      .width('100%')
      if (this.loading) {
        Row({ space: 10 }) {
          LoadingProgress()
            .width(20)
            .height(20)
            .color(ColorTokens.primary)
          Text('Core source.switch 正在运行…')
            .fontSize(12)
            .fontColor(ColorTokens.muted)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      Row({ space: 10 }) {
        W3ActionButton({
          label: '取消切换',
          warning: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'source-switch-cancel' }),
        })
        W3ActionButton({
          label: '返回阅读',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 5. source-switch-rollback — 换源失败回滚
//    Core: source.switch 失败后已回滚到原书源；读取 currentBook + errorCode。
// =============================================================================
@Component
export struct SourceSwitchRollbackPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.errorCode') errorCode: string = '';
  @StorageProp('reader.errorMessage') errorMessage: string = '';

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private currentSourceLabel(): string {
    return this.currentBook !== null && this.currentBook.sourceName.length > 0
      ? this.currentBook.sourceName : '未知来源';
  }

  private errorLabel(): string {
    if (this.errorCode.length > 0) return this.errorCode;
    return '未返回错误码';
  }

  build() {
    Column({ space: 12 }) {
      W3StateHeader({
        iconGlyph: '↺',
        title: '换源失败已回滚',
        summary: '书源切换失败，已自动回滚到原书源。当前阅读不受影响，可以重试或返回阅读。',
      })
      Column({ space: 6 }) {
        W3InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W3InfoRow({ label: '已回滚到', value: this.currentSourceLabel() })
        W3InfoRow({ label: '失败原因', value: this.errorLabel() })
      }
      .width('100%')
      Row({ space: 10 }) {
        W3ActionButton({
          label: '重新换源',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-switch' }),
        })
        W3ActionButton({
          label: '返回阅读',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 6. source-switch-preview — 换源预览
//    Core: 读取 sourceSelection + availableSources 展示预览信息。
// =============================================================================
@Component
export struct SourceSwitchPreviewPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.sourceSelection') sourceSelection: string[] = [];
  @StorageProp('reader.availableSources') availableSources: CoreSourceEntry[] = [];
  @StorageProp('reader.loading') loading: boolean = false;

  private bookLabel(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private currentSourceLabel(): string {
    return this.currentBook !== null && this.currentBook.sourceName.length > 0
      ? this.currentBook.sourceName : '未知来源';
  }

  private targetSourceLabel(): string {
    if (this.sourceSelection.length !== 1) return '未选择目标书源';
    const selectedId = this.sourceSelection[0];
    for (let i = 0; i < this.availableSources.length; i++) {
      if (this.availableSources[i].sourceId === selectedId) {
        return this.availableSources[i].name;
      }
    }
    return '目标书源不在当前列表';
  }

  private hasSelection(): boolean {
    return this.sourceSelection.length === 1;
  }

  build() {
    Column({ space: 12 }) {
      W3StateHeader({
        iconGlyph: '⧉',
        title: '换源预览',
        summary: '请确认要将当前书籍切换到以下书源。确认后 Core 将搜索同名书并完成切换。',
      })
      Column({ space: 6 }) {
        W3InfoRow({ label: '当前书籍', value: this.bookLabel() })
        W3InfoRow({ label: '当前来源', value: this.currentSourceLabel() })
        W3InfoRow({ label: '目标来源', value: this.targetSourceLabel() })
      }
      .width('100%')
      if (!this.hasSelection()) {
        W3CorePendingNotice({
          detail: '尚未选择目标书源。请返回换源列表选择一个书源后再预览。',
        })
      }
      Row({ space: 10 }) {
        W3ActionButton({
          label: this.loading ? '切换中…' : '确认换源',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'source-switch-confirm' }),
        })
        W3ActionButton({
          label: '返回列表',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-switch' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
