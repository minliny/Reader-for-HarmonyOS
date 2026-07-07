// ReaderComponents — reader immersive base + ReaderBase composite.
// Ported from frontend-demo (styles/00-foundation.css .fd-reading-surface /
// .fd-ir-reading-layer / .fd-ir-info-layer / .fd-immersive-hotzone).
//
// Batch 1: the legacy reader.overlay control dock + module sheets are retired
// — Reader overlays are routes now (route-push / route-pop), rendered via
// ViewStateRenderer(stack) from ViewStateTable. ReaderBase is the factored
// base composite used by every reader route's view-state body; theme='night'
// switches to night-theme tokens (step 3c-2 / D11).
//
// Immersive: each layer expands behind the system status / nav bars
// (expandSafeArea) so the reading paper owns the whole screen — correct under
// the night theme, not just the default paper. Layers then pad with the real
// device insets (safeAreaTop / safeAreaBottom from AppStorage via
// SafeAreaAdapter, written by EntryAbility) so the body text and the 4-corner
// info clear the bars. Each layer expandSafeArea on its own (the attribute does
// not propagate from the parent), which also disables implicit safe-area
// avoidance so the explicit padding is the single source of truth — no double
// inset.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RadiusTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

// .fd-ir-background-layer: full-bleed paper bg (night theme -> paperNight).
@Component
export struct ReadingBackgroundLayer {
  @Prop theme: string = 'paper';

  build() {
    Column().width('100%').height('100%').backgroundColor(this.theme === 'night' ? ColorTokens.paperNight : ColorTokens.paper)
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

// .fd-ir-reading-layer: inset 72 32 48. h1 (chapter, first page): +5px serif,
//   centered. p: reader-font-size (18) line-height 1.96 text-indent 2em, gap
//   paragraph-gap (16) between paragraphs.
@Component
export struct ReadingTextFlow {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];
  @Prop theme: string = 'paper';

  private fixtureParagraphs: string[] = [
    '汪淼盯着面前的纳米丝，想象着它在宏观尺度上的形态。它细如蛛丝，却能切断合金，这便是三体人送给地球的第一个礼物。',
    '叶文洁当年的选择，像一条看不见的线，从雷达峰延伸到此刻的每一个角落。她按下发射键的那一刻，人类的命运被永远改写了。',
    '宇宙曾经是一片死寂的荒漠，直到那条信息被发出，直到那个回复被接收。在那之后的每一个夜晚，星空都不再是原来的星空。'
  ];

  private inkColor(): string {
    return this.theme === 'night' ? ColorTokens.inkNight : ColorTokens.ink;
  }

  // Use real chapter content from the reducer when available; fall back to
  // fixture paragraphs so the reader page still renders in demo flows.
  private paragraphs(): string[] {
    return this.chapterContent.length > 0 ? this.chapterContent : this.fixtureParagraphs;
  }

  build() {
    Scroll() {
      Column() {
        Text('第一章 科学边界')
          .fontSize(23)
          .fontWeight(700)
          .fontColor(this.inkColor())
          .fontFamily(ReaderTypography.serifFamily())
          .textAlign(TextAlign.Center)
          .width('100%')
          .margin({ bottom: 24 })
        ForEach(this.paragraphs(), (p: string, i: number) => {
          Text(p)
            .fontSize(18)
            .fontColor(this.inkColor())
            .fontFamily(ReaderTypography.serifFamily())
            .lineHeight(18 * 1.96)
            .textIndent(2 * 18)
            .margin({ bottom: 16 })
        }, (p: string, i: number) => `${i}`)
      }
      .padding({ top: 72, left: 32, right: 32, bottom: 48 + this.safeAreaBottom })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme === 'night' ? ColorTokens.paperNight : ColorTokens.paper)
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

// .fd-ir-info-layer: inset 26 24 22, 4-corner overlay (top-left book·chapter,
//   top-right time, bottom-left progress, bottom-right page label). 12px sans
//   muted. pointer-events none (taps pass through to TapZones).
@Component
export struct ReadingInfoLayer {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @Prop theme: string = 'paper';

  private mutedColor(): string {
    return this.theme === 'night' ? ColorTokens.controlInkNight : ColorTokens.muted;
  }

  build() {
    Column() {
      Row() {
        Text('示例书 · 第一章 科学边界')
          .fontSize(12)
          .fontColor(this.mutedColor())
          .fontFamily(ReaderTypography.sansFamily())
          .layoutWeight(1)
        Text('13:50')
          .fontSize(12)
          .fontColor(this.mutedColor())
          .fontFamily(ReaderTypography.sansFamily())
      }
      .width('100%')
      Blank()
      Row() {
        Text('38%')
          .fontSize(12)
          .fontColor(this.mutedColor())
          .fontFamily(ReaderTypography.sansFamily())
          .layoutWeight(1)
        Text('第 1 / 10 页')
          .fontSize(12)
          .fontColor(this.mutedColor())
          .fontFamily(ReaderTypography.sansFamily())
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.safeAreaTop + 26, left: 24, right: 24, bottom: this.safeAreaBottom + 22 })
    .hitTestBehavior(HitTestMode.None)
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

// .fd-immersive-hotzone: prev 26% / center 48% / next 26%. Center opens the
// control layer (route-push control-layer-base-v2); prev pops back.
@Component
export struct TapZones {
  build() {
    Row() {
      Column().width('26%').height('100%')
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      Column().width('48%').height('100%')
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'control-layer-base-v2' }))
      Column().width('26%').height('100%')
    }
    .width('100%')
    .height('100%')
  }
}

// Session capsule — reflects reader.activeSession (reading / tts / auto-page).
@Component
export struct SessionCapsule {
  @StorageProp('reader.activeSession') activeSession: string = '';
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;

  private sessionLabel(): string {
    switch (this.activeSession) {
      case 'tts': return '朗读中';
      case 'auto-page': return '自动翻页';
      case 'reading': return '阅读中';
      default: return '';
    }
  }

  build() {
    if (this.activeSession !== '') {
      Row() {
        Circle().width(6).height(6).fill(ColorTokens.primary)
        Text(this.sessionLabel())
          .fontSize(11).fontWeight(700).fontColor(ColorTokens.controlInk)
          .margin({ left: 6 })
      }
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .borderRadius(RadiusTokens.control)
      .backgroundColor(DemoAliasTokens.surface)
      .border({ width: 1, color: ColorTokens.border })
      .position({ x: 24, y: this.safeAreaTop + 14 })
    }
  }
}

// ReaderBase — factored reading base (background + text + info + tap zones +
// session capsule). Composite used by every reader route's view-state body so
// the base is declared once in the contract, not repeated per overlay route.
// theme prop: 'paper' (default) | 'night' (night-theme tokens — step 3c-2).
@Component
export struct ReaderBase {
  @Prop theme: string = 'paper';

  build() {
    Stack() {
      ReadingBackgroundLayer({ theme: this.theme })
      ReadingTextFlow({ theme: this.theme })
      ReadingInfoLayer({ theme: this.theme })
      TapZones()
      SessionCapsule()
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
