import { ReaderStartupContentOwner, ReaderStartupContentState } from '../app/ReaderStartupContentOwner';
import { ReaderPageState } from '../features/common/ReaderPageState';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { readerAppColor } from '../features/common/ReaderThemeRegistry';
import { TYPE_APP_BODY, TYPE_SHELF_STATE_TITLE } from '../features/common/ReaderTypography';

/** Minimal host when Index itself cannot be mounted. It uses the existing
 * error typography/action family and never reads or resets user data. */
@Entry
@Component
struct ReaderStartupRecovery {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @State private state: ReaderStartupContentState = { phase: 'recovery-loading', reason: 'admission-pending', canRetry: false };
  private owner: ReaderStartupContentOwner | undefined = undefined;
  private unsubscribe: (() => void) | undefined = undefined;

  aboutToAppear(): void {
    this.owner = ReaderStartupContentOwner.current();
    this.unsubscribe = this.owner?.subscribe((state: ReaderStartupContentState): void => { this.state = state; });
  }
  aboutToDisappear(): void { this.unsubscribe?.(); this.unsubscribe = undefined; }
  onBackPress(): boolean { void this.owner?.exit(); return true; }
  build() {
    Scroll() {
      Column() {
        ReaderPageState({ title: this.title(), message: this.message(),
          loading: !this.state.canRetry, actionLabel: this.state.canRetry ? '重试' : '',
          onAction: (): void => this.owner?.retry(), secondaryActionLabel: this.state.canRetry ? '退出应用' : '',
          onSecondaryAction: (): void => { void this.owner?.exit(); } });
      }.width('100%').constraintSize({ minHeight: this.availableHeight() })
        .justifyContent(FlexAlign.Center).padding(24);
    }.width('100%').height('100%').scrollBar(BarState.Off)
      .backgroundColor(readerAppColor('app.window.background', this.scheme));
  }
  private availableHeight(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(0, metrics.windowRect.height - metrics.systemInsets.top - metrics.systemInsets.bottom);
  }

  private title(): string { return this.state.reason === 'admission-pending' ? '启动尚未完成' : '应用启动失败'; }
  private message(): string {
    if (this.state.reason === 'admission-pending') return '初始化或数据恢复仍在等待。可以稍后重试，或退出应用。';
    if (this.state.reason === 'exit-failed') return '退出未完成，请重试或使用系统返回操作。';
    return '无法完成应用初始化。请重试；现有数据会保留。';
  }
}
