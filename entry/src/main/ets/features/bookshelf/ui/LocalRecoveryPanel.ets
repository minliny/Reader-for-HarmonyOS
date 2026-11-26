import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { resolveReaderButtonMatrixPaint } from '../../../ui/controls/ReaderControlSpecs';
import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import { ReaderSectionHeading } from '../../../ui/controls/ReaderSectionHeading';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { TOK_SPACE_SM } from '../../../ui/foundation/ReaderTokens';
import { ReaderNativeAlertOwner, type ReaderNativeAlertOptions } from '../../../ui/platform/ReaderNativeAlertOwner';
import { CategorySection } from '../../settings/ui/CategorySection';
import { LocalRecoveryGateway, type LocalRecoveryOutcome } from '../application/LocalRecoveryGateway';

type LocalRecoveryAction = 'export' | 'inspect' | 'apply' | 'resume' | 'rollback';
const RECOVERY_PASSPHRASE_WIDTH = 168;

@Component
export struct LocalRecoveryPanel {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop @Watch('refreshOpening') navigationGeneration: number = 0;
  @Prop @Watch('refreshOpening') externalRestoreRevision: number = 0;
  editingHost: ReaderEditingVisibility | undefined = undefined;
  isInputAllowed: () => boolean = (): boolean => true;
  @State private passphrase: string = '';
  @State private checking: boolean = true;
  @State private statusUnavailable: boolean = false;
  @State private pendingRestore: boolean = false;
  @State private rollbackPending: boolean = false;
  @State private systemPending: boolean = false;
  @State private active: LocalRecoveryAction | undefined = undefined;
  @State private preview: LocalRecoveryOutcome | undefined = undefined;
  @State private revision: number = 0;
  private mounted: boolean = false;
  private confirmationOpen: boolean = false;
  private readonly gateway: LocalRecoveryGateway = new LocalRecoveryGateway();
  private readonly alert: ReaderNativeAlertOwner = new ReaderNativeAlertOwner();
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();

  aboutToAppear(): void { this.mounted = true; this.refreshOpening(); }

  aboutToDisappear(): void {
    this.mounted = false;
    this.retireOpening();
  }

  private retireOpening(): void {
    this.revision++;
    this.confirmationOpen = false;
    this.alert.retire();
    this.feedback.reset();
    this.gateway.clearPreview();
    this.preview = undefined;
    this.passphrase = '';
    this.active = undefined;
  }

  private refreshOpening(): void {
    if (!this.mounted) return;
    this.retireOpening();
    void this.readPending();
  }

  private current(revision: number, navigation: number): boolean {
    return this.mounted && this.revision === revision && this.navigationGeneration === navigation;
  }

  private async readPending(): Promise<void> {
    const revision = this.revision, navigation = this.navigationGeneration;
    this.checking = true;
    this.statusUnavailable = false;
    try {
      const pending = await this.gateway.pendingAction();
      if (this.current(revision, navigation)) {
        this.systemPending = pending === 'system';
        this.pendingRestore = pending === 'restore' || pending === 'rollback';
        this.rollbackPending = pending === 'rollback';
      }
    } catch (_) {
      if (this.current(revision, navigation)) this.statusUnavailable = true;
    } finally {
      if (this.current(revision, navigation)) this.checking = false;
    }
  }

  private canStart(revision: number): boolean {
    return this.current(revision, this.navigationGeneration) && this.isInputAllowed() && !this.checking &&
      !this.statusUnavailable && this.active === undefined && this.passphrase.length > 0;
  }

  private clearPreview(revision: number): void {
    if (this.revision !== revision || !this.mounted || !this.isInputAllowed() || this.active !== undefined) return;
    this.revision++;
    this.alert.retire();
    this.gateway.clearPreview();
    this.preview = undefined;
    this.passphrase = '';
  }

  private requestRestore(revision: number, action: 'apply' | 'rollback' = 'apply'): void {
    const navigation = this.navigationGeneration;
    const rollback = action === 'rollback';
    const current = (): boolean => this.current(revision, navigation) && this.canStart(revision) &&
      (rollback ? this.pendingRestore && !this.rollbackPending : this.preview !== undefined);
    if (!current() || this.confirmationOpen) return;
    this.confirmationOpen = true;
    try {
      const paint = resolveReaderButtonMatrixPaint('primary', true);
      const alert = this.alert.present((native: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(native),
        'confirmation-cancelable', {
          title: rollback ? '回退未完成的恢复' : '恢复本地阅读库',
          message: rollback ? '将用恢复前的检查点替换当前阅读库，恢复开始后的变更将被替换。' :
            '恢复包将替换当前阅读库。导入的联网书源和自动更新需重新启用。',
          primaryButton: { value: '取消', action: (): void => {} },
          secondaryButton: { value: rollback ? '回退' : '恢复', style: DialogButtonStyle.HIGHLIGHT,
            backgroundColor: readerAppColor(paint.surface, this.scheme), fontColor: readerAppColor(paint.ink, this.scheme),
            action: (): void => { void this.perform(action, revision); } },
        }, current);
      void alert.decision.then((decision): void => {
        if (!this.current(revision, navigation)) return;
        this.confirmationOpen = false;
        if (decision === 'native-failure' && current()) this.showOutcome(action, { state: 'failed' }, revision, navigation);
      });
    } catch (_) {
      this.confirmationOpen = false;
      if (current()) this.showOutcome(action, { state: 'failed' }, revision, navigation);
    }
  }

  private async perform(action: LocalRecoveryAction, expected: number): Promise<void> {
    if (!this.canStart(expected) || (action === 'resume' || action === 'rollback') !== this.pendingRestore ||
      (action === 'apply') !== (this.preview !== undefined) || (this.systemPending && action !== 'export')) return;
    const revision = ++this.revision, navigation = this.navigationGeneration;
    const current = (): boolean => this.current(revision, navigation);
    const admit = async (): Promise<void> => {
      if (!current() || !this.isInputAllowed()) throw new Error('Local recovery opening retired');
    };
    const passphrase = this.passphrase;
    this.active = action;
    this.confirmationOpen = false;
    this.feedback.reset();
    if (action !== 'inspect') this.passphrase = '';
    let outcome: LocalRecoveryOutcome;
    try {
      if (action === 'export') outcome = await this.gateway.exportPackage(passphrase, current);
      else if (action === 'inspect') outcome = await this.gateway.inspectPackage(passphrase, current);
      else if (action === 'apply') outcome = await this.gateway.applyPackage(passphrase, admit);
      else if (action === 'rollback') outcome = await this.gateway.rollbackPackage(passphrase, admit);
      else outcome = await this.gateway.resumePackage(passphrase, admit);
    } catch (_) {
      outcome = { state: 'failed' };
    }
    if (!current()) return;
    this.active = undefined;
    if (outcome.state === 'preview') {
      this.preview = outcome;
      return;
    }
    this.preview = undefined;
    this.passphrase = '';
    if (outcome.state === 'interrupted' || action === 'apply' || action === 'resume' || action === 'rollback') await this.readPending();
    if (current()) this.showOutcome(action, outcome, revision, navigation);
  }

  private originalCounts(outcome: LocalRecoveryOutcome): string {
    if (outcome.included === undefined || outcome.missing === undefined) return '';
    return `包含原书 ${outcome.included} 本，缺少原书 ${outcome.missing} 本。`;
  }

  private showOutcome(action: LocalRecoveryAction, outcome: LocalRecoveryOutcome, revision: number, navigation: number): void {
    let message: string;
    switch (outcome.state) {
      case 'exported': message = `恢复包已导出。${this.originalCounts(outcome)}`; break;
      case 'restored': message = `阅读库已恢复。${this.originalCounts(outcome)}`; break;
      case 'rolledBack': message = '已回退到恢复前的阅读库'; break;
      case 'cancelled': message = action === 'export' ? '已取消导出' : '已取消选择恢复包'; break;
      case 'rejected': message = '恢复包未通过校验，请核对口令与文件完整性。'; break;
      case 'tooLarge': message = action === 'export' ? '待备份内容超过恢复包大小限制。' : '恢复包超过可导入的大小限制。'; break;
      case 'failed': message = action === 'export' ? '恢复包导出失败，请重试。' : '恢复操作未完成，请重试。'; break;
      default: return;
    }
    this.feedback.show(() => this.getUIContext(), { message },
      (): boolean => this.current(revision, navigation) && this.isInputAllowed());
  }

  @Builder
  private passphraseField(label: string = '恢复包口令') {
    ReaderFormField({ editingHost: this.editingHost, scheme: this.scheme, specId: 'sync-credential', text: this.passphrase, password: true,
      placeholder: label, fieldAccessibilityLabel: label, isEditable: this.active === undefined,
      onTextChange: (value: string): void => {
        if (this.mounted && this.isInputAllowed() && this.active === undefined) this.passphrase = value;
      } });
  }

  @Builder
  private processing() {
    ReaderPageState({ variant: 'inline', padded: false, loading: true,
      title: this.checking ? '正在核对恢复状态…' : this.active === 'export' ? '正在导出恢复包…' :
        this.active === 'inspect' ? '正在隔离校验恢复包…' :
          this.active === 'rollback' || this.rollbackPending ? '正在回退阅读库…' : '正在恢复阅读库…' });
  }

  @Builder
  private statusReadFailed() {
    ReaderPageState({ variant: 'inline', padded: false, title: '恢复状态暂时无法读取',
      actionLabel: '重试', actionGeneration: this.revision, onAction: (expected: number): void => {
        if (this.mounted && this.isInputAllowed() && this.revision === expected && this.statusUnavailable && !this.checking)
          void this.readPending();
      } });
  }

  @Builder
  private resumeControl() {
    ReaderRecoveryNotice({ tag: this.systemPending ? '系统迁移待继续' : this.rollbackPending ? '回退中断' : '恢复中断',
      actionLabel: this.rollbackPending ? '继续回退' : '继续恢复',
      view: { visible: true, canRetry: !this.systemPending, generation: this.revision,
        message: this.systemPending ? '系统迁移将在下次启动继续。可继续导出本地备份。' : this.rollbackPending ?
        '请输入原恢复包口令，继续未完成的回退。' : '请输入原恢复包口令，继续恢复或回退到恢复前。' },
      actionEnabled: !this.systemPending && this.passphrase.length > 0,
      onReconcile: (expected: number): void => { void this.perform('resume', expected); } });
  }

  @Builder
  private actions(expected: number) {
    if (this.preview !== undefined) {
      ReaderFormRow({ kind: 'standard', label: '恢复包校验完成', secondaryText: this.originalCounts(this.preview) });
      Row({ space: TOK_SPACE_SM }) {
        ReaderButton({ scheme: this.scheme, variant: 'subtle', label: '取消', layout: 'equal',
          onAction: (): void => this.clearPreview(expected) });
        ReaderButton({ scheme: this.scheme, variant: 'primary', label: '恢复…', layout: 'equal',
          onAction: (): void => this.requestRestore(expected) });
      }.width('100%').padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, bottom: TOK_SPACE_SM });
    } else {
      if (this.systemPending) {
        Column() { this.resumeControl(); }.width('100%').padding(TOK_SPACE_SM);
      }
      ReaderFormRow({ kind: 'standard', label: this.systemPending ? '导出包口令' : '恢复包口令',
        contentMinWidth: RECOVERY_PASSPHRASE_WIDTH }) {
        Column() { this.passphraseField(this.systemPending ? '导出包口令' : '恢复包口令'); }.width(RECOVERY_PASSPHRASE_WIDTH);
      }
      if (this.pendingRestore) {
        Column() { this.resumeControl(); }.width('100%').padding(TOK_SPACE_SM);
        if (!this.rollbackPending) {
          ReaderButton({ scheme: this.scheme, variant: 'subtle', label: '回退到恢复前…',
            actionEnabled: this.passphrase.length > 0, onAction: (): void => this.requestRestore(expected, 'rollback') });
        }
      } else {
        Row({ space: TOK_SPACE_SM }) {
          ReaderButton({ scheme: this.scheme, variant: 'tonal', label: '导出恢复包', layout: 'equal',
            actionEnabled: this.passphrase.length > 0, onAction: (): void => { void this.perform('export', expected); } });
          if (!this.systemPending) {
            ReaderButton({ scheme: this.scheme, variant: 'tonal', label: '导入恢复包', layout: 'equal',
              actionEnabled: this.passphrase.length > 0, onAction: (): void => { void this.perform('inspect', expected); } });
          }
        }.width('100%').padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, bottom: TOK_SPACE_SM });
      }
    }
  }

  build() {
    CategorySection({ title: '' }) {
      Column() {
        ReaderSectionHeading({ title: '本地备份与恢复', variant: 'tool-card' });
      }.width('100%').padding(TOK_SPACE_SM);
      if (this.checking || this.active !== undefined) {
        Column() { this.processing(); }.width('100%').padding(TOK_SPACE_SM);
      } else if (this.statusUnavailable) {
        Column() { this.statusReadFailed(); }.width('100%').padding(TOK_SPACE_SM);
      } else {
        ForEach([this.revision], (expected: number): void => { this.actions(expected); },
          (expected: number): string => expected.toString());
      }
    }
  }
}
