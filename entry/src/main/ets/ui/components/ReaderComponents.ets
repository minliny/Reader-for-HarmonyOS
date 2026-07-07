// ReaderComponents — reader immersive base ported from frontend-demo
// (styles/00-foundation.css .fd-reading-surface / .fd-ir-reading-layer /
// .fd-ir-info-layer / .fd-immersive-hotzone). Control-layer panels are Phase 2.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SizeTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

// .fd-ir-background-layer: full-bleed paper bg.
@Component
export struct ReadingBackgroundLayer {
  build() {
    Column().width('100%').height('100%').backgroundColor(ColorTokens.paper)
  }
}

// .fd-ir-reading-layer: inset 72 32 48. h1 (chapter, first page): +5px serif,
//   centered. p: reader-font-size (18) line-height 1.96 text-indent 2em, gap
//   paragraph-gap (16) between paragraphs.
@Component
export struct ReadingTextFlow {
  private paragraphs: string[] = [
    '汪淼盯着面前的纳米丝，想象着它在宏观尺度上的形态。它细如蛛丝，却能切断合金，这便是三体人送给地球的第一个礼物。',
    '叶文洁当年的选择，像一条看不见的线，从雷达峰延伸到此刻的每一个角落。她按下发射键的那一刻，人类的命运被永远改写了。',
    '宇宙曾经是一片死寂的荒漠，直到那条信息被发出，直到那个回复被接收。在那之后的每一个夜晚，星空都不再是原来的星空。'
  ];

  build() {
    Scroll() {
      Column() {
        Text('第一章 科学边界')
          .fontSize(23)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .fontFamily(ReaderTypography.serifFamily())
          .textAlign(TextAlign.Center)
          .width('100%')
          .margin({ bottom: 24 })
        ForEach(this.paragraphs, (p: string, i: number) => {
          Text(p)
            .fontSize(18)
            .fontColor(ColorTokens.ink)
            .fontFamily(ReaderTypography.serifFamily())
            .lineHeight(18 * 1.96)
            .textIndent(2 * 18)
            .margin({ bottom: 16 })
        }, (p: string, i: number) => `${i}`)
      }
      .padding({ top: 72, left: 32, right: 32, bottom: 48 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(ColorTokens.paper)
  }
}

// .fd-ir-info-layer: inset 26 24 22, 4-corner overlay (top-left book·chapter,
//   top-right time, bottom-left progress, bottom-right page label). 12px sans
//   muted. pointer-events none (taps pass through to TapZones).
@Component
export struct ReadingInfoLayer {
  build() {
    Column() {
      Row() {
        Text('示例书 · 第一章 科学边界')
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .fontFamily(ReaderTypography.sansFamily())
          .layoutWeight(1)
        Text('13:50')
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .fontFamily(ReaderTypography.sansFamily())
      }
      .width('100%')
      Blank()
      Row() {
        Text('38%')
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .fontFamily(ReaderTypography.sansFamily())
          .layoutWeight(1)
        Text('第 1 / 10 页')
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .fontFamily(ReaderTypography.sansFamily())
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .padding({ top: 26, left: 24, right: 24, bottom: 22 })
    .hitTestBehavior(HitTestMode.None)
  }
}

// .fd-immersive-hotzone: prev 26% / center 48% / next 26%. Center toggles control.
@Component
export struct TapZones {
  @StorageProp('reader.overlay') overlayKind: string = '';

  build() {
    Row() {
      Column().width('26%').height('100%')
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      Column().width('48%').height('100%')
        .onClick(() => {
          const next: '' | 'reader-control' = this.overlayKind === 'reader-control' ? '' : 'reader-control';
          ReaderUiStore.dispatch({ type: 'set-overlay', overlay: next });
        })
      Column().width('26%').height('100%')
    }
    .width('100%')
    .height('100%')
  }
}

type ModuleKind = 'directory' | 'appearance' | 'tts' | 'settings';

// reader-module-nav: height 82 (--reader-ds-size-reader-module-nav-height),
//   4 items (目录/外观/朗读/设置), icon + label.
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
