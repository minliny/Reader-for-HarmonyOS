import { readerMainViewport } from './MainNavigationSpec';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderRaisedSurface } from '../common/ReaderRaisedSurface';
import { readerPageAreaLength } from '../common/ReaderPageShell';
import { registerReaderShelfFonts } from '../common/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
} from '../common/ReaderWindowMetrics';
import { readerFloatingTabBarHeight, readerMainTabItemHeight, readerFloatingTabBottomInset } from '../common/ReaderFloatingBarMetrics';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  TOK_BORDER_W,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PRIMARY_DARK,
  TOK_RADIUS_PILL,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';
import { TYPE_MAIN_TAB_LABEL } from '../common/ReaderTypography';
import {
  MAIN_TABS,
  MainTabDef,
  MAIN_TAB_RAIL_ITEM_GAP,
  MAIN_TAB_RAIL_PADDING,
  MAIN_TAB_RAIL_WIDTH,
  mainTabBottomWidth,
  mainTabRailHeight,
} from './MainNavigationSpec';

// 公共主导航 —— 同一套 tab 配置与 item 样式，可渲染为底部栏或左侧 rail。
// 宽屏 rail 高度由启用 tab 数决定，不再固定 332；两种形态共享表面、边框、
// 图标、字体、选中胶囊、按压语义和无障碍角色。
@Component
export struct MainTabBar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop current: string = 'bookshelf';
  @Prop vertical: boolean = false;
  @State private bottomSurfaceWidth: number = 0;
  @State private bottomSurfaceHeight: number = 0;
  @State private railSurfaceWidth: number = 0;
  @State private railSurfaceHeight: number = 0;
  onSelect: (key: string) => void = (_key: string): void => {};
  onCurrentTap: (key: string) => void = (_key: string): void => {};

  aboutToAppear(): void {
    registerReaderShelfFonts(this.getUIContext().getFont());
  }

  build() {
    if (this.vertical) {
      this.verticalRail();
    } else {
      this.bottomBar();
    }
  }

  @Builder
  private bottomBar() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderRaisedSurface({ surfaceWidth: this.bottomSurfaceWidth, surfaceHeight: this.bottomSurfaceHeight,
        cornerRadius: TOK_RADIUS_PILL, scheme: this.appThemeScheme });
    Row({ space: TOK_SPACE_XS }) {
      ForEach(MAIN_TABS, (tab: MainTabDef): void => {
        this.tabItem(tab, this.current === tab.key, false);
      }, (tab: MainTabDef): string => `main-tab-${tab.key}`);
    }
    .width(this.bottomBarFrame().width)
    .constraintSize({ minHeight: readerFloatingTabBarHeight(this.navigationFontScale()) })
    .padding(TOK_SPACE_XS)
    .backgroundColor(readerAppColor('app.navigation.floatingSurface', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.navigation.floatingBorder', this.appThemeScheme) })
    .borderRadius(TOK_RADIUS_PILL)
    .clip(false)
    .hitTestBehavior(HitTestMode.Transparent)
    .onAreaChange((_old: Area, area: Area): void => this.recordRaisedSurface(false, area));
    }.width(this.bottomBarFrame().width).clip(false)
    .hitTestBehavior(HitTestMode.Transparent)
    .margin({ bottom: this.bottomInset() })
    .translate({ x: this.bottomBarTranslateX() });
  }

  @Builder
  private verticalRail() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderRaisedSurface({ surfaceWidth: this.railSurfaceWidth, surfaceHeight: this.railSurfaceHeight,
        cornerRadius: TOK_RADIUS_PILL, scheme: this.appThemeScheme });
    Column({ space: MAIN_TAB_RAIL_ITEM_GAP }) {
      ForEach(MAIN_TABS, (tab: MainTabDef): void => {
        this.tabItem(tab, this.current === tab.key, true);
      }, (tab: MainTabDef): string => `main-rail-tab-${tab.key}`);
    }
    .width(MAIN_TAB_RAIL_WIDTH)
    .height(mainTabRailHeight(MAIN_TABS.length, this.navigationFontScale()))
    .padding(MAIN_TAB_RAIL_PADDING)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('app.navigation.floatingSurface', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.navigation.floatingBorder', this.appThemeScheme) })
    .borderRadius(TOK_RADIUS_PILL)
    .clip(false)
    .onAreaChange((_old: Area, area: Area): void => this.recordRaisedSurface(true, area))
    .hitTestBehavior(HitTestMode.Transparent);
    }.width(MAIN_TAB_RAIL_WIDTH).clip(false).hitTestBehavior(HitTestMode.Transparent);
  }

  private recordRaisedSurface(vertical: boolean, area: Area): void {
    if (vertical !== this.vertical) return;
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
    if (vertical) {
      if (Math.abs(width - this.railSurfaceWidth) > 0.1) this.railSurfaceWidth = width;
      if (Math.abs(height - this.railSurfaceHeight) > 0.1) this.railSurfaceHeight = height;
    } else {
      if (Math.abs(width - this.bottomSurfaceWidth) > 0.1) this.bottomSurfaceWidth = width;
      if (Math.abs(height - this.bottomSurfaceHeight) > 0.1) this.bottomSurfaceHeight = height;
    }
  }

  @Builder
  private tabItem(tab: MainTabDef, active: boolean, vertical: boolean) {
    Column({ space: 2 }) {
      Stack({ alignContent: Alignment.Center }) {
        this.tabIcon(tab.key, active);
      }
      .width(30)
      .height(30);

      Text(tab.label)
        .width('100%')
        .fontFamily(TYPE_MAIN_TAB_LABEL.fontFamily)
        .fontWeight(TYPE_MAIN_TAB_LABEL.fontWeight)
        .fontSize(TYPE_MAIN_TAB_LABEL.fontSizeFp)
        .lineHeight(`${TYPE_MAIN_TAB_LABEL.lineHeightFp}fp`)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.Center)
        .fontColor(active ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme));
    }
    .width(vertical ? 66 : undefined)
    .layoutWeight(vertical ? 0 : 1)
    .constraintSize({ minHeight: readerMainTabItemHeight(this.navigationFontScale(), vertical) })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(active ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : Color.Transparent)
    .borderRadius(active ? TOK_RADIUS_PILL : 0)
    .accessibilityText(`${tab.label}${active ? '，已选中' : ''}`)
    .accessibilityRole(AccessibilityRoleType.BUTTON)
    .accessibilitySelected(active)
    .focusable(true)
    .onClick((): void => {
      if (!active) {
        this.onSelect(tab.key);
      } else {
        this.onCurrentTap(tab.key);
      }
    });
  }

  private navigationFontScale(): number {
    return this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
  }

  private tabIconResource(key: string, active: boolean): string {
    const night = this.appThemeScheme === 'night';
    if (key === 'bookshelf') {
      return active ? 'bookshelf_library_active' :
        (night ? 'bookshelf_library_outline_theme_night' : 'bookshelf_library_outline');
    }
    if (key === 'discover') {
      return active ? 'bookshelf_compass_active' :
        (night ? 'bookshelf_compass_outline_theme_night' : 'bookshelf_compass_outline');
    }
    if (key === 'rss') {
      return active ? 'bookshelf_rss_active' :
        (night ? 'bookshelf_rss_outline_theme_night' : 'bookshelf_rss_outline');
    }
    return active ? 'bookshelf_settings_active' :
      (night ? 'bookshelf_settings_outline_theme_night' : 'bookshelf_settings_outline');
  }

  @Builder
  private tabIcon(key: string, active: boolean) {
    Image($r(`app.media.${this.tabIconResource(key, active)}`)).width(24).height(24);
  }

  private bottomBarFrame(): SurfaceHorizontalFrame {
    const metrics = ReaderWindowCoordinator.metrics();
    const width = this.liveWindowWidth();
    return resolveHorizontalFrame(
      width,
      readerInteractiveSafeLeft(metrics),
      readerInteractiveSafeRight(metrics),
      new SurfaceWidthSpec(mainTabBottomWidth(MAIN_TABS.length), 32, 32, 'center'),
    );
  }

  private bottomBarTranslateX(): number {
    const frame = this.bottomBarFrame();
    return (frame.left - frame.right) / 2;
  }

  private bottomInset(): number {
    if (this.readerWindowMetricsRevision < 0) return 15;
    return readerFloatingTabBottomInset(ReaderWindowCoordinator.metrics());
  }

  private liveWindowWidth(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const width = readerMainViewport(this.mainViewportRevision).width;
    return Number.isFinite(width) && width > 0 ? width : 0;
  }
}
