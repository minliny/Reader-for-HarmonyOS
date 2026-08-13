// W1ImportFlowComponents — 专用 ArkUI 页面 for the 8 W1 import-workflow routes.
//
// These routes were previously rendered by Contract25StateCard (a generic
// "功能暂不可用" scaffold).  Each route now has its own dedicated @Component
// with route-specific phase indicator, content sections, and action buttons,
// mirroring the Demo's w1-import-renderers.js structure.
//
// Phase model (importPhase enum):
//   selecting → input → parsing → preview → conflict → applying → result
//
// Honesty contract:
//   - Real Core-backed state (importPreviewFormat, importPreviewCount, loading)
//     is read from AppStorage and displayed.
//   - Routes whose Core DTO does not yet exist (duplicate list, conflict list,
//     partial/full result list) explicitly state "Core 尚未返回 …" instead of
//     fabricating fixture entries.
//   - No fixed text impersonates imported fonts, sources, or rules.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

// ── Phase breadcrumb helpers ──

interface W1ImportPhase {
  key: string;
  label: string;
}

const W1_IMPORT_PHASES: W1ImportPhase[] = [
  { key: 'selecting', label: '选择' },
  { key: 'input', label: '输入' },
  { key: 'parsing', label: '解析' },
  { key: 'preview', label: '预览' },
  { key: 'conflict', label: '冲突' },
  { key: 'applying', label: '应用' },
  { key: 'result', label: '结果' },
];

function phaseIndex(key: string): number {
  for (let i = 0; i < W1_IMPORT_PHASES.length; i++) {
    if (W1_IMPORT_PHASES[i].key === key) return i;
  }
  return -1;
}

// Shared phase breadcrumb row.  Highlights the current phase, dims past phases.
@Component
struct W1ImportPhaseBreadcrumb {
  @Prop currentPhase: string = '';

  build() {
    Row() {
      ForEach(W1_IMPORT_PHASES, (phase: W1ImportPhase, index: number) => {
        Row({ space: 4 }) {
          Text(phase.label)
            .fontSize(11)
            .fontWeight(phase.key === this.currentPhase ? 900 : 600)
            .fontColor(phase.key === this.currentPhase
              ? DemoAliasTokens.onPrimary
              : (phaseIndex(phase.key) < phaseIndex(this.currentPhase)
                ? ColorTokens.primary
                : ColorTokens.muted))
          if (index < W1_IMPORT_PHASES.length - 1) {
            Text('›')
              .fontSize(11)
              .fontColor(ColorTokens.muted)
              .margin({ left: 2 })
          }
        }
        .height(26)
        .padding({ left: 8, right: 8 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(phase.key === this.currentPhase
          ? ColorTokens.primary
          : ColorTokens.metaBg)
      }, (phase: W1ImportPhase, index: number) => `${phase.key}-${index}`)
    }
    .width('100%')
    .height(34)
    .alignItems(VerticalAlign.Center)
  }
}

// Shared state-card header: icon glyph + title + summary paragraph.
@Component
struct W1ImportStateHeader {
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

// Shared info row: small label + strong value (mimics Demo's <article> blocks).
@Component
struct W1ImportInfoRow {
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

// Shared action button pill.
@Component
struct W1ImportActionButton {
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

// Shared "Core 未返回" honest-unavailable notice for routes whose Core DTO
// does not exist yet.  Distinct from the generic Contract25StateCard because
// it carries route-specific context (what Core hasn't returned) and sits inside
// a dedicated page layout with phase + actions.
@Component
struct W1ImportCorePendingNotice {
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
// 1. import-permission-denied — 权限拒绝页 (phase: selecting)
//    Core/Host: 需要系统存储权限；Core local_book.parse 无法读取文件。
// =============================================================================
@Component
export struct ImportPermissionDeniedPage {
  build() {
    Column({ space: 12 }) {
      W1ImportPhaseBreadcrumb({ currentPhase: 'selecting' })
      W1ImportStateHeader({
        iconGlyph: '🔒',
        title: '导入权限被拒绝',
        summary: '系统未授予存储访问权限，无法读取本地书籍文件。请在系统设置中授权后重试。',
      })
      Column({ space: 6 }) {
        W1ImportInfoRow({ label: '所需权限', value: '存储访问' })
        W1ImportInfoRow({ label: '触发场景', value: '本地书导入 · 选择文件阶段' })
        W1ImportInfoRow({ label: '影响范围', value: '无法读取或写入本地书籍文件' })
      }
      .width('100%')
      Row({ space: 10 }) {
        W1ImportActionButton({
          label: '重新选择',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'local-import' }),
        })
        W1ImportActionButton({
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
// 2. import-format-unsupported — 格式不支持页 (phase: input)
//    Core: local_book.parse 返回格式不支持；读取 importPreviewFormat。
// =============================================================================
@Component
export struct ImportFormatUnsupportedPage {
  @StorageProp('reader.importPreviewFormat') previewFormat: string = '';
  @StorageProp('reader.loading') loading: boolean = false;

  private detectedFormat(): string {
    return this.previewFormat.length > 0 ? this.previewFormat.toUpperCase() : '未识别';
  }

  build() {
    Column({ space: 12 }) {
      W1ImportPhaseBreadcrumb({ currentPhase: 'input' })
      W1ImportStateHeader({
        iconGlyph: '⚠',
        title: '文件格式不支持',
        summary: `当前文件格式（${this.detectedFormat()}）暂不支持导入，请转换为支持的格式后重新选择。`,
      })
      Column({ space: 6 }) {
        W1ImportInfoRow({ label: '检测格式', value: this.detectedFormat() })
        W1ImportInfoRow({ label: '支持格式', value: 'EPUB · TXT · MOBI · AZW3 · PDF' })
      }
      .width('100%')
      Text('可尝试使用格式转换工具转换为支持的格式后重新导入。')
        .fontSize(12)
        .fontColor(ColorTokens.muted)
        .lineHeight(18)
        .width('100%')
      Row({ space: 10 }) {
        W1ImportActionButton({
          label: '重新选择',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'local-import' }),
        })
        W1ImportActionButton({
          label: '取消',
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
// 3. import-empty-file — 空文件页 (phase: parsing)
//    Core: local_book.parse 检测到文件大小为 0。
// =============================================================================
@Component
export struct ImportEmptyFilePage {
  @StorageProp('reader.importPreviewCount') previewCount: number = 0;

  build() {
    Column({ space: 12 }) {
      W1ImportPhaseBreadcrumb({ currentPhase: 'parsing' })
      W1ImportStateHeader({
        iconGlyph: '📄',
        title: '文件为空',
        summary: '所选文件没有可导入的内容，请确认文件未损坏后重新选择。',
      })
      Column({ space: 6 }) {
        W1ImportInfoRow({ label: '检测结果', value: '文件内容为空或无法读取' })
        W1ImportInfoRow({ label: '已解析章节', value: `${this.previewCount}` })
      }
      .width('100%')
      Row({ space: 10 }) {
        W1ImportActionButton({
          label: '重新选择文件',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'local-import' }),
        })
        W1ImportActionButton({
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
// 4. import-parsing — 解析中页 (phase: parsing)
//    Core: local_book.parse 正在运行；读取 loading + previewFormat。
// =============================================================================
@Component
export struct ImportParsingPage {
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.importPreviewFormat') previewFormat: string = '';
  @StorageProp('reader.importPreviewCount') previewCount: number = 0;

  private stepLabel(): string {
    if (this.previewCount > 0) return '正在识别章节结构';
    return '正在读取文件内容';
  }

  build() {
    Column({ space: 12 }) {
      W1ImportPhaseBreadcrumb({ currentPhase: 'parsing' })
      W1ImportStateHeader({
        iconGlyph: '↻',
        title: '正在解析书籍',
        summary: '正在解析文件内容、识别章节结构和元数据，请稍候。',
      })
      Column({ space: 6 }) {
        W1ImportInfoRow({
          label: '当前步骤',
          value: this.loading ? this.stepLabel() : '解析已完成',
        })
        W1ImportInfoRow({
          label: '检测格式',
          value: this.previewFormat.length > 0 ? this.previewFormat.toUpperCase() : '解析中',
        })
      }
      .width('100%')
      if (this.loading) {
        Row({ space: 10 }) {
          LoadingProgress()
            .width(20)
            .height(20)
            .color(ColorTokens.primary)
          Text('Core local_book.parse 正在运行…')
            .fontSize(12)
            .fontColor(ColorTokens.muted)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      Row({ space: 10 }) {
        W1ImportActionButton({
          label: '返回书架',
          primary: true,
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
// 5. import-duplicate — 重复检测页 (phase: preview)
//    Core: 尚无 duplicate 检测 DTO；诚实标注 Core 数据未返回。
// =============================================================================
@Component
export struct ImportDuplicatePage {
  build() {
    Column({ space: 12 }) {
      W1ImportPhaseBreadcrumb({ currentPhase: 'preview' })
      W1ImportStateHeader({
        iconGlyph: '⧉',
        title: '检测到重复书籍',
        summary: '以下书籍在本地书架已存在，请选择处理方式。',
      })
      W1ImportCorePendingNotice({
        detail: 'Core 尚未返回本次导入的重复项列表（duplicate DTO 未定义）。不会显示固定的重复书名、大小或来源。',
      })
      Row({ space: 10 }) {
        W1ImportActionButton({
          label: '重新选择',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'local-import' }),
        })
        W1ImportActionButton({
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
// 6. import-conflict-resolve — 冲突解决页 (phase: conflict)
//    Core: 尚无 conflict 字段 DTO；诚实标注 Core 数据未返回。
// =============================================================================
@Component
export struct ImportConflictResolvePage {
  build() {
    Column({ space: 12 }) {
      W1ImportPhaseBreadcrumb({ currentPhase: 'conflict' })
      W1ImportStateHeader({
        iconGlyph: '⚠',
        title: '解决导入冲突',
        summary: '导入数据与本地记录存在冲突，请逐项选择处理方式。',
      })
      W1ImportCorePendingNotice({
        detail: 'Core 尚未返回字段冲突列表（conflict DTO 未定义）。不会显示固定的书名/作者/分组冲突项。',
      })
      Text('选择解决方案后将进入应用阶段，可通过回滚撤销本次导入。')
        .fontSize(12)
        .fontColor(ColorTokens.muted)
        .lineHeight(18)
        .width('100%')
      Row({ space: 10 }) {
        W1ImportActionButton({
          label: '重新选择',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'local-import' }),
        })
        W1ImportActionButton({
          label: '取消',
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
// 7. import-partial-success — 部分成功结果页 (phase: result)
//    Core: 读取 sourceImport* 统计；无逐项结果 DTO 时诚实标注。
// =============================================================================
@Component
export struct ImportPartialSuccessPage {
  @StorageProp('reader.importPreviewCount') previewCount: number = 0;
  @StorageProp('reader.sourceImportImported') imported: number = 0;
  @StorageProp('reader.sourceImportFailed') failed: number = 0;
  @StorageProp('reader.sourceImportTotal') total: number = 0;

  private successCount(): number {
    if (this.imported > 0) return this.imported;
    return this.previewCount > 0 && this.failed === 0 ? this.previewCount : 0;
  }

  private failCount(): number {
    return this.failed;
  }

  private totalCount(): number {
    if (this.total > 0) return this.total;
    return this.previewCount;
  }

  build() {
    Column({ space: 12 }) {
      W1ImportPhaseBreadcrumb({ currentPhase: 'result' })
      W1ImportStateHeader({
        iconGlyph: '✓',
        title: '部分导入成功',
        summary: `本次导入共 ${this.totalCount()} 项，其中 ${this.successCount()} 项成功、${this.failCount()} 项失败。`,
      })
      Column({ space: 6 }) {
        W1ImportInfoRow({ label: '成功', value: `${this.successCount()} 项` })
        W1ImportInfoRow({ label: '失败', value: `${this.failCount()} 项` })
        W1ImportInfoRow({ label: '总计', value: `${this.totalCount()} 项` })
      }
      .width('100%')
      W1ImportCorePendingNotice({
        detail: 'Core 尚未返回逐项导入结果明细（per-item result DTO 未定义）。不会显示固定的文件名、状态或失败原因。',
      })
      Row({ space: 10 }) {
        W1ImportActionButton({
          label: '查看详情',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-push', id: 'import-result-detail' }),
        })
        W1ImportActionButton({
          label: '完成',
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
// 8. import-result-detail — 导入结果详情页 (phase: result)
//    Core: 读取 sourceImport* 统计；无完整结果 DTO 时诚实标注。
// =============================================================================
@Component
export struct ImportResultDetailPage {
  @StorageProp('reader.importPreviewFormat') previewFormat: string = '';
  @StorageProp('reader.importPreviewCount') previewCount: number = 0;
  @StorageProp('reader.sourceImportImported') imported: number = 0;
  @StorageProp('reader.sourceImportSkipped') skipped: number = 0;
  @StorageProp('reader.sourceImportFailed') failed: number = 0;
  @StorageProp('reader.sourceImportOrigin') origin: string = '';

  build() {
    Column({ space: 12 }) {
      W1ImportPhaseBreadcrumb({ currentPhase: 'result' })
      W1ImportStateHeader({
        iconGlyph: 'ℹ',
        title: '导入结果详情',
        summary: '以下是本次导入的完整结果，可继续导入其他书籍或返回书架。',
      })
      Column({ space: 6 }) {
        W1ImportInfoRow({
          label: '来源',
          value: this.origin.length > 0 ? this.origin : '本地文件',
        })
        W1ImportInfoRow({
          label: '检测格式',
          value: this.previewFormat.length > 0 ? this.previewFormat.toUpperCase() : '未返回',
        })
        W1ImportInfoRow({ label: '已解析章节', value: `${this.previewCount}` })
        W1ImportInfoRow({ label: '已导入', value: `${this.imported}` })
        W1ImportInfoRow({ label: '已跳过', value: `${this.skipped}` })
        W1ImportInfoRow({ label: '失败', value: `${this.failed}` })
      }
      .width('100%')
      W1ImportCorePendingNotice({
        detail: 'Core 尚未返回逐项导入结果明细（per-item result DTO 未定义）。不会显示固定的文件名、编码或章节识别状态。',
      })
      Row({ space: 10 }) {
        W1ImportActionButton({
          label: '继续导入',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'local-import' }),
        })
        W1ImportActionButton({
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
