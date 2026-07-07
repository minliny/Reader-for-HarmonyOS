// ReaderOverlayComponents — reader overlay panels + the shared control bottom
// bar, ported from docs/ui-handoff/normalized-html/*-overlay-v2.html (structure
// source for Batch 1) + reader-control-layer.css / reader-components.css.
//
// Route-driven (Batch 1): these render as body components of the *-overlay-v2
// view-state entries — NOT via the legacy reader.overlay field. ReaderShell
// mounts them through ViewStateRenderer (stack layout). The reading base comes
// from ReaderBase in the same body; no double-render.
//
// Slice scope: ReaderBottomBar + ReaderDirectoryPanel (minimal). The shared
// ReaderOverlayPanel shell + the remaining 7 overlays + floating controls land
// in step 2/3.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RadiusTokens, SizeTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';

// .reader-control-bottom-bar: 4 items (目录/外观/朗读/设置), icon + label, pinned
//   to the bottom of the reader Stack. Each item route-pushes its overlay route
//   (route-driven; was set-overlay in the legacy ReaderModuleNav).
//   NOTE: only reader-directory-overlay-v2 has a fixture today (slice). The other
//   three route-push to their overlay routes, which Batch 1 step 3 fills in —
//   tapping them before step 3 renders a blank reader (no fixture yet).
@Component
export struct ReaderBottomBar {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  private items: Array<[string, string, string]> = [
    ['directory', '目录', 'reader-directory-overlay-v2'],
    ['appearance', '外观', 'reader-appearance-overlay-v2'],
    ['tts', '朗读', 'reader-tts-overlay-v2'],
    ['settings', '设置', 'reader-settings-overlay-v2'],
  ];

  private moduleIcon(kind: string): Resource {
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
      ForEach(this.items, (it: [string, string, string]) => {
        Column() {
          Image(this.moduleIcon(it[0])).width(26).height(26)
          Text(it[1])
            .fontSize(12)
            .fontColor(ColorTokens.controlInk)
            .margin({ top: 3 })
        }
        .layoutWeight(1)
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: it[2] as RouteId }))
      }, (it: [string, string, string]) => it[2])
    }
    .width('100%')
    .height(SizeTokens.readerModuleNavHeight)
    .padding({ left: 12, right: 12, bottom: this.safeAreaBottom })
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .align(Alignment.Bottom)
  }
}

// .reader-overlay-panel.reader-overlay-panel-bottom-function (directory variant,
//   minimal slice): tabs (目录/书签) + a short chapter list. Picking a chapter
//   route-pops back to control-layer-base-v2. Sits above ReaderBottomBar.
//   Shared ReaderOverlayPanel shell + full directory DOM (toc levels / bookmarks /
//   progress) land in step 2.
@Component
export struct ReaderDirectoryPanel {
  private chapters: string[] = [
    '第一章 科学边界', '第二章 疯狂年代', '第三章 红岸之一', '第四章 宇宙闪烁',
    '第五章 三体世界', '第六章 三体游戏',
  ];

  build() {
    Column() {
      // .reader-toc-tabs: segmented 目录 / 书签
      Row() {
        Text('目录')
          .fontSize(14).fontWeight(700).fontColor(ColorTokens.primary)
          .padding({ left: 14, right: 14, top: 8, bottom: 8 })
          .borderRadius(RadiusTokens.control)
          .backgroundColor(ColorTokens.metaBg)
        Text('书签')
          .fontSize(14).fontWeight(700).fontColor(ColorTokens.muted)
          .padding({ left: 14, right: 14, top: 8, bottom: 8 })
          .margin({ left: 8 })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 10 })
      .alignItems(VerticalAlign.Center)

      // .reader-toc-list (minimal): chapter rows; current highlighted.
      Scroll() {
        Column() {
          ForEach(this.chapters, (c: string, i: number) => {
            Row() {
              Text(c)
                .fontSize(14)
                .fontColor(i === 0 ? ColorTokens.primary : ColorTokens.controlInk)
                .layoutWeight(1)
              if (i === 0) {
                Text('正文').fontSize(11).fontColor(ColorTokens.primary)
              }
            }
            .width('100%')
            .height(44)
            .padding({ left: 20, right: 20 })
            .border({ width: { bottom: 1 }, color: ColorTokens.border })
            .alignItems(VerticalAlign.Center)
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
          }, (c: string, i: number) => `${c}-${i}`)
        }
      }
      .layoutWeight(1)
      .align(Alignment.Top)
    }
    .width('100%')
    .height(380)
    .backgroundColor(DemoAliasTokens.surface)
    .borderRadius({ topLeft: RadiusTokens.large, topRight: RadiusTokens.large })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .shadow({ radius: 18, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: -4 })
    .align(Alignment.Bottom)
    .offset({ y: -SizeTokens.readerModuleNavHeight - 14 })
  }
}
