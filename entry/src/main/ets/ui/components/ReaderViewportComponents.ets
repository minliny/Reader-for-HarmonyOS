// ReaderViewportComponents — viewport-anchored bottom bar / module nav.
// 对应 B 的 03c-reader-viewport.css (视口适配).
// Split from ReaderOverlayComponents.ets; barrel re-exports kept for back-compat.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { InteractionDebugBadge, InteractionDebugFrame } from './InteractionDebugComponents';

// ── Control bottom bar (.reader-control-bottom-bar) ───────────────────────
@Component
export struct ReaderBottomBar {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.displayedRouteId') routeId: string = 'control-layer-base-v2';

  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 24;
  private readonly navBottom: number = 32;
  private readonly navHeight: number = 79;

  private items: Array<[string, string, string]> = [
    ['directory', '目录', 'reader-directory-overlay-v2'],
    ['tts', '朗读', 'reader-tts-overlay-v2'],
    ['appearance', '界面', 'reader-appearance-overlay-v2'],
    ['settings', '设置', 'reader-settings-overlay-v2'],
  ];

  private wideControlDock(): boolean {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private navWidth(): number {
    return this.wideControlDock() ? this.dockWidth : Math.max(0, this.viewportWidth - this.dockRight * 2);
  }

  private navBottomValue(): number {
    return this.wideControlDock() ? this.safeAreaBottom + this.navBottom : this.navBottom;
  }

  private moduleIcon(kind: string, active: boolean): Resource {
    switch (kind) {
      case 'directory':
        return active ? $r('app.media.reader_icon_reader_module_directory_white') : $r('app.media.reader_icon_reader_module_directory_primary');
      case 'appearance':
        return active ? $r('app.media.reader_icon_reader_module_appearance_white') : $r('app.media.reader_icon_reader_module_appearance_primary');
      case 'tts':
        return active ? $r('app.media.reader_icon_reader_module_tts_white') : $r('app.media.reader_icon_reader_module_tts_primary');
      case 'settings':
        return active ? $r('app.media.reader_icon_reader_module_settings_white') : $r('app.media.reader_icon_reader_module_settings_primary');
      default:
        return $r('app.media.reader_icon_reader_module_directory_primary');
    }
  }

  private active(kind: string): boolean {
    if (kind === 'directory') return this.routeId === 'reader-directory-overlay-v2';
    if (kind === 'tts') return this.routeId === 'reader-tts-overlay-v2';
    if (kind === 'appearance') return this.routeId === 'reader-appearance-overlay-v2';
    if (kind === 'settings') return this.routeId === 'reader-settings-overlay-v2';
    return false;
  }

  private moduleDebugLabel(kind: string): string {
    if (kind === 'directory') return 'dir';
    if (kind === 'appearance') return 'ui';
    return kind;
  }

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Row({ space: 4 }) {
          ForEach(this.items, (it: [string, string, string]) => {
            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 4 }) {
                Stack({ alignContent: Alignment.Center }) {
                  Image(this.moduleIcon(it[0], this.active(it[0]))).width(26).height(26)
                }
                .width(42)
                .height(42)
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(this.active(it[0]) ? ColorTokens.primaryDark : ColorTokens.surfaceSoft)

                Text(it[1])
                  .fontSize(12)
                  .fontWeight(800)
                  .fontColor(this.active(it[0]) ? ColorTokens.primaryDark : ColorTokens.controlInk)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
              }
              .width('100%')
              .height(62)
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Center)
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: it[2] as RouteId }))
              InteractionDebugBadge({ label: this.moduleDebugLabel(it[0]), tone: 'action', offsetTop: 24 })
            }
            .layoutWeight(1)
            .height(62)
          }, (it: [string, string, string]) => it[2])
        }
        .width(this.navWidth())
        .height(this.navHeight)
        .padding({ left: 8, right: 8, top: 8, bottom: 8 })
        .backgroundColor(DemoAliasTokens.surface)
        .border({ width: { left: 1, right: 1, top: this.wideControlDock() ? 0 : 1, bottom: 1 }, color: ColorTokens.border })
        .borderRadius({
          topLeft: this.wideControlDock() ? 0 : DemoAliasTokens.radiusLg,
          topRight: this.wideControlDock() ? 0 : DemoAliasTokens.radiusLg,
          bottomLeft: DemoAliasTokens.radiusLg,
          bottomRight: DemoAliasTokens.radiusLg,
        })
        InteractionDebugFrame({ label: 'readerModuleNav', tone: 'sheet' })
      }
      .width(this.navWidth())
      .height(this.navHeight)
      .margin({ right: this.dockRight, bottom: this.navBottomValue() })
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(ZIndexTokens.readerModuleNav)
  }
}
