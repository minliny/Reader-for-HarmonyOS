import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { readerEmptyPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { SyncPage } from './SyncPage';
import { SyncPresentation } from '../presentation/SyncPresentation';

@Component
export struct SyncSurface {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @ObjectLink presentation: SyncPresentation;
  @Prop expandedLayout: boolean = false;
  identity: string = '';
  onBack: () => void = (): void => {};

  build() {
    if (this.presentation.ready) {
      SyncPage({
        snapshot: this.presentation.snapshot,
        expandedLayout: this.expandedLayout,
        onBack: (): void => { if (this.presentation.operations(this.identity) !== undefined) this.onBack(); },
        onReconcile: (expected: number): void => this.presentation.operations(this.identity)?.reconcile(expected),
        onSkipBackupRetention: (expected: number): void => this.presentation.operations(this.identity)?.skipBackupRetention(expected),
        onContinueConfigSave: (expected: number, url: string, user: string, pass: string, backupPass: string, directory: string): void =>
          this.presentation.operations(this.identity)?.continueConfigSave(expected, url, user, pass, backupPass, directory),
        onSaveConfig: (url: string, user: string, pass: string, backupPass: string, path: string): void =>
          this.presentation.operations(this.identity)?.saveConfig(url, user, pass, backupPass, path),
        onTestConnection: (url: string, user: string, pass: string, path: string): void =>
          this.presentation.operations(this.identity)?.testConnection(url, user, pass, path),
        onTriggerBackup: (): void => this.presentation.operations(this.identity)?.triggerBackup(),
        onRestoreLatest: (): void => this.presentation.operations(this.identity)?.restoreLatest(),
        onResolveRestore: (overwriteLocal: boolean): void => this.presentation.operations(this.identity)?.resolveRestore(overwriteLocal),
      });
    } else {
      ReaderPageScaffold({ frameStyle: this.preparingFrame(), geometry: readerEmptyPageGeometry(),
        content: (): void => { this.preparingContent(); } });
    }
  }

  private preparingFrame(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.scheme);
    return readerFrameStyle({ backgroundColor: pageBackground,
      headerBackground: readerAppColor('TOK_SURFACE_SOLID', this.scheme), footerBackground: pageBackground });
  }

  @Builder
  private preparingContent() {
    Column() { Text('正在读取安全配置…'); }
    .width('100%').height('100%').justifyContent(FlexAlign.Center);
  }
}
