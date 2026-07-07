// SharedComponents — P0 demo components shared across shells.
// All values come from generated tokens / ReaderTypography. No raw hex or px.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, SizeTokens, RadiusTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

function routeTitle(routeId: string): string {
  switch (routeId) {
    case 'bookshelf': return '书架';
    case 'discover': return '发现';
    case 'rss': return 'RSS';
    case 'settings': return '设置';
    case 'book-detail': return '书籍详情';
    default: return '';
  }
}

// Title for secondary routes rendered inside BackTopBar (LibraryShell / SettingsShell).
// Hard-coding '书籍详情' here would mislabel every settings-secondary page.
function secondaryRouteTitle(routeId: string): string {
  switch (routeId) {
    case 'book-detail': return '书籍详情';
    case 'book-directory': return '目录';
    case 'book-search':
    case 'search-home': return '搜索';
    case 'source-management': return '书源管理';
    case 'source-detail': return '书源详情';
    case 'source-edit': return '编辑书源';
    case 'webdav-config': return 'WebDAV';
    case 'sync-backup': return '备份与同步';
    case 'restore-scopes': return '恢复范围';
    case 'about-feedback': return '关于';
    case 'rss-subscription-management': return '订阅管理';
    default: return '';
  }
}

@Component
export struct AppTopBar {
  @StorageProp('reader.routeId') routeId: string = 'bookshelf';
  @StorageProp('reader.stackDepth') stackDepth: number = 1;

  build() {
    Row() {
      if (this.stackDepth > 1) {
        Image($r('app.media.reader_icon_back_dark'))
          .width(24).height(24)
          .margin({ left: SpacingTokens.sm })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      }
      Text(routeTitle(this.routeId))
        .fontSize(ReaderTypography.topBarTitle().fontSize)
        .fontColor(ColorTokens.ink)
        .fontWeight(ReaderTypography.topBarTitle().fontWeight)
        .margin({ left: SpacingTokens.sm })
      Blank()
      Image($r('app.media.bookshelf_icon_search_dark'))
        .width(22).height(22)
        .margin({ right: SpacingTokens.sm })
      Image($r('app.media.bookshelf_icon_gear_dark'))
        .width(22).height(22)
        .margin({ right: SpacingTokens.sm })
    }
    .width('100%')
    .height(SizeTokens.topBarHeight)
    .padding({ left: SpacingTokens.sm, right: SpacingTokens.sm })
    .backgroundColor(ColorTokens.paper)
  }
}

@Component
export struct BackTopBar {
  @StorageProp('reader.routeId') routeId: string = 'book-detail';

  build() {
    Row() {
      Image($r('app.media.reader_icon_back_dark'))
        .width(24).height(24)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      Text(secondaryRouteTitle(this.routeId))
        .fontSize(ReaderTypography.topBarTitle().fontSize)
        .fontColor(ColorTokens.ink)
        .fontWeight(ReaderTypography.topBarTitle().fontWeight)
        .margin({ left: SpacingTokens.sm })
      Blank()
      Image($r('app.media.reader_icon_more_dark'))
        .width(22).height(22)
    }
    .width('100%')
    .height(SizeTokens.topBarHeight)
    .padding({ left: SpacingTokens.md, right: SpacingTokens.md })
    .backgroundColor(ColorTokens.paper)
  }
}

type TabKind = 'bookshelf' | 'discover' | 'rss' | 'settings';

@Component
export struct BottomNav {
  @StorageProp('reader.tab') tab: string = 'bookshelf';

  private iconFor(tab: TabKind, active: boolean): Resource {
    switch (tab) {
      case 'bookshelf':
        return active ? $r('app.media.main_tab_icon_bookshelf_active') : $r('app.media.main_tab_icon_bookshelf_muted');
      case 'discover':
        return active ? $r('app.media.main_tab_icon_discover_active') : $r('app.media.main_tab_icon_discover_muted');
      case 'rss':
        return active ? $r('app.media.main_tab_icon_rss_active') : $r('app.media.main_tab_icon_rss_muted');
      case 'settings':
        return active ? $r('app.media.main_tab_icon_settings_active') : $r('app.media.main_tab_icon_settings_muted');
      default:
        return $r('app.media.main_tab_icon_bookshelf_muted');
    }
  }

  build() {
    Row() {
      this.tabItem('bookshelf', '书架')
      this.tabItem('discover', '发现')
      this.tabItem('rss', 'RSS')
      this.tabItem('settings', '设置')
    }
    .width('100%')
    .height(SizeTokens.bottomBarHeight)
    .padding({ left: SpacingTokens.sm, right: SpacingTokens.sm })
    .backgroundColor(ColorTokens.bottomBarBg)
  }

  @Builder tabItem(tab: TabKind, label: string) {
    Column() {
      Image(this.iconFor(tab, this.tab === tab)).width(24).height(24)
      Text(label)
        .fontSize(10)
        .fontColor(this.tab === tab ? ColorTokens.primary : ColorTokens.muted)
        .margin({ top: 2 })
    }
    .layoutWeight(1)
    .onClick(() => ReaderUiStore.dispatch({ type: 'switch-tab', tab: tab }))
  }
}

@Component
export struct Loading {
  build() {
    Column() {
      LoadingProgress().color(ColorTokens.primary).width(40).height(40)
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}

@Component
export struct Empty {
  build() {
    Column() {
      Text('书架为空')
        .fontSize(ReaderTypography.sectionTitle().fontSize)
        .fontColor(ColorTokens.muted)
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}

@Component
export struct ErrorState {
  @StorageProp('reader.errorMessage') message: string = '网络异常';

  build() {
    Column() {
      Text(this.message)
        .fontSize(ReaderTypography.sectionTitle().fontSize)
        .fontColor(ColorTokens.ink)
      Text('重试')
        .fontSize(ReaderTypography.bookMeta().fontSize)
        .fontColor(ColorTokens.primary)
        .margin({ top: SpacingTokens.md })
        .padding({ left: SpacingTokens.lg, right: SpacingTokens.lg, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
        .borderRadius(RadiusTokens.control)
        .backgroundColor(ColorTokens.metaBg)
        .onClick(() => ReaderUiStore.dispatch({ type: 'set-loading', loading: false }))
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}

@Component
export struct Offline {
  build() {
    Column() {
      Text('离线')
        .fontSize(ReaderTypography.sectionTitle().fontSize)
        .fontColor(ColorTokens.muted)
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}
