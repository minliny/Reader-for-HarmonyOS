// SharedComponents — shell components ported 1:1 from frontend-demo
// (styles/00-foundation.css .fd-top-bar / .fd-back-bar / .fd-main-nav +
// styles/01-shell-layout.css). State components (Loading/Empty/Error/Offline)
// remain P0 stubs pending their own port. All values are demo vp (lint allows
// plain numbers); colors via tokens.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SpacingTokens, SizeTokens } from '../../contract/generated/DimensionTokens';
import { ViewStateComponent, ViewStateTable } from '../../contract/generated/ViewStateTable';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

function topBarTitle(routeId: string, pageState: string, kind: string, fallback: string): string {
  const components: ViewStateComponent[] = ViewStateTable.componentsFor(routeId, pageState);
  for (const component of components) {
    if (component.type === kind && component.props.title !== undefined && component.props.title !== '') {
      return component.props.title;
    }
  }
  return fallback;
}

// .fd-top-bar: flex space-between, min-height 58, padding 6 20 0, ink.
//   h1: serif 29/700, nowrap ellipsis. top-actions: flex gap 18, 44×44 icon-buttons.
@Component
export struct AppTopBar {
  @StorageProp('reader.displayedRouteId') routeId: string = 'bookshelf';
  @StorageProp('reader.pageState') pageState: string = 'default';

  build() {
    Row() {
      Text(topBarTitle(this.routeId, this.pageState, 'AppTopBar', ''))
        .fontSize(29)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .fontFamily(ReaderTypography.serifFamily())
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
      Row() {
        Image($r('app.media.bookshelf_icon_search_dark')).width(24).height(24)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-search' }))
        Image($r('app.media.reader_icon_more_dark')).width(24).height(24).margin({ left: 18 })
          .onClick(() => this.openTopMore())
      }
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(SizeTokens.topBarHeight)
      .padding({ top: 6, left: 20, right: 20, bottom: 0 })
  }

  private openTopMore(): void {
    if (this.routeId === 'bookshelf' || this.routeId === 'bookshelf-cover-mode' || this.routeId === 'bookshelf-list-mode') {
      ReaderUiStore.dispatch({ type: 'set-overlay', overlay: 'book-action' });
    }
  }
}

// .fd-back-bar: grid 44px 1fr 44px, gap 10, min-height 58, padding 6 20 0, ink.
//   back button + more: 44×44 circle (.fd-icon-button). h1: serif 24/700.
@Component
export struct BackTopBar {
  @StorageProp('reader.displayedRouteId') routeId: string = 'book-detail';
  @StorageProp('reader.pageState') pageState: string = 'default';

  build() {
    Row() {
      Image($r('app.media.reader_icon_back_dark'))
        .width(24).height(24)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      Text(topBarTitle(this.routeId, this.pageState, 'BackTopBar',
        topBarTitle(this.routeId, this.pageState, 'AppTopBar', '')))
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
  @Prop message: string = '书架为空';

  build() {
    Column() {
      Text(this.message)
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

// --- Generic view-state components (contract ComponentType enum) ---
// Phase 1 renderers for the generic component types used across secondary flow
// pages (search / rss / source / sync). They consume simple fixture props such as
// labels, messages and titles while richer child layout stays in ViewStateRenderer.
// Struct names that collide with
// ArkUI built-ins (Button, List) are prefixed with Demo; the contract type string
// ('Button' / 'List') is what DemoViewState cites, and ViewStateRenderer maps it.
@Component
export struct DemoButton {
  @Prop label: string = '操作';
  @Prop destructive: boolean = false;

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(700)
      .fontColor(DemoAliasTokens.onPrimary)
      .height(40)
      .padding({ left: 16, right: 16 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.primary)
      .textAlign(TextAlign.Center)
  }
}

@Component
export struct Input {
  @Prop placeholder: string = '输入...';

  build() {
    TextInput({ placeholder: this.placeholder })
      .fontSize(14)
      .fontColor(ColorTokens.ink)
      .height(42)
      .padding({ left: 12, right: 12 })
      .borderRadius(14)
      .backgroundColor(ColorTokens.metaBg)
      .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
export struct ListRow {
  @Prop title: string = '列表项';
  @Prop detail: string = '';

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(14)
          .fontWeight(600)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.detail.length > 0) {
          Text(this.detail)
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 4 })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      Text('›')
        .fontSize(20)
        .fontColor(ColorTokens.controlInk)
    }
    .width('100%')
    .constraintSize({ minHeight: 48 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(14)
    .backgroundColor(ColorTokens.floatingControlBg)
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct DemoList {
  build() {
    Column() {
      ListRow()
      ListRow()
      ListRow()
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct Card {
  @Prop title: string = '卡片标题';
  @Prop subtitle: string = '卡片摘要';

  build() {
    Column() {
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.controlInk)
      Text(this.subtitle)
        .fontSize(14)
        .fontColor(ColorTokens.muted)
        .lineHeight(20)
        .margin({ top: 8 })
    }
    .width('100%')
    .padding(14)
    .borderRadius(16)
    .border({ width: 1, color: ColorTokens.border })
    .backgroundColor(ColorTokens.floatingControlBg)
    .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct Content {
  @Prop text: string = '正文内容';

  build() {
    Text(this.text)
      .fontSize(ReaderTypography.readerBody().fontSize)
      .fontColor(ColorTokens.ink)
      .width('100%')
      .padding({ left: 20, right: 20 })
  }
}

@Component
export struct FormSection {
  @Prop title: string = '表单分组';

  build() {
    Blank()
    .width('100%')
    .height(0)
  }
}

@Component
export struct FilterBar {
  build() {
    Row() {
      Text('全部')
        .fontSize(13).fontWeight(700)
        .fontColor(ColorTokens.paper)
        .backgroundColor(ColorTokens.primary)
        .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
        .borderRadius(DemoAliasTokens.radiusPill)
      Text('男频')
        .fontSize(13)
        .fontColor(ColorTokens.muted)
        .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
      Text('女频')
        .fontSize(13)
        .fontColor(ColorTokens.muted)
        .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
    }
    .width('100%')
    .padding({ left: 20, right: 20 })
  }
}

@Component
export struct Overlay {
  build() {
    Column() {
      Column() {
        Text('覆盖层')
          .fontSize(ReaderTypography.sectionTitle().fontSize)
          .fontColor(ColorTokens.ink)
      }
      .width('100%')
      .padding(SpacingTokens.lg)
      .backgroundColor(ColorTokens.paper)
      .borderRadius(DemoAliasTokens.radiusXl)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}
