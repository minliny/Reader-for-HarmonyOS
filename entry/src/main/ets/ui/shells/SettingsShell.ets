// SettingsShell — shell for settings secondary pages (source-management, webdav-config, …).
// Slots: topArea (BackTopBar) · content (ViewStateRenderer) · overlayHost · stateHost.
//
// Immersive: outermost Stack expands paper behind the system bars; the content
// Column expands into the status-bar region and pads with the real device inset
// (safeAreaTop) so BackTopBar clears the status bar, and the scroll body pads its
// bottom with safeAreaBottom so the last row clears the navigation bar.
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { BackTopBar } from '../components/SharedComponents';
import { RestoreBackupOverlay, SyncBackupPage } from '../components/StructuralPageComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';

@Component
export struct SettingsShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'overlayHost', 'stateHost'];
  @StorageProp('reader.displayedRouteId') routeId: string = 'settings';
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  private hasFixedActionBar(): boolean {
    return this.routeId === 'source-management';
  }

  private isSyncFigmaRoute(): boolean {
    return this.routeId === 'sync-backup' || this.routeId === 'webdav-config' ||
      this.routeId === 'restore-confirm' || this.routeId === 'restore-running' ||
      this.routeId === 'restore-result';
  }

  private isWebDavFigmaRoute(): boolean {
    return this.routeId === 'webdav-config';
  }

  private isSyncBackupFigmaRoute(): boolean {
    return this.routeId === 'sync-backup' || this.isRestoreOverlayRoute();
  }

  private isRestoreOverlayRoute(): boolean {
    return this.routeId === 'restore-confirm' || this.routeId === 'restore-running' ||
      this.routeId === 'restore-result';
  }

  private scrollBottomPadding(): number {
    if (this.isSyncBackupFigmaRoute()) {
      return this.safeAreaBottom + ReaderUiVisualTokens.syncContentBottomInset;
    }
    if (this.isWebDavFigmaRoute()) {
      return this.safeAreaBottom + ReaderUiVisualTokens.webdavContentBottomInset;
    }
    if (this.hasFixedActionBar()) return ReaderUiVisualTokens.sourceManagementContentBottomInset;
    return this.safeAreaBottom + ReaderUiVisualTokens.settingsContentBottomInset;
  }

  private scrollTopPadding(): number {
    if (this.isSyncFigmaRoute()) return 0;
    return this.routeId === 'source-management'
      ? ReaderUiVisualTokens.sourceManagementContentTopInset
      : ReaderUiVisualTokens.settingsContentTopInset;
  }

  private actionBarHeight(): number {
    if (this.routeId === 'source-management') {
      // Figma Phone places the 44vp actions at y=757 and leaves 43vp beneath
      // them. A larger real system safe-area may increase, but never reduce,
      // that current-Figma visual minimum.
      return ReaderUiVisualTokens.sourceManagementBottomActionHeight +
        Math.max(this.safeAreaBottom, ReaderUiVisualTokens.sourceManagementBottomActionBottomInset);
    }
    return this.safeAreaBottom;
  }

  private pageSurface(): string {
    return this.routeId === 'settings-general'
      ? ReaderUiVisualTokens.settingsPageSurface
      : this.routeId === 'source-management'
        ? ReaderUiVisualTokens.sourceManagementPageSurface
        : this.isWebDavFigmaRoute()
          ? ReaderUiVisualTokens.webdavPageSurface
          : this.isSyncBackupFigmaRoute()
            ? ReaderUiVisualTokens.syncPageSurface
          // Every other visible settings route is blocked until it obtains a
          // Figma binding. Keep the fallback within the generated source-led
          // contract, never the historical global paper palette.
          : ReaderUiVisualTokens.settingsPageSurface;
  }

  private contentHorizontalInset(): number {
    return this.routeId === 'source-management'
      ? ReaderUiVisualTokens.sourceManagementContentHorizontalInset
      : this.isWebDavFigmaRoute()
        ? ReaderUiVisualTokens.webdavContentPhoneInset
        : this.isSyncBackupFigmaRoute()
          ? ReaderUiVisualTokens.syncContentPhoneInset
        : ReaderUiVisualTokens.settingsContentHorizontalInset;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        if (this.isRestoreOverlayRoute()) {
          BackTopBar({ title: '同步与备份' })
        } else {
          BackTopBar()
        }
        Scroll() {
          Column() {
            if (this.isRestoreOverlayRoute()) {
              // Restore is an admitted Figma overlay over this exact Sync
              // Backup surface; do not render the old generated full page.
              SyncBackupPage()
            } else {
              ViewStateRenderer()
            }
          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollable(ScrollDirection.Vertical)
        .scrollBar(BarState.Auto)
        .align(Alignment.Top)
        .padding({
          top: this.scrollTopPadding(),
          left: this.contentHorizontalInset(),
          right: this.contentHorizontalInset(),
          bottom: this.scrollBottomPadding(),
        })
        .backgroundColor(this.pageSurface())
        this.renderBottomActionBar()
      }
      .width('100%')
      .height('100%')
      .padding({ top: this.safeAreaTop })
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.START, SafeAreaEdge.END])
      .zIndex(ZIndexTokens.content)

      OverlayHost()
        .zIndex(ZIndexTokens.dialog)
      if (this.isRestoreOverlayRoute()) {
        RestoreBackupOverlay()
          .zIndex(ZIndexTokens.dialog + 1)
      }
      StateHost()
        .zIndex(ZIndexTokens.mainNav)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.pageSurface())
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }

  @Builder renderBottomActionBar() {
    if (this.routeId === 'source-management') {
      Row({ space: ReaderUiVisualTokens.sourceManagementBottomActionGap }) {
        Text('批量管理')
          .fontFamily(ReaderUiVisualTokens.sourceManagementCjkFontFamily)
          .fontSize(ReaderUiVisualTokens.sourceManagementBottomActionLabelSize)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.sourceManagementInk)
          .height(ReaderUiVisualTokens.sourceManagementBottomActionHeight)
          .textAlign(TextAlign.Center)
          .borderRadius(ReaderUiVisualTokens.sourceManagementBottomActionRadius)
          .backgroundColor(ReaderUiVisualTokens.sourceManagementFieldSurface)
          .border({ width: 1, color: ReaderUiVisualTokens.sourceManagementFieldBorder })
          .layoutWeight(1)
        Text('＋  新增书源')
          .fontFamily(ReaderUiVisualTokens.sourceManagementCjkFontFamily)
          .fontSize(ReaderUiVisualTokens.sourceManagementBottomActionLabelSize)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.sourceManagementOnPrimary)
          .height(ReaderUiVisualTokens.sourceManagementBottomActionHeight)
          .textAlign(TextAlign.Center)
          .borderRadius(ReaderUiVisualTokens.sourceManagementBottomActionRadius)
          .backgroundColor(ReaderUiVisualTokens.sourceManagementPrimary)
          .layoutWeight(1)
      }
      .width('100%')
      .height(this.actionBarHeight())
      .padding({
        left: this.contentHorizontalInset(),
        right: this.contentHorizontalInset(),
        top: 0,
        bottom: Math.max(this.safeAreaBottom, ReaderUiVisualTokens.sourceManagementBottomActionBottomInset),
      })
      .backgroundColor(ReaderUiVisualTokens.sourceManagementPageSurface)
      .zIndex(ZIndexTokens.mainNav)
    }
  }
}
