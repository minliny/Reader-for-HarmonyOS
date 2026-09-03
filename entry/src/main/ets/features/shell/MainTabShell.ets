import { MainTabBar } from './MainTabBar';
import { TOK_PAPER } from '../common/ReaderTokens';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeBottom,
  readerInteractiveSafeLeft,
  readerVisualSafeTop,
} from '../common/ReaderWindowMetrics';


// MainTabShell —— 主页面(书架/发现/RSS/设置)公共骨架 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §七)。
// 页面背景 + 内容区 + 响应式主导航。主页面只提供 content + activeTab + onMainTab，
// Phone 使用 BottomNav；完成 Tablet 版式的页面可启用共享左侧导航轨道。状态栏 padding
// 与安全区仍由 Index 根 Stack 统一处理，避免双 padding。
@Component
export struct MainTabShell {
  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop activeTab: string = 'bookshelf';
  @Prop showBottomNav: boolean = true;
  @Prop showTabletRail: boolean = false;
  onMainTab: (key: string) => void = (_key: string): void => {};
  @BuilderParam content: () => void;

  build() {
    if (this.showTabletRail) {
      Stack({ alignContent: Alignment.Start }) {
        Stack({ alignContent: Alignment.TopStart }) {
          this.content();
        }
        .width('100%')
        .height('100%');

        MainTabBar({
          current: this.activeTab,
          vertical: true,
          onSelect: (key: string): void => this.onMainTab(key),
        })
          .position({ x: this.railLeft(), y: this.railTop() });
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER);
    } else {
      Column() {
        Stack({ alignContent: Alignment.TopStart }) {
          this.content();
        }
        .layoutWeight(1)
        .width('100%');

        if (this.showBottomNav) {
          MainTabBar({ current: this.activeTab, onSelect: (key: string): void => this.onMainTab(key) });
        }
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER);
    }
  }

  private railLeft(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return 17;
    }
    return Math.max(17, readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()));
  }

  private railTop(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const windowHeight = metrics.windowRect.height;
    if (!Number.isFinite(windowHeight) || windowHeight <= 0) {
      return 0;
    }
    const safeTop = readerVisualSafeTop(metrics);
    const safeBottom = readerInteractiveSafeBottom(metrics);
    const availableHeight = Math.max(0, windowHeight - safeTop - safeBottom);
    // Index 已把主页面宿主放到 visual safeTop 以下；这里使用宿主局部坐标，
    // 只按可用高度居中，不能再次叠加 safeTop。
    return Math.max(0, (availableHeight - 332) / 2);
  }
}
