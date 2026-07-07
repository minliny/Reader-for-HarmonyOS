// SharedComponents — shell components ported 1:1 from frontend-demo
// (styles/00-foundation.css .fd-top-bar / .fd-back-bar / .fd-main-nav +
// styles/01-shell-layout.css). State components (Loading/Empty/Error/Offline)
// remain P0 stubs pending their own port. All values are demo vp (lint allows
// plain numbers); colors via tokens.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SpacingTokens, SizeTokens } from '../../contract/generated/DimensionTokens';
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

// .fd-top-bar: flex space-between, min-height 58, padding 6 20 0, ink.
//   h1: serif 29/700, nowrap ellipsis. top-actions: flex gap 18, 44×44 icon-buttons.
@Component
export struct AppTopBar {
  @StorageProp('reader.routeId') routeId: string = 'bookshelf';

  build() {
    Row() {
      Text(routeTitle(this.routeId))
        .fontSize(29)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .fontFamily(ReaderTypography.serifFamily())
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
      Row() {
        Image($r('app.media.bookshelf_icon_search_dark')).width(24).height(24)
        Image($r('app.media.reader_icon_more_dark')).width(24).height(24).margin({ left: 18 })
      }
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(SizeTokens.topBarHeight)
    .padding({ top: 6, left: 20, right: 20, bottom: 0 })
  }
}

// .fd-back-bar: grid 44px 1fr 44px, gap 10, min-height 58, padding 6 20 0, ink.
//   back button + more: 44×44 circle (.fd-icon-button). h1: serif 24/700.
@Component
export struct BackTopBar {
  @StorageProp('reader.routeId') routeId: string = 'book-detail';

  build() {
    Row() {
      Image($r('app.media.reader_icon_back_dark'))
        .width(24).height(24)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      Text(secondaryRouteTitle(this.routeId))
        .fontSize(24)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .fontFamily(ReaderTypography.serifFamily())
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
        .margin({ left: 10, right: 10 })
      Image($r('app.media.reader_icon_more_dark'))
        .width(24).height(24)
    }
    .width('100%')
    .height(SizeTokens.topBarHeight)
    .padding({ top: 6, left: 20, right: 20, bottom: 0 })
  }
}

type TabKind = 'bookshelf' | 'discover' | 'rss' | 'settings';

// .fd-main-nav: 4-col grid, min-height 68, padding 7 8, border 1 border,
//   radius-xl(24), surface bg, soft-shadow. Floats (margin 14 horizontal).
// .fd-main-nav-item: grid-rows 30px 18px, gap 3, icon-shell 30×30 circle,
//   label 11/800. is-active: primaryDark bg, on-primary.
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
    .height(SizeTokens.mainNavHeight)
    .padding({ top: 7, bottom: 7, left: 8, right: 8 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusXl)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
  }

  @Builder tabItem(tab: TabKind, label: string) {
    Column() {
      Stack() {
        Image(this.iconFor(tab, this.tab === tab)).width(24).height(24)
      }
      .width(30).height(30)
      .borderRadius(DemoAliasTokens.radiusPill)
      Text(label)
        .fontSize(11)
        .fontWeight(800)
        .fontColor(this.tab === tab ? DemoAliasTokens.onPrimary : ColorTokens.muted)
        .margin({ top: 3 })
    }
    .layoutWeight(1)
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .borderRadius(DemoAliasTokens.radiusXl)
    .backgroundColor(this.tab === tab ? ColorTokens.primaryDark : ColorTokens.paper)
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
        .borderRadius(DemoAliasTokens.radiusPill)
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
