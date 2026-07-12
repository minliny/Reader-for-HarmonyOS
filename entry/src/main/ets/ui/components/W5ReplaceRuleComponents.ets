// W5ReplaceRuleComponents — 专用 ArkUI 页面 for the 5 W5 replace-rule routes:
//   reader-replace-page / reader-replace-delete-confirm
//   reader-replace-apply-result / reader-replace-import-export
//   reader-replace-preview
//
// These routes were previously rendered by Contract25StateCard (a generic
// "功能暂不可用" scaffold).  Each route now has its own dedicated @Component
// that reads real Core state (replaceRules, pendingReplaceRuleDeleteId) and
// renders a route-specific body with honest context and rule actions.
//
// Honesty contract:
//   - Real Core-backed state (replaceRules, pendingReplaceRuleDeleteId) is
//     read from AppStorage and displayed.
//   - If Core has not returned rule data, the page says so explicitly instead
//     of fabricating fixture rule names, patterns, or apply results.
//   - No fixed text impersonates rule patterns, replacement text, or results.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { ReplaceRule } from '../store/ReaderUiState';

// ── Shared W5 state header ──
@Component
struct W5StateHeader {
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

// ── Shared W5 info row ──
@Component
struct W5InfoRow {
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

// ── Shared W5 action button ──
@Component
struct W5ActionButton {
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

// ── Shared W5 honest-pending notice ──
@Component
struct W5CorePendingNotice {
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
// 1. reader-replace-page — 内容替换规则管理
//    Core: 读取 replaceRules 列表，展示真实规则或空状态。
// =============================================================================
@Component
export struct ReplaceRuleManagePage {
  @StorageProp('reader.replaceRules') rules: ReplaceRule[] = [];

  private enabledCount(): number {
    let count = 0;
    for (let i = 0; i < this.rules.length; i++) {
      if (this.rules[i].enabled) count++;
    }
    return count;
  }

  build() {
    Column({ space: 12 }) {
      W5StateHeader({
        iconGlyph: '⇄',
        title: '内容替换规则管理',
        summary: '管理 Core 返回的替换规则列表。可以新增、编辑、启用/禁用或删除规则。',
      })
      Column({ space: 6 }) {
        W5InfoRow({ label: '规则总数', value: `${this.rules.length} 条` })
        W5InfoRow({ label: '已启用', value: `${this.enabledCount()} 条` })
      }
      .width('100%')
      if (this.rules.length === 0) {
        W5CorePendingNotice({
          detail: 'Core 尚未返回替换规则列表（replaceRules 为空）。不会显示固定的规则名称、匹配模式或替换文本。',
        })
      } else {
        Column({ space: 6 }) {
          ForEach(this.rules, (rule: ReplaceRule, index: number) => {
            Row({ space: 8 }) {
              Column() {
                Text(rule.pattern)
                  .fontSize(12)
                  .fontWeight(700)
                  .fontColor(ColorTokens.controlInk)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                if (rule.replacement.length > 0) {
                  Text(`→ ${rule.replacement}`)
                    .fontSize(10)
                    .fontColor(ColorTokens.muted)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                }
              }
              .layoutWeight(1)
              .alignItems(HorizontalAlign.Start)
              Text(rule.enabled ? '启用' : '禁用')
                .fontSize(10)
                .fontWeight(700)
                .fontColor(rule.enabled ? ColorTokens.primary : ColorTokens.muted)
            }
            .width('100%')
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.floatingControlBg)
            .alignItems(VerticalAlign.Center)
          }, (rule: ReplaceRule) => rule.id)
        }
        .width('100%')
      }
      Row({ space: 10 }) {
        W5ActionButton({
          label: '进入替换面板',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'content-replacement' }),
        })
        W5ActionButton({
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
// 2. reader-replace-delete-confirm — 删除替换规则确认
//    Core: 读取 pendingReplaceRuleDeleteId + replaceRules 定位待删除规则。
// =============================================================================
@Component
export struct ReplaceDeleteConfirmPage {
  @StorageProp('reader.replaceRules') rules: ReplaceRule[] = [];
  @StorageProp('reader.pendingReplaceRuleDeleteId') pendingDeleteId: string = '';

  private pendingRule(): ReplaceRule | null {
    if (this.pendingDeleteId.length === 0) return null;
    for (let i = 0; i < this.rules.length; i++) {
      if (this.rules[i].id === this.pendingDeleteId) return this.rules[i];
    }
    return null;
  }

  build() {
    Column({ space: 12 }) {
      W5StateHeader({
        iconGlyph: '⚠',
        title: '确认删除替换规则',
        summary: '删除后该规则将不再对正文生效。此操作不可撤销，请确认。',
      })
      if (this.pendingRule() !== null) {
        Column({ space: 6 }) {
          W5InfoRow({ label: '规则 ID', value: this.pendingRule()!.id })
          W5InfoRow({ label: '匹配模式', value: this.pendingRule()!.pattern })
          W5InfoRow({ label: '替换为', value: this.pendingRule()!.replacement.length > 0 ? this.pendingRule()!.replacement : '（删除匹配内容）' })
          W5InfoRow({ label: '作用域', value: this.pendingRule()!.scope })
        }
        .width('100%')
      } else {
        W5CorePendingNotice({
          detail: 'Core 尚未返回待删除规则（pendingReplaceRuleDeleteId 未匹配到当前 replaceRules 列表）。不会显示固定的规则内容。',
        })
      }
      Row({ space: 10 }) {
        W5ActionButton({
          label: '取消',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'replace-rule-delete-cancel' }),
        })
        W5ActionButton({
          label: '确认删除',
          warning: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'replace-rule-delete-confirm' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 3. reader-replace-apply-result — 替换规则应用结果
//    Core: 尚无 apply-result DTO；诚实标注 Core 数据未返回。
// =============================================================================
@Component
export struct ReplaceApplyResultPage {
  @StorageProp('reader.replaceRules') rules: ReplaceRule[] = [];

  private enabledCount(): number {
    let count = 0;
    for (let i = 0; i < this.rules.length; i++) {
      if (this.rules[i].enabled) count++;
    }
    return count;
  }

  build() {
    Column({ space: 12 }) {
      W5StateHeader({
        iconGlyph: '✓',
        title: '替换规则应用结果',
        summary: '查看当前已启用替换规则对正文的匹配和替换情况。',
      })
      Column({ space: 6 }) {
        W5InfoRow({ label: '已启用规则', value: `${this.enabledCount()} 条` })
        W5InfoRow({ label: '规则总数', value: `${this.rules.length} 条` })
      }
      .width('100%')
      W5CorePendingNotice({
        detail: 'Core 尚未返回替换规则逐项应用结果（apply-result DTO 未定义）。不会显示固定的匹配次数、替换计数或逐项明细。',
      })
      Row({ space: 10 }) {
        W5ActionButton({
          label: '返回阅读',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
        W5ActionButton({
          label: '规则管理',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader-replace-page' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 4. reader-replace-import-export — 替换规则导入导出
//    Core: 尚无 import/export DTO；诚实标注 Core 数据未返回。
// =============================================================================
@Component
export struct ReplaceImportExportPage {
  @StorageProp('reader.replaceRules') rules: ReplaceRule[] = [];

  build() {
    Column({ space: 12 }) {
      W5StateHeader({
        iconGlyph: '⇅',
        title: '替换规则导入导出',
        summary: '将当前 Core 返回的替换规则导出为文件，或从文件导入新规则。',
      })
      Column({ space: 6 }) {
        W5InfoRow({ label: '当前规则数', value: `${this.rules.length} 条` })
      }
      .width('100%')
      W5CorePendingNotice({
        detail: 'Core 尚未返回替换规则导入导出契约（import/export DTO 未定义）。不会显示固定的文件名、导出格式或导入进度。',
      })
      Row({ space: 10 }) {
        W5ActionButton({
          label: '返回阅读',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
        W5ActionButton({
          label: '规则管理',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader-replace-page' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

// =============================================================================
// 5. reader-replace-preview — 替换规则预览
//    Core: 尚无 preview DTO；读取 replaceRules 展示规则列表。
// =============================================================================
@Component
export struct ReplacePreviewPage {
  @StorageProp('reader.replaceRules') rules: ReplaceRule[] = [];

  private enabledRules(): ReplaceRule[] {
    const result: ReplaceRule[] = [];
    for (let i = 0; i < this.rules.length; i++) {
      if (this.rules[i].enabled) result.push(this.rules[i]);
    }
    return result;
  }

  build() {
    Column({ space: 12 }) {
      W5StateHeader({
        iconGlyph: '👁',
        title: '替换规则预览',
        summary: '预览当前已启用替换规则对正文的匹配和替换效果。',
      })
      if (this.enabledRules().length > 0) {
        Column({ space: 6 }) {
          ForEach(this.enabledRules(), (rule: ReplaceRule) => {
            Row({ space: 8 }) {
              Column() {
                Text(rule.pattern)
                  .fontSize(12)
                  .fontWeight(700)
                  .fontColor(ColorTokens.controlInk)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                Text(`→ ${rule.replacement.length > 0 ? rule.replacement : '（删除）'}`)
                  .fontSize(10)
                  .fontColor(ColorTokens.muted)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
              }
              .layoutWeight(1)
              .alignItems(HorizontalAlign.Start)
              Text(rule.scope)
                .fontSize(10)
                .fontWeight(700)
                .fontColor(ColorTokens.muted)
            }
            .width('100%')
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.floatingControlBg)
            .alignItems(VerticalAlign.Center)
          }, (rule: ReplaceRule) => rule.id)
        }
        .width('100%')
      } else {
        W5CorePendingNotice({
          detail: '当前没有已启用的替换规则。不会显示固定的预览正文或匹配结果。',
        })
      }
      W5CorePendingNotice({
        detail: 'Core 尚未返回替换规则预览正文（preview DTO 未定义）。不会显示固定的匹配段落或替换后文本。',
      })
      Row({ space: 10 }) {
        W5ActionButton({
          label: '返回阅读',
          primary: true,
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' }),
        })
        W5ActionButton({
          label: '规则管理',
          onTap: () => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader-replace-page' }),
        })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
