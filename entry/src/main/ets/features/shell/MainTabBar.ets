import { readerAppColor } from '../common/ReaderThemeRegistry';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeBottom,
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PRIMARY_DARK,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';
import { TYPE_MAIN_TAB_LABEL } from '../common/ReaderTypography';
import { isReaderMainTabEnabled } from '../../app/ReaderProductScope';


// 公共主导航 —— 数据驱动的 tab 栏。四个主页面（书架/发现/RSS/设置）复用。
// tab 列表来自单一配置（MAIN_TABS）：增删 tab 只改配置，宽度按数量自适应平分。
// 选中态由 current 驱动；点击非当前 tab 回调 onSelect(key)，由宿主页映射到各自回调。
// Figma 重绘版：Phone 360×68、Tablet 82×332，r24 bg #E6FFFCF8 border #C1C7CD；
// 选中 bg #1F3528 + 文字 #FFFAF4，未选中文字 #756F69；icon 24，标签 Noto Sans SC Bold 11。
// 颜色直接使用 TOK_* 语义 token (无二次别名)。

export interface MainTabDef {
  key: string;
  label: string;
}

const ALL_MAIN_TABS: MainTabDef[] = [
  { key: 'bookshelf', label: '书架' },
  { key: 'discover', label: '发现' },
  { key: 'rss', label: 'RSS' },
  { key: 'settings', label: '设置' },
];

export const MAIN_TABS: MainTabDef[] = ALL_MAIN_TABS.filter(
  (tab: MainTabDef): boolean => isReaderMainTabEnabled(tab.key),
);

@Component
export struct MainTabBar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop current: string = 'bookshelf';
  @Prop vertical: boolean = false;
  onSelect: (key: string) => void = (_key: string): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
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
    Row() {
      ForEach(MAIN_TABS, (tab: MainTabDef) => {
        this.bottomTabItem(tab, this.current === tab.key);
      }, (tab: MainTabDef): string => `main-tab-${tab.key}`);
    }
    .width(this.bottomBarFrame().width)
    .height(68)
    .padding(TOK_SPACE_XS)
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(24)
    .margin({ bottom: Math.max(15, this.interactiveBottom()) })
    .translate({ x: this.bottomBarTranslateX() });
  }

  @Builder
  private verticalRail() {
    Column({ space: 6 }) {
      ForEach(MAIN_TABS, (tab: MainTabDef) => {
        this.railTabItem(tab, this.current === tab.key);
      }, (tab: MainTabDef): string => `main-rail-tab-${tab.key}`);
    }
    .width(82)
    .height(332)
    .padding(TOK_SPACE_XS)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(24);
  }

  @Builder
  private bottomTabItem(tab: MainTabDef, active: boolean) {
    Column({ space: 2 }) {
      Stack({ alignContent: Alignment.Center }) {
        this.tabIcon(tab.key, active);
      }
      .width(30)
      .height(30);

      Text(tab.label)
        .fontFamily(TYPE_MAIN_TAB_LABEL.fontFamily)
        .fontWeight(TYPE_MAIN_TAB_LABEL.fontWeight)
        .fontSize(TYPE_MAIN_TAB_LABEL.fontSizeFp)
        .lineHeight(TYPE_MAIN_TAB_LABEL.lineHeightFp as number)
        .fontColor(active ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme));
    }
    .layoutWeight(1)
    .height(54)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(active ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : Color.Transparent)
    .borderRadius(24)
    .onClick((): void => {
      if (!active) {
        this.onSelect(tab.key);
      }
    });
  }

  @Builder
  private railTabItem(tab: MainTabDef, active: boolean) {
    Column({ space: 2 }) {
      Stack({ alignContent: Alignment.Center }) {
        this.tabIcon(tab.key, active);
      }
      .width(32)
      .height(32);

      Text(tab.label)
        .fontFamily(TYPE_MAIN_TAB_LABEL.fontFamily)
        .fontWeight(TYPE_MAIN_TAB_LABEL.fontWeight)
        .fontSize(TYPE_MAIN_TAB_LABEL.fontSizeFp)
        .lineHeight(TYPE_MAIN_TAB_LABEL.lineHeightFp as number)
        .fontColor(active ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme));
    }
    .width(66)
    .height(58)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(active ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : Color.Transparent)
    .borderRadius(24)
    .onClick((): void => {
      if (!active) {
        this.onSelect(tab.key);
      }
    });
  }

  // Final Phone/Tablet 页面在选中态仍使用同一套 Tabler outline glyph，
  // 只由资源颜色和深色胶囊表达状态；不要切换成本地 filled 轮廓。
  private tabIconResource(key: string, active: boolean): string {
    if (key === 'bookshelf') {
      return active ? 'bookshelf_library_active' : 'bookshelf_library_outline';
    } else if (key === 'discover') {
      return active ? 'bookshelf_compass_active' : 'bookshelf_compass_outline';
    } else if (key === 'rss') {
      return active ? 'bookshelf_rss_active' : 'bookshelf_rss_outline';
    }
    return active ? 'bookshelf_settings_active' : 'bookshelf_settings_outline';
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
      new SurfaceWidthSpec(360, 15, 15, 'center'),
    );
  }

  private bottomBarTranslateX(): number {
    const frame = this.bottomBarFrame();
    return (frame.left - frame.right) / 2;
  }

  private interactiveBottom(): number {
    return readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics());
  }

  private liveWindowWidth(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const width = ReaderWindowCoordinator.metrics().windowRect.width;
    return Number.isFinite(width) && width > 0 ? width : 0;
  }
}
