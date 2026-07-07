// ReaderComponents — P0 reader reading-surface demo components.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, SizeTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

@Component
export struct ReadingBackgroundLayer {
  build() {
    Column().width('100%').height('100%').backgroundColor(ColorTokens.paper)
  }
}

@Component
export struct ReadingTextFlow {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Scroll() {
      Column() {
        Text('第一章 科学边界')
          .fontSize(ReaderTypography.chapterTitle().fontSize)
          .fontColor(ColorTokens.ink)
          .fontWeight(ReaderTypography.chapterTitle().fontWeight)
          .margin({ bottom: SpacingTokens.lg })
        Text('汪淼盯着面前的纳米丝，想象着它在宏观尺度上的形态。叶文洁当年的选择，像一条看不见的线，从雷达峰延伸到此刻的每一个角落。')
          .fontSize(ReaderTypography.readerBody().fontSize)
          .fontColor(ColorTokens.ink)
          .lineHeight(ReaderTypography.readerBody().lineHeight)
          .fontFamily(ReaderTypography.serifFamily())
          .width('100%')
      }
      .padding({
        left: SpacingTokens.lg, right: SpacingTokens.lg,
        top: SpacingTokens.xl, bottom: SpacingTokens.xl,
      })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(ColorTokens.paper)
  }
}

@Component
export struct ReadingInfoLayer {
  build() {
    Row() {
      Text('第一章 科学边界')
        .fontSize(ReaderTypography.immersiveInfo().fontSize)
        .fontColor(ColorTokens.muted)
      Blank()
      Text('42%')
        .fontSize(ReaderTypography.immersiveInfo().fontSize)
        .fontColor(ColorTokens.muted)
    }
    .width('100%')
    .padding({ left: SpacingTokens.lg, right: SpacingTokens.lg, top: SpacingTokens.lg })
    .backgroundColor(ColorTokens.paper)
  }
}

@Component
export struct TapZones {
  @StorageProp('reader.overlay') overlayKind: string = '';

  build() {
    Row() {
      Column().width('20%').height('100%')
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      Column().width('60%').height('100%')
        .onClick(() => {
          const next: '' | 'reader-control' = this.overlayKind === 'reader-control' ? '' : 'reader-control';
          ReaderUiStore.dispatch({ type: 'set-overlay', overlay: next });
        })
      Column().width('20%').height('100%')
    }
    .width('100%')
    .height('100%')
  }
}

type ModuleKind = 'directory' | 'appearance' | 'tts' | 'settings';

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
    .padding({ left: SpacingTokens.md, right: SpacingTokens.md })
    .backgroundColor(ColorTokens.floatingControlBg)
  }

  @Builder moduleItem(kind: ModuleKind, label: string) {
    Column() {
      Image(this.moduleIcon(kind)).width(26).height(26)
      Text(label)
        .fontSize(ReaderTypography.actionLabel().fontSize)
        .fontColor(ColorTokens.controlInk)
        .margin({ top: 2 })
    }
    .layoutWeight(1)
    .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: kind }))
  }
}
