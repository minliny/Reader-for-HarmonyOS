import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderRecoveryGroup } from '../../../ui/feedback/ReaderRecoveryGroup';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TOK_SPACE_SM } from '../../../ui/foundation/ReaderTokens';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeTop } from '../../../ui/foundation/ReaderWindowMetrics';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { readerKeyboardHostBottom } from '../../../ui/layout/ReaderKeyboardGeometry';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { DialogActionView, ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { CategorySection } from '../../settings/ui/CategorySection';
import { LocalRecoveryGateway, type LocalRecoveryOutcome } from '../application/LocalRecoveryGateway';

type LocalRecoveryDialog = 'export' | 'inspect' | 'apply' | 'rollback';
type LocalRecoveryAction = LocalRecoveryDialog | 'resume';

@Component
export struct LocalRecoveryPanel {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @StorageProp('readerAppForeground') private appForeground: boolean = true;
  @StorageProp('readerSystemMigrationState') @Watch('refreshOpening') private systemMigrationState: string = 'none';
  @StorageProp('readerWindowMetricsRevision') private windowMetricsRevision: number = 0;
  @Prop @Watch('refreshOpening') navigationGeneration: number = 0;
  @Prop @Watch('refreshOpening') externalRestoreRevision: number = 0;
  @Prop showHeading: boolean = false;
  editingHost: ReaderEditingVisibility | undefined = undefined;
  isInputAllowed: () => boolean = (): boolean => true;
  isOpeningCurrent: () => boolean = (): boolean => true;
  onBusyChange: (busy: boolean) => void = (_busy: boolean): void => {};
  @State private passphrase: string = '';
  @State private confirmation: string = '';
  @State private checking: boolean = true;
  @State private statusUnavailable: boolean = false;
  @State private pendingRestore: boolean = false;
  @State private rollbackPending: boolean = false;
  @State private systemPending: boolean = false;
  @State private active: LocalRecoveryAction | undefined = undefined;
  @State private preview: LocalRecoveryOutcome | undefined = undefined;
  @State private revision: number = 0;
  @State private dialogKind: LocalRecoveryDialog = 'export';
  @State private dialogTicket: number = 0;
  @State private coverVisible: boolean = false;
  @State private coverHeight: number = 0;
  @State private coverOriginY: number = 0;
  private dialogSequence: number = 0;
  private confirmedDialogTicket: number = 0;
  private mounted: boolean = false;
  private readonly gateway: LocalRecoveryGateway = new LocalRecoveryGateway();
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private readonly dialogEditing: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly dialogScroller: Scroller = new Scroller();
  private readonly dialogScrollBinding: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();

  aboutToAppear(): void { this.mounted = true; this.refreshOpening(); }

  aboutToDisappear(): void {
    this.mounted = false;
    this.retireOpening();
  }

  private retireOpening(): void {
    this.revision++;
    this.retireDialog();
    this.feedback.reset();
    this.gateway.clearPreview();
    this.preview = undefined;
    this.passphrase = '';
    this.active = undefined;
    this.onBusyChange(false);
  }

  private refreshOpening(): void {
    if (!this.mounted) return;
    this.retireOpening();
    void this.readPending();
  }

  private current(revision: number, navigation: number): boolean {
    return this.mounted && this.revision === revision && this.navigationGeneration === navigation && this.isOpeningCurrent();
  }

  private async readPending(): Promise<void> {
    const revision = this.revision, navigation = this.navigationGeneration;
    this.checking = true;
    this.statusUnavailable = false;
    try {
      const pending = await this.gateway.pendingAction();
      if (this.current(revision, navigation)) {
        this.systemPending = pending === 'system' || (pending === undefined && this.systemMigrationState === 'interrupted');
        this.pendingRestore = pending === 'restore' || pending === 'rollback';
        this.rollbackPending = pending === 'rollback';
      }
    } catch (_) {
      if (this.current(revision, navigation)) this.statusUnavailable = true;
    } finally {
      if (this.current(revision, navigation)) this.checking = false;
    }
  }

  private inputCurrent(revision: number): boolean {
    return this.current(revision, this.navigationGeneration) && this.appForeground && this.isInputAllowed();
  }

  private canStart(action: LocalRecoveryAction, revision: number): boolean {
    return this.inputCurrent(revision) && !this.checking && !this.statusUnavailable && this.active === undefined &&
      (!this.systemPending || action === 'export') &&
      (action === 'resume' || action === 'rollback') === this.pendingRestore &&
      (action !== 'rollback' || !this.rollbackPending) && (action === 'apply') === (this.preview !== undefined);
  }

  private openDialog(kind: LocalRecoveryDialog, revision: number): void {
    if (!this.canStart(kind, revision) || this.dialogTicket !== 0) return;
    if (kind === 'export' || kind === 'inspect') this.passphrase = '';
    this.dialogKind = kind;
    this.dialogTicket = ++this.dialogSequence;
    this.onBusyChange(true);
    this.coverVisible = true;
  }

  private retireDialog(): void {
    this.confirmedDialogTicket = 0;
    this.dialogTicket = 0;
    this.coverVisible = false;
    this.confirmation = '';
    this.coverHeight = 0;
    this.coverOriginY = 0;
  }

  private dialogCurrent(ticket: number, revision: number): boolean {
    return ticket > 0 && ticket === this.dialogTicket && this.coverVisible && this.canStart(this.dialogKind, revision);
  }

  private dialogReady(): boolean {
    return this.passphrase.length > 0 && (this.dialogKind !== 'export' || this.passphrase === this.confirmation);
  }

  private dismissDialog(ticket: number): void {
    if (ticket > 0 && ticket === this.dialogTicket) this.coverVisible = false;
  }

  private chooseDialogAction(ticket: number, revision: number, id: string): void {
    if (!this.dialogCurrent(ticket, revision)) return;
    if (id === 'confirm') {
      if (!this.dialogReady()) return;
      this.confirmedDialogTicket = ticket;
    } else if (id !== 'cancel') {
      return;
    }
    this.dismissDialog(ticket);
  }

  private coverOptions(ticket: number, revision: number): ContentCoverOptions {
    return {
      modalTransition: ModalTransition.NONE,
      backgroundColor: Color.Transparent,
      onWillDismiss: (_action: DismissContentCoverAction): void => this.dismissDialog(ticket),
      onDisappear: (): void => {
        if (ticket <= 0 || ticket !== this.dialogTicket) return;
        const action = this.dialogKind;
        const confirmed = this.confirmedDialogTicket === ticket && this.canStart(action, revision);
        this.retireDialog();
        // Wait until the modal has detached before presenting the system document picker.
        if (confirmed) {
          void this.perform(action, revision);
        } else {
          if (action !== 'apply') this.passphrase = '';
          this.onBusyChange(false);
        }
      },
    };
  }

  private clearPreview(revision: number): void {
    if (!this.canStart('apply', revision) || this.dialogTicket !== 0) return;
    this.revision++;
    this.gateway.clearPreview();
    this.preview = undefined;
    this.passphrase = '';
  }

  private async perform(action: LocalRecoveryAction, expected: number): Promise<void> {
    if (!this.canStart(action, expected) || this.dialogTicket !== 0 || this.passphrase.length === 0) return;
    const revision = ++this.revision, navigation = this.navigationGeneration;
    const current = (): boolean => this.current(revision, navigation);
    const admit = async (): Promise<void> => {
      if (!this.inputCurrent(revision)) throw new Error('Local recovery opening retired');
    };
    const passphrase = this.passphrase;
    this.active = action;
    this.onBusyChange(true);
    this.feedback.reset();
    this.passphrase = '';
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
      this.passphrase = passphrase;
      this.preview = outcome;
      this.onBusyChange(false);
      return;
    }
    this.preview = undefined;
    if (outcome.state === 'interrupted' || action === 'apply' || action === 'resume' || action === 'rollback') {
      await this.readPending();
    }
    if (current()) {
      this.onBusyChange(false);
      this.showOutcome(action, outcome, revision, navigation);
    }
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
      case 'cancelled': message = action === 'export' ? '已取消导出' : action === 'inspect' ? '已取消选择恢复包' :
        action === 'resume' ? '当前没有待继续的本地恢复' : '已取消本次恢复'; break;
      case 'rejected': message = '恢复包未通过校验，请核对口令与文件完整性。'; break;
      case 'tooLarge': message = action === 'export' ? '待备份内容超过恢复包大小限制。' : '恢复包超过可导入的大小限制。'; break;
      case 'failed': message = action === 'export' ? '恢复包导出失败，请重试。' : '恢复操作未完成，请重试。'; break;
      default: return;
    }
    this.feedback.show(() => this.getUIContext(), { message },
      (): boolean => this.current(revision, navigation) && this.appForeground && this.isInputAllowed());
  }

  @Builder
  private passphraseField(label: string, repeat: boolean, ticket: number, revision: number) {
    ReaderFormField({ editingHost: ticket > 0 ? this.dialogEditing : this.editingHost,
      scheme: this.scheme, specId: 'sync-credential', text: repeat ? this.confirmation : this.passphrase,
      password: true, placeholder: label, fieldAccessibilityLabel: label,
      inputIdentity: `${ticket}:${revision}:${label}`,
      isEditable: ticket > 0 ? this.dialogCurrent(ticket, revision) : this.canStart('resume', revision),
      onTextChange: (value: string): void => {
        if (ticket > 0 ? !this.dialogCurrent(ticket, revision) : !this.canStart('resume', revision)) return;
        if (repeat) this.confirmation = value;
        else this.passphrase = value;
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
        if (this.inputCurrent(expected) && this.statusUnavailable && !this.checking) void this.readPending();
      } });
  }

  @Builder
  private resumeControl(expected: number) {
    ReaderRecoveryGroup({ content: (): void => { this.resumeFields(expected); } });
  }

  @Builder
  private resumeFields(expected: number) {
    ReaderRecoveryNotice({ grouped: true, tag: this.systemPending ? '系统迁移待继续' :
      this.rollbackPending ? '本地回退中断' : '本地恢复中断',
      view: { visible: true, canRetry: false, generation: expected,
        message: this.systemPending ? '系统迁移将在下次启动继续。可继续导出本地备份。' : this.rollbackPending ?
          '请输入原恢复包口令，继续未完成的回退。' : '请输入原恢复包口令，继续恢复或回退到恢复前。' } });
    if (!this.systemPending) {
      Column({ space: TOK_SPACE_SM }) {
        this.passphraseField('恢复包口令', false, 0, expected);
        Row({ space: TOK_SPACE_SM }) {
          if (!this.rollbackPending) {
            ReaderButton({ scheme: this.scheme, variant: 'subtle', label: '回退到恢复前…',
              actionEnabled: this.canStart('rollback', expected) && this.passphrase.length > 0,
              onAction: (): void => this.openDialog('rollback', expected) });
          }
          ReaderRecoveryAction({ variant: 'notice', label: this.rollbackPending ? '继续回退' : '继续恢复',
            generation: expected, actionEnabled: this.canStart('resume', expected) && this.passphrase.length > 0,
            onReconcile: (revision: number): void => { void this.perform('resume', revision); } });
        }.width('100%').justifyContent(FlexAlign.End);
      }.width('100%').padding({ top: TOK_SPACE_SM });
    }
  }

  @Builder
  private actions(expected: number) {
    if (this.preview !== undefined) {
      ReaderFormRow({ kind: 'standard', label: '恢复包校验完成', secondaryText: this.originalCounts(this.preview) });
      Row({ space: TOK_SPACE_SM }) {
        ReaderButton({ scheme: this.scheme, variant: 'subtle', label: '取消', layout: 'equal',
          onAction: (): void => this.clearPreview(expected) });
        ReaderButton({ scheme: this.scheme, variant: 'primary', label: '恢复…', layout: 'equal',
          onAction: (): void => this.openDialog('apply', expected) });
      }.width('100%').padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, bottom: TOK_SPACE_SM });
    } else {
      if (this.systemPending) {
        Column() { this.resumeControl(expected); }.width('100%').padding(TOK_SPACE_SM);
      }
      ReaderFormRow({ label: '导出恢复包', secondaryText: '设置口令并将加密恢复包保存到文件',
        actionEnabled: this.canStart('export', expected), onAction: (): void => this.openDialog('export', expected) });
      if (!this.systemPending) {
        ReaderFormRow({ label: '导入恢复包', secondaryText: '输入口令并选择文件，先查看校验结果',
          actionEnabled: this.canStart('inspect', expected), onAction: (): void => this.openDialog('inspect', expected) });
      }
    }
  }

  private coverTop(): number {
    if (this.windowMetricsRevision < 0) return 0;
    return Math.max(0, readerInteractiveSafeTop(readerWindowMetrics(), true) - this.coverOriginY);
  }

  private coverBodyHeight(): number {
    const metrics = readerWindowMetrics();
    const height = this.coverHeight > 0 ? this.coverHeight : metrics.windowRect.height;
    return Math.max(0, readerKeyboardHostBottom(metrics, this.coverOriginY, height) - this.coverTop());
  }

  @Builder
  private dialogCover() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.dialogTicket > 0) {
        ForEach([this.dialogTicket], (ticket: number): void => { this.dialogContent(ticket, this.revision); },
          (ticket: number): string => ticket.toString());
      }
    }.width('100%').height('100%')
      .onAreaChange((_old: Area, next: Area): void => {
        const height = readerPageAreaLength(next.height);
        const originY = readerPageAreaLength(next.globalPosition.y);
        if (height > 0 && this.coverHeight !== height) this.coverHeight = height;
        if (this.coverOriginY !== originY) this.coverOriginY = originY;
      });
  }

  @Builder
  private dialogContent(ticket: number, revision: number) {
    Stack()
      .width('100%').height('100%')
      .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.scheme,
        readerAppColor('app.scrim.modal', this.scheme)))
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
      .accessibilityLevel('no')
      .onClick((): void => this.dismissDialog(ticket));
    Scroll(this.dialogScroller) {
      Column() {
        ReaderDialogSurface({ specId: 'json-import',
          title: this.dialogKind === 'export' ? '导出恢复包' : this.dialogKind === 'inspect' ? '导入恢复包' :
            this.dialogKind === 'rollback' ? '回退未完成的恢复' : '恢复本地阅读库',
          actions: [new DialogActionView('cancel', '取消', 'default', true, true),
            new DialogActionView('confirm', this.dialogKind === 'export' ? '确认导出' :
              this.dialogKind === 'inspect' ? '选择恢复包' : this.dialogKind === 'rollback' ? '确认回退' : '确认恢复',
              this.dialogKind === 'apply' || this.dialogKind === 'rollback' ? 'danger' : 'primary', this.dialogReady())],
          onAction: (id: string): void => this.chooseDialogAction(ticket, revision, id),
          body: (): void => { this.dialogFields(ticket, revision); },
        }).hitTestBehavior(HitTestMode.Default);
      }.width('100%').constraintSize({ minHeight: this.coverBodyHeight() })
        .padding({ top: TOK_SPACE_SM, bottom: TOK_SPACE_SM }).justifyContent(FlexAlign.Center)
        .hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height(this.coverBodyHeight()).position({ x: 0, y: this.coverTop() })
      .id(this.dialogScrollBinding.id)
      .onAppear((): void => this.dialogScrollBinding.mount(this.getUIContext(), this.dialogEditing, this.dialogScroller))
      .onDisAppear((): void => this.dialogScrollBinding.unmount())
      .onAreaChange((): void => this.dialogEditing.refresh())
      .scrollBar(BarState.Auto).clip(true).hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private dialogFields(ticket: number, revision: number) {
    Column({ space: TOK_SPACE_SM }) {
      if (this.dialogKind === 'apply') {
        this.dialogText('恢复包将替换当前阅读库。导入的联网书源和自动更新需重新启用。');
      } else if (this.dialogKind === 'rollback') {
        this.dialogText('将用恢复前的检查点替换当前阅读库，恢复开始后的变更将被替换。');
      } else {
        this.passphraseField('恢复包口令', false, ticket, revision);
        if (this.dialogKind === 'export') {
          this.passphraseField('再次输入恢复包口令', true, ticket, revision);
          if (this.confirmation.length > 0 && this.confirmation !== this.passphrase) {
            this.dialogText('两次输入的口令不一致。', true);
          }
          this.dialogText('请妥善保管口令。口令遗失后无法找回，也无法恢复此备份。');
        }
      }
    }.width('100%').alignItems(HorizontalAlign.Start);
  }

  @Builder
  private dialogText(message: string, invalid: boolean = false) {
    Text(message).width('100%')
      .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
      .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
      .fontColor(readerAppColor(invalid ? 'TOK_DANGER' : 'TOK_MUTED', this.scheme));
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        if (this.pendingRestore && this.active === undefined && !this.checking && !this.statusUnavailable) {
          ForEach([this.revision], (expected: number): void => { this.resumeControl(expected); },
            (expected: number): string => expected.toString());
        } else {
          CategorySection({ title: this.showHeading ? '本地备份与恢复' : '' }) {
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
      }.width('100%').enabled(this.dialogTicket === 0)
        .accessibilityLevel(this.dialogTicket === 0 ? 'auto' : 'no-hide-descendants');
      Column().width(0).height(0).hitTestBehavior(HitTestMode.None).accessibilityLevel('no')
        .bindContentCover(this.coverVisible, this.dialogCover, this.coverOptions(this.dialogTicket, this.revision));
    }.width('100%');
  }
}
