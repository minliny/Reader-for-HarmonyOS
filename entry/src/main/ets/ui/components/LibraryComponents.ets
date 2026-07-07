// LibraryComponents — Library / Book / Search flow-page components (Batch 2).
// Ported from docs/ui-handoff/normalized-html (source-switch-results.html, ...)
// + reader-components.css. Route-driven: render as FlowShell body components
// via ViewStateRenderer(column). Colors via ColorTokens / DemoAliasTokens;
// sizes are bare vp (lint_tokens only forbids hex / px-unit strings).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';

// ── Source item (.reader-source-item) ──────────────────────────────────────
//   list-title 15/600 + list-detail 12 (muted) + trailing status chip.
@Component
export struct SourceItem {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop chip: string = '';

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(15).fontWeight(600).fontColor(ColorTokens.ink)
        if (this.detail !== '') {
          Text(this.detail)
            .fontSize(12).fontColor(ColorTokens.muted)
            .margin({ top: 2 })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      if (this.chip !== '') {
        Text(this.chip)
          .fontSize(12).fontColor(ColorTokens.primary)
          .padding({ left: 10, right: 10, top: 4, bottom: 4 })
          .border({ width: 1, color: ColorTokens.primary })
          .borderRadius(DemoAliasTokens.radiusPill)
      }
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .border({ width: { bottom: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

// ── Source switch results panel (source-switch-results.html) ───────────────
//   FlowShell body: header (title "换源结果" + close → route-pop) + source list
//   (4 candidate sources with latency + "可切换" chip). Replaces the generic
//   Overlay/ListRow fallback — the book-detail 换源 action now route-pushes
//   here (Batch 2 first cut: source-switch from fake overlay → real route).
@Component
export struct SourceSwitchResultsPanel {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  build() {
    Column() {
      // .reader-page-header: title + close (route-pop back to book-detail).
      Row() {
        Text('换源结果')
          .fontSize(18).fontWeight(700).fontColor(ColorTokens.ink)
          .layoutWeight(1)
        Text('关闭')
          .fontSize(13).fontColor(ColorTokens.primary)
          .padding({ left: 12, right: 12, top: 8, bottom: 8 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      }
      .width('100%')
      .height(52)
      .padding({ left: 16, right: 16 })
      .alignItems(VerticalAlign.Center)
      .border({ width: { bottom: 1 }, color: ColorTokens.border })

      // .reader-source-list: candidate sources by latency.
      Scroll() {
        Column() {
          SourceItem({ title: '书源 1', detail: '章节完整 · 延迟 120ms', chip: '可切换' })
          SourceItem({ title: '书源 2', detail: '章节完整 · 延迟 240ms', chip: '可切换' })
          SourceItem({ title: '书源 3', detail: '章节完整 · 延迟 360ms', chip: '可切换' })
          SourceItem({ title: '书源 4', detail: '章节完整 · 延迟 480ms', chip: '可切换' })
        }
      }
      .layoutWeight(1)
      .align(Alignment.Top)
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.safeAreaTop, bottom: this.safeAreaBottom })
    .backgroundColor(ColorTokens.paper)
  }
}
