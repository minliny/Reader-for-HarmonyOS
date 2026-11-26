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
import { SyncGateway, type SyncLibraryArchiveRow, type SyncLibraryBackupResult, type SyncLibraryRemovalStatus } from '../application/SyncGateway';

type LibraryAction = 'saveConfig' | 'export' | 'cleanup' | 'list' | 'inspect' | 'apply' | 'remove' | 'retireParts' |
  'leaveRetirement';

@Component
export struct ReaderWebDavLibraryPanel {
  @Prop @Watch('refreshOpening') navigationGeneration: number = 0;
  @Prop @Watch('refreshOpening') configurationId: string = '';
  isInputAllowed: () => boolean = (): boolean => false;
  onBusyChange: (busy: boolean) => void = (_busy: boolean): void => {};
  onConfigurationChanged: () => void = (): void => {};
  onRestoreStateChanged: () => void = (): void => {};
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @State private url: string = '';
  @State private user: string = '';
  @State private password: string = '';
  @State private backupPassword: string = '';
  @State private directory: string = '';
  @State private configured: boolean = false;
  @State @Watch('publishBusy') private editing: boolean = false;
  @State private includeOriginals: boolean = false;
  @State private pending: boolean = false;
  @State private publicationUnavailable: boolean = false;
  @State private retirementUnavailable: boolean = false;
  @State private localCleanupPending: boolean = false;
  @State private cleanupReceipt: string = '';
  @State private pendingConfigId: string = '';
  @State private configNeedsOriginal: boolean = false;
  @State private removal: SyncLibraryRemovalStatus | undefined = undefined;
  @State private archives: SyncLibraryArchiveRow[] | undefined = undefined;
  private providerIdentity: string | undefined;
  @State private readOnly: boolean = false;
  @State private deletionUnavailable: boolean = false;
  @State @Watch('publishBusy') private loading: boolean = true;
  @State private loadError: boolean = false;
  @State @Watch('publishBusy') private active: LibraryAction | undefined = undefined;
  @State @Watch('publishBusy') private preview: SyncLibraryBackupResult | undefined = undefined;
  private mounted: boolean = false;
  private openingGeneration: number = 0;
  private revision: number = 0;
  private confirmationOpen: boolean = false;
  private reportedBusy: boolean = false;
  private readonly gateway: SyncGateway = new SyncGateway();
  private readonly recovery: LocalRecoveryGateway = new LocalRecoveryGateway();
  private readonly alert: ReaderNativeAlertOwner = new ReaderNativeAlertOwner();
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();

  aboutToAppear(): void { this.mounted = true; this.refreshOpening(); }
  aboutToDisappear(): void { this.mounted = false; this.retireOpening(); }

  private retireOpening(): void {
    this.openingGeneration++;
    this.revision++;
    this.alert.retire();
    this.feedback.reset();
    this.confirmationOpen = false;
    this.active = undefined;
    this.preview = undefined;
    this.editing = false;
    this.readOnly = false;
    this.deletionUnavailable = false;
    this.localCleanupPending = false;
    this.archives = undefined;
    this.password = '';
    this.backupPassword = '';
    this.gateway.cancelLibraryPreview(this.recovery);
    this.publishBusy();
  }

  private publishBusy(): void {
    const busy = this.mounted && (this.loading || this.editing || this.active !== undefined ||
      this.preview !== undefined || this.confirmationOpen);
    if (busy === this.reportedBusy) return;
    this.reportedBusy = busy;
    this.onBusyChange(busy);
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

  private async readConfiguration(revision: number, preserveDraft: boolean = false): Promise<void> {
    this.loading = true;
    this.loadError = false;
    try {
      const state = await this.gateway.libraryBackupConfiguration();
      if (!this.current(revision)) return;
      if (!preserveDraft) {
        this.url = state.url;
        this.user = state.user;
        this.directory = state.directory;
      }
      this.configured = state.configured;
      if (this.providerIdentity !== state.providerIdentity) {
        this.archives = undefined;
        this.deletionUnavailable = false;
        this.localCleanupPending = false;
      }
      this.providerIdentity = state.providerIdentity;
      this.pending = state.pendingPublication;
      this.publicationUnavailable = state.publicationUnavailable === true;
      this.retirementUnavailable = state.retirementUnavailable === true;
      this.cleanupReceipt = state.cleanupReceipt ?? '';
      this.pendingConfigId = state.pendingConfigId ?? '';
      this.configNeedsOriginal = state.configNeedsOriginal === true;
      this.removal = state.removal;
    } catch (_) {
      if (this.current(revision)) this.loadError = true;
    } finally {
      if (this.current(revision)) this.loading = false;
    }
    if (this.current(revision) && !this.loadError && this.pendingConfigId.length === 0) {
      void this.refreshLocalCleanup(revision);
    }
  }

  private async refreshLocalCleanup(revision: number): Promise<void> {
    const provider = this.providerIdentity;
    if (provider === undefined || !this.current(revision)) return;
    const opening = this.openingGeneration;
    // Reading the remote list or preview advances the action revision only.
    const current = (): boolean => this.mounted && this.openingGeneration === opening && this.isInputAllowed() &&
      this.providerIdentity === provider && !this.editing && !this.loadError && this.pendingConfigId.length === 0;
    if (!current()) return;
    const status = await this.gateway.sweepLibraryPayloads(provider, current);
    if (current()) this.localCleanupPending = status !== 'done';
  }

  private async run(action: LibraryAction, row?: SyncLibraryArchiveRow): Promise<void> {
    if (!this.canAct() || (action === 'apply') !== (this.preview !== undefined)) return;
    if (action === 'saveConfig' && (!this.editing || this.url.trim().length === 0) &&
      (this.pendingConfigId.length === 0 || this.configNeedsOriginal)) return;
    if (action !== 'saveConfig' && (!this.configured || this.editing || this.pendingConfigId.length > 0)) return;
    if ((action === 'export' || action === 'cleanup') && this.publicationUnavailable) return;
    if (action === 'cleanup' && this.cleanupReceipt.length === 0) return;
    if (action === 'remove' && (row === undefined || this.removal !== undefined || this.readOnly || this.deletionUnavailable ||
      this.retirementUnavailable)) return;
    if ((action === 'retireParts' || action === 'leaveRetirement') &&
      (this.removal === undefined || this.retirementUnavailable)) return;
    const revision = ++this.revision;
    const current = (): boolean => this.current(revision) && this.isInputAllowed();
    this.active = action;
    this.feedback.reset();
    let configurationChanged = false;
    let outcome: SyncLibraryBackupResult = { state: 'failed' };
    try {
      if (action === 'saveConfig') {
        const recovering = this.pendingConfigId.length > 0;
        const saved = recovering ?
          await this.gateway.resumeLibraryConfiguration(this.pendingConfigId, current,
            this.url, this.user, this.password, this.backupPassword, this.directory) :
          (await this.gateway.saveConfig(this.url, this.user, this.password, this.backupPassword, this.directory,
            undefined, current)).ok;
        if (this.current(revision) && saved) {
          configurationChanged = true;
          this.editing = false;
          this.readOnly = false;
          this.deletionUnavailable = false;
          this.archives = undefined;
        }
        if (this.current(revision)) {
          this.password = '';
          this.backupPassword = '';
          this.showMessage(saved ? 'WebDAV 配置已保存' :
            recovering ? '原配置尚未恢复，请核对原 HTTPS 地址、账号和密码' :
              'WebDAV 配置未保存，请核对 HTTPS 地址、账号及备份密码', current);
        }
      } else if (action === 'export' || action === 'cleanup') {
        outcome = await this.gateway.backupLibrary(this.recovery, this.includeOriginals, current,
          action === 'cleanup' ? this.cleanupReceipt : undefined);
      } else if (action === 'list') outcome = await this.gateway.listLibraryArchives(current);
      else if (action === 'inspect') outcome = await this.gateway.previewLibraryBackup(this.recovery, current, row);
      else if (action === 'remove' && row !== undefined) outcome = await this.gateway.removeLibraryArchive(row, current);
      else if (action === 'retireParts' && this.removal !== undefined) {
        outcome = await this.gateway.resumeLibraryRetirement(this.removal.receipt, current);
      } else if (action === 'leaveRetirement' && this.removal !== undefined) {
        outcome = await this.gateway.leaveLibraryRetirement(this.removal.receipt, current);
      } else if (action === 'apply') outcome = await this.gateway.restoreLibraryBackup(this.recovery, current);
    } catch (_) { /* Outcome stays failed for the current owner. */ }
    if (!this.current(revision)) return;
    this.active = undefined;
    if (outcome.state === 'preview') {
      this.preview = outcome;
      return;
    }
    if (action === 'list' && outcome.archives !== undefined) this.archives = outcome.archives;
    this.preview = undefined;
    const removal = action === 'remove' || action === 'retireParts';
    if (outcome.state === 'deletionUnavailable') this.deletionUnavailable = true;
    if (outcome.state === 'readOnly') {
      if (removal) this.deletionUnavailable = true;
      else this.readOnly = true;
    }
    if (action === 'apply' || outcome.state === 'interrupted') this.onRestoreStateChanged();
    if (action !== 'saveConfig' && outcome.state !== 'listed') {
      this.showMessage(action === 'cleanup' && outcome.state === 'exported' ? '本机暂存已清理' :
        removal && outcome.state === 'conflict' ? '所选旧包或替代备份已变化，清理未继续' :
          removal && outcome.state === 'readOnly' ? '服务端不支持条件删除，现有备份仍可读取和恢复' : this.outcomeMessage(outcome), current);
    }
    if (action === 'export' || action === 'cleanup' || action === 'saveConfig' || removal || action === 'leaveRetirement') {
      if (!this.editing || action === 'saveConfig') await this.readConfiguration(revision, this.editing);
      if (removal) {
        const refreshed = await this.gateway.listLibraryArchives(current);
        if (this.current(revision) && refreshed.archives !== undefined) this.archives = refreshed.archives;
      } else if (action === 'export' && outcome.state === 'exported' && this.current(revision)) this.archives = undefined;
    }
    if (configurationChanged && current()) this.onConfigurationChanged();
  }

  private outcomeMessage(outcome: SyncLibraryBackupResult): string {
    switch (outcome.state) {
      case 'exported': return '新备份已上传并完成回读校验，旧备份已保留';
      case 'cleanupPending': return '远端备份已完成回读校验，本机暂存待清理';
      case 'retirementPending': return '远端旧包清理待续办，请查看清理状态';
      case 'retirementCompleted': return '所选旧备份已清理';
      case 'retirementAbandoned': return '已放弃本次清理，旧备份仍可读取';
      case 'retirementPaused': return '本次清理已停止，保留了远端现有文件和原清理回执';
      case 'deletionUnavailable': return '服务端不支持条件删除，现有备份仍可读取和恢复';
      case 'cleanupFailed': return '远端旧包清理未完成，可以继续原操作或退出';
      case 'replacementUnverified': return '未能验证可恢复的同库替代备份，清理已暂停。请核对备份口令或远端列表。';
      case 'replacementMissingOriginals': return '替代备份缺少旧备份中的原书，清理已暂停。';
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
    this.publishBusy();
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
              this.publishBusy();
            } },
        }, current);
      void decision.decision.then((result): void => {
        if (!current()) return;
        this.confirmationOpen = false;
        this.publishBusy();
        if (result === 'native-failure') this.showMessage('暂时无法确认恢复，请重试', current);
      });
    } catch (_) {
      this.confirmationOpen = false;
      this.publishBusy();
      if (current()) this.showMessage('暂时无法确认恢复，请重试', current);
    }
  }

  private requestArchiveRemoval(row: SyncLibraryArchiveRow): void {
    if (!this.canAct() || this.preview !== undefined || this.removal !== undefined ||
      this.readOnly || this.deletionUnavailable || this.retirementUnavailable || !row.canDelete) return;
    const revision = this.revision;
    const current = (): boolean => this.current(revision) && this.isInputAllowed() &&
      this.removal === undefined && !this.retirementUnavailable &&
      this.archives?.some((candidate: SyncLibraryArchiveRow): boolean => candidate.sha256 === row.sha256 &&
        candidate.manifestSha256 === row.manifestSha256 && candidate.providerIdentity === row.providerIdentity &&
        candidate.canDelete) === true;
    this.confirmationOpen = true;
    this.publishBusy();
    try {
      const paint = resolveReaderButtonMatrixPaint('danger', true);
      const decision = this.alert.present((options: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(options),
        'confirmation-cancelable', {
          title: '删除所选远端旧备份？',
          message: `${this.archiveDate(row)} · ${this.archiveSize(row)} · ${this.archiveLibrary(row)}。验证同库的新备份可以恢复后再移除所选旧备份，正在读取的设备有 30 分钟完成读取。`,
          primaryButton: { value: '取消', action: (): void => {} },
          secondaryButton: { value: '删除旧备份', style: DialogButtonStyle.HIGHLIGHT,
            backgroundColor: readerAppColor(paint.surface, this.scheme), fontColor: readerAppColor(paint.ink, this.scheme),
            action: (): void => {
              this.confirmationOpen = false;
              if (current()) void this.run('remove', row);
              this.publishBusy();
            } },
        }, current);
      void decision.decision.then((result): void => {
        if (!current()) return;
        this.confirmationOpen = false;
        this.publishBusy();
        if (result === 'native-failure') this.showMessage('暂时无法确认远端清理，请重试', current);
      });
    } catch (_) {
      this.confirmationOpen = false;
      this.publishBusy();
      if (current()) this.showMessage('暂时无法确认远端清理，请重试', current);
    }
  }

  private archiveDate(row: SyncLibraryArchiveRow): string {
    return row.createdAt === undefined ? '时间未知' : new Date(row.createdAt).toLocaleString();
  }

  private archiveSize(row: SyncLibraryArchiveRow): string {
    return row.bytes >= 1024 * 1024 ? `${(row.bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(row.bytes / 1024)} KB`;
  }

  private archiveLibrary(row: SyncLibraryArchiveRow): string {
    return row.library === 'same' ? '本库备份' : row.library === 'other' ? '其他书库' : '书库未知';
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
      ReaderButton({ scheme: this.scheme, variant: 'primary',
        label: this.pendingConfigId.length > 0 ? '续办原配置' : '保存配置', layout: 'equal',
        onAction: (): void => { void this.run('saveConfig'); } });
    }.width('100%').padding(TOK_SPACE_SM);
  }

  @Builder
  private configNotice() {
    ReaderRecoveryNotice({ tag: '配置保存待核对', actionLabel: this.configNeedsOriginal ? '重填原配置' : '续办原配置',
      view: { visible: true, canRetry: true, generation: this.revision,
        message: this.configNeedsOriginal ? '请输入原 HTTPS 地址、目录、账号和密码以继续。' : '从安全存储续办同一次保存。' },
      onReconcile: (expected: number): void => {
        if (!this.current(expected) || !this.canAct()) return;
        if (this.configNeedsOriginal) this.editing = true;
        else void this.run('saveConfig');
      } });
  }

  @Builder
  private retirementNotice() {
    ReaderRecoveryNotice({ tag: '远端旧包清理待续办',
      actionLabel: this.removal?.phase === 'manifest' ? '核对所选旧备份' : '继续清理分片',
      secondaryActionLabel: this.removal?.phase === 'manifest' ? '放弃本次清理' : '退出本次清理',
      view: { visible: true, canRetry: true, generation: this.revision,
        message: this.removal?.phase === 'waiting' ? `为已开始的读取保留分片，预计还需 ${this.removal?.waitMinutes ?? 0} 分钟。` :
          '只续办已确认的旧备份，不重新上传。' },
      onReconcile: (expected: number): void => { if (this.current(expected)) void this.run('retireParts'); },
      onSecondaryAction: (expected: number): void => { if (this.current(expected)) void this.run('leaveRetirement'); } });
  }

  @Builder
  private deletionUnavailableNotice() {
    ReaderRecoveryNotice({ tag: '服务端不支持条件删除',
      view: { visible: true, canRetry: false, generation: this.revision, message: '现有备份仍可读取和恢复。' } });
  }

  @Builder
  private localJournalNotice() {
    ReaderRecoveryNotice({ tag: '本机操作日志待核对', actionLabel: '重新核对日志',
      view: { visible: true, canRetry: true, generation: this.revision,
        message: this.publicationUnavailable && this.retirementUnavailable ? '备份和删除日志暂不可读，远端备份仍可读取。' :
          this.publicationUnavailable ? '备份日志暂不可读，远端备份仍可读取。' : '删除日志暂不可读，远端备份仍可读取。' },
      onReconcile: (expected: number): void => {
        if (this.current(expected) && this.canAct()) void this.readConfiguration(expected);
      } });
  }

  @Builder
  private localCleanupNotice() {
    ReaderRecoveryNotice({ tag: '本机暂存待清理', actionLabel: '重试清理',
      view: { visible: true, canRetry: true, generation: this.revision,
        message: '本机暂存文件暂未清理，远端备份仍可读取。' },
      onReconcile: (expected: number): void => {
        if (this.current(expected) && this.canAct()) void this.refreshLocalCleanup(expected);
      } });
  }

  @Builder
  private archiveList() {
    if (this.archives?.length === 0) {
      ReaderFormRow({ label: '该目录暂无 Reader 书库备份' });
    }
    ForEach(this.archives ?? [], (row: SyncLibraryArchiveRow): void => {
      ReaderFormRow({ kind: 'standard', label: this.archiveDate(row),
        secondaryText: `${this.archiveSize(row)} · ${this.archiveLibrary(row)}${row.latest ? ' · 最新' : ''}` });
      Row({ space: TOK_SPACE_SM }) {
        ReaderButton({ scheme: this.scheme, variant: 'tonal', label: '读取备份', layout: 'equal',
          onAction: (): void => { void this.run('inspect', row); } });
        if (row.canDelete && this.removal === undefined && !this.readOnly && !this.deletionUnavailable && !this.retirementUnavailable) {
          ReaderButton({ scheme: this.scheme, variant: 'subtle', label: '删除旧备份', layout: 'equal',
            onAction: (): void => { this.requestArchiveRemoval(row); } });
        }
      }.width('100%').padding(TOK_SPACE_SM);
    }, (row: SyncLibraryArchiveRow): string => row.sha256);
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
          this.active === 'list' ? '正在读取远端备份列表…' : this.active === 'remove' || this.active === 'retireParts' ?
            '正在核对远端旧备份…' : this.active === 'leaveRetirement' ? '正在退出旧备份清理…' :
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
        if (this.publicationUnavailable || this.retirementUnavailable) {
          Column() { this.localJournalNotice(); }.width('100%').padding(TOK_SPACE_SM);
        }
        if (this.localCleanupPending) {
          Column() { this.localCleanupNotice(); }.width('100%').padding(TOK_SPACE_SM);
        }
        if (this.removal !== undefined && !this.retirementUnavailable) {
          Column() { this.retirementNotice(); }.width('100%').padding(TOK_SPACE_SM);
        }
        if (this.deletionUnavailable) {
          Column() { this.deletionUnavailableNotice(); }.width('100%').padding(TOK_SPACE_SM);
        }
        if (!this.publicationUnavailable && (this.cleanupReceipt.length > 0 || (this.pending && !this.readOnly))) {
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
          if (!this.pending && this.cleanupReceipt.length === 0 && !this.readOnly && !this.publicationUnavailable) {
            ReaderButton({ scheme: this.scheme, variant: 'tonal', label: '备份到 WebDAV', layout: 'equal',
              onAction: (): void => { void this.run('export'); } });
          }
          ReaderButton({ scheme: this.scheme, variant: 'tonal', label: '读取最新备份', layout: 'equal',
            onAction: (): void => { void this.run('inspect'); } });
          ReaderButton({ scheme: this.scheme, variant: 'tonal', label: '远端备份', layout: 'equal',
            onAction: (): void => { void this.run('list'); } });
        }.width('100%').padding(TOK_SPACE_SM);
        if (this.archives !== undefined) this.archiveList();
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
      } else if (this.pendingConfigId.length > 0) {
        Column() { this.configNotice(); }.width('100%').padding(TOK_SPACE_SM);
      } else {
        this.actions();
      }
    }
  }
}
