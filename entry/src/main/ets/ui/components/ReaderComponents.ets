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
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp('reader.displayedRouteId') routeId: string = 'reader';
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];
  @Prop theme: string = 'paper';

  private immersiveParagraphs: string[] = [
    '雨声在窗外连成一片，像无数细小的针，密密地刺在玻璃上，汇成一层朦胧的水幕，将城市的灯光晕成模糊的光团。',
    '他站在窗前，手里握着那封被雨水润湿的信。纸页边角微微卷起，字迹却依旧清晰，像某个迟到许久的答案终于抵达。',
    '这座城市在夜里显得格外安静，街道尽头偶尔有车灯掠过，又很快被雨幕吞没，只留下短暂而摇晃的光。',
    '他曾经以为自己已经习惯等待，习惯在没有回音的日子里把所有疑问折起来，塞进抽屉最深处。'
  ];

  private controlParagraphs: string[] = [
    '雨声在窗外连成一片，像无数细小的针，密密地刺在玻璃上，汇成一层朦胧的水幕，将城市的灯光晕成模糊的光团。',
    '他站在窗前，手里握着那封被雨水润湿的信。纸页边角微微卷起，字迹却依旧清晰，像某个迟到许久的答案终于抵达。',
    '这座城市在夜里显得格外安静，街道尽头偶尔有车灯掠过，又很快被雨幕吞没，只留下短暂而摇晃的光。',
    '他曾经以为自己已经习惯等待，习惯在没有回音的日子里把所有疑问折起来，塞进抽屉最深处。',
    '可真正看到信上那行字时，他才发现那些被压下去的情绪并没有消失，只是一直在暗处积蓄，等着这一刻重新涌上来。',
    '远处的灯光像被雾气揉碎，只剩下一团模糊的暖色。也许有些选择，从一开始就注定要在某个雨夜到来。'
  ];

  private inkColor(): string {
    return this.theme === 'night' ? ColorTokens.inkNight : ColorTokens.ink;
  }

  private controlLayer(): boolean {
    return this.routeId !== 'reader';
  }

  private title(): string {
    return '雨夜';
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
        top: this.controlLayer() ? this.safeAreaTop + 90 : 72,
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
        Text('长夜余火 · 第 32 章 雨夜')
          .fontSize(12)
          .fontColor(this.mutedColor())
          .fontFamily(ReaderTypography.sansFamily())
          .layoutWeight(1)
        Text('10:30')
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
        Text('第 1 / 8 页')
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

// .fd-reader-top: top control chrome shown on control-layer and overlay routes.
// Live demo shape: one floating rounded bar with back, book title/source line,
// source-switch action, and more. The plain reader route keeps ReadingInfoLayer.
@Component
export struct ReaderTopArea {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {
        Row({ space: 8 }) {
          Row() {
            Image($r('app.media.reader_icon_back_dark'))
              .width(28)
              .height(28)
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
          }
          .width(40)
          .height(42)
          .justifyContent(FlexAlign.Start)
          .alignItems(VerticalAlign.Center)

          Column({ space: 5 }) {
            Text('长夜余火')
              .fontSize(16)
              .fontWeight(700)
              .fontColor(ColorTokens.controlInk)
              .fontFamily(ReaderTypography.sansFamily())
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            Text('第 32 章 雨夜 · 优书网')
              .fontSize(12)
              .fontColor(ColorTokens.muted)
              .fontFamily(ReaderTypography.sansFamily())
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          .height(42)

          Row({ space: 4 }) {
            Image($r('app.media.reader_icon_source_switch_dark'))
              .width(20)
              .height(20)
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

          Row() {
            Image($r('app.media.reader_icon_more_dark')).width(24).height(24)
          }
          .width(34)
          .height(42)
          .justifyContent(FlexAlign.Center)
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .height(54)
        .padding({ left: 12, right: 12 })
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusXl)
        .backgroundColor(DemoAliasTokens.surface)
        .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
      }
      .width('100%')
      .padding({ left: 14, right: 14 })
      .margin({ top: this.safeAreaTop + 18 })
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
