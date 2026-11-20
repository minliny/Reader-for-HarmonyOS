import { ReaderDialogSurface, DialogActionView } from '../common/ReaderDialogSurface';
import { ReaderFormField } from '../common/ReaderFormField';
import { ReaderPageState } from '../common/ReaderPageState';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { ReaderChoiceRow } from '../common/ReaderChoiceRow';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { ReaderTransientFeedback } from '../common/ReaderTransientFeedback';
import { MESSAGE_BODY, MESSAGE_META } from '../common/ReaderMessageStyle';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderNativeAlertOwner, type ReaderNativeAlertOptions } from '../../app/ReaderNativeAlertOwner';
import { ReaderLibrarySyncGateway } from '../sync/ReaderLibrarySyncGateway';
import type { ReaderLibrarySyncSnapshot, ReaderLibrarySyncConflict, ReaderLibrarySyncCandidate, ReaderLibrarySyncChannel } from '../sync/ReaderLibrarySyncTypes';

@CustomDialog
export struct ReaderLibrarySyncRecoveryDialog {
  controller: CustomDialogController;
  gateway: ReaderLibrarySyncGateway | undefined = undefined;
  isCurrent: () => boolean = (): boolean => false;
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @State private password: string = '';
  @State private snapshot: ReaderLibrarySyncSnapshot = {
    status: 'idle', supported: false, conflicts: [], joinRequired: false, reviewRevision: 0, canRebase: false, canContinueCommit: false, message: '',
  };
  @State private visibleConflictCount: number = 20;
  private mounted: boolean = false;
  private unsubscribe: (() => void) | undefined;
  private readonly confirmation: ReaderNativeAlertOwner = new ReaderNativeAlertOwner();
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  aboutToAppear(): void {
    this.mounted = true;
    this.snapshot = this.gateway?.snapshot() ?? this.snapshot;
    this.unsubscribe = this.gateway?.subscribe((): void => this.changed());
    void this.gateway?.open((): boolean => this.owns());
  }
  aboutToDisappear(): void {
    this.mounted = false; this.password = ''; this.confirmation.retire();
    this.unsubscribe?.(); this.unsubscribe = undefined; this.feedback.reset(); this.gateway?.retire();
  }
  private owns(): boolean { try { return this.mounted && this.isCurrent(); } catch (_) { return false; } }
  private changed(): void {
    if (!this.owns() || this.gateway === undefined) return;
    const previous = this.snapshot; this.snapshot = this.gateway.snapshot();
    if (previous.operationId !== this.snapshot.operationId) this.visibleConflictCount = 20;
    if (this.snapshot.status === 'completed' && previous.status !== 'completed') {
      const operationId = this.snapshot.operationId;
      this.feedback.show(() => this.getUIContext(), { message: this.snapshot.message }, (): boolean =>
        this.owns() && this.gateway?.snapshot().status === 'completed' && this.gateway?.snapshot().operationId === operationId);
    }
  }
  private close(): void { this.password = ''; this.confirmation.retire(); this.gateway?.retire(); this.controller.close(); }
  private prepare(): void {
    if (!this.owns() || this.gateway?.canPrepare() !== true || this.password.length === 0) return;
    const password = this.password; this.password = ''; this.confirmation.retire();
    void this.gateway.prepare(password, (): boolean => this.owns());
  }
  private retryRead(reviewRevision: number): void {
    if (this.snapshot.status === 'failed' && this.snapshot.transport === 'immutableLogV2' && this.snapshot.reviewRevision === reviewRevision)
      this.prepare();
  }
  private reconcile(operationId: string): void {
    if (!this.owns() || this.gateway?.busy() !== false || this.snapshot.operationId !== operationId) return;
    const password = this.password; this.password = ''; this.confirmation.retire();
    void this.gateway.reconcile(operationId, password, (): boolean => this.owns());
  }
  private originalReconcile(operationId: string): () => void { return (): void => this.reconcile(operationId); }
  private requestContinueCommit(operationId: string): void {
    const gateway = this.gateway, revision = this.snapshot.reviewRevision;
    if (!this.owns() || gateway === undefined || gateway.busy() || this.snapshot.operationId !== operationId || !this.snapshot.canContinueCommit) return;
    const current = (): boolean => this.owns() && this.snapshot.operationId === operationId && this.snapshot.reviewRevision === revision &&
      this.snapshot.canContinueCommit && !gateway.busy();
    this.confirmation.present((native: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(native), 'confirmation', {
      title: '继续应用原同步', message: '原版本已确认发布。将继续核对并应用这一原同步，不会重新上传文件。若本机又有变更，会保留变更并要求重新合并。完成后重新打开书架。',
      primaryButton: { value: '取消', action: (): void => {} },
      secondaryButton: { value: '继续原同步', action: (): void => { if (current()) void gateway.continueCommit(operationId, revision, (): boolean => this.owns()); } },
    }, current);
  }
  private originalContinueCommit(operationId: string): () => void { return (): void => this.requestContinueCommit(operationId); }
  private recoverHandoff(): void {
    if (this.owns() && this.gateway?.canRecoverHandoff() === true) void this.gateway.recoverHandoff((): boolean => this.owns());
  }
  private requestRebase(operationId: string): void {
    const gateway = this.gateway, revision = this.snapshot.reviewRevision;
    if (!this.owns() || gateway === undefined || gateway.busy() || this.snapshot.operationId !== operationId ||
      !this.snapshot.canRebase || this.password.length === 0) return;
    const current = (): boolean => this.owns() && this.snapshot.operationId === operationId &&
      this.snapshot.reviewRevision === revision && this.snapshot.canRebase && !gateway.busy();
    this.confirmation.present((native: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(native), 'confirmation', {
      title: '以当前远端重新合并',
      message: '将保留原候选及本机后续变更，与现在读到的远端版本重新合并。若当前未见共享文件，会保留历史并准备新建，不能据此认为原发布失败。旧密文不会重发；合并后还须逐项核对并确认新的发布。',
      primaryButton: { value: '取消', action: (): void => {} },
      secondaryButton: { value: '保留原变更并重新合并', action: (): void => {
        if (!current()) return;
        const password = this.password; this.password = '';
        void gateway.rebase(operationId, password, (): boolean => this.owns());
      } },
    }, current);
  }
  private originalRebase(operationId: string): () => void { return (): void => this.requestRebase(operationId); }
  private sharedLibraryLabel(): string {
    return this.snapshot.channels?.find((channel: ReaderLibrarySyncChannel): boolean => channel.id === this.snapshot.selectedChannel)?.label ?? '所选共享书库';
  }
  private originalChannel(channelId: string, reviewRevision: number): (value: string) => void {
    return (_value: string): void => {
      if (!this.owns() || this.snapshot.reviewRevision !== reviewRevision || this.gateway?.busy() !== false ||
        this.snapshot.status !== 'idle' && this.snapshot.status !== 'failed' ||
        !this.snapshot.channels?.some((channel: ReaderLibrarySyncChannel): boolean => channel.id === channelId)) return;
      this.confirmation.retire();
      this.gateway.chooseChannel(channelId, (): boolean => this.owns());
    };
  }
  private requestConfirm(): void {
    const operationId = this.snapshot.operationId, revision = this.snapshot.reviewRevision, gateway = this.gateway;
    if (!this.owns() || gateway === undefined || operationId === undefined || !gateway.canConfirm(operationId, revision, this.password.length > 0)) return;
    const current = (): boolean => this.owns() && this.snapshot.operationId === operationId &&
      this.snapshot.reviewRevision === revision && gateway.canConfirm(operationId, revision, this.password.length > 0);
    this.confirmation.present((native: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(native), 'confirmation', {
      title: '确认原操作的重合并结果',
      message: '将沿原操作与原连接继续合并已核对的变更。' +
        '阅读位置不会简单取最大章节；冲突按逐项选择处理，删除记录会保留以避免旧副本复活。' +
        '此同步不传本机凭据、文件授权或缓存；原书通过已有恢复包或手动选择补回。' +
        (this.snapshot.transport === 'immutableLogV2' ? '确认后会整理已合并的旧同步记录，不影响备份文件；未纳入本次合并的其他设备记录会保留。' : '') +
        '确认后会重新打开书架。',
      primaryButton: { value: '取消', action: (): void => {} },
      secondaryButton: { value: '确认同步', action: (): void => {
        if (current()) { const password = this.password; this.password = ''; void gateway.confirm(operationId, revision, password, (): boolean => this.owns()); }
      } },
    }, current);
  }
  private actions(): DialogActionView[] {
    const close = new DialogActionView('close', '关闭');
    if (this.snapshot.status === 'review') return [close, new DialogActionView('confirm', '核对并同步…', 'primary',
      this.gateway?.canConfirm(this.snapshot.operationId ?? '', this.snapshot.reviewRevision, this.password.length > 0) === true)];
    if (this.snapshot.status === 'pending' || this.snapshot.status === 'unavailable' ||
      this.snapshot.status === 'failed' && this.snapshot.transport === 'immutableLogV2') return [close];
    return [close];
  }
  @Builder private line(value: string) {
    Text(value).width('100%').fontFamily(MESSAGE_BODY.fontFamily).fontSize(MESSAGE_BODY.fontSizeFp)
      .fontColor(readerAppColor('TOK_MESSAGE_INK', this.scheme));
  }
  @Builder private dynamicLine(read: () => string) {
    Text(read()).width('100%').fontFamily(MESSAGE_BODY.fontFamily).fontSize(MESSAGE_BODY.fontSizeFp)
      .fontColor(readerAppColor('TOK_MESSAGE_INK', this.scheme));
  }
  private conflict(key: string): ReaderLibrarySyncConflict | undefined { return this.snapshot.conflicts.find((row: ReaderLibrarySyncConflict): boolean => row.key === key); }
  private originalChoice(operationId: string, _reviewRevision: number, key: string, choice: string): (value: string) => void {
    return (_value: string): void => {
      // The gateway advances reviewRevision after every choice. Rows are
      // keyed by candidate and may be reused by ForEach, so a callback that
      // captures the build-time revision rejects every later choice. Read the
      // live revision at the tap boundary while retaining the operation guard.
      const revision = this.snapshot.reviewRevision;
      if (this.owns() && this.snapshot.status === 'review' && this.snapshot.operationId === operationId)
        this.gateway?.choose(operationId, key, choice, (): boolean => this.owns(), revision);
    };
  }
  @Builder private conflictContent(key: string) {
    Column({ space: 4 }) {
      this.dynamicLine((): string => this.conflict(key)?.label ?? '书库记录');
      ForEach(this.conflict(key)?.candidates ?? [], (candidate: ReaderLibrarySyncCandidate): void => {
        ReaderChoiceRow({ label: `${candidate.label}：${candidate.summary}`, scheme: this.scheme, wrapLabel: true,
          selected: this.conflict(key)?.decision === candidate.choice,
          actionEnabled: this.gateway?.busy() === false,
          onChoose: this.originalChoice(this.snapshot.operationId ?? '', this.snapshot.reviewRevision, key, candidate.choice) });
      }, (candidate: ReaderLibrarySyncCandidate): string => candidate.choice);
    }.width('100%');
  }
  @Builder private review() {
    Column({ space: 12 }) {
      if (this.snapshot.transport === 'immutableLogV2' && this.snapshot.selectedChannel !== undefined)
        this.dynamicLine((): string => `共享书库：${this.sharedLibraryLabel()}`);
      this.dynamicLine((): string => `书籍 ${this.snapshot.counts?.books ?? 0} · 阅读位置 ${this.snapshot.counts?.positions ?? 0} · 书签与笔记 ${this.snapshot.counts?.marks ?? 0}`);
      this.dynamicLine((): string => `记录 ${this.snapshot.counts?.records ?? 0} · 删除记录 ${this.snapshot.counts?.deleted ?? 0} · 冲突 ${this.snapshot.conflicts.length}`);

      this.dynamicLine((): string => this.snapshot.message);
      ForEach(this.snapshot.conflicts.slice(0, this.visibleConflictCount), (row: ReaderLibrarySyncConflict): void => {
        this.conflictContent(row.key);
      }, (row: ReaderLibrarySyncConflict): string => row.key);
      if (this.visibleConflictCount < this.snapshot.conflicts.length) {
        ReaderRecoveryAction({ label: '显示更多冲突', generation: this.snapshot.reviewRevision,
          actionEnabled: this.gateway?.busy() === false, onReconcile: (): void => {
            if (this.owns()) this.visibleConflictCount = Math.min(this.snapshot.conflicts.length, this.visibleConflictCount + 20);
          } });
      }
    }.width('100%');
  }
  @Builder private channels() {
    if ((this.snapshot.channels?.length ?? 0) > 1 && (this.snapshot.status === 'idle' || this.snapshot.status === 'failed')) {
      Column({ space: 8 }) {
        this.line('存储中有多个共享书库。请选择要同步的书库，再读取并核对；不会自动合并不同书库。');
        ForEach(this.snapshot.channels ?? [], (channel: ReaderLibrarySyncChannel): void => {
          ReaderChoiceRow({ label: channel.label, scheme: this.scheme, wrapLabel: true,
            selected: this.snapshot.selectedChannel === channel.id,
            actionEnabled: this.gateway?.busy() === false,
            onChoose: this.originalChannel(channel.id, this.snapshot.reviewRevision) });
        }, (channel: ReaderLibrarySyncChannel): string => channel.id);
      }.width('100%');
    }
  }
  @Builder private body() {
    Column({ space: 12 }) {
      this.line('仅核对并继续已保存的原同步操作；不会自动重新上传或创建新的同步。');
      if (this.snapshot.transport === 'immutableLogV2')
        this.line('各端通过独立的共享版本合并变更。参与同步的设备均需使用支持此方式的 Reader。');
      if (this.snapshot.transport === 'casV1' && this.snapshot.status === 'pending')
        this.line('正在保留并核对此前的同步。原操作完成前，不会切换同步方式。');

      if (this.snapshot.status !== 'review' || this.gateway?.needsPassword() === true) {
        ReaderFormField({ scheme: this.scheme, specId: 'rules-input', password: true, text: this.password,
          placeholder: '同步加密密码', fieldAccessibilityLabel: '同步加密密码',
          isEditable: this.snapshot.supported && this.gateway?.busy() === false,
          onTextChange: (value: string): void => { if (this.owns() && this.gateway?.busy() === false) this.password = value; } });
      }
      if (this.snapshot.status === 'loading' || this.snapshot.status === 'publishing')
        ReaderPageState({ loading: true, title: this.snapshot.status === 'publishing' ? '正在发布并核对同步…' : '正在读取同步状态…' });
      if (this.snapshot.status === 'review') this.review();
      if (this.snapshot.status === 'pending') {
        if (this.gateway?.canRecoverHandoff() === true) {
          ReaderRecoveryNotice({ tag: '书架交接', actionLabel: '重新打开书架',
            view: { visible: true, message: this.snapshot.message, canRetry: true, generation: 0 }, onReconcile: (): void => this.recoverHandoff() });
        } else {
        ReaderRecoveryNotice({ tag: this.snapshot.canCleanup === true ? '共享版本清理' : '原书库同步',
          actionLabel: this.snapshot.canCleanup === true ? '核对原清理' : '核对原同步',
          view: { visible: true, message: this.snapshot.message, canRetry: this.gateway?.busy() === false, generation: 0 },
          onReconcile: this.originalReconcile(this.snapshot.operationId ?? '') });
        if (this.snapshot.canContinueCommit) {
          ReaderRecoveryAction({ label: '继续应用原同步…', generation: this.snapshot.reviewRevision,
            actionEnabled: this.gateway?.busy() === false, onReconcile: this.originalContinueCommit(this.snapshot.operationId ?? '') });
        }
        if (this.snapshot.canRebase) {
          ReaderRecoveryAction({ label: '以当前远端重新合并…', generation: this.snapshot.reviewRevision,
            actionEnabled: this.gateway?.busy() === false && this.password.length > 0,
            onReconcile: this.originalRebase(this.snapshot.operationId ?? '') });
        }
        }
      }
      if (this.snapshot.status === 'failed' || this.snapshot.status === 'unavailable')
        ReaderPageState({ loading: false, title: this.snapshot.message });
      if (this.snapshot.status === 'failed' && this.snapshot.transport === 'immutableLogV2') {
        ReaderRecoveryAction({ label: '重新读取并核对', generation: this.snapshot.reviewRevision,
          actionEnabled: this.password.length > 0 && this.gateway?.canPrepare() === true,
          onReconcile: (generation: number): void => this.retryRead(generation) });
      }
      if (this.snapshot.status === 'completed') this.dynamicLine((): string => this.snapshot.message);
      Text('原书、漫画缓存和本机平台授权不会自动上传。').width('100%')
        .fontFamily(MESSAGE_META.fontFamily).fontSize(MESSAGE_META.fontSizeFp)
        .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.scheme));
    }.width('100%');
  }
  build() {
    ReaderDialogSurface({ specId: 'json-import', title: '继续原同步', showCloseButton: true, scrollBody: true,
      body: (): void => this.body(), actions: this.actions(),
      onClose: (): void => this.close(), onAction: (id: string): void => {
        if (id === 'prepare') this.prepare(); else if (id === 'confirm') this.requestConfirm(); else this.close();
      } });
  }
}
