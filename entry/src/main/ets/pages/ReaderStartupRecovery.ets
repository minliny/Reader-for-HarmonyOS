import { ReaderStartupContentOwner, ReaderStartupContentState } from '../app/ReaderStartupContentOwner';
import { ReaderRecoveryAction } from '../features/common/ReaderRecoveryAction';
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
    Column({ space: 16 }) {
      Text(this.title()).fontFamily(TYPE_SHELF_STATE_TITLE.fontFamily).fontWeight(TYPE_SHELF_STATE_TITLE.fontWeight)
        .fontSize(TYPE_SHELF_STATE_TITLE.fontSizeFp).lineHeight(TYPE_SHELF_STATE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.scheme)).textAlign(TextAlign.Center);
      Text(this.message()).fontFamily(TYPE_APP_BODY.fontFamily).fontWeight(TYPE_APP_BODY.fontWeight)
        .fontSize(TYPE_APP_BODY.fontSizeFp).lineHeight(TYPE_APP_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.scheme)).textAlign(TextAlign.Center);
      ReaderRecoveryAction({ label: this.state.canRetry ? '重试' : '正在等待…', enabled: this.state.canRetry,
        onReconcile: (): void => this.owner?.retry() });
      ReaderRecoveryAction({ label: '退出应用', enabled: this.state.canRetry,
        onReconcile: (): void => { void this.owner?.exit(); } });
    }.width('100%').height('100%').padding(24)
      .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
      .backgroundColor(readerAppColor('app.window.background', this.scheme));
  }
  private title(): string { return this.state.reason === 'admission-pending' ? '启动尚未完成' : '应用启动失败'; }
  private message(): string {
    if (this.state.reason === 'admission-pending') return '初始化或数据恢复仍在等待。可以稍后重试，或退出应用。';
    if (this.state.reason === 'exit-failed') return '退出未完成，请重试或使用系统返回操作。';
    return '无法完成应用初始化。请重试；现有数据会保留。';
  }
}
