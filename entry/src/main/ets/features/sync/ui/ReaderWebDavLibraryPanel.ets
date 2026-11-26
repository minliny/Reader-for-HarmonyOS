import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { resolveReaderButtonMatrixPaint } from '../../../ui/controls/ReaderControlSpecs';
import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import { ReaderSectionHeading } from '../../../ui/controls/ReaderSectionHeading';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { TOK_SPACE_SM } from '../../../ui/foundation/ReaderTokens';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderNativeAlertOwner, type ReaderNativeAlertOptions } from '../../../ui/platform/ReaderNativeAlertOwner';
import { LocalRecoveryGateway } from '../../bookshelf/application/LocalRecoveryGateway';
import { CategorySection } from '../../settings/ui/CategorySection';
import { SyncGateway, type SyncLibraryBackupResult } from '../application/SyncGateway';

type LibraryAction = 'saveConfig' | 'export' | 'cleanup' | 'inspect' | 'apply';

@Component
export struct ReaderWebDavLibraryPanel {
  @Prop @Watch('refreshOpening') navigationGeneration: number = 0;
  isInputAllowed: () => boolean = (): boolean => false;
  onRestoreStateChanged: () => void = (): void => {};
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @State private url: string = '';
  @State private user: string = '';
  @State private password: string = '';
  @State private backupPassword: string = '';
  @State private directory: string = '';
  @State private configured: boolean = false;
  @State private editing: boolean = false;
  @State private includeOriginals: boolean = false;
  @State private pending: boolean = false;
  @State private cleanupReceipt: string = '';
  @State private readOnly: boolean = false;
  @State private loading: boolean = true;
  @State private loadError: boolean = false;
  @State private active: LibraryAction | undefined = undefined;
  @State private preview: SyncLibraryBackupResult | undefined = undefined;
  private mounted: boolean = false;
  private revision: number = 0;
  private confirmationOpen: boolean = false;
  private readonly gateway: SyncGateway = new SyncGateway();
  private readonly recovery: LocalRecoveryGateway = new LocalRecoveryGateway();
  private readonly alert: ReaderNativeAlertOwner = new ReaderNativeAlertOwner();
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();

  aboutToAppear(): void { this.mounted = true; this.refreshOpening(); }
  aboutToDisappear(): void { this.mounted = false; this.retireOpening(); }

  private retireOpening(): void {
    this.revision++;
    this.alert.retire();
    this.feedback.reset();
    this.confirmationOpen = false;
    this.active = undefined;
    this.preview = undefined;
    this.editing = false;
    this.readOnly = false;
    this.password = '';
    this.backupPassword = '';
    this.gateway.cancelLibraryPreview(this.recovery);
  }

  private refreshOpening(): void {
    if (!this.mounted) return;
    this.retireOpening();
    void this.readConfiguration(this.revision);
  }

  private current(revision: number): boolean { return this.mounted && this.revision === revision; }

  private canAct(): boolean {
    return this.mounted && this.isInputAllowed() && !this.loading && this.active === undefined && !this.confirmationOpen;
  }

  private async readConfiguration(revision: number): Promise<void> {
    this.loading = true;
    this.loadError = false;
    try {
      const state = await this.gateway.libraryBackupConfiguration();
      if (!this.current(revision)) return;
      this.url = state.url;
      this.user = state.user;
      this.directory = state.directory;
      this.configured = state.configured;
      this.pending = state.pendingPublication;
      this.cleanupReceipt = state.cleanupReceipt ?? '';
    } catch (_) {
      if (this.current(revision)) this.loadError = true;
    } finally {
      if (this.current(revision)) this.loading = false;
    }
  }

  private async run(action: LibraryAction): Promise<void> {
    if (!this.canAct() || (action === 'apply') !== (this.preview !== undefined)) return;
    if (action === 'saveConfig' && (!this.editing || this.url.trim().length === 0)) return;
    if (action !== 'saveConfig' && (!this.configured || this.editing)) return;
    if (action === 'cleanup' && this.cleanupReceipt.length === 0) return;
    const revision = ++this.revision;
    const current = (): boolean => this.current(revision) && this.isInputAllowed();
    this.active = action;
    this.feedback.reset();
    let outcome: SyncLibraryBackupResult = { state: 'failed' };
    try {
      if (action === 'saveConfig') {
        const saved = await this.gateway.saveConfig(this.url, this.user, this.password, this.backupPassword, this.directory,
          undefined, current);
        if (this.current(revision) && saved.ok) {
          this.editing = false;
          this.readOnly = false;
        }
        if (this.current(revision)) {
          this.password = '';
          this.backupPassword = '';
          this.showMessage(saved.ok ? 'WebDAV 配置已保存' : 'WebDAV 配置未保存，请核对 HTTPS 地址、账号及备份密码', current);
        }
      } else if (action === 'export' || action === 'cleanup') {
        outcome = await this.gateway.backupLibrary(this.recovery, this.includeOriginals, current,
          action === 'cleanup' ? this.cleanupReceipt : undefined);
      } else if (action === 'inspect') outcome = await this.gateway.previewLibraryBackup(this.recovery, current);
      else outcome = await this.gateway.restoreLibraryBackup(this.recovery, current);
    } catch (_) { /* Outcome stays failed for the current owner. */ }
    if (!this.current(revision)) return;
    this.active = undefined;
    if (outcome.state === 'preview') {
      this.preview = outcome;
      return;
    }
    this.preview = undefined;
    if (outcome.state === 'readOnly') this.readOnly = true;
    if (action === 'apply' || outcome.state === 'interrupted') this.onRestoreStateChanged();
    if (action !== 'saveConfig') {
      this.showMessage(action === 'cleanup' && outcome.state === 'exported' ? '本机暂存已清理' : this.outcomeMessage(outcome), current);
    }
    if (action === 'export' || action === 'cleanup' || action === 'saveConfig') {
      if (!this.editing) await this.readConfiguration(revision);
    }
  }

  private outcomeMessage(outcome: SyncLibraryBackupResult): string {
    switch (outcome.state) {
      case 'exported': return '新备份已上传并完成回读校验，旧备份已保留';
      case 'cleanupPending': return '远端备份已完成回读校验，本机暂存待清理';
      case 'restored': return '阅读库已恢复';
      case 'cancelled': return '已取消 WebDAV 操作';
      case 'notConfigured': return '请先保存 WebDAV 配置';
      case 'authentication': return 'WebDAV 认证失效，请更新账号和密码';
      case 'readOnly': return 'WebDAV 缺少可靠的条件写入，仍可读取已有备份';
      case 'empty': return '该 WebDAV 目录暂无可恢复的 Reader 书库备份';
      case 'missingDirectory': return 'WebDAV 备份目录不存在，请核对配置';
      case 'providerChanged': return 'WebDAV 配置已变更，请重新选择备份';
      case 'conflict': return '远端内容与本次备份冲突，已有文件已保留';
      case 'unconfirmed': return '远端写入尚未确认，请核对此次备份';
      case 'tooLarge': return '备份超过大小限制';
      case 'rejected': return '备份校验未通过，请核对密码和文件完整性';
      case 'interrupted': return '请在本地备份与恢复中核对未完成的恢复';
      default: return 'WebDAV 操作未完成，请重试';
    }
  }

  private showMessage(message: string, current: () => boolean): void {
    this.feedback.show(() => this.getUIContext(), { message }, current);
  }

  private cancelPreview(): void {
    if (!this.canAct() || this.preview === undefined) return;
    this.gateway.cancelLibraryPreview(this.recovery);
    this.preview = undefined;
  }

  private requestRestore(): void {
    if (!this.canAct() || this.preview === undefined) return;
    const revision = this.revision;
    const current = (): boolean => this.current(revision) && this.isInputAllowed() && this.preview !== undefined;
    this.confirmationOpen = true;
    try {
      const paint = resolveReaderButtonMatrixPaint('primary', true);
      const decision = this.alert.present((options: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(options),
        'confirmation-cancelable', {
          title: '从 WebDAV 恢复阅读库',
          message: '已校验的备份将替换当前阅读库。导入的联网书源和自动更新需重新启用。',
          primaryButton: { value: '取消', action: (): void => {} },
          secondaryButton: { value: '替换并恢复', style: DialogButtonStyle.HIGHLIGHT,
            backgroundColor: readerAppColor(paint.surface, this.scheme), fontColor: readerAppColor(paint.ink, this.scheme),
            action: (): void => {
              this.confirmationOpen = false;
              if (current()) void this.run('apply');
            } },
        }, current);
      void decision.decision.then((result): void => {
        if (!current()) return;
        this.confirmationOpen = false;
        if (result === 'native-failure') this.showMessage('暂时无法确认恢复，请重试', current);
      });
    } catch (_) {
      this.confirmationOpen = false;
      if (current()) this.showMessage('暂时无法确认恢复，请重试', current);
    }
  }

  @Builder
  private field(label: string, text: string, secret: boolean, change: (value: string) => void) {
    ReaderFormRow({ kind: 'standard', label, contentMinWidth: 156 }) {
      ReaderFormField({ scheme: this.scheme, specId: 'sync-credential', text, password: secret,
        fieldAccessibilityLabel: label, isEditable: this.active === undefined, onTextChange: change });
    }
  }

  @Builder
  private configuration() {
    this.field('HTTPS 地址', this.url, false, (value: string): void => { if (this.canAct()) this.url = value; });
    this.field('账号', this.user, false, (value: string): void => { if (this.canAct()) this.user = value; });
    this.field('密码', this.password, true, (value: string): void => { if (this.canAct()) this.password = value; });
    this.field('备份加密密码', this.backupPassword, true, (value: string): void => { if (this.canAct()) this.backupPassword = value; });
    this.field('备份目录', this.directory, false, (value: string): void => { if (this.canAct()) this.directory = value; });
    Row({ space: TOK_SPACE_SM }) {
      ReaderButton({ scheme: this.scheme, variant: 'subtle', label: '取消', layout: 'equal',
        onAction: (): void => { if (this.canAct()) this.refreshOpening(); } });
      ReaderButton({ scheme: this.scheme, variant: 'primary', label: '保存配置', layout: 'equal',
        onAction: (): void => { void this.run('saveConfig'); } });
    }.width('100%').padding(TOK_SPACE_SM);
  }

  @Builder
  private pendingNotice() {
    ReaderRecoveryNotice({ tag: this.cleanupReceipt.length > 0 ? '本机暂存待清理' : '备份待核对',
      actionLabel: this.cleanupReceipt.length > 0 ? '清理本机暂存' : '核对此次备份',
      view: { visible: true, canRetry: true, generation: this.revision,
        message: this.cleanupReceipt.length > 0 ? '远端备份已回读确认。' : '将核对原备份，有缺失时继续上传同一份加密内容。' },
      onReconcile: (expected: number): void => {
        if (this.current(expected)) void this.run(this.cleanupReceipt.length > 0 ? 'cleanup' : 'export');
      } });
  }

  @Builder
  private processing() {
    ReaderPageState({ variant: 'inline', padded: false, loading: true,
      title: this.loading ? '正在读取 WebDAV 配置…' : this.active === 'saveConfig' ? '正在保存 WebDAV 配置…' :
        this.active === 'export' ? '正在上传和核对备份…' : this.active === 'cleanup' ? '正在清理本机暂存…' :
          this.active === 'inspect' ? '正在下载和校验备份…' : '正在恢复阅读库…' });
  }

  @Builder
  private statusReadFailed() {
    ReaderPageState({ variant: 'inline', padded: false, title: 'WebDAV 配置暂时无法读取', actionLabel: '重试',
      actionGeneration: this.revision, onAction: (expected: number): void => {
        if (this.current(expected) && this.canAct()) void this.readConfiguration(expected);
      } });
  }

  @Builder
  private actions() {
    if (this.preview !== undefined) {
      ReaderFormRow({ kind: 'standard', label: '备份校验完成',
        secondaryText: `包含原书 ${this.preview.included ?? 0} 本，缺少原书 ${this.preview.missing ?? 0} 本` });
      Row({ space: TOK_SPACE_SM }) {
        ReaderButton({ scheme: this.scheme, variant: 'subtle', label: '取消', layout: 'equal',
          onAction: (): void => this.cancelPreview() });
        ReaderButton({ scheme: this.scheme, variant: 'primary', label: '恢复…', layout: 'equal',
          onAction: (): void => this.requestRestore() });
      }.width('100%').padding(TOK_SPACE_SM);
    } else {
      ReaderFormRow({ label: this.configured ? '编辑 WebDAV 配置' : '配置 WebDAV', disclosure: true,
        onAction: (): void => { if (this.canAct()) this.editing = true; } });
      if (this.configured) {
        if (this.cleanupReceipt.length > 0 || (this.pending && !this.readOnly)) {
          Column() { this.pendingNotice(); }.width('100%').padding(TOK_SPACE_SM);
        } else if (this.readOnly) {
          ReaderFormRow({ label: '远端仅可读取', secondaryText: '可读取已有备份。' });
        } else {
          ReaderFormRow({ label: '包含本地原书', secondaryText: '默认只备份书架、进度、书签、笔记和配置。' }) {
            ReaderToggle({ value: this.includeOriginals, specId: 'standard-toggle', accessibilityLabel: '包含本地原书',
              actionEnabled: this.isInputAllowed(), onToggle: (value: boolean): void => {
                if (this.canAct()) this.includeOriginals = value;
              } });
          }
        }
        Row({ space: TOK_SPACE_SM }) {
          if (!this.pending && this.cleanupReceipt.length === 0 && !this.readOnly) {
            ReaderButton({ scheme: this.scheme, variant: 'tonal', label: '备份到 WebDAV', layout: 'equal',
              onAction: (): void => { void this.run('export'); } });
          }
          ReaderButton({ scheme: this.scheme, variant: 'tonal', label: '读取最新备份', layout: 'equal',
            onAction: (): void => { void this.run('inspect'); } });
        }.width('100%').padding(TOK_SPACE_SM);
      }
    }
  }

  build() {
    CategorySection({ title: '' }) {
      Column() { ReaderSectionHeading({ title: 'WebDAV 书库备份', variant: 'tool-card' }); }.width('100%').padding(TOK_SPACE_SM);
      if (this.loading || this.active !== undefined) {
        Column() { this.processing(); }.width('100%').padding(TOK_SPACE_SM);
      } else if (this.loadError) {
        Column() { this.statusReadFailed(); }.width('100%').padding(TOK_SPACE_SM);
      } else if (this.editing) {
        this.configuration();
      } else {
        this.actions();
      }
    }
  }
}
