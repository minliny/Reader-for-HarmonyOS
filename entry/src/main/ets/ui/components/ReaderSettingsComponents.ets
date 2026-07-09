// ReaderSettingsComponents — settings panel + full settings page.
// 对应 B 的 03b-reader-settings.css (设置完整页).
// Split from ReaderOverlayComponents.ets; barrel re-exports kept for back-compat.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderModulePanelShell, ReaderLiveOptionRow } from './ReaderControlComponents';
import { ReaderFullPanelShell, ReaderFullBlock, ReaderFullChoiceRow, ReaderFullToggleRow } from './ReaderFullpageComponents';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { MotionAdapter } from '../adapters/MotionAdapter';

// ── Settings panel (.fd-reader-settings-panel) ────────────────────────────
@Component
export struct ReaderSettingsPanel {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp('reader.autoPageSession.playing') autoPagePlaying: boolean = false;
  @StorageProp('reader.readerSettingOptions.tapMode') tapMode: string = 'left';
  @StorageProp('reader.readerToggles.volumePage') volumePage: boolean = true;
  @StorageProp('reader.readerSettingOptions.pageAnimation') pageAnimation: string = 'slide';
  @StorageProp('reader.readerToggles.landscapeLock') landscapeLock: boolean = false;
  @StorageProp('reader.readerToggles.keepScreenOn') keepScreenOn: boolean = true;
  @StorageProp('reader.readerToggles.statusInfo') statusInfo: boolean = true;
  @StorageProp('reader.readerToggles.hapticFeedback') hapticFeedback: boolean = false;
  @StorageProp('reader.readerToggles.cacheNext') cacheNext: boolean = true;

  private tapModeLabel(): string {
    if (this.tapMode === 'middle') return '全屏点击';
    if (this.tapMode === 'right') return '上下区域';
    return '左右区域';
  }

  private pageAnimationLabel(): string {
    if (this.pageAnimation === 'none') return '无动画';
    if (this.pageAnimation === 'simulation') return '覆盖';
    return '平滑';
  }

  private cycleTapMode(): void {
    if (this.tapMode === 'left') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'tapMode', optionValue: 'middle' });
    } else if (this.tapMode === 'middle') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'tapMode', optionValue: 'right' });
    } else {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'tapMode', optionValue: 'left' });
    }
  }

  private cyclePageAnimation(): void {
    if (this.pageAnimation === 'slide') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: 'simulation' });
    } else if (this.pageAnimation === 'simulation') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: 'none' });
    } else {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: 'slide' });
    }
  }

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Scroll() {
        Column() {
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_refresh_dark'), title: '自动翻页', active: this.autoPagePlaying, switchRow: true })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('toggle.switch', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_gesture_dark'), title: '点击翻页方式', value: this.tapModeLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleTapMode();
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_volume_dark'), title: '音量键翻页', active: this.volumePage, switchRow: true })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('toggle.switch', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'volumePage', toggleValue: !this.volumePage });
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_file_dark'), title: '翻页动画', value: this.pageAnimationLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cyclePageAnimation();
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_permission_dark'), title: '横屏锁定', active: this.landscapeLock, switchRow: true })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('toggle.switch', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'landscapeLock', toggleValue: !this.landscapeLock });
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_sun_dark'), title: '屏幕常亮', active: this.keepScreenOn, switchRow: true })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('toggle.switch', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'keepScreenOn', toggleValue: !this.keepScreenOn });
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_progress_dark'), title: '页脚进度信息', active: this.statusInfo, switchRow: true })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('toggle.switch', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'statusInfo', toggleValue: !this.statusInfo });
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_gesture_dark'), title: '触摸反馈', active: this.hapticFeedback, switchRow: true })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('toggle.switch', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'hapticFeedback', toggleValue: !this.hapticFeedback });
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_download_dark'), title: '自动缓存后续章节', active: this.cacheNext, switchRow: true })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('toggle.switch', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'cacheNext', toggleValue: !this.cacheNext });
            });
          })
        }
        .width('100%')
      }
      .width('100%')
      .height('100%')
      .clip(true)
      .scrollBar(BarState.Off)
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
    }
  }
}

@Component
export struct ReaderFullSettingsPage {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp('reader.autoPageSession.playing') autoPagePlaying: boolean = false;
  @StorageProp('reader.readerSettingOptions.tapMode') tapMode: string = 'left';
  @StorageProp('reader.readerToggles.volumePage') volumePage: boolean = true;
  @StorageProp('reader.readerSettingOptions.pageAnimation') pageAnimation: string = 'slide';
  @StorageProp('reader.readerToggles.landscapeLock') landscapeLock: boolean = false;
  @StorageProp('reader.readerToggles.keepScreenOn') keepScreenOn: boolean = true;
  @StorageProp('reader.readerToggles.statusInfo') statusInfo: boolean = true;
  @StorageProp('reader.readerToggles.hapticFeedback') hapticFeedback: boolean = false;
  @StorageProp('reader.readerToggles.cacheNext') cacheNext: boolean = true;

  // [icon, title, toggleKey] — autoPage uses auto-page-toggle, others use set-reader-toggle.
  private toggles: Array<[string, string, string]> = [
    ['翻', '自动翻页', 'autoPage'],
    ['音', '音量键翻页', 'volumePage'],
    ['横', '横屏锁定', 'landscapeLock'],
    ['亮', '屏幕常亮', 'keepScreenOn'],
    ['页', '页脚进度信息', 'statusInfo'],
    ['触', '触摸反馈', 'hapticFeedback'],
    ['缓', '自动缓存后续章节', 'cacheNext'],
  ];

  private toggleActive(toggleKey: string): boolean {
    switch (toggleKey) {
      case 'autoPage': return this.autoPagePlaying;
      case 'volumePage': return this.volumePage;
      case 'landscapeLock': return this.landscapeLock;
      case 'keepScreenOn': return this.keepScreenOn;
      case 'statusInfo': return this.statusInfo;
      case 'hapticFeedback': return this.hapticFeedback;
      case 'cacheNext': return this.cacheNext;
      default: return false;
    }
  }

  private dispatchToggle(toggleKey: string): void {
    switch (toggleKey) {
      case 'autoPage':
        ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
        break;
      case 'volumePage':
        ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'volumePage', toggleValue: !this.volumePage });
        break;
      case 'landscapeLock':
        ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'landscapeLock', toggleValue: !this.landscapeLock });
        break;
      case 'keepScreenOn':
        ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'keepScreenOn', toggleValue: !this.keepScreenOn });
        break;
      case 'statusInfo':
        ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'statusInfo', toggleValue: !this.statusInfo });
        break;
      case 'hapticFeedback':
        ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'hapticFeedback', toggleValue: !this.hapticFeedback });
        break;
      case 'cacheNext':
        ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'cacheNext', toggleValue: !this.cacheNext });
        break;
      default:
        break;
    }
  }

  private tapModeLabel(): string {
    if (this.tapMode === 'middle') return '全屏点击';
    if (this.tapMode === 'right') return '上下区域';
    return '左右区域';
  }

  private pageAnimationLabel(): string {
    if (this.pageAnimation === 'none') return '无动画';
    if (this.pageAnimation === 'simulation') return '覆盖';
    return '平滑';
  }

  private cycleTapMode(): void {
    if (this.tapMode === 'left') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'tapMode', optionValue: 'middle' });
    } else if (this.tapMode === 'middle') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'tapMode', optionValue: 'right' });
    } else {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'tapMode', optionValue: 'left' });
    }
  }

  private cyclePageAnimation(): void {
    if (this.pageAnimation === 'slide') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: 'simulation' });
    } else if (this.pageAnimation === 'simulation') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: 'none' });
    } else {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: 'slide' });
    }
  }

  build() {
    ReaderFullPanelShell({ title: '设置', quickRoute: 'reader-settings', debugLabel: 'ReaderExpandedPanel' }) {
      Column({ space: 10 }) {
        ReaderFullBlock({ title: '点击翻页方式', meta: this.tapModeLabel() }) {
          Column() {
            ReaderFullChoiceRow({ values: ['左右区域', '全屏点击', '上下区域'], active: this.tapModeLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleTapMode();
            });
          })
        }
        ReaderFullBlock({ title: '翻页动画', meta: this.pageAnimationLabel() }) {
          Column() {
            ReaderFullChoiceRow({ values: ['平滑', '覆盖', '无动画'], active: this.pageAnimationLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cyclePageAnimation();
            });
          })
        }
        ReaderFullBlock({ title: '阅读行为', meta: '开关项' }) {
          Column() {
            ForEach(this.toggles, (item: [string, string, string], i: number) => {
              Column() {
                ReaderFullToggleRow({ icon: item[0], title: item[1], active: this.toggleActive(item[2]) })
              }
              .width('100%')
              .onClick(() => {
                MotionAdapter.apply('toggle.switch', this.reducedMotion, () => {
                  this.dispatchToggle(item[2]);
                });
              })
            }, (item: [string, string, string], i: number) => `${item[1]}-${i}`)
          }
          .width('100%')
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
        }
      }
      .width('100%')
      .height('100%')
      .padding(10)
    }
  }
}
