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
  @StorageProp('reader.displayedRouteId') routeId: string = 'reader';
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];
  @Prop theme: string = 'paper';

  private immersiveParagraphs: string[] = [
    '汪淼盯着面前的纳米丝，想象着它在宏观尺度上的形态。它细如蛛丝，却能切断合金，这便是三体人送给地球的第一个礼物。',
    '叶文洁当年的选择，像一条看不见的线，从雷达峰延伸到此刻的每一个角落。她按下发射键的那一刻，人类的命运被永远改写了。',
    '宇宙曾经是一片死寂的荒漠，直到那条信息被发出，直到那个回复被接收。在那之后的每一个夜晚，星空都不再是原来的星空。'
  ];

  private controlParagraphs: string[] = [
    '通讯台的指示灯已经闪烁了三个标准时。在这片被称为“寂静航线”的星域里，通常除了背景辐射的白噪音，什么也听不到。艾伦揉了揉干涩的眼睛，盯着那个代表未知频段的跳动波形。',
    '“这不是随机的脉冲星信号，”领航员索菲亚走到他身后，指着屏幕边缘的傅里叶变换图谱，“看这里的周期性间断，它有明显的结构，像是一种原始的二进制。”',
    '空间站外，恒星的光芒被一层稀薄的星云物质过滤，呈现出一种黯淡的铁锈红。船舱内的维生系统发出平缓的嗡嗡声，与屏幕上跳动的波形形成了一种奇异的共振。',
    '“求救信号。”艾伦打断了她，手指在控制台的触控板上快速滑过，试图锁定信号源的坐标。'
  ];

  private inkColor(): string {
    return this.theme === 'night' ? ColorTokens.inkNight : ColorTokens.ink;
  }

  private controlLayer(): boolean {
    return this.routeId !== 'reader';
  }

  private title(): string {
    return this.controlLayer() ? '雨夜' : '第一章 科学边界';
  }

  // Use real chapter content from the reducer when available; fall back to
  // fixture paragraphs so the reader page still renders in demo flows.
  private paragraphs(): string[] {
    if (this.chapterContent.length > 0) {
      return this.chapterContent;
    }
    return this.controlLayer() ? this.controlParagraphs : this.immersiveParagraphs;
  }

  build() {
    Scroll() {
      Column() {
        Text(this.title())
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
      .padding({
        top: this.controlLayer() ? 100 : 72,
        left: 32,
        right: 32,
        bottom: 48 + this.safeAreaBottom,
      })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme === 'night' ? ColorTokens.paperNight : ColorTokens.paper)
    .scrollBar(BarState.Off)
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

// .reader-top-area: top control chrome shown on control-layer and overlay
// routes. Mirrors demo .fd-reader-top: one rounded floating card with back,
// title/source, source switch, and more. The plain reader route keeps
// ReadingInfoLayer instead.
@Component
export struct ReaderTopArea {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Row({ space: 8 }) {
        Image($r('app.media.reader_icon_back_dark'))
          .width(28)
          .height(28)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))

        Column({ space: 4 }) {
          Text('长夜余火')
            .fontSize(16)
            .fontWeight(700)
            .fontColor(ColorTokens.controlInk)
            .fontFamily(ReaderTypography.sansFamily())
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text('第 32 章 雨夜 · 优书网')
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .fontFamily(ReaderTypography.sansFamily())
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Row({ space: 4 }) {
          Image($r('app.media.reader_icon_source_switch_dark')).width(18).height(18)
          Text('换源')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .fontFamily(ReaderTypography.sansFamily())
        }
        .width(62)
        .height(42)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-switch-results' }))

        Image($r('app.media.reader_icon_more_dark')).width(24).height(24)
      }
      .width('92%')
      .height(54)
      .padding({ left: 12, right: 12 })
      .margin({ top: this.safeAreaTop + 18 })
      .backgroundColor(ColorTokens.floatingControlBg)
      .border({ width: 1, color: ColorTokens.border })
      .borderRadius(DemoAliasTokens.radiusXl)
      .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
    }
    .width('100%')
    .height('100%')
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
  @StorageProp('reader.displayedRouteId') routeId: string = 'reader';

  private controlLayer(): boolean {
    return this.routeId !== 'reader';
  }

  build() {
    Stack() {
      ReadingBackgroundLayer({ theme: this.theme })
      ReadingTextFlow({ theme: this.theme })
      if (this.controlLayer()) {
        ReaderTopArea()
      } else {
        ReadingInfoLayer({ theme: this.theme })
        TapZones()
        SessionCapsule()
      }
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
