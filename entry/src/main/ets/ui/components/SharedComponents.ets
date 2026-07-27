// SharedComponents — shared shell pieces for admitted Figma routes. Every
// visible header/navigation value below comes from Reader-UI's revision-bound
// VisualAdmission contract. Historical generic state helpers remain inert by
// route admission; they never substitute for a missing Figma surface.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SpacingTokens } from '../../contract/generated/DimensionTokens';
import { ViewStateComponent, ViewStateTable } from '../../contract/generated/ViewStateTable';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { CoreRssSubscription } from '../store/ReaderUiState';

function topBarTitle(routeId: string, pageState: string, kind: string, fallback: string): string {
  // This route aliases its generated management body, while Harmony renders a
  // real target-bound confirmation body. Keep the shell title truthful too.
  if (routeId === 'rss-source-delete-confirm') return '删除订阅源';
  const components: ViewStateComponent[] = ViewStateTable.componentsFor(routeId, pageState);
  for (const component of components) {
    if (component.type === kind && component.props.title !== undefined && component.props.title !== '') {
      return component.props.title;
    }
  }
  return fallback;
}

// Current Figma AppTopBar master: 58 high, 6/20/0 padding, 29pt title, and
// two 44pt actions separated by 18pt (all read through VisualAdmission).
@Component
export struct AppTopBar {
  @StorageProp('reader.displayedRouteId') routeId: string = 'bookshelf';
  @StorageProp('reader.pageState') pageState: string = 'default';
  @StorageProp('reader.rssSubscriptions') rssSubscriptions: CoreRssSubscription[] = [];
  // ViewStateRenderer supplies the canonical title. Shell-owned callers leave
  // it empty and keep the route-derived fallback used by production today.
  @Prop title: string = '';

  private resolvedTitle(): string {
    if (this.title !== '') return this.title;
    return topBarTitle(this.routeId, this.pageState, 'AppTopBar', '');
  }

  private isDiscoverRoute(): boolean {
    return this.routeId === 'discover' || this.routeId === 'discover-home';
  }

  private isRssRoute(): boolean {
    return this.routeId === 'rss';
  }

  private isBookshelfRoute(): boolean {
    return this.routeId === 'bookshelf' || this.routeId === 'bookshelf-cover-mode' ||
      this.routeId === 'bookshelf-list-mode' || this.routeId === 'bookshelf-empty';
  }

  private genericTitleFontFamily(): string {
    return this.isBookshelfRoute()
      ? ReaderUiVisualTokens.bookshelfBookTitleFontFamily
      // Other visible MainTab headers have dedicated Figma branches above.
      // Keep this defensive path source-led for any future admitted header.
      : ReaderUiVisualTokens.settingsTitleFontFamily;
  }

  private genericTitleInk(): string {
    return this.isBookshelfRoute()
      ? ReaderUiVisualTokens.bookshelfInk
      : ReaderUiVisualTokens.settingsTitleInk;
  }

  private enabledRssSourceCount(): number {
    let count = 0;
    for (let index = 0; index < this.rssSubscriptions.length; index += 1) {
      if (this.rssSubscriptions[index].enabled) count += 1;
    }
    return count;
  }

  build() {
    if (this.isDiscoverRoute()) {
      this.renderDiscoverHeader()
    } else if (this.isRssRoute()) {
      this.renderRssHeader()
    } else {
      Row() {
        Text(this.resolvedTitle())
          .fontSize(ReaderUiVisualTokens.navigationTopBarTitleSize)
          .fontWeight(700)
          .fontColor(this.genericTitleInk())
          .fontFamily(this.genericTitleFontFamily())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)
        Row({ space: ReaderUiVisualTokens.navigationTopBarActionGap }) {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.bookshelf_icon_search_dark'))
              .width(ReaderUiVisualTokens.navigationMainNavIconSize)
              .height(ReaderUiVisualTokens.navigationMainNavIconSize)
          }
            .width(ReaderUiVisualTokens.navigationTopBarActionSize)
            .height(ReaderUiVisualTokens.navigationTopBarActionSize)
            .accessibilityText('搜索书籍')
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-search' }))
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.reader_icon_more_dark'))
              .width(ReaderUiVisualTokens.navigationMainNavIconSize)
              .height(ReaderUiVisualTokens.navigationMainNavIconSize)
          }
            .width(ReaderUiVisualTokens.navigationTopBarActionSize)
            .height(ReaderUiVisualTokens.navigationTopBarActionSize)
            .accessibilityText('更多操作')
            .onClick(() => this.openTopMore())
        }
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .height(ReaderUiVisualTokens.navigationHeaderHeight)
      .padding({
        top: ReaderUiVisualTokens.navigationHeaderTopInset,
        left: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
        right: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
        bottom: 0,
      })
    }
  }

  @Builder renderDiscoverHeader() {
    Row() {
      Text('发现')
        .fontFamily(ReaderUiVisualTokens.discoverHeaderFontFamily)
        .fontSize(ReaderUiVisualTokens.discoverHeaderTitleSize)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.discoverHeaderInk)
      Blank().layoutWeight(1)
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.ui_icon_refresh_primary'))
          .width(ReaderUiVisualTokens.navigationMainNavIconSize)
          .height(ReaderUiVisualTokens.navigationMainNavIconSize)
      }
      .width(ReaderUiVisualTokens.navigationTopBarActionSize)
      .height(ReaderUiVisualTokens.navigationTopBarActionSize)
      .accessibilityText('刷新发现')
      .onClick(() => ReaderUiStore.dispatch({ type: 'discover-refresh' }))
    }
    .width('100%')
    .height(ReaderUiVisualTokens.navigationHeaderHeight)
    .padding({
      top: ReaderUiVisualTokens.navigationHeaderTopInset,
      left: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
      right: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
      bottom: 0,
    })
    .alignItems(VerticalAlign.Center)
  }

  @Builder renderRssHeader() {
    Row() {
      Text('RSS')
        .fontFamily(ReaderUiVisualTokens.rssHeaderFontFamily)
        .fontSize(ReaderUiVisualTokens.rssHeaderTitleSize)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.rssHeaderInk)
      Blank().layoutWeight(1)
      Row({ space: ReaderUiVisualTokens.rssHeaderControlGap }) {
        Row() {
          Circle()
            .width(ReaderUiVisualTokens.rssHeaderStatusDotSize)
            .height(ReaderUiVisualTokens.rssHeaderStatusDotSize)
            .fill(ReaderUiVisualTokens.rssPrimary)
          Text(`${this.enabledRssSourceCount()} 个启用源`)
            .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
            .fontSize(ReaderUiVisualTokens.rssControlLabelSize)
            .fontWeight(900)
            .fontColor(ReaderUiVisualTokens.rssHeaderInk)
            .margin({ left: ReaderUiVisualTokens.rssHeaderStatusTextGap })
          Image($r('app.media.ui_icon_refresh_primary'))
            .width(ReaderUiVisualTokens.rssHeaderRefreshIconSize)
            .height(ReaderUiVisualTokens.rssHeaderRefreshIconSize)
            .margin({ left: ReaderUiVisualTokens.rssHeaderStatusTextGap })
        }
        .height(ReaderUiVisualTokens.rssHeaderStatusHeight)
        .padding({
          left: ReaderUiVisualTokens.rssHeaderStatusPaddingLeft,
          right: ReaderUiVisualTokens.rssHeaderStatusPaddingRight,
        })
        .border({ width: 1, color: ReaderUiVisualTokens.rssSoftBorder })
        .borderRadius(999)
        .backgroundColor(ReaderUiVisualTokens.rssStatusSurface)
        .alignItems(VerticalAlign.Center)
        .accessibilityText('刷新当前订阅')
        .onClick(() => ReaderUiStore.dispatch({ type: 'rss-refresh' }))
        Row() {
          Image($r('app.media.ui_icon_list_dark'))
            .width(ReaderUiVisualTokens.rssHeaderManageIconSize)
            .height(ReaderUiVisualTokens.rssHeaderManageIconSize)
          Text('管理')
            .fontFamily(ReaderUiVisualTokens.rssControlFontFamily)
            .fontSize(ReaderUiVisualTokens.rssControlLabelSize)
            .fontWeight(900)
            .fontColor(ReaderUiVisualTokens.rssHeaderInk)
            .margin({ left: ReaderUiVisualTokens.rssHeaderManageLabelGap })
        }
        .width(ReaderUiVisualTokens.rssHeaderManageWidth)
        .height(ReaderUiVisualTokens.rssHeaderStatusHeight)
        .border({ width: 1, color: ReaderUiVisualTokens.rssSoftBorder })
        .borderRadius(ReaderUiVisualTokens.rssHeaderManageRadius)
        .backgroundColor(ReaderUiVisualTokens.rssStatusSurface)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .accessibilityText('管理订阅源：当前 Figma 未提供可进入的目标')
      }
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(ReaderUiVisualTokens.navigationHeaderHeight)
    .padding({
      top: ReaderUiVisualTokens.navigationHeaderTopInset,
      left: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
      right: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
      bottom: 0,
    })
    .alignItems(VerticalAlign.Center)
  }

  private openTopMore(): void {
    if (this.routeId === 'bookshelf' || this.routeId === 'bookshelf-cover-mode' || this.routeId === 'bookshelf-list-mode') {
      // Figma Page/Bookshelf (941:6) defines this as a visual/pressed
      // `More Action` only: it has no click navigation reaction.  A book
      // action sheet belongs exclusively to a long-pressed, identity-bound
      // card, so do not manufacture a targetless sheet from the top bar.
      return;
    } else if (this.routeId === 'discover' || this.routeId === 'discover-home') {
      // Core source.explore does not expose a global sort contract.  Make the
      // top-bar affordance an honest refresh of the selected persisted source
      // instead of routing to the demo-only sort fixture.
      ReaderUiStore.dispatch({ type: 'discover-refresh' });
    } else if (this.routeId === 'rss' || this.routeId === 'rss-all') {
      ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-subscription-management' });
    } else if (this.routeId === 'settings' || this.routeId === 'global-settings') {
      ReaderUiStore.dispatch({ type: 'route-push', id: 'about-feedback' });
    }
  }
}

// Current Figma back header: 58 high with a 44pt back action, 24pt icon, and
// a 10pt title gap. Route-specific colors and typography remain source-bound.
@Component
export struct BackTopBar {
  @StorageProp('reader.displayedRouteId') routeId: string = 'book-detail';
  @StorageProp('reader.pageState') pageState: string = 'default';
  @Prop title: string = '';

  private resolvedTitle(): string {
    if (this.title !== '') return this.title;
    return topBarTitle(this.routeId, this.pageState, 'BackTopBar',
      topBarTitle(this.routeId, this.pageState, 'AppTopBar', ''));
  }

  private supportsBookActions(): boolean {
    // The current Book Detail Figma master has only a back affordance. Book
    // actions are the two exact bottom-bar buttons; adding a top-right more
    // control would be a local visual invention. The Reader directory keeps
    // its separately admitted action affordance.
    return this.routeId === 'book-directory';
  }

  private isBookDetailRoute(): boolean {
    return this.routeId === 'book-detail' || this.routeId === 'book-detail-toc-preview';
  }

  private usesSourceManagementMore(): boolean {
    return this.routeId === 'source-management';
  }

  private isSettingsGeneralRoute(): boolean {
    return this.routeId === 'settings-general';
  }

  private isSyncFigmaRoute(): boolean {
    return this.routeId === 'webdav-config' || this.routeId === 'sync-backup' ||
      this.routeId === 'restore-confirm' || this.routeId === 'restore-running' ||
      this.routeId === 'restore-result';
  }

  private titleFontFamily(): string {
    return this.isBookDetailRoute()
      ? ReaderUiVisualTokens.bookDetailTitleFontFamily
      : this.usesSourceManagementMore()
      ? ReaderUiVisualTokens.sourceManagementTitleFontFamily
      : this.isSettingsGeneralRoute()
      ? ReaderUiVisualTokens.settingsTitleFontFamily
      : this.isSyncFigmaRoute()
      ? ReaderUiVisualTokens.webdavControlFontFamily
      : ReaderUiVisualTokens.settingsTitleFontFamily;
  }

  private titleFontSize(): number {
    return this.usesSourceManagementMore()
      ? ReaderUiVisualTokens.sourceManagementTitleSize
      : this.isSettingsGeneralRoute()
      ? ReaderUiVisualTokens.settingsTitleSize
      : ReaderUiVisualTokens.navigationBackTitleSize;
  }

  private titleInk(): string {
    return this.isBookDetailRoute()
      ? ReaderUiVisualTokens.bookDetailInk
      : this.usesSourceManagementMore()
      ? ReaderUiVisualTokens.sourceManagementInk
      : this.isSettingsGeneralRoute()
      ? ReaderUiVisualTokens.settingsTitleInk
      : this.isSyncFigmaRoute()
      ? ReaderUiVisualTokens.webdavInk
      : ReaderUiVisualTokens.settingsTitleInk;
  }

  private barHeight(): number {
    return this.isSettingsGeneralRoute()
      ? ReaderUiVisualTokens.settingsBackBarHeight
      : ReaderUiVisualTokens.navigationHeaderHeight;
  }

  build() {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_icon_back_dark'))
          .width(ReaderUiVisualTokens.navigationBackIconSize)
          .height(ReaderUiVisualTokens.navigationBackIconSize)
      }
        .width(ReaderUiVisualTokens.navigationBackActionSize)
        .height(ReaderUiVisualTokens.navigationBackActionSize)
        .accessibilityText('返回')
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      Text(this.resolvedTitle())
        .fontSize(this.titleFontSize())
        .fontWeight(700)
        .fontColor(this.titleInk())
        .fontFamily(this.titleFontFamily())
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
        .margin({
          left: ReaderUiVisualTokens.navigationBackTitleGap,
          right: ReaderUiVisualTokens.navigationBackTitleGap,
        })
      if (this.supportsBookActions()) {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.reader_icon_more_dark'))
            .width(ReaderUiVisualTokens.navigationMainNavIconSize)
            .height(ReaderUiVisualTokens.navigationMainNavIconSize)
        }
          .width(ReaderUiVisualTokens.navigationBackActionSize)
          .height(ReaderUiVisualTokens.navigationBackActionSize)
          .accessibilityText('书籍更多操作')
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: 'book-action' }))
      } else if (this.usesSourceManagementMore()) {
        Stack({ alignContent: Alignment.Center }) {
          Row({ space: 3 }) {
            Circle().width(ReaderUiVisualTokens.sourceManagementMoreDotSize).height(ReaderUiVisualTokens.sourceManagementMoreDotSize).fill(ReaderUiVisualTokens.sourceManagementInk)
            Circle().width(ReaderUiVisualTokens.sourceManagementMoreDotSize).height(ReaderUiVisualTokens.sourceManagementMoreDotSize).fill(ReaderUiVisualTokens.sourceManagementInk)
            Circle().width(ReaderUiVisualTokens.sourceManagementMoreDotSize).height(ReaderUiVisualTokens.sourceManagementMoreDotSize).fill(ReaderUiVisualTokens.sourceManagementInk)
          }
        }
          .width(ReaderUiVisualTokens.sourceManagementMoreHitSize)
          .height(ReaderUiVisualTokens.sourceManagementMoreHitSize)
      } else {
        Blank()
          .width(ReaderUiVisualTokens.navigationBackActionSize)
          .height(ReaderUiVisualTokens.navigationBackActionSize)
      }
    }
    .width('100%')
    .height(this.barHeight())
    .padding({
      top: ReaderUiVisualTokens.navigationHeaderTopInset,
      left: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
      right: ReaderUiVisualTokens.navigationHeaderHorizontalInset,
      bottom: 0,
    })
  }
}

type TabKind = 'bookshelf' | 'discover' | 'rss' | 'settings';

// Current Figma navigation has separate 390×844 Phone and 760×960 Tablet
// geometries. Its dimensions below are generated from those masters; compact
// and fold layouts are intentionally not represented.
@Component
export struct BottomNav {
  @StorageProp('reader.tab') tab: string = 'bookshelf';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @Prop selected: string = '';

  private activeTab(): TabKind {
    if (this.selected === 'bookshelf' || this.selected === 'discover' ||
      this.selected === 'rss' || this.selected === 'settings') {
      return this.selected as TabKind;
    }
    if (this.tab === 'discover' || this.tab === 'rss' || this.tab === 'settings') {
      return this.tab as TabKind;
    }
    return 'bookshelf';
  }

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
    .height(ReaderUiVisualTokens.navigationMainNavPhoneHeight)
    .padding({
      top: ReaderUiVisualTokens.navigationMainNavPhoneVisualInset,
      bottom: ReaderUiVisualTokens.navigationMainNavPhoneVisualInset,
      left: ReaderUiVisualTokens.navigationMainNavPhoneVisualInset,
      right: ReaderUiVisualTokens.navigationMainNavPhoneVisualInset,
    })
    .border({ width: 1, color: ReaderUiVisualTokens.bookshelfBorder })
    .borderRadius(ReaderUiVisualTokens.navigationMainNavRadius)
    .backgroundColor(ReaderUiVisualTokens.bookshelfMainNavSurface)
  }

  @Builder tabItem(tab: TabKind, label: string) {
    Column() {
      Stack() {
        Image(this.iconFor(tab, this.activeTab() === tab))
          .width(ReaderUiVisualTokens.navigationMainNavIconSize)
          .height(ReaderUiVisualTokens.navigationMainNavIconSize)
      }
      .width(ReaderUiVisualTokens.navigationMainNavPhoneIconShellSize)
      .height(ReaderUiVisualTokens.navigationMainNavPhoneIconShellSize)
      .borderRadius(999)
      Text(label)
        .fontSize(ReaderUiVisualTokens.navigationMainNavLabelSize)
        .fontWeight(700)
        .fontFamily(ReaderUiVisualTokens.bookshelfMainNavLabelFontFamily)
        .fontColor(this.activeTab() === tab
          ? ReaderUiVisualTokens.bookshelfActionLabel
          : ReaderUiVisualTokens.bookshelfMainNavInactiveLabel)
        .lineHeight(ReaderUiVisualTokens.navigationMainNavLabelLineHeight)
        .margin({ top: ReaderUiVisualTokens.navigationMainNavItemGap })
    }
    .layoutWeight(1)
    .height(ReaderUiVisualTokens.navigationMainNavPhoneItemHeight)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .borderRadius(ReaderUiVisualTokens.navigationMainNavRadius)
    .backgroundColor(this.activeTab() === tab ? ReaderUiVisualTokens.bookshelfMainNavActive : Color.Transparent)
    .accessibilityText(label)
    .accessibilityDescription(this.activeTab() === tab ? '已选中标签' : '未选中标签')
    .onClick(() => {
      MotionAdapter.apply('tab.switch', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'switch-tab', tab: tab });
      });
    })
  }
}

@Component
export struct Loading {
  @Prop title: string = '';
  @Prop message: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Column({ space: 8 }) {
      if (this.reducedMotion) {
        Text('加载中')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
          .accessibilityText('正在加载')
      } else {
        LoadingProgress().color(ColorTokens.primary).width(40).height(40)
          .accessibilityText('正在加载')
      }
      if (this.title !== '') {
        Text(this.title)
          .fontSize(ReaderTypography.sectionTitle().fontSize)
          .fontColor(ColorTokens.ink)
      }
      if (this.message !== '' && this.message !== this.title) {
        Text(this.message)
          .fontSize(ReaderTypography.bookMeta().fontSize)
          .fontColor(ColorTokens.muted)
      }
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
  @Prop title: string = '';
  @Prop canonicalMessage: string = '';
  // Native fallback errors retain retry. Canonical state-evidence nodes pass
  // false because their retry action, when present, is a separate Button with
  // its own explicit binding.
  @Prop retryEnabled: boolean = true;

  private resolvedMessage(): string {
    if (this.canonicalMessage !== '') return this.canonicalMessage;
    return this.message;
  }

  build() {
    Column() {
      if (this.title !== '') {
        Text(this.title)
          .fontSize(ReaderTypography.sectionTitle().fontSize)
          .fontColor(ColorTokens.ink)
      }
      Text(this.resolvedMessage())
        .fontSize(ReaderTypography.sectionTitle().fontSize)
        .fontColor(ColorTokens.ink)
      if (this.retryEnabled) {
        Text('重试')
          .fontSize(ReaderTypography.bookMeta().fontSize)
          .fontColor(ColorTokens.primary)
          .margin({ top: SpacingTokens.md })
          .padding({ left: SpacingTokens.lg, right: SpacingTokens.lg, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .onClick(() => ReaderUiStore.dispatch({ type: 'retry-last-operation' }))
      }
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}

@Component
export struct Offline {
  @Prop title: string = '';
  @Prop message: string = '';

  build() {
    Column({ space: 8 }) {
      Text(this.title !== '' ? this.title : '离线')
        .fontSize(ReaderTypography.sectionTitle().fontSize)
        .fontColor(ColorTokens.muted)
      if (this.message !== '' && this.message !== this.title) {
        Text(this.message)
          .fontSize(ReaderTypography.bookMeta().fontSize)
          .fontColor(ColorTokens.muted)
      }
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
