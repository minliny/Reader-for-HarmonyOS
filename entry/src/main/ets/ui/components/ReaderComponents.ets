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
    '那声音起初像是冰层断裂的脆响，随后逐渐演变成一种低沉的、仿佛是在水下敲击金属的节奏。每敲击三次，就会有一次长达十秒的绝对静默。',
    '“三短，一长静默……”索菲亚的脸色变了，“在旧地球时代的航海通讯里，这是……”',
    '“求救信号。”艾伦打断了她，手指在控制台的触控板上快速滑过，试图锁定信号源的坐标。“但问题是，这个波段是我们在五十年前就已经淘汰的军用加密频道。而且，坐标指向的是——”',
    '他咽了一口唾沫，看着屏幕上解析出的星图坐标。',
    '“指向的是我们母星系的方向。可那里，在四十年前的大坍缩中，就已经什么都不剩了。”'
  ];

  private inkColor(): string {
    return this.theme === 'night' ? ColorTokens.inkNight : ColorTokens.ink;
  }

  private controlLayer(): boolean {
    return this.routeId !== 'reader';
  }

  private title(): string {
    return this.controlLayer() ? '深空信号' : '第一章 科学边界';
  }

  // Use real chapter content from the reducer when available; fall back to
  // fixture paragraphs so the reader page still renders in demo flows.
  private paragraphs(): string[] {
    if (this.controlLayer()) {
      return this.controlParagraphs;
    }
    if (this.chapterContent.length > 0) {
      return this.chapterContent;
    }
    return this.immersiveParagraphs;
  }

  build() {
    Scroll() {
      Column() {
        Text(this.title())
          .fontSize(this.controlLayer() ? 28 : 23)
          .fontWeight(700)
          .fontColor(this.inkColor())
          .fontFamily(ReaderTypography.serifFamily())
          .lineHeight(this.controlLayer() ? 36 : 28)
          .textAlign(this.controlLayer() ? TextAlign.Start : TextAlign.Center)
          .width('100%')
          .margin({ bottom: this.controlLayer() ? 32 : 24 })
        ForEach(this.paragraphs(), (p: string, i: number) => {
          Text(p)
            .fontSize(18)
            .fontColor(this.inkColor())
            .fontFamily(ReaderTypography.serifFamily())
            .lineHeight(this.controlLayer() ? 18 * 1.72 : 18 * 1.96)
            .textIndent(this.controlLayer() ? 0 : 2 * 18)
            .textAlign(TextAlign.Start)
            .margin({ bottom: this.controlLayer() ? 24 : 16 })
        }, (p: string, i: number) => `${i}`)
      }
      .padding({
        top: this.controlLayer() ? 128 : 72,
        left: this.controlLayer() ? 24 : 32,
        right: this.controlLayer() ? 24 : 32,
        bottom: this.controlLayer() ? 230 + this.safeAreaBottom : 48 + this.safeAreaBottom,
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
// routes. Mirrors normalized HTML: a full-width 56vp top bar plus a 48vp meta
// row. The plain reader route keeps ReadingInfoLayer instead.
@Component
export struct ReaderTopArea {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {
        Row() {
          Row() {
            Image($r('app.media.reader_icon_back_dark'))
              .width(28)
              .height(28)
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
          }
          .width(40)
          .justifyContent(FlexAlign.Start)
          .alignItems(VerticalAlign.Center)

          Text('深空信号')
            .fontSize(18)
            .fontWeight(600)
            .fontColor(ColorTokens.controlInk)
            .fontFamily(ReaderTypography.sansFamily())
            .textAlign(TextAlign.Center)
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          Row({ space: 16 }) {
            Image($r('app.media.ui_icon_refresh_dark')).width(24).height(24)
            Image($r('app.media.reader_icon_source_switch_dark'))
              .width(24)
              .height(24)
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-switch-results' }))
            Image($r('app.media.reader_icon_more_dark')).width(24).height(24)
          }
          .width(112)
          .justifyContent(FlexAlign.End)
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .height(56)
        .padding({ left: 16, right: 16 })
        .backgroundColor(ColorTokens.surface)
        .border({ width: { bottom: 1 }, color: ColorTokens.border })

        Row() {
          Text('第一章：阿长与《山海经》')
            .fontSize(14)
            .fontColor(ColorTokens.controlInk)
            .fontFamily(ReaderTypography.sansFamily())
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text('本地书籍')
            .fontSize(12)
            .fontWeight(600)
            .fontColor(ColorTokens.primary)
            .fontFamily(ReaderTypography.sansFamily())
            .padding({ left: 10, right: 10, top: 4, bottom: 4 })
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .borderRadius(DemoAliasTokens.radiusPill)
        }
        .width('100%')
        .height(48)
        .padding({ left: 16, right: 16 })
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: { bottom: 1 }, color: ColorTokens.border })
      }
      .width('100%')
      .margin({ top: this.safeAreaTop })
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
