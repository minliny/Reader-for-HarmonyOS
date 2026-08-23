import { MainTabBar } from './MainTabBar';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { PageBackBar } from '../common/PageBackBar';
import { AppTopBar } from '../common/AppTopBar';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  TOK_CONTENT_MAX_W_TABLET,
  TOK_PAPER,
  TOK_SCREEN_INSET,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';


// SettingsShell —— Settings 页面骨架 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §七/§十)。
// 负责 Settings Home TopBar + BackTopBar + Scroll Content + BottomNav + 子页返回结构 +
// 响应式页面边距。Settings 分 Home 与 General 两态(不互替): Home 显示设置菜单 + 底部栏,
// General 显示返回栏 + 通用设置区块。页面只提供 homeContent/generalContent + activeSection/
// onSectionChange + 导航回调; 不复制 TopBar/BackBar/BottomNav/Scroll 骨架。
// 根 Stack = 下拉面板 overlay 宿主: 展开面板必须挂在全高容器才可点 (ArkUI 命中测试裁到
// 父边界, 固定高行内面板下层选项不可点)。showOverlay + overlayContent 由页面提供;
// onOverlayOriginChange 上报宿主 Stack 全局坐标, 供页面换算触发条相对位置。
@Component
export struct SettingsShell {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop activeSection: 'home' | 'general' = 'home';
  @Prop showOverlay: boolean = false;
  onSectionChange: (section: 'home' | 'general') => void = (_section: 'home' | 'general'): void => {};
  onBack: () => void = (): void => {};
  onOpenSourceManagement: () => void = (): void => {};
  onOpenSync: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  onOverlayOriginChange: (x: number, y: number) => void = (_x: number, _y: number): void => {};
  @BuilderParam homeContent: () => void;
  @BuilderParam generalContent: () => void;
  @BuilderParam overlayContent: () => void;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        if (this.activeSection === 'home') {
          this.homeTopBar();
        } else {
          PageBackBar({
            title: '通用设置',
            onBack: (): void => this.onSectionChange('home'),
          });
        }
        if (this.activeSection === 'home') {
          Scroll() {
            Column({ space: TOK_SPACE_SM }) {
              this.homeContent();
            }
            .width('100%')
            .padding({
              left: this.contentFrame().left,
              right: this.contentFrame().right,
              top: TOK_SPACE_XS,
              bottom: TOK_SPACE_SM,
            });
          }
          .layoutWeight(1)
          .width('100%')
          .align(Alignment.Top)
          .scrollBar(BarState.Off);
          MainTabBar({ current: 'settings', onSelect: (key: string): void => this.onMainTab(key) });
        } else {
          Scroll() {
            Column({ space: TOK_SPACE_SM }) {
              this.generalContent();
            }
            .width('100%')
            .padding({
              left: this.contentFrame().left,
              right: this.contentFrame().right,
              top: TOK_SPACE_XS,
              bottom: TOK_SPACE_SM,
            });
          }
          .layoutWeight(1)
          .width('100%')
          .scrollBar(BarState.Off);
        }
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER)
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
        this.onOverlayOriginChange(
          Number(newValue.globalPosition.x),
          Number(newValue.globalPosition.y));
      });

      if (this.showOverlay) {
        this.overlayContent();
      }
    }
    .width('100%')
    .height('100%');
  }

  @Builder
  private homeTopBar() {
    AppTopBar({ title: '设置' });
  }

  private onMainTab(key: string): void {
    if (key === 'bookshelf') {
      this.onBack();
    } else if (key === 'discover') {
      this.onDiscoverRequested();
    } else if (key === 'rss') {
      this.onRssRequested();
    }
    // 'settings' is this page; MainTabBar suppresses the current tab.
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      metrics.windowRect.width,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }
}
