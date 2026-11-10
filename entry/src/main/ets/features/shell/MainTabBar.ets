import { ReaderBottomNavigation } from '../../app/navigation/ReaderBottomNavigation';
import { readerMainTabIconResource } from '../../app/navigation/ReaderMainTabs';
import { readerAppColor } from '../../ui/foundation/ReaderThemeRegistry';
import { ReaderRaisedSurface } from '../../ui/surfaces/ReaderRaisedSurface';
import { readerPageAreaLength } from '../../ui/layout/ReaderPageShell';
import { registerReaderShelfFonts } from '../../ui/foundation/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerMainTabItemHeight } from '../../ui/layout/ReaderFloatingBarMetrics';
import {
  TOK_BORDER_W,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PRIMARY_DARK,
  TOK_RADIUS_PILL,
} from '../../ui/foundation/ReaderTokens';
import { TYPE_MAIN_TAB_LABEL } from '../../ui/foundation/ReaderTypography';
import {
  MAIN_TABS,
  MainTabDef,
  MAIN_TAB_RAIL_ITEM_GAP,
  MAIN_TAB_RAIL_PADDING,
  MAIN_TAB_RAIL_WIDTH,
  mainTabRailHeight,
} from './MainNavigationSpec';

// 公共主导航 —— 同一套 tab 配置与 item 样式，可渲染为底部栏或左侧 rail。
// 宽屏 rail 高度由启用 tab 数决定，不再固定 332；两种形态共享表面、边框、
// 图标、字体、选中胶囊、按压语义和无障碍角色。
@Component
export struct MainTabBar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop current: string = 'bookshelf';
  @Prop vertical: boolean = false;
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
      ReaderBottomNavigation({ current: this.current,
        onSelect: (key: string): void => this.onSelect(key),
        onCurrentTap: (key: string): void => this.onCurrentTap(key),
      });
    }
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

  @Builder
  private tabIcon(key: string, active: boolean) {
    Image($r(`app.media.${readerMainTabIconResource(key, active, this.appThemeScheme)}`)).width(24).height(24);
  }
}
