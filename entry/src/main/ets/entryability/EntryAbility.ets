import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';

const DOMAIN = 0x5244;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    const owner = ReaderRuntimeOwner.install(this.context);
    owner.start().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core startup failed: %{public}s', error.message);
    });
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    // 顶部状态栏: 保留正常渲染(时钟可见), 背景色改为与应用页面对齐 (#F8F4EC surface)。
    // 底部手势条: 透明, 内容通过 Index 根的 expandSafeArea(BOTTOM) 延伸到屏幕底(沉浸式底部)。
    // 全沉浸布局 setWindowLayoutFullScreen(true): 窗口延伸到系统栏; 顶部内容由 Index 根
    // padding 状态栏高度避让(不上移), 底部内容延伸到手势条下方(不留安全区空白)。
    const win = windowStage.getMainWindowSync();
    win.setWindowLayoutFullScreen(true);
    win.setWindowSystemBarEnable(['status', 'navigation']);
    win.setWindowSystemBarProperties({
      statusBarColor: '#FFF8F4EC',
      navigationBarColor: '#00000000',
      statusBarContentColor: '#99000000',
      navigationBarContentColor: '#99000000',
    });
    // 状态栏高度(px)供 Index 根布局 padding 顶部避让, 使内容不上移到状态栏。
    const avoidArea = win.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
    AppStorage.setOrCreate('statusBarHeightPx', avoidArea.topRect.height);
    windowStage.loadContent('pages/Index', (error): void => {
      if (error.code) {
        hilog.error(DOMAIN, 'Reader', 'Failed to load main page: %{public}s', JSON.stringify(error));
      }
    });
  }

  onBackground(): void {
    ReaderRuntimeOwner.current().flush().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core storage flush failed: %{public}s', error.message);
    });
  }

  onDestroy(): void {
    ReaderRuntimeOwner.current().close().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core close failed: %{public}s', error.message);
    });
  }
}
