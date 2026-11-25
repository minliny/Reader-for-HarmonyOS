import { LengthMetrics } from '@kit.ArkUI';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { readerAppColor, type ReaderAppColorRole } from '../../../ui/foundation/ReaderThemeRegistry';
import { DialogActionView, ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import { sourceV9Primary } from '../presentation/SourceManagementV9';
import { httpUrlHostname } from '../../../platform/network/HttpTransportPolicy';
import type { ManagedRuleSubscription, RuleSubscriptionDraft, RuleSubscriptionType } from '../../settings/application/RulesManagementGateway';
import type { SourceCheckOutcome, SourceCheckReportStep, SourceGroupRecord, SourceImportGroupTarget } from '../application/SourceGateway';
import { EMPTY_SOURCE_V9_TRANSFER, SourceV9TransferOwner, type SourceV9CheckOptions, type SourceV9SubscriptionReview,
  type SourceV9ConfirmedImport, type SourceV9TransferItemResult, type SourceV9TransferSnapshot } from '../application/SourceV9TransferOwner';
import { sourceV9ChangesToApply, sourceV9SelectedImportRows, type SourceV9Change, type SourceV9ChangeKind,
  type SourceV9Depth, type SourceV9GroupStrategy, type SourceV9ImportedReport, type SourceV9ImportOrigin,
  type SourceV9ImportRow, type SourceV9Mode, type SourceV9TransferPane } from '../application/SourceV9TransferState';

interface TransferChoice {
  id: string;
  label: string;
}
type TransferButtonTone = 'primary' | 'secondary' | 'neutral' | 'danger' | 'text';
type TransferDialog = 'none' | 'form' | 'delete';

const IMPORT_STEP_LABELS: string[] = ['选择来源', '校验与检测', '完成'];
const IMPORT_ORIGINS: TransferChoice[] = [
  { id: 'file', label: '本地文件' }, { id: 'url', label: '在线链接' }, { id: 'paste', label: '粘贴 JSON' },
];
const GROUP_STRATEGIES: TransferChoice[] = [
  { id: 'preserve', label: '保留原分组' }, { id: 'fill', label: '补全未分组' }, { id: 'all', label: '统一归入' },
];
const CHECK_MODES: TransferChoice[] = [{ id: 'search', label: '搜索' }, { id: 'explore', label: '发现' }];
const IMPORT_DEPTHS: TransferChoice[] = [
  { id: 'L2', label: 'L2 快速' }, { id: 'L4', label: 'L4 目录' }, { id: 'L5', label: 'L5 正文' },
];
const SUBSCRIPTION_DEPTHS: TransferChoice[] = [{ id: 'L2', label: 'L2 快速' }, { id: 'L5', label: 'L5 正文' }];
const SUBSCRIPTION_TYPES: TransferChoice[] = [{ id: '0', label: '书源' }, { id: '2', label: '净化规则' }];
const CHANGE_GROUPS: TransferChoice[] = [
  { id: 'added', label: '新增' }, { id: 'update', label: '更新' }, { id: 'conflict', label: '冲突' },
  { id: 'removedRemote', label: '远端移除' }, { id: 'unchanged', label: '无变化' }, { id: 'localOnly', label: '仅本地' },
];
const KEYWORDS: string[] = ['我的', '斗破', '海贼'];

@Component
export struct SourceV9TransferPage {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop pane: SourceV9TransferPane = 'import';
  @Prop initialUrl: string = '';
  @Prop initialJson: string = '';
  @Prop embeddedWide: boolean = false;
  @Prop groups: SourceGroupRecord[] = [];
  owner: ReaderRuntimeOwner | undefined = undefined;
  onBack: () => void = (): void => {};
  onReadBack: (reports: SourceV9ImportedReport[], imported?: SourceV9ConfirmedImport) => void =
    (_reports: SourceV9ImportedReport[], _imported?: SourceV9ConfirmedImport): void => {};
  onTemporaryBackBridge?: (handler: (() => boolean) | undefined) => void;
  isInputAllowed?: () => boolean;
  @State private state: SourceV9TransferSnapshot = EMPTY_SOURCE_V9_TRANSFER;
  @State private origin: SourceV9ImportOrigin = 'file';
  @State private url: string = '';
  @State private paste: string = '';
  @State private saveAsSubscription: boolean = false;
  @State private subscriptionName: string = '';
  @State private checkEnabled: boolean = true;
  @State private detailExpanded: boolean = false;
  @State private checkMode: SourceV9Mode = 'search';
  @State private checkDepth: SourceV9Depth = 'L2';
  @State private checkKeyword: string = '';
  @State private strategy: SourceV9GroupStrategy = 'preserve';
  @State private groupId: string = '';
  @State private createGroup: boolean = false;
  @State private groupName: string = '';
  @State private dialog: TransferDialog = 'none';
  @State private edited: ManagedRuleSubscription | undefined = undefined;
  @State private formName: string = '';
  @State private formUrl: string = '';
  @State private formType: RuleSubscriptionType = 0;
  @State private formEnabled: boolean = true;
  @State private visibleReport: SourceCheckOutcome | undefined = undefined;
  @State private reportName: string = '';
  @State private modalBodyHeight: number = 430;
  private flow: SourceV9TransferOwner | undefined = undefined;
  private mounted: boolean = false;
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();

  aboutToAppear(): void {
    this.mounted = true;
    this.url = this.initialUrl ?? '';
    this.paste = this.initialJson ?? '';
    this.origin = this.url.length > 0 ? 'url' : this.paste.length > 0 ? 'paste' : 'file';
    if (this.owner !== undefined) {
      this.flow = new SourceV9TransferOwner(this.owner,
        (state: SourceV9TransferSnapshot): void => this.acceptState(state),
        (): boolean => this.inputCurrent(),
        (reports: SourceV9ImportedReport[], imported?: SourceV9ConfirmedImport): void => {
          if (this.mounted) this.onReadBack(reports, imported);
        });
      if (this.pane === 'subscriptions') void this.flow.loadSubscriptions();
    }
    this.onTemporaryBackBridge?.((): boolean => this.consumeBack());
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.transientFeedback.reset();
    this.flow?.retire();
    this.flow = undefined;
    this.onTemporaryBackBridge?.(undefined);
  }

  private acceptState(next: SourceV9TransferSnapshot): void {
    if (!this.mounted) return;
    const previous = this.state;
    this.state = next;
    if (next.busy || next.writePending || !this.inputCurrent()) return;
    const finishing = previous.busy;
    const reportableError = this.dialog === 'none' && next.reviews.length === 0 &&
      (this.pane === 'subscriptions' ? next.subscriptions.length > 0 : next.importStep > 1);
    if (finishing && (next.status.length > 0 || (reportableError && next.error.length > 0))) {
      const message = next.status && next.error ? next.status + '。' + next.error : next.error || next.status;
      this.transientFeedback.show((): UIContext => this.getUIContext(), { message,
        tone: next.error ? 'error' : 'success' }, (): boolean => this.inputCurrent());
    }
  }

  private inputCurrent(): boolean { return this.mounted && (this.isInputAllowed?.() ?? true); }

  private editable(): boolean {
    return this.inputCurrent() && !this.state.busy && !this.state.runningCheck && !this.state.writePending;
  }

  private consumeBack(): boolean {
    if (!this.mounted) return false;
    if (this.visibleReport !== undefined) {
      this.visibleReport = undefined;
      return true;
    }
    if (this.state.busy) return true;
    if (this.dialog !== 'none') {
      this.dialog = 'none';
      return true;
    }
    if (this.state.reviews.length > 0) {
      this.flow?.closeReviews();
      return true;
    }
    return this.pane === 'import' && (this.flow?.backToImportSource() ?? false);
  }

  private back(): void {
    if (this.inputCurrent() && !this.consumeBack()) this.onBack();
  }

  private resetImport(): void {
    if (!this.editable()) return;
    this.flow?.resetImport();
    this.origin = 'file';
    this.url = '';
    this.paste = '';
    this.saveAsSubscription = false;
    this.subscriptionName = '';
    this.checkEnabled = true;
    this.detailExpanded = false;
    this.resetCheckSettings();
    this.strategy = 'preserve';
    this.groupId = '';
    this.groupName = '';
    this.createGroup = false;
  }

  private resetCheckSettings(): void {
    this.checkMode = 'search';
    this.checkDepth = 'L2';
    this.checkKeyword = '';
  }

  private selectedImportCount(): number { return sourceV9SelectedImportRows(this.state.rows).length; }

  private supportedImportCount(): number {
    return this.state.rows.filter((row: SourceV9ImportRow): boolean => row.candidate?.supported === true).length;
  }

  private unsupportedImportCount(): number {
    return this.state.rows.filter((row: SourceV9ImportRow): boolean => row.candidate?.supported === false).length;
  }

  private canParse(): boolean {
    return this.editable() && (this.origin === 'file' ? this.state.fileName.length > 0 :
      this.origin === 'url' ? this.url.trim().length > 0 : this.paste.trim().length > 0);
  }

  private targetReady(): boolean {
    return this.strategy === 'preserve' || (this.createGroup ? this.groupName.trim().length > 0 :
      this.state.groups.some((group: SourceGroupRecord): boolean => group.groupId === this.groupId));
  }

  private importSelected(): void {
    if (!this.editable() || !this.targetReady()) return;
    let target: SourceImportGroupTarget | undefined = undefined;
    if (this.strategy !== 'preserve') {
      target = this.createGroup ? { groupName: this.groupName.trim() } : { groupId: this.groupId };
    }
    void this.flow?.importSelected({ strategy: this.strategy, target, subscriptionName: this.subscriptionName,
      subscriptionUrl: this.origin === 'url' && this.saveAsSubscription ? this.url.trim() : undefined });
  }

  private checkOptions(): SourceV9CheckOptions {
    return { mode: this.checkMode, depth: this.checkDepth, keyword: this.checkKeyword };
  }

  private startCheck(subscription: boolean): void {
    if (this.state.runningCheck) {
      this.flow?.stopChecks();
    } else if (this.editable() && this.state.checkSupported) {
      if (subscription) void this.flow?.checkReviews(this.checkOptions());
      else void this.flow?.checkImport(this.checkOptions());
    }
  }

  private checkSubscriptions(ids: number[]): void {
    if (!this.editable() || ids.length === 0) return;
    this.resetCheckSettings();
    void this.flow?.previewSubscriptions(ids);
  }

  private activeSubscriptions(): number[] {
    return this.state.subscriptions.filter((sub: ManagedRuleSubscription): boolean => sub.autoUpdate)
      .map((sub: ManagedRuleSubscription): number => sub.id);
  }

  private applyCount(): number {
    let count = 0;
    for (const review of this.state.reviews) count += sourceV9ChangesToApply(review.rows).length;
    return count;
  }

  private rowsOf(kind: string, review: SourceV9SubscriptionReview): SourceV9Change[] {
    return review.rows.filter((row: SourceV9Change): boolean => row.kind === kind as SourceV9ChangeKind);
  }

  private reviewHasSources(): boolean {
    return this.state.reviews.some((review: SourceV9SubscriptionReview): boolean =>
      review.rows.some((row: SourceV9Change): boolean => row.candidate !== undefined &&
        (row.kind === 'added' || row.kind === 'update' || row.kind === 'conflict')));
  }

  private openForm(subscription?: ManagedRuleSubscription): void {
    if (!this.editable()) return;
    this.edited = subscription;
    this.formName = subscription?.name ?? '';
    this.formUrl = subscription?.url ?? '';
    this.formType = subscription?.type ?? 0;
    this.formEnabled = subscription?.autoUpdate ?? true;
    this.dialog = 'form';
  }

  private async confirmDialog(action: string): Promise<void> {
    if (!this.editable()) return;
    if (action === 'cancel') {
      this.dialog = 'none';
      return;
    }
    if (this.dialog === 'form') {
      const draft: RuleSubscriptionDraft = { id: this.edited?.id, name: this.formName, url: this.formUrl,
        type: this.formType, autoUpdate: this.formEnabled, customOrder: this.edited?.customOrder ?? 0,
        update: this.edited?.update };
      await this.flow?.saveSubscription(draft);
    } else if (this.edited !== undefined) {
      await this.flow?.deleteSubscription(this.edited.id);
    }
    if (this.mounted && (!this.state.error || this.state.writePending)) this.dialog = 'none';
  }

  private showReport(name: string, report: SourceCheckOutcome | undefined): void {
    if (!this.inputCurrent() || report === undefined) return;
    this.reportName = name;
    this.visibleReport = report;
  }

  private color(role: ReaderAppColorRole): ResourceColor { return role === 'app.sourceUi.primary' ? sourceV9Primary(this.scheme) : readerAppColor(role, this.scheme); }

  private primary(): ResourceColor { return this.color('app.sourceUi.primary'); }

  private toneInk(tone: TransferButtonTone): ResourceColor {
    if (tone === 'primary') return this.color('app.sourceUi.onPrimary');
    if (tone === 'danger') return this.color('app.sourceUi.danger');
    if (tone === 'secondary') return this.primary();
    return this.color('TOK_INK');
  }

  private toneSurface(tone: TransferButtonTone): ResourceColor {
    if (tone === 'primary') return this.primary();
    if (tone === 'danger') return this.color('app.sourceUi.dangerSurface');
    if (tone === 'secondary') return this.color('app.sourceUi.selected');
    if (tone === 'text') return Color.Transparent;
    return this.color('app.sourceUi.field');
  }

  private reportStepStatus(step: SourceCheckReportStep): string {
    switch (step.status) {
      case 'pass': return '通过';
      case 'fail': return '失败';
      case 'blocked': return '受阻';
      case 'cancelled': return '已取消';
      case 'not_supported': return '不支持';
      default: return '未请求';
    }
  }

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {
        this.header();
        if (this.pane === 'import') this.importPage();
        else this.subscriptionsPage();
      }.width('100%').height('100%').backgroundColor(this.color('TOK_PAPER'))
        .accessibilityLevel(this.dialog !== 'none' || this.state.reviews.length > 0 || this.visibleReport !== undefined ?
          'no-hide-descendants' : 'auto');
      this.pendingRecovery();
      if (this.state.reviews.length > 0) this.subscriptionReview();
      if (this.dialog !== 'none') this.subscriptionDialog();
      if (this.visibleReport !== undefined) this.reportDialog();
    }.id(this.pane === 'import' ? 'reader-source-v9-import' : 'reader-source-v9-subscriptions')
      .width('100%').height('100%').clip(true)
      .onSizeChange((_old: SizeOptions, next: SizeOptions): void => {
        const height = Number(next.height);
        if (Number.isFinite(height) && height > 0) this.modalBodyHeight = Math.max(100, Math.min(480, height - 156));
      });
  }

  @Builder
  private header() {
    Row({ space: 8 }) {
      Button('←', { type: ButtonType.Normal }).width(36).height(36).padding(0)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(21)
        .fontColor(this.color('TOK_INK')).backgroundColor(Color.Transparent)
        .accessibilityText('返回').onClick((): void => this.back());
      Text(this.pane === 'import' ? '导入书源' : '书源订阅').layoutWeight(1)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(18).fontColor(this.color('TOK_INK'));
      if (this.pane === 'subscriptions') {
        this.action('＋ 新建', 'secondary', this.editable(), (): void => this.openForm());
      }
    }.width('100%').height(48).padding({ left: 14, right: 14 })
      .border({ width: { bottom: 1 }, color: this.color('TOK_LINE') });
  }

  @Builder
  private label(value: string, size: number, role: ReaderAppColorRole = 'TOK_INK', strong: boolean = false) {
    Text(value).fontSize(size).fontColor(this.color(role))
      .fontFamily(strong ? READER_FONT_NOTO_SANS_SC_UI_MEDIUM : READER_FONT_NOTO_SANS_SC_UI_REGULAR);
  }

  @Builder
  private action(label: string, tone: TransferButtonTone, enabled: boolean, run: () => void,
    height: number = 32, width: number | undefined = undefined, weight: number | undefined = undefined, id: string = '') {
    Button(label, { type: ButtonType.Capsule }).id(id).height(height).width(width).layoutWeight(weight)
      .padding({ left: 12, right: 12 }).fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
      .fontColor(this.toneInk(tone)).backgroundColor(this.toneSurface(tone))
      .enabled(enabled).opacity(enabled ? 1 : 0.47)
      .onClick((): void => { if (this.inputCurrent()) run(); });
  }

  @Builder
  private segments(choices: TransferChoice[], active: string, emit: (id: string) => void, accessibilityLabel: string) {
    Row({ space: 2 }) {
      ForEach(choices, (choice: TransferChoice): void => {
        Button(choice.label, { type: ButtonType.Normal }).layoutWeight(1).height(32).padding(0)
          .borderRadius(8).fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
          .fontColor(active === choice.id ? this.primary() : this.color('TOK_MUTED'))
          .backgroundColor(active === choice.id ? this.color('app.sourceUi.surface') : Color.Transparent)
          .accessibilityText(accessibilityLabel + ' · ' + choice.label).accessibilitySelected(active === choice.id)
          .enabled(this.editable()).onClick((): void => { if (this.editable()) emit(choice.id); });
      }, (choice: TransferChoice): string => choice.id);
    }.width('100%').padding(3).borderRadius(10).backgroundColor(this.color('app.sourceUi.field'));
  }

  @Builder
  private field(title: string, value: string, placeholder: string, emit: (value: string) => void) {
    Column({ space: 5 }) {
      this.label(title, 12, 'TOK_MUTED', true);
      TextInput({ text: value, placeholder }).height(40).width('100%').borderRadius(10)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13)
        .fontColor(this.color('TOK_INK')).placeholderColor(this.color('TOK_MUTED'))
        .backgroundColor(this.color('app.sourceUi.field')).accessibilityText(title)
        .enabled(this.editable()).onChange((next: string): void => { if (this.editable()) emit(next); });
    }.width('100%').alignItems(HorizontalAlign.Start);
  }

  @Builder
  private checkbox(checked: boolean, enabled: boolean, label: string, emit: (checked: boolean) => void) {
    Checkbox().height(26).width(26).select(checked).selectedColor(this.primary())
      .enabled(enabled).accessibilityText(label)
      .onChange((selected: boolean): void => { if (this.editable()) emit(selected); });
  }

  @Builder
  private pendingRecovery() {
    if (this.state.writePending && this.dialog === 'none' && this.visibleReport === undefined &&
      this.state.reviews.length === 0) {
      Column() {
        ReaderRecoveryNotice({
          view: { message: this.state.error || this.state.status || '原操作需要核对', visible: true,
            canRetry: true, generation: this.state.pendingGeneration },
          actionLabel: '核对', secondaryActionLabel: this.state.canContinueOriginal ? '继续' : '',
          actionEnabled: this.inputCurrent() && !this.state.busy,
          secondaryActionEnabled: this.inputCurrent() && !this.state.busy && this.state.canContinueOriginal,
          maxHeightVp: this.modalBodyHeight,
          onReconcile: (generation: number): void => { void this.flow?.recoverPending(generation, false); },
          onSecondaryAction: (generation: number): void => { void this.flow?.recoverPending(generation, true); },
        });
      }.width('100%').constraintSize({ maxWidth: 640 })
        .padding({ left: 14, right: 14, top: 54 }).alignSelf(ItemAlign.Center);
    }
  }

  @Builder
  private importPage() {
    this.importStepper();
    Scroll() {
      Column({ space: 10 }) {
        if (!this.state.writePending && this.state.error.length > 0 && this.state.importStep < 3) {
          ReaderPageState({ variant: 'inline', padded: false, message: this.state.error });
        }
        if (this.state.busy) {
          ReaderPageState({ variant: 'inline', loading: true, padded: false,
            message: this.state.importStep === 1 ? '正在读取书源' : '正在确认导入' });
        }
        if (this.state.importStep === 1) this.importSource();
        else if (this.state.importStep === 2) this.importReview();
        else this.importResult();
      }.width('100%').constraintSize({ maxWidth: 640 })
        .padding({ left: 14, right: 14, bottom: 18 }).alignItems(HorizontalAlign.Start);
    }.width('100%').layoutWeight(1).align(Alignment.Top).scrollBar(BarState.Off);
    this.importFooter();
  }

  @Builder
  private importStepper() {
    Row({ space: 6 }) {
      ForEach(IMPORT_STEP_LABELS, (label: string, index: number): void => {
        Row({ space: 6 }) {
          Text(this.state.importStep > index + 1 ? '✓' : String(index + 1))
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(11).width(20).height(20)
            .textAlign(TextAlign.Center).borderRadius(10)
            .fontColor(this.state.importStep >= index + 1 ? this.color('app.sourceUi.onPrimary') : this.color('TOK_MUTED'))
            .backgroundColor(this.state.importStep >= index + 1 ? this.primary() : this.color('app.sourceUi.field'));
          this.label(label, 11.5, this.state.importStep === index + 1 ? 'TOK_INK' : 'TOK_MUTED', true);
          if (index < 2) Blank().height(1).color(this.color('app.sourceUi.optionBorder'));
        }.layoutWeight(index < 2 ? 1 : undefined)
          .accessibilityText(label).accessibilitySelected(this.state.importStep === index + 1);
      }, (label: string): string => label);
    }.width('100%').constraintSize({ maxWidth: 640 }).padding({ left: 14, right: 14, top: 12, bottom: 12 });
  }

  @Builder
  private importSource() {
    this.segments(IMPORT_ORIGINS, this.origin, (id: string): void => { this.origin = id as SourceV9ImportOrigin; }, '导入来源');
    if (this.origin === 'file') {
      Button({ type: ButtonType.Normal }) {
        Column({ space: 5 }) {
          Stack({ alignContent: Alignment.Center }) {
            Image(readerActionIcon('import', this.scheme)).width(18).height(18).accessibilityLevel('no');
          }.width(36).height(36).borderRadius(18).backgroundColor(this.color('app.sourceUi.selected'));
          this.label('选择本地书源文件', 13.5, 'TOK_INK', true);
          Text(this.state.fileName.length > 0 ? this.state.fileName : '.json / .txt')
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11.5).fontColor(this.color('TOK_MUTED'))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }.width('100%').padding({ left: 12, right: 12, top: 14, bottom: 14 });
      }.id('reader-source-v9-import-file').width('100%').padding(0).borderRadius(14)
        .backgroundColor(this.color('app.sourceUi.surface'))
        .border({ width: 1, style: BorderStyle.Dashed, color: this.color('TOK_PRIMARY_BORDER') })
        .enabled(this.editable()).accessibilityText('选择本地书源文件')
        .onClick((): void => { if (this.editable()) void this.flow?.chooseFile(); });
    } else if (this.origin === 'url') {
      Column({ space: 8 }) {
        this.field('书源链接', this.url, 'https://…', (value: string): void => { this.url = value; });
      }.width('100%').padding(13).backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14);
      Column({ space: 8 }) {
        Row() {
          this.label('同时保存为书源订阅', 13, 'TOK_INK', true);
          Blank();
          ReaderToggle({ checkedColor: sourceV9Primary(this.scheme), value: this.saveAsSubscription, accessibilityLabel: '同时保存为书源订阅',
            actionEnabled: this.editable(), onToggle: (next: boolean): void => {
              if (this.editable()) this.saveAsSubscription = next;
            } });
        }.width('100%');
        if (this.saveAsSubscription) {
          this.field('订阅名称（可选）', this.subscriptionName, '', (value: string): void => { this.subscriptionName = value; });
        }
      }.width('100%').padding(13).backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14);
    } else {
      Column({ space: 8 }) {
        this.label('JSON 内容', 12, 'TOK_MUTED', true);
        TextArea({ text: this.paste, placeholder: '粘贴一个书源对象或一组书源' })
          .height(168).width('100%').borderRadius(10).padding(12)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(12)
          .fontColor(this.color('TOK_INK')).placeholderColor(this.color('TOK_MUTED'))
          .backgroundColor(this.color('app.sourceUi.field')).accessibilityText('JSON 内容')
          .enabled(this.editable()).onChange((value: string): void => { if (this.editable()) this.paste = value; });
      }.width('100%').padding(13).alignItems(HorizontalAlign.Start)
        .backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14);
    }
  }

  @Builder
  private checkSettings(subscription: boolean) {
    if (!subscription) {
      this.segments(CHECK_MODES, this.checkMode, (id: string): void => { this.checkMode = id as SourceV9Mode; }, '检测模式');
    }
    this.segments(subscription ? SUBSCRIPTION_DEPTHS : IMPORT_DEPTHS, this.checkDepth,
      (id: string): void => { this.checkDepth = id as SourceV9Depth; }, '检测深度');
    if (this.checkMode === 'search') {
      this.field('自定义测试词', this.checkKeyword, '默认使用书源自带测试词或“我的”',
        (value: string): void => { this.checkKeyword = value; });
      Row({ space: 6 }) {
        ForEach(KEYWORDS, (word: string): void => {
          this.action(word, this.checkKeyword === word ? 'primary' : 'neutral', this.editable(),
            (): void => { this.checkKeyword = word; }, 28);
        }, (word: string): string => word);
      }.width('100%');
    }
  }

  @Builder
  private checkProgress() {
    if (this.state.totalChecks > 0) {
      Column({ space: 5 }) {
        this.label(this.state.runningCheck && this.state.checkingName ?
          this.state.checkingName + (this.state.checkingStage ? ' · ' + this.state.checkingStage : '') : '检测进度', 12, 'TOK_INK', true);
        Progress({ value: this.state.completedChecks, total: this.state.totalChecks, type: ProgressType.Linear })
          .width('100%').color(this.primary()).backgroundColor(this.color('app.sourceUi.field'));
        this.label(this.state.completedChecks + ' / ' + this.state.totalChecks + ' · 通过 ' +
          (this.state.completedChecks - this.state.checkFailures - this.state.unavailableChecks) +
          ' · 未通过 ' + this.state.checkFailures, 11, 'TOK_MUTED');
        if (this.state.status.length > 0 && !this.state.runningCheck) this.label(this.state.status, 11, 'TOK_MUTED');
      }.width('100%').alignItems(HorizontalAlign.Start);
    }
    if (this.state.checkIssue.length > 0) {
      ReaderPageState({ variant: 'inline', padded: false, message: this.state.checkIssue });
    }
  }

  @Builder
  private checkPanel(subscription: boolean) {
    Column({ space: 8 }) {
      if (!subscription) {
        Row() {
          this.label('导入前可用性检测', 13, 'TOK_INK', true);
          Blank();
          ReaderToggle({ checkedColor: sourceV9Primary(this.scheme), value: this.state.checkSupported && this.checkEnabled, accessibilityLabel: '导入前可用性检测',
            actionEnabled: this.editable() && this.state.checkSupported,
            onToggle: (next: boolean): void => { if (this.editable()) this.checkEnabled = next; } });
        }.width('100%');
      }
      if ((subscription || this.checkEnabled) && this.state.checkSupported) {
        this.checkSettings(subscription);
        this.checkProgress();
        Row({ space: 6 }) {
          this.action(this.state.runningCheck ? '停止检测' : '开始检测',
            this.state.runningCheck ? 'danger' : 'primary',
            this.state.runningCheck || (this.editable() && (subscription || this.selectedImportCount() > 0)),
            (): void => this.startCheck(subscription));
          if (!this.state.runningCheck && this.state.completedChecks > 0) {
            this.action('仅选通过', 'neutral', this.editable(), (): void => {
              if (subscription) this.flow?.choosePassingReviewRows();
              else this.flow?.chooseImportRows(true, true);
            });
          }
        }.width('100%');
      } else if (!this.state.checkSupported) {
        ReaderPageState({ variant: 'inline', padded: false, message: this.state.checkIssue ||
          '当前 Core 不支持临时书源检测，可跳过检测' });
      }
    }.width('100%').padding(12).alignItems(HorizontalAlign.Start)
      .backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14);
  }

  @Builder
  private groupPanel() {
    Column({ space: 8 }) {
      this.label('分组归属', 13, 'TOK_INK', true);
      this.segments(GROUP_STRATEGIES, this.strategy,
        (id: string): void => { this.strategy = id as SourceV9GroupStrategy; }, '分组归属');
      if (this.strategy !== 'preserve') {
        Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(6), cross: LengthMetrics.vp(6) } }) {
          ForEach(this.state.groups, (group: SourceGroupRecord): void => {
            this.action(group.name, this.groupId === group.groupId && !this.createGroup ? 'primary' : 'neutral',
              this.editable(), (): void => { this.groupId = group.groupId; this.createGroup = false; }, 28);
          }, (group: SourceGroupRecord): string => group.groupId);
          this.action('＋ 新建分组', this.createGroup ? 'primary' : 'neutral', this.editable(),
            (): void => { this.createGroup = true; this.groupId = ''; }, 28);
        }.width('100%');
        if (this.createGroup) {
          this.field('新分组名称', this.groupName, '', (value: string): void => { this.groupName = value; });
        }
      }
    }.width('100%').padding(12).alignItems(HorizontalAlign.Start)
      .backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14);
  }

  @Builder
  private importReview() {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween,
      space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(4) } }) {
      this.label('静态校验 · 共 ' + this.state.rows.length + ' 项', 12, 'TOK_INK', true);
      this.label('通过 ' + this.supportedImportCount(), 12, 'app.status.good');
      if (this.unsupportedImportCount() > 0) {
        this.label('已自动过滤不支持 ' + this.unsupportedImportCount(), 12, 'TOK_DANGER');
      }
      if (this.state.rows.length - this.supportedImportCount() - this.unsupportedImportCount() > 0) {
        this.label('无效 ' + (this.state.rows.length - this.supportedImportCount() - this.unsupportedImportCount()), 12, 'TOK_DANGER');
      }
    }.id('reader-source-v9-import-review').width('100%').padding(10).backgroundColor(this.color('app.sourceUi.field')).borderRadius(12);
    this.checkPanel(false);
    this.groupPanel();
    Row({ space: 5 }) {
      this.label('已选 ' + this.selectedImportCount() + ' / ' + this.supportedImportCount(), 12, 'TOK_MUTED');
      Blank();
      this.action('全选', 'neutral', this.editable() && this.supportedImportCount() > 0,
        (): void => this.flow?.chooseImportRows(true), 28);
      this.action('清空', 'text', this.editable() && this.selectedImportCount() > 0,
        (): void => this.flow?.chooseImportRows(false), 28);
    }.width('100%');
    Column() {
      ForEach(this.state.rows, (row: SourceV9ImportRow, index: number): void => {
        this.importRow(row, index);
      }, (row: SourceV9ImportRow): string => String(row.index) + ':' + String(row.selected) + ':' + (row.report?.traceId ?? ''));
    }.width('100%').backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14);
  }

  @Builder
  private importRow(row: SourceV9ImportRow, index: number) {
    Row({ space: 8 }) {
      this.checkbox(row.selected, this.editable() && row.candidate?.supported === true,
        row.candidate?.name ?? ('第 ' + (row.index + 1) + ' 项'), (checked: boolean): void => this.flow?.chooseImportRow(row.index, checked));
      Column({ space: 3 }) {
        Text(row.candidate?.name || ('第 ' + (row.index + 1) + ' 项')).maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis }).fontSize(13)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontColor(this.color('TOK_INK'));
        Text(row.problem ?? (row.candidate?.supported === false ? '已过滤 · 不支持的书源类型' :
          (row.candidate?.sourceId ?? ''))).maxLines(row.problem ? 3 : 1)
          .textOverflow({ overflow: TextOverflow.Ellipsis }).fontSize(11)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontColor(this.color(row.candidate?.supported === false || row.problem !== undefined ? 'TOK_DANGER' : 'TOK_MUTED'));
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      if (row.report !== undefined) this.reportAction(row.candidate?.name ?? '', row.report);
    }.width('100%').padding({ left: 9, right: 10, top: 8, bottom: 8 })
      .border({ width: { top: index === 0 ? 0 : 1 }, color: this.color('TOK_LINE') });
  }

  @Builder
  private reportAction(name: string, report: SourceCheckOutcome) {
    this.action(report.available ? '通过' : '未通过', report.available ? 'neutral' : 'danger',
      this.inputCurrent(), (): void => this.showReport(name, report), 28);
  }

  @Builder
  private importResult() {
    Column({ space: 7 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(readerActionIcon('check', this.scheme)).width(22).height(22).accessibilityLevel('no');
      }.width(44).height(44).borderRadius(22).backgroundColor(this.color('app.status.goodSoft'));
      this.label('导入完成', 17, 'TOK_INK', true);
      Row({ space: 8 }) {
        this.resultMetric('新增', this.state.importResult?.addedCount ?? 0);
        this.resultMetric('更新', this.state.importResult?.updatedCount ?? 0);
      }.width('100%');
      this.label('已自动过滤不支持 ' + (this.state.importResult?.unsupportedCount ?? 0) + ' 项', 12, 'TOK_MUTED');
      if ((this.state.importResult?.invalidCount ?? 0) > 0) {
        this.label('另有 ' + (this.state.importResult?.invalidCount ?? 0) + ' 项未通过静态校验', 12, 'TOK_MUTED');
      }
      if ((this.state.importResult?.failedCount ?? 0) > 0) {
        this.label('导入失败 ' + (this.state.importResult?.failedCount ?? 0) + ' 项', 12, 'TOK_DANGER');
      }
    }.id('reader-source-v9-import-result').width('100%').padding(13).backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14);
    Column() {
      Button({ type: ButtonType.Normal }) {
        Row() {
          this.label('导入详情', 13, 'TOK_INK', true);
          Blank();
          this.label(this.detailExpanded ? '⌃' : '⌄', 16, 'TOK_MUTED');
        }.width('100%').padding(12);
      }.width('100%').padding(0).backgroundColor(Color.Transparent)
        .accessibilityText(this.detailExpanded ? '收起导入详情' : '展开导入详情')
        .onClick((): void => { if (this.inputCurrent()) this.detailExpanded = !this.detailExpanded; });
      if (this.detailExpanded) {
        ForEach(this.state.importResult?.details ?? [], (detail: SourceV9TransferItemResult): void => {
          Row({ space: 8 }) {
            Text(detail.name).layoutWeight(1).fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
              .fontColor(this.color('TOK_INK')).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
            this.label(detail.outcome, 11, detail.outcome === '新增' || detail.outcome === '更新' ? 'TOK_MUTED' : 'TOK_DANGER');
          }.width('100%').padding(10).border({ width: { top: 1 }, color: this.color('TOK_LINE') });
        }, (detail: SourceV9TransferItemResult): string => String(detail.index));
      }
    }.width('100%').backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14).clip(true);
  }

  @Builder
  private resultMetric(title: string, count: number) {
    Column({ space: 2 }) {
      this.label(String(count), 19, 'app.sourceUi.primary', true);
      this.label(title, 11, 'TOK_MUTED');
    }.layoutWeight(1).padding(8).borderRadius(10).backgroundColor(this.color('app.sourceUi.field'));
  }

  @Builder
  private importFooter() {
    Row({ space: 8 }) {
      if (this.state.importStep === 1) {
        this.action(this.state.busy ? '读取中…' : '下一步：解析书源', 'primary', this.canParse(), (): void => {
          void this.flow?.parseImport({ origin: this.origin, url: this.url, paste: this.paste });
        }, 40, undefined, 1, 'reader-source-v9-import-parse');
      } else if (this.state.importStep === 2) {
        this.action((this.checkEnabled && this.state.completedChecks > 0 ? '导入已选 (' : '跳过检测并导入 (') +
          this.selectedImportCount() + ')', 'primary',
          this.editable() && this.selectedImportCount() > 0 && this.targetReady(),
          (): void => this.importSelected(), 40, undefined, 1, 'reader-source-v9-import-commit');
      } else {
        this.action('继续导入', 'neutral', this.editable(), (): void => this.resetImport(), 40, undefined, 1);
        this.action('返回书源列表', 'primary', !this.state.busy, (): void => this.back(),
          40, undefined, 1, 'reader-source-v9-import-return');
      }
    }.width('100%').constraintSize({ maxWidth: 640 }).padding({ left: 14, right: 14, top: 8, bottom: this.embeddedWide ? 10 : 12 })
      .border({ width: { top: 1 }, color: this.color('TOK_LINE') });
  }

  @Builder
  private subscriptionsPage() {
    Scroll() {
      Column({ space: 10 }) {
        Row({ space: 8 }) {
          this.label('共 ' + this.state.subscriptions.length + ' 个订阅', 13, 'TOK_MUTED');
          Blank();
          this.action('全部检查更新', 'primary', this.editable() && this.activeSubscriptions().length > 0,
            (): void => this.checkSubscriptions(this.activeSubscriptions()), 36);
        }.width('100%');
        if (this.state.subscriptions.length === 0 && !this.state.writePending && this.state.error.length > 0) {
          ReaderPageState({ variant: 'inline', padded: false, message: this.state.error, actionLabel: '重新读取订阅',
            actionEnabled: this.editable(),
            onAction: (_generation: number): void => { void this.flow?.loadSubscriptions(); } });
        }
        if (this.state.busy) {
          ReaderPageState({ variant: 'inline', loading: true, padded: false, message: '正在处理订阅' });
        }
        if (this.state.subscriptions.length === 0 && !this.state.busy && !this.state.error && !this.state.writePending) {
          Column() {
            ReaderPageState({ variant: 'inline', message: '暂无订阅' });
          }.width('100%').backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14);
        } else {
          Column() {
            ForEach(this.state.subscriptions, (sub: ManagedRuleSubscription, index: number): void => {
              this.subscriptionRow(sub, index);
            }, (sub: ManagedRuleSubscription): string => [sub.id, sub.name, sub.url, sub.type, sub.update, sub.autoUpdate].join(':'));
          }.width('100%').backgroundColor(this.color('app.sourceUi.surface')).borderRadius(14);
        }
      }.width('100%').constraintSize({ maxWidth: 640 }).padding({ left: 14, right: 14, top: 12, bottom: 18 });
    }.width('100%').layoutWeight(1).align(Alignment.Top).scrollBar(BarState.Off);
  }

  @Builder
  private subscriptionRow(sub: ManagedRuleSubscription, index: number) {
    Column({ space: 7 }) {
      Row({ space: 8 }) {
        Column({ space: 3 }) {
          Row({ space: 6 }) {
            Text(sub.name).fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
              .fontColor(this.color('TOK_INK')).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
            this.label(sub.type === 0 ? '书源' : '净化规则', 10, 'TOK_MUTED');
          }.width('100%');
          Text((httpUrlHostname(sub.url) ?? sub.url) + ' · ' +
            (sub.update > 0 ? new Date(sub.update).toLocaleDateString() : '尚未更新'))
            .fontSize(11).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontColor(this.color('TOK_MUTED'))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }.layoutWeight(1).alignItems(HorizontalAlign.Start);
        ReaderToggle({ checkedColor: sourceV9Primary(this.scheme), value: sub.autoUpdate, accessibilityLabel: '启用' + sub.name + '订阅',
          inputIdentity: String(sub.id), actionEnabled: this.editable(), onToggle: (next: boolean): void => {
            if (this.editable()) void this.flow?.saveSubscription({ id: sub.id, name: sub.name,
              url: sub.url, type: sub.type, customOrder: sub.customOrder, update: sub.update, autoUpdate: next });
          } });
      }.width('100%');
      Row({ space: 5 }) {
        this.action('检查更新', 'neutral', this.editable() && sub.autoUpdate,
          (): void => this.checkSubscriptions([sub.id]), 28);
        this.action('编辑', 'neutral', this.editable(), (): void => this.openForm(sub), 28);
        Blank();
        this.action('删除', 'danger', this.editable(), (): void => {
          this.edited = sub;
          this.dialog = 'delete';
        }, 28);
      }.width('100%');
    }.width('100%').padding(12).border({ width: { top: index === 0 ? 0 : 1 }, color: this.color('TOK_LINE') });
  }

  @Builder
  private subscriptionReview() {
    Stack({ alignContent: Alignment.Center }) {
      this.scrim();
      ReaderDialogSurface({ specId: 'source-v9-check', primarySurfaceColor: sourceV9Primary(this.scheme), title: '订阅更新预览', showCloseButton: true,
        onClose: (): void => this.flow?.closeReviews(),
        actions: [new DialogActionView('cancel', '取消', 'default', !this.state.busy, true),
          new DialogActionView('apply', '应用更新 (' + this.applyCount() + ')', 'primary',
            this.editable() && this.applyCount() > 0)],
        onAction: (action: string): void => {
          if (!this.inputCurrent()) return;
          if (action === 'cancel') this.flow?.closeReviews();
          else if (this.editable()) void this.flow?.applyReviews();
        },
        body: (): void => { this.reviewBody(); },
      });
    }.width('100%').height('100%').align(Alignment.Center)
      .accessibilityLevel(this.visibleReport === undefined ? 'auto' : 'no-hide-descendants');
  }

  @Builder
  private reviewBody() {
    Scroll() {
      Column({ space: 9 }) {
        if (this.state.error.length > 0) {
          ReaderPageState({ variant: 'inline', padded: false, message: this.state.error });
        }
        if (this.reviewHasSources()) this.checkPanel(true);
        if (this.state.checkIssue.length > 0 && this.state.totalChecks === 0 && this.state.checkSupported) {
          ReaderPageState({ variant: 'inline', padded: false, message: this.state.checkIssue });
        }
        ForEach(this.state.reviews, (review: SourceV9SubscriptionReview): void => {
          this.reviewSubscription(review);
        }, (review: SourceV9SubscriptionReview): string => String(review.subscription.id));
      }.width('100%');
    }.width('100%').constraintSize({ maxHeight: this.modalBodyHeight }).scrollBar(BarState.Off);
  }

  @Builder
  private reviewSubscription(review: SourceV9SubscriptionReview) {
    Column({ space: 5 }) {
      this.label(review.subscription.name, 13, 'TOK_INK', true);
      if (review.rows.length === 0) this.label('没有变更', 12, 'TOK_MUTED');
      ForEach(CHANGE_GROUPS, (group: TransferChoice): void => {
        if (this.rowsOf(group.id, review).length > 0) {
          Column() {
            Row() {
              this.label(group.label + ' · ' + this.rowsOf(group.id, review).length, 11, 'TOK_MUTED', true);
            }.width('100%').padding(8).backgroundColor(this.color('app.sourceUi.field'));
            ForEach(this.rowsOf(group.id, review), (row: SourceV9Change): void => {
              this.reviewRow(row);
            }, (row: SourceV9Change): string => row.key + ':' + String(row.selected) + ':' +
              String(row.overwrite) + ':' + (row.report?.traceId ?? ''));
          }.width('100%').borderRadius(10).clip(true).border({ width: 1, color: this.color('TOK_LINE') });
        }
      }, (group: TransferChoice): string => group.id);
    }.width('100%').alignItems(HorizontalAlign.Start);
  }

  @Builder
  private reviewRow(row: SourceV9Change) {
    Row({ space: 5 }) {
      this.checkbox(row.selected, this.editable() && row.selectable && (row.kind !== 'conflict' || row.overwrite),
        row.name, (checked: boolean): void => this.flow?.selectReviewRow(row.key, checked));
      Column({ space: 4 }) {
        Text(row.name).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontColor(this.color('TOK_INK'));
        if (row.sourceId !== undefined) {
          Text(row.sourceId).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontSize(10).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontColor(this.color('TOK_MUTED'));
        }
        if (row.kind === 'conflict' && !row.selectable) {
          this.label('当前 Core 无法按版本覆盖，保留本地', 11, 'TOK_MUTED');
        } else if (row.kind === 'conflict') {
          Row({ space: 4 }) {
            this.action('覆盖', row.overwrite ? 'primary' : 'neutral', this.editable() && row.selectable,
              (): void => this.flow?.resolveReviewConflict(row.key, true), 24);
            this.action('保留本地', !row.overwrite ? 'primary' : 'neutral', this.editable() && row.selectable,
              (): void => this.flow?.resolveReviewConflict(row.key, false), 24);
          }.width('100%');
        }
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      if (row.report !== undefined) this.reportAction(row.name, row.report);
    }.width('100%').padding(6).border({ width: { top: 1 }, color: this.color('TOK_LINE') });
  }

  @Builder
  private subscriptionDialog() {
    Stack({ alignContent: Alignment.Center }) {
      this.scrim();
      ReaderDialogSurface({ specId: 'source-v9-check', primarySurfaceColor: sourceV9Primary(this.scheme),
        title: this.dialog === 'delete' ? '删除订阅' : this.edited === undefined ? '新建订阅' : '编辑订阅',
        actions: [new DialogActionView('cancel', '取消', 'default', !this.state.busy, true),
          new DialogActionView('confirm', this.dialog === 'delete' ? '删除订阅' : '保存',
            this.dialog === 'delete' ? 'danger' : 'primary',
            this.editable() && (this.dialog === 'delete' || (this.formName.trim().length > 0 && this.formUrl.trim().length > 0)))],
        onAction: (action: string): void => { void this.confirmDialog(action); },
        body: (): void => {
          if (this.dialog === 'delete') this.deleteBody();
          else this.formBody();
        },
      });
    }.width('100%').height('100%');
  }

  @Builder
  private deleteBody() {
    Column({ space: 7 }) {
      this.label(this.edited?.name ?? '', 13, 'TOK_INK', true);
      this.label(this.edited?.type === 2 ? '已导入的净化规则将保留。' : '已导入的书源将保留。', 12, 'TOK_MUTED');
      if (this.state.error.length > 0 && !this.state.writePending) {
        ReaderPageState({ variant: 'inline', padded: false, message: this.state.error });
      }
    }.width('100%').alignItems(HorizontalAlign.Start);
  }

  @Builder
  private formBody() {
    Scroll() {
      Column({ space: 8 }) {
        this.field('订阅名称', this.formName, '', (value: string): void => { this.formName = value; });
        this.field('订阅链接', this.formUrl, 'https://…', (value: string): void => { this.formUrl = value; });
        this.segments(SUBSCRIPTION_TYPES, String(this.formType),
          (id: string): void => { this.formType = id === '0' ? 0 : 2; }, '订阅类型');
        Row() {
          this.label('自动检查更新', 13, 'TOK_INK', true);
          Blank();
          ReaderToggle({ checkedColor: sourceV9Primary(this.scheme), value: this.formEnabled, accessibilityLabel: '自动检查更新', actionEnabled: this.editable(),
            onToggle: (next: boolean): void => { if (this.editable()) this.formEnabled = next; } });
        }.width('100%');
        if (this.state.error.length > 0 && !this.state.writePending) {
        ReaderPageState({ variant: 'inline', padded: false, message: this.state.error });
      }
      }.width('100%');
    }.width('100%').constraintSize({ maxHeight: this.modalBodyHeight }).scrollBar(BarState.Off);
  }

  @Builder
  private scrim() {
    Rect().width('100%').height('100%').fill(this.color('app.scrim.warmModal'))
      .accessibilityLevel('no').onClick((): void => { if (this.inputCurrent()) this.consumeBack(); });
  }

  @Builder
  private reportDialog() {
    Stack({ alignContent: Alignment.Center }) {
      this.scrim();
      ReaderDialogSurface({ specId: 'source-v9-check', primarySurfaceColor: sourceV9Primary(this.scheme), title: '检测详情', showCloseButton: true,
        onClose: (): void => { this.visibleReport = undefined; },
        actions: [new DialogActionView('close', '关闭', 'default', true, true)],
        onAction: (_action: string): void => { this.visibleReport = undefined; },
        body: (): void => { this.reportBody(); },
      });
    }.width('100%').height('100%');
  }

  @Builder
  private reportBody() {
    Scroll() {
      Column({ space: 8 }) {
        this.label(this.reportName, 13, 'TOK_INK', true);
        this.label((this.visibleReport?.available ? '通过' : '未通过') + ' · ' +
          (this.visibleReport?.durationMs ?? 0) + ' ms', 12, this.visibleReport?.available ? 'app.status.good' : 'TOK_DANGER');
        if (this.visibleReport?.failureReason) this.label(this.visibleReport?.failureReason ?? '', 12, 'TOK_MUTED');
        ForEach(this.visibleReport?.report?.steps ?? [], (step: SourceCheckReportStep): void => {
          Column({ space: 4 }) {
            Row({ space: 6 }) {
              this.label(step.level, 12, 'TOK_INK', true);
              this.label(this.reportStepStatus(step), 11,
                step.status === 'pass' ? 'app.status.good' : step.status === 'fail' ? 'TOK_DANGER' : 'TOK_MUTED');
              Blank();
              if (step.executed) this.label(step.durationMs + ' ms', 11, 'TOK_MUTED');
            }.width('100%');
            if (step.reason !== undefined) this.label(step.reason, 11, 'TOK_MUTED');
          }.width('100%').padding(7).alignItems(HorizontalAlign.Start)
            .backgroundColor(this.color('app.sourceUi.field')).borderRadius(8);
        }, (step: SourceCheckReportStep): string => step.level);
      }.width('100%').alignItems(HorizontalAlign.Start);
    }.width('100%').constraintSize({ maxHeight: this.modalBodyHeight }).scrollBar(BarState.Off);
  }
}
