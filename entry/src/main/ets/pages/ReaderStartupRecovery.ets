import { ReaderStartupContentOwner, ReaderStartupContentState } from '../app/ReaderStartupContentOwner';
import { ReaderPageState } from '../ui/feedback/ReaderPageState';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { readerAppColor } from '../ui/foundation/ReaderThemeRegistry';

/** Minimal host when Index itself cannot be mounted. It uses the existing
 * error typography/action family and never reads or resets user data. */
@Entry
@Component
struct ReaderStartupRecovery {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @State private state: ReaderStartupContentState = { phase: 'recovery-loading', reason: 'admission-pending', canRetry: false };
  @State private publication: number = 0;
  private owner: ReaderStartupContentOwner | undefined = undefined;
  private unsubscribe: (() => void) | undefined = undefined;

  aboutToAppear(): void {
    this.unsubscribe?.();
    const owner = ReaderStartupContentOwner.current();
    this.owner = owner;
    this.unsubscribe = owner?.subscribe((state: ReaderStartupContentState): void => {
      if (this.owner === owner) {
        this.state = state;
        this.publication += 1;
      }
    });
  }
  aboutToDisappear(): void {
    this.owner = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
  onBackPress(): boolean {
    const owner = this.owner;
    if (owner !== undefined && owner === ReaderStartupContentOwner.current()) void owner.exit();
    return true;
  }
  build() {
    Scroll() {
      Column() {
        ForEach([this.publication], (publication: number): void => {
          ReaderPageState({ title: this.title(), message: this.message(),
            loading: !this.state.canRetry, actionLabel: this.state.canRetry ? '重试' : '',
            onAction: this.recoveryAction(publication, false), secondaryActionLabel: this.state.canRetry ? '退出应用' : '',
            onSecondaryAction: this.recoveryAction(publication, true) });
        }, (publication: number): string => publication.toString());
      }.width('100%').constraintSize({ minHeight: this.availableHeight() })
        .justifyContent(FlexAlign.Center).padding(24);
    }.width('100%').height('100%').scrollBar(BarState.Off)
      .backgroundColor(readerAppColor('app.window.background', this.scheme));
  }

  private recoveryAction(publication: number, exit: boolean): () => void {
    const owner = this.owner;
    return (): void => {
      if (!this.state.canRetry || publication !== this.publication || owner === undefined || owner !== this.owner ||
        owner !== ReaderStartupContentOwner.current()) return;
      if (exit) void owner.exit();
      else owner.retry();
    };
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
