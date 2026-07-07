// ReaderComponents — reader immersive base ported from frontend-demo
// (styles/00-foundation.css .fd-reading-surface / .fd-ir-reading-layer /
// .fd-ir-info-layer / .fd-immersive-hotzone). Control-layer panels are Phase 2.
//
// Immersive: each layer expands behind the system status / nav bars (expandSafeArea)
// so the reading paper owns the whole screen — correct under a future night theme,
// not just the default paper. Layers then pad with the real device insets
// (safeAreaTop / safeAreaBottom from AppStorage via SafeAreaAdapter, written by
// EntryAbility) so the body text and the 4-corner info clear the bars. Each layer
// expandSafeArea on its own (the attribute does not propagate from the parent),
// which also disables implicit safe-area avoidance so the explicit padding is the
// single source of truth — no double inset.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RadiusTokens, SizeTokens, SpacingTokens } from '../../contract/generated/DimensionTokens';
import { MotionDurationTokens } from '../../contract/generated/MotionTokens';
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
  @Prop theme: string = 'paper';

  private paragraphs: string[] = [
    '汪淼盯着面前的纳米丝，想象着它在宏观尺度上的形态。它细如蛛丝，却能切断合金，这便是三体人送给地球的第一个礼物。',
    '叶文洁当年的选择，像一条看不见的线，从雷达峰延伸到此刻的每一个角落。她按下发射键的那一刻，人类的命运被永远改写了。',
    '宇宙曾经是一片死寂的荒漠，直到那条信息被发出，直到那个回复被接收。在那之后的每一个夜晚，星空都不再是原来的星空。'
  ];

  private inkColor(): string {
    return this.theme === 'night' ? ColorTokens.inkNight : ColorTokens.ink;
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
        ForEach(this.paragraphs, (p: string, i: number) => {
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

type ModuleKind = 'directory' | 'appearance' | 'tts' | 'settings';

// Reader control dock: bottom control-layer host with the grabber handle, a compact
// progress/chapters row, and the module nav. The platform system home indicator is
// not drawn here; bottom padding only avoids it.
@Component
export struct ReaderControlDock {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  build() {
    Column() {
      ReaderControlGrabber()
      Row() {
        Text('上一章')
          .fontSize(ReaderTypography.readerControlLabel().fontSize)
          .fontColor(ColorTokens.controlInk)
          .padding({ left: SpacingTokens.sm, right: SpacingTokens.sm, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
          .borderRadius(RadiusTokens.control)
          .backgroundColor(ColorTokens.metaBg)
        Column() {
          Text('38%')
            .fontSize(12)
            .fontWeight(700)
            .fontColor(ColorTokens.ink)
          Stack({ alignContent: Alignment.Start }) {
            Column()
              .width('100%')
              .height(3)
              .borderRadius(RadiusTokens.control)
              .backgroundColor(ColorTokens.border)
            Column()
              .width('38%')
              .height(3)
              .borderRadius(RadiusTokens.control)
              .backgroundColor(ColorTokens.primary)
          }
          .width('100%')
          .height(3)
          .margin({ top: 6 })
        }
        .layoutWeight(1)
        .margin({ left: SpacingTokens.sm, right: SpacingTokens.sm })
        Text('下一章')
          .fontSize(ReaderTypography.readerControlLabel().fontSize)
          .fontColor(ColorTokens.controlInk)
          .padding({ left: SpacingTokens.sm, right: SpacingTokens.sm, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
          .borderRadius(RadiusTokens.control)
          .backgroundColor(ColorTokens.metaBg)
      }
      .width('100%')
      .height(58)
      .padding({ left: SpacingTokens.md, right: SpacingTokens.md })
      .alignItems(VerticalAlign.Center)

      ReaderModuleNav()
    }
    .width('100%')
    .padding({ top: 4, bottom: this.safeAreaBottom })
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .shadow({ radius: 18, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: -4 })
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

@Component
export struct ReaderControlGrabber {
  build() {
    Column() {
      Column()
        .width(42)
        .height(4)
        .borderRadius(RadiusTokens.control)
        .backgroundColor(ColorTokens.border)
    }
    .width('100%')
    .height(28)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' }))
  }
}

// reader-module-nav: height 82 (--reader-ds-size-reader-module-nav-height),
//   4 items (目录/外观/朗读/设置), icon + label. Bottom safe-area ownership lives
//   on ReaderControlDock so this row can remain a stable contract-height slot.
@Component
export struct ReaderModuleNav {
  private moduleIcon(kind: ModuleKind): Resource {
    switch (kind) {
      case 'directory':
        return $r('app.media.reader_icon_reader_module_directory_primary');
      case 'appearance':
        return $r('app.media.reader_icon_reader_module_appearance_primary');
      case 'tts':
        return $r('app.media.reader_icon_reader_module_tts_primary');
      case 'settings':
        return $r('app.media.reader_icon_reader_module_settings_primary');
      default:
        return $r('app.media.reader_icon_reader_module_directory_primary');
    }
  }

  build() {
    Row() {
      this.moduleItem('directory', '目录')
      this.moduleItem('appearance', '外观')
      this.moduleItem('tts', '朗读')
      this.moduleItem('settings', '设置')
    }
    .width('100%')
    .height(SizeTokens.readerModuleNavHeight)
    .padding({ left: 12, right: 12 })
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: { top: 1 }, color: ColorTokens.border })
  }

  @Builder moduleItem(kind: ModuleKind, label: string) {
    Column() {
      Image(this.moduleIcon(kind)).width(26).height(26)
      Text(label)
        .fontSize(12)
        .fontColor(ColorTokens.controlInk)
        .margin({ top: 3 })
    }
    .layoutWeight(1)
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: kind }))
  }
}

// ── Reader module bottom sheets ────────────────────────────────────────────
// Tapping a module-nav item (目录/外观/朗读/设置) opens that module's sheet
// over the reading surface. Each sheet has real controls (chapter list, font/
// theme/brightness, TTS play/speed, settings toggles) with local demo state —
// Phase 1 interactivity pending reducer-backed reader-settings state.

type ReaderModuleKind = 'directory' | 'appearance' | 'tts' | 'settings';

function isReaderModule(overlay: string): boolean {
  return overlay === 'directory' || overlay === 'appearance' || overlay === 'tts' || overlay === 'settings';
}

function moduleTitle(kind: string): string {
  switch (kind) {
    case 'directory': return '目录';
    case 'appearance': return '外观';
    case 'tts': return '朗读';
    case 'settings': return '设置';
    default: return '';
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
// theme prop: 'paper' (default) | 'night' (night-theme wiring lands in Batch 1
// step 3 / D11; for now every route renders paper).
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

// Directory sheet content — scrollable chapter list, current chapter highlighted.
@Component
export struct ReaderDirectoryContent {
  private chapters: string[] = [
    '第一章 科学边界', '第二章 疯狂年代', '第三章 红岸之一', '第四章 宇宙闪烁',
    '第五章 三体世界', '第六章 三体游戏', '第七章 地球叛军', '第八章 黑暗森林',
  ];
  @State current: number = 0;

  build() {
    Scroll() {
      Column() {
        ForEach(this.chapters, (c: string, i: number) => {
          Row() {
            Text(c)
              .fontSize(14)
              .fontColor(i === this.current ? ColorTokens.primary : ColorTokens.controlInk)
              .layoutWeight(1)
            if (i === this.current) {
              Text('正文').fontSize(11).fontColor(ColorTokens.primary)
            }
          }
          .width('100%').height(46).padding({ left: 20, right: 20 })
          .border({ width: { bottom: 1 }, color: ColorTokens.border })
          .alignItems(VerticalAlign.Center)
          .onClick(() => { this.current = i; ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' }); })
        }, (c: string, i: number) => `${c}-${i}`)
      }
    }
    .width('100%').height(280)
  }
}

// Appearance sheet content — font size stepper + theme chips + brightness slider.
@Component
export struct ReaderAppearanceContent {
  @State fontPx: number = 18;
  @State theme: string = 'paper';
  @State brightnessPct: number = 80;

  build() {
    Column() {
      // Font size stepper
      Row() {
        Text('字号').fontSize(13).fontWeight(700).fontColor(ColorTokens.ink)
        Blank()
        Text('A-')
          .fontSize(16).fontColor(ColorTokens.controlInk)
          .padding({ left: 16, right: 16, top: 6, bottom: 6 })
          .borderRadius(RadiusTokens.control).backgroundColor(ColorTokens.metaBg)
          .onClick(() => { if (this.fontPx > 12) this.fontPx -= 1; })
        Text(`${this.fontPx}`)
          .fontSize(14).fontWeight(700).fontColor(ColorTokens.ink)
          .width(40).textAlign(TextAlign.Center)
        Text('A+')
          .fontSize(20).fontColor(ColorTokens.controlInk)
          .padding({ left: 16, right: 16, top: 6, bottom: 6 })
          .borderRadius(RadiusTokens.control).backgroundColor(ColorTokens.metaBg)
          .onClick(() => { if (this.fontPx < 32) this.fontPx += 1; })
      }
      .width('100%').padding({ left: 20, right: 20, top: 12, bottom: 12 })
      .alignItems(VerticalAlign.Center)

      // Theme chips
      Row() {
        Text('主题').fontSize(13).fontWeight(700).fontColor(ColorTokens.ink).layoutWeight(1)
        ForEach(['paper', 'sepia', 'dark'] as string[], (t: string) => {
          Text(t === 'paper' ? '纸张' : t === 'sepia' ? '护眼' : '夜间')
            .fontSize(12).fontWeight(700)
            .fontColor(this.theme === t ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .backgroundColor(this.theme === t ? ColorTokens.primary : ColorTokens.metaBg)
            .padding({ left: 12, right: 12, top: 6, bottom: 6 })
            .borderRadius(RadiusTokens.control).margin({ right: 8 })
            .onClick(() => { this.theme = t; })
        }, (t: string) => t)
      }
      .width('100%').padding({ left: 20, right: 20, bottom: 12 })
      .alignItems(VerticalAlign.Center)

      // Brightness slider
      Row() {
        Text('亮度').fontSize(13).fontWeight(700).fontColor(ColorTokens.ink)
        Slider({ value: this.brightnessPct, min: 10, max: 100, step: 1 })
          .layoutWeight(1).margin({ left: 12, right: 12 })
          .selectedColor(ColorTokens.primary)
          .onChange((v: number) => { this.brightnessPct = Math.round(v); })
        Text(`${this.brightnessPct}`).fontSize(12).fontColor(ColorTokens.muted).width(32)
      }
      .width('100%').padding({ left: 20, right: 20, bottom: 16 })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
  }
}

// TTS sheet content — play/pause + speed selector + voice label.
@Component
export struct ReaderTtsContent {
  @State playing: boolean = false;
  @State speed: number = 1;
  private speeds: number[] = [5, 8, 10, 12, 16];

  build() {
    Column() {
      Row() {
        Text(this.playing ? '暂停' : '播放')
          .fontSize(14).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
          .backgroundColor(ColorTokens.primary)
          .padding({ left: 24, right: 24, top: 10, bottom: 10 })
          .borderRadius(RadiusTokens.control)
          .onClick(() => { this.playing = !this.playing; })
        Column() {
          Text('系统语音').fontSize(12).fontColor(ColorTokens.muted)
          Text('普通话 · 女声').fontSize(13).fontColor(ColorTokens.ink).margin({ top: 2 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1).margin({ left: 16 })
      }
      .width('100%').padding({ left: 20, right: 20, top: 14, bottom: 14 })
      .alignItems(VerticalAlign.Center)

      Row() {
        Text('语速').fontSize(13).fontWeight(700).fontColor(ColorTokens.ink)
        Scroll() {
          Row() {
            ForEach(this.speeds, (s: number) => {
              Text(`${(s / 10).toFixed(1)}x`)
                .fontSize(12).fontWeight(700)
                .fontColor(this.speed === s ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
                .backgroundColor(this.speed === s ? ColorTokens.primary : ColorTokens.metaBg)
                .padding({ left: 12, right: 12, top: 6, bottom: 6 })
                .borderRadius(RadiusTokens.control).margin({ right: 8 })
                .onClick(() => { this.speed = s; })
            }, (s: number) => `${s}`)
          }
        }.scrollable(ScrollDirection.Horizontal).layoutWeight(1).margin({ left: 12 })
      }
      .width('100%').padding({ left: 20, right: 20, bottom: 16 })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
  }
}

// Settings sheet content — page-turn mode + auto-page + reduced-motion toggle.
@Component
export struct ReaderSettingsContent {
  @State pageTurn: string = 'slide';
  @State autoPage: boolean = false;
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Column() {
      Row() {
        Text('翻页方式').fontSize(13).fontWeight(700).fontColor(ColorTokens.ink).layoutWeight(1)
        ForEach(['slide', 'scroll'] as string[], (m: string) => {
          Text(m === 'slide' ? '滑动' : '滚动')
            .fontSize(12).fontWeight(700)
            .fontColor(this.pageTurn === m ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .backgroundColor(this.pageTurn === m ? ColorTokens.primary : ColorTokens.metaBg)
            .padding({ left: 12, right: 12, top: 6, bottom: 6 })
            .borderRadius(RadiusTokens.control).margin({ right: 8 })
            .onClick(() => { this.pageTurn = m; })
        }, (m: string) => m)
      }
      .width('100%').padding({ left: 20, right: 20, top: 14, bottom: 14 })
      .alignItems(VerticalAlign.Center)

      Row() {
        Text('自动翻页').fontSize(13).fontWeight(700).fontColor(ColorTokens.ink).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.autoPage })
          .selectedColor(ColorTokens.primary)
          .onChange((on: boolean) => { this.autoPage = on; })
      }
      .width('100%').padding({ left: 20, right: 20, bottom: 14 })
      .alignItems(VerticalAlign.Center)

      Row() {
        Text('减少动态效果').fontSize(13).fontWeight(700).fontColor(ColorTokens.ink).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.reducedMotion })
          .selectedColor(ColorTokens.primary)
          .onChange((on: boolean) => ReaderUiStore.dispatch({ type: 'toggle-reduced-motion', enabled: on }))
      }
      .width('100%').padding({ left: 20, right: 20, bottom: 16 })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
  }
}

// ReaderModuleSheet — backdrop + bottom sheet that renders the active module's
// content. Rendered by ReaderShell when overlay is a reader-module kind. Closing
// returns to the reader-control dock (not the reading surface).
@Component
export struct ReaderModuleSheet {
  @StorageProp('reader.overlay') overlayKind: string = '';
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  @Builder moduleBody() {
    if (this.overlayKind === 'directory') {
      ReaderDirectoryContent()
    } else if (this.overlayKind === 'appearance') {
      ReaderAppearanceContent()
    } else if (this.overlayKind === 'tts') {
      ReaderTtsContent()
    } else if (this.overlayKind === 'settings') {
      ReaderSettingsContent()
    }
  }

  build() {
    if (isReaderModule(this.overlayKind)) {
      Stack() {
        Column()
          .width('100%').height('100%')
          .backgroundColor(ColorTokens.ink).opacity(0.4)
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: 'reader-control' }))

        Column() {
          ReaderControlGrabber()
          Row() {
            Text(moduleTitle(this.overlayKind))
              .fontSize(15).fontWeight(700).fontColor(ColorTokens.ink)
            Blank()
            Text('关闭')
              .fontSize(12).fontColor(ColorTokens.primary)
              .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: 'reader-control' }))
          }
          .width('100%').padding({ left: 20, right: 20, bottom: 8 })
          .alignItems(VerticalAlign.Center)

          this.moduleBody()
        }
        .width('100%')
        .padding({ bottom: this.safeAreaBottom })
        .backgroundColor(DemoAliasTokens.surface)
        .border({ width: { top: 1 }, color: ColorTokens.border })
        .borderRadius({ topLeft: RadiusTokens.large, topRight: RadiusTokens.large })
        .shadow({ radius: 18, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: -4 })
      }
      .width('100%').height('100%')
      .alignContent(Alignment.Bottom)
      .transition(TransitionEffect.OPACITY.animation({ duration: MotionDurationTokens.overlay, curve: Curve.EaseInOut }))
    }
  }
}
