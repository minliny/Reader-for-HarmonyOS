import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { LengthMetrics } from '@kit.ArkUI';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { APP_FLOATING_HEADER_BAR_HEIGHT } from '../../../ui/foundation/ReaderHeaderMetrics';
import { readerMotionAnimateParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerAppColor, type ReaderAppColorRole } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import type { ReaderWindowMetricsSnapshot } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerFloatingBarBottomInset } from '../../../ui/layout/ReaderFloatingBarMetrics';
import { readerFrameStyle, type ReaderFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { readerKeyboardHostBottom } from '../../../ui/layout/ReaderKeyboardGeometry';
import { applyReaderStandardFloatingHeader, ReaderPageGeometry, ReaderPageGeometryInput,
  resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { readerPageAreaLength, READER_STANDARD_PAGE_CONTENT_GAP } from '../../../ui/layout/ReaderPageShell';
import { DialogActionView, readerDialogCardTransition, readerDialogScrimTransition,
  ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import { sourceV9DisplayUrl } from '../presentation/SourceManagementV9';
import { SourceV9ReportSteps } from './SourceV9CheckDialog';
import { SourceV9AddAction, SourceV9CircleCheck, SourceV9SegmentedTrack, type SourceV9SegmentChoice } from './SourceV9Chrome';
import { httpUrlHostname } from '../../../platform/network/HttpTransportPolicy';
import type { ManagedRuleSubscription, RuleSubscriptionDraft, RuleSubscriptionType } from '../../settings/application/RulesManagementGateway';
import type { SourceCheckOutcome, SourceGroupRecord, SourceImportGroupTarget } from '../application/SourceGateway';
import { EMPTY_SOURCE_V9_TRANSFER, SourceV9TransferOwner, type SourceV9CheckOptions, type SourceV9SubscriptionReview,
  type SourceV9ConfirmedImport, type SourceV9PartialApplyDetail, type SourceV9PartialApplyItem,
  type SourceV9PartialSubscriptionApply, type SourceV9TransferItemResult, type SourceV9TransferSnapshot } from '../application/SourceV9TransferOwner';
import { sourceV9ChangesToApply, sourceV9SelectedImportRows, type SourceV9Change, type SourceV9ChangeKind,
  type SourceV9Depth, type SourceV9GroupStrategy, type SourceV9ImportedReport, type SourceV9ImportOrigin,
  type SourceV9ImportRow, type SourceV9Mode, type SourceV9TransferPane } from '../application/SourceV9TransferState';

type TransferButtonTone = 'primary' | 'secondary' | 'neutral' | 'danger' | 'text';
type TransferDialog = 'none' | 'form' | 'delete';

const TRANSFER_FOOTER_TOP = 8;
const TRANSFER_BODY_TAIL = 12;
const TRANSFER_MAX_WIDTH = 640;
const TRANSFER_HEADER_ACTION_WIDTH = 80;
const IMPORT_STEP_LABELS: string[] = ['选择来源', '校验与检测', '完成'];
const IMPORT_ORIGINS: SourceV9SegmentChoice[] = [
  { id: 'file', label: '本地文件' }, { id: 'url', label: '在线链接' }, { id: 'paste', label: '粘贴 JSON' },
];
const GROUP_STRATEGIES: SourceV9SegmentChoice[] = [
  { id: 'preserve', label: '保留原分组' }, { id: 'fill', label: '补全未分组' }, { id: 'all', label: '统一归入' },
];
const CHECK_MODES: SourceV9SegmentChoice[] = [{ id: 'search', label: '搜索' }, { id: 'explore', label: '发现' }];
const IMPORT_DEPTHS: SourceV9SegmentChoice[] = [
  { id: 'L2', label: 'L2 快速' }, { id: 'L4', label: 'L4 目录' }, { id: 'L5', label: 'L5 正文' },
];
const SUBSCRIPTION_DEPTHS: SourceV9SegmentChoice[] = [{ id: 'L2', label: 'L2 快速' }, { id: 'L5', label: 'L5 正文' }];
const SUBSCRIPTION_TYPES: SourceV9SegmentChoice[] = [{ id: '0', label: '书源' }, { id: '2', label: '净化规则' }];
const KEYWORDS: string[] = ['我的', '斗破', '海贼'];

@Component
export struct SourceV9TransferPage {
  @StorageProp('readerNavigationAppearancePreferences')
  private appearancePreferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @StorageLink('readerWindowMetricsRevision') @Watch('refreshLayout') private windowRevision: number = 0;
  @Prop @Watch('refreshLayout') pane: SourceV9TransferPane = 'import';
  @Prop initialUrl: string = '';
  @Prop initialJson: string = '';
  @Prop @Watch('refreshLayout') embeddedWide: boolean = false;
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
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private paneWidth: number = 0;
  @State private paneHeight: number = 0;
  @State private paneX: number = 0;
  @State private paneY: number = 0;
  private headerHeight: number = APP_FLOATING_HEADER_BAR_HEIGHT;
  private footerHeight: number = 0;
  private flow: SourceV9TransferOwner | undefined = undefined;
  private mounted: boolean = false;
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();

  aboutToAppear(): void {
    this.mounted = true;
    this.refreshLayout();
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

  private canDismissDialog(): boolean {
    return this.inputCurrent() && !this.state.busy && this.dialog !== 'none';
  }

  private consumeBack(): boolean {
    if (!this.mounted) return false;
    if (this.visibleReport !== undefined) {
      this.visibleReport = undefined;
      return true;
    }
    if (this.state.busy) return true;
    if (this.canDismissDialog()) {
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
    if (action === 'cancel') {
      if (this.canDismissDialog()) this.dialog = 'none';
      return;
    }
    if (action !== 'confirm' || !this.editable() || this.dialog === 'none') return;
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

  private color(role: ReaderAppColorRole): string { return readerAppColor(role, this.scheme); }

  private primary(): string { return this.color('app.sourceUi.primary'); }

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

  private touchRegion(height: number): Rectangle {
    return { x: 0, y: Math.min(0, (height - 44) / 2), width: '100%', height: Math.max(44, height) };
  }

  private stepTransition(): TransitionEffect {
    const effect = this.reduceMotion ? TransitionEffect.OPACITY :
      TransitionEffect.OPACITY.combine(TransitionEffect.translate({ y: 6 }));
    return effect.animation(readerMotionAnimateParam('app.navigation.tab', this.reduceMotion));
  }

  private formatSubscriptionUpdate(timestamp: number): string {
    const date = new Date(timestamp);
    if (timestamp <= 0 || !Number.isFinite(date.getTime())) return '尚未更新';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
  }

  private refreshLayout(): void {
    if (!this.mounted) return;
    const metrics = readerWindowMetrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.originX = this.embeddedWide ? this.paneX : undefined;
    input.viewportWidth = this.paneWidth;
    input.viewportHeight = this.paneHeight;
    input.headerHeight = this.headerHeight;
    applyReaderStandardFloatingHeader(input);
    input.contentGap = READER_STANDARD_PAGE_CONTENT_GAP;
    input.contentMaxWidth = TRANSFER_MAX_WIDTH;
    input.contentHorizontalPadding = 19;
    input.contentHorizontalSafeArea = 'interactive';
    input.footerBottom = readerFloatingBarBottomInset(metrics, TRANSFER_BODY_TAIL);
    if (this.paneHeight > 0) {
      input.footerBottom = Math.max(input.footerBottom, this.paneHeight - this.visiblePaneHeight(metrics));
    }
    input.footerHeight = this.pane === 'import' ? Math.max(this.footerHeight, this.footerButtonHeight() + TRANSFER_FOOTER_TOP) : 0;
    input.contentEndInset = input.footerHeight + input.footerBottom;
    this.geometry = resolveReaderPageGeometry(input);
  }

  private frameStyle(): ReaderFrameStyle {
    const background = this.color('TOK_PAPER');
    return readerFrameStyle({ backgroundColor: background, headerTransparent: true,
      headerBackground: background, footerBackground: background });
  }

  private footerButtonHeight(): number {
    return readerScaledControlHeight(44, 18, readerReadableFontScale(readerWindowMetrics().systemFontScale));
  }

  private visiblePaneHeight(metrics: ReaderWindowMetricsSnapshot): number {
    const height = this.paneHeight > 0 ? this.paneHeight : metrics.windowRect.height;
    const keyboardVisible = metrics.keyboardArea.available ? metrics.keyboardArea.visible : metrics.keyboardInsets.bottom > 0;
    if (!keyboardVisible) return height;
    const width = this.paneWidth > 0 ? this.paneWidth : metrics.windowRect.width;
    return Math.min(height, readerKeyboardHostBottom(metrics, this.paneY, height, this.paneX, width));
  }

  private modalViewportHeight(): number {
    if (this.windowRevision < 0) return this.paneHeight;
    return this.visiblePaneHeight(readerWindowMetrics());
  }

  private modalBodyHeight(): number {
    const height = this.modalViewportHeight();
    if (height <= 0 && this.paneHeight <= 0) return 430;
    const fontScale = readerReadableFontScale(readerWindowMetrics().systemFontScale);
    return Math.max(72, Math.min(480, height - 156 - 52 * (fontScale - 1)));
  }

  private recordPaneArea(area: Area): void {
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    const x = readerPageAreaLength(area.globalPosition.x);
    const y = readerPageAreaLength(area.globalPosition.y);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 ||
      !Number.isFinite(x) || !Number.isFinite(y) ||
      (width === this.paneWidth && height === this.paneHeight && x === this.paneX && y === this.paneY)) return;
    this.paneX = x;
    this.paneY = y;
    this.paneWidth = width;
    this.paneHeight = height;
    this.refreshLayout();
  }

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {
        ReaderPageScaffold({ frameStyle: this.frameStyle(), geometry: this.geometry,
          header: (): void => { this.header(); },
          content: (): void => { this.body(); },
          footer: (): void => { if (this.pane === 'import') this.importFooter(); },
          onHeaderHeightChange: (height: number): void => {
            if (height <= 0 || height === this.headerHeight) return;
            this.headerHeight = height;
            this.refreshLayout();
          },
          onFooterHeightChange: (height: number): void => {
            if (height === this.footerHeight) return;
            this.footerHeight = height;
            this.refreshLayout();
          },
        });
      }.width('100%').height('100%')
        .accessibilityLevel(this.dialog !== 'none' || this.state.reviews.length > 0 || this.visibleReport !== undefined ?
          'no-hide-descendants' : 'auto');
      this.pendingRecovery();
      if (this.state.reviews.length > 0) this.modalFrame('review');
      if (this.dialog !== 'none') this.modalFrame('edit');
      if (this.visibleReport !== undefined) this.modalFrame('report');
    }.id(this.pane === 'import' ? 'reader-source-v9-import' : 'reader-source-v9-subscriptions')
      .width('100%').height('100%').clip(true)
      .onAreaChange((_old: Area, next: Area): void => this.recordPaneArea(next));
  }

  @Builder
  private header() {
    if (this.pane === 'subscriptions') {
      PageBackBar({ floating: true, centered: true, elevation: 'floating', title: '书源订阅',
        trailingWidthVp: TRANSFER_HEADER_ACTION_WIDTH, balancedCenteredSlots: true,
        backFocusId: 'reader-source-v9-transfer-back', onBack: (): void => this.back(),
        trailing: (): void => {
          SourceV9AddAction({ label: '新建', actionEnabled: this.editable(),
            controlId: 'reader-source-v9-subscription-create', onTap: (): void => this.openForm() });
        },
      });
    } else {
      PageBackBar({ floating: true, centered: true, elevation: 'floating', title: '导入书源',
        backFocusId: 'reader-source-v9-transfer-back', onBack: (): void => this.back() });
    }
  }

  @Builder
  private body() {
    Column() {
      if (this.pane === 'import') this.importPage();
      else this.subscriptionsPage();
    }.width('100%').height('100%').padding({ left: this.geometry.content.frame.left,
      right: this.geometry.content.frame.right, top: this.geometry.content.startInset,
      bottom: this.geometry.content.endInset });
  }

  @Builder
  private label(value: string, size: number, role: ReaderAppColorRole = 'TOK_INK', strong: boolean = false) {
    Text(value).fontSize(size).fontColor(this.color(role))
      .fontFamily(strong ? READER_FONT_NOTO_SANS_SC_UI_MEDIUM : READER_FONT_NOTO_SANS_SC_UI_REGULAR);
  }

  @Builder
  private action(label: string, tone: TransferButtonTone, enabled: boolean, run: () => void,
    height: number = 32, width: number | undefined = undefined, weight: number | undefined = undefined, id: string = '') {
    Button(label, { type: ButtonType.Capsule, stateEffect: false }).id(id).height(height).width(width).layoutWeight(weight)
      .padding({ left: 12, right: 12 }).fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
      .fontColor(this.toneInk(tone)).attributeModifier(new ReaderPressFeedback(this.toneSurface(tone),
        this.scheme, height / 2, height / 2, enabled))
      .enabled(enabled).opacity(enabled ? 1 : 0.45).responseRegion(this.touchRegion(height))
      .onClick((): void => { if (enabled && this.inputCurrent()) run(); });
  }

  @Builder
  private segments(choices: SourceV9SegmentChoice[], active: string, emit: (id: string) => void,
    accessibilityLabel: string, idPrefix: string) {
    SourceV9SegmentedTrack({ choices: choices, selected: active, idPrefix, accessibilityLabel,
      actionEnabled: this.editable(), onSelect: (id: string): void => { if (this.editable()) emit(id); } });
  }

  @Builder
  private field(title: string, value: string, placeholder: string, emit: (value: string) => void) {
    Column({ space: 5 }) {
      this.label(title, 12, 'TOK_MUTED', true);
      TextInput({ text: value, placeholder }).height(40).width('100%').borderRadius(10)
        .border({ width: 1, color: this.color('TOK_LINE_STRONG') })
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13)
        .fontColor(this.color('TOK_INK')).placeholderColor(this.color('TOK_MUTED'))
        .backgroundColor(this.color('app.sourceUi.field')).accessibilityText(title)
        .enabled(this.editable()).onChange((next: string): void => { if (this.editable()) emit(next); });
    }.width('100%').alignItems(HorizontalAlign.Start);
  }

  @Builder
  private checkbox(checked: boolean, enabled: boolean, label: string, emit: (checked: boolean) => void) {
    SourceV9CircleCheck({ selected: checked, actionEnabled: enabled, label: label,
      onChange: (selected: boolean): void => { if (this.editable()) emit(selected); } });
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
          maxHeightVp: Math.min(this.modalBodyHeight(), Math.max(0, this.geometry.footer.top - this.geometry.content.startInset)),
          onReconcile: (generation: number): void => { void this.flow?.recoverPending(generation, false); },
          onSecondaryAction: (generation: number): void => { void this.flow?.recoverPending(generation, true); },
        });
      }.width('100%').padding({ left: this.geometry.content.frame.left,
        right: this.geometry.content.frame.right, top: this.geometry.content.startInset });
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
        ForEach([this.state.importStep], (step: number): void => {
          Column({ space: 10 }) {
            if (step === 1) this.importSource();
            else if (step === 2) this.importReview();
            else this.importResult();
          }.width('100%').alignItems(HorizontalAlign.Start).transition(this.stepTransition());
        }, (step: number): string => String(step));
      }.width('100%').padding({ bottom: 18 }).alignItems(HorizontalAlign.Start);
    }.width('100%').layoutWeight(1).align(Alignment.Top).scrollBar(BarState.Off);
  }

  @Builder
  private importStepper() {
    Row({ space: 6 }) {
      ForEach(IMPORT_STEP_LABELS, (label: string, index: number): void => {
        Row({ space: 6 }) {
          Stack({ alignContent: Alignment.Center }) {
            if (this.state.importStep > index + 1) {
              Image(readerActionIcon('check', this.scheme)).width(11).height(11)
                .fillColor(this.color('app.sourceUi.onPrimary')).accessibilityLevel('no');
            } else {
              Text(String(index + 1)).fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(11)
                .fontColor(this.state.importStep === index + 1 ? this.color('app.sourceUi.onPrimary') : this.color('TOK_MUTED'));
            }
          }.width(20).height(20).borderRadius(10).flexShrink(0)
            .backgroundColor(this.state.importStep >= index + 1 ? this.primary() : this.color('app.sourceUi.field'));
          this.label(label, 11.5, this.state.importStep === index + 1 ? 'TOK_INK' : 'TOK_MUTED', true);
          if (index < 2) {
            Blank().layoutWeight(1).height(1)
              .color(this.state.importStep > index + 1 ? this.primary() : this.color('TOK_LINE_STRONG'));
          }
        }.layoutWeight(index < 2 ? 1 : undefined)
          .accessibilityText(label).accessibilitySelected(this.state.importStep === index + 1);
      }, (label: string): string => label);
    }.width('100%').padding({ top: 4, bottom: 12 });
  }

  @Builder
  private importSource() {
    this.segments(IMPORT_ORIGINS, this.origin, (id: string): void => { this.origin = id as SourceV9ImportOrigin; },
      '导入来源', 'reader-source-v9-import-origin');
    if (this.origin === 'file') {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Column({ space: 5 }) {
          Stack({ alignContent: Alignment.Center }) {
            Image(this.scheme === 'night' ? $r('app.media.import_select_system_theme_night') :
              $r('app.media.import_select_system')).width(20).height(20).accessibilityLevel('no');
          }.width(36).height(36).borderRadius(18).backgroundColor(this.color('app.sourceUi.selected'));
          this.label('选择本地书源文件', 13.5, 'TOK_INK', true);
          Text(this.state.fileName.length > 0 ? this.state.fileName : '.json / .txt')
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11.5).fontColor(this.color('TOK_MUTED'))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }.width('100%').padding({ left: 12, right: 12, top: 14, bottom: 14 });
      }.id('reader-source-v9-import-file').width('100%').padding(0)
        .attributeModifier(new ReaderPressFeedback(this.color('TOK_CARD_BG'), this.scheme, 14, 14, this.editable()))
        .border({ width: 1, style: BorderStyle.Dashed, color: this.color('TOK_PRIMARY_BORDER') })
        .enabled(this.editable()).opacity(this.editable() ? 1 : 0.45).accessibilityText('选择本地书源文件')
        .onClick((): void => { if (this.editable()) void this.flow?.chooseFile(); });
    } else if (this.origin === 'url') {
      Column({ space: 8 }) {
        this.field('书源链接', this.url, 'https://…', (value: string): void => { this.url = value; });
      }.width('100%').padding(13).backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
        .border({ width: 1, color: this.color('TOK_LINE') });
      Column({ space: 8 }) {
        Row() {
          this.label('同时保存为书源订阅', 13, 'TOK_INK', true);
          Blank();
          ReaderToggle({ checkedColor: this.primary(), value: this.saveAsSubscription, accessibilityLabel: '同时保存为书源订阅',
            inputIdentity: 'source-v9-import-save-sub', actionEnabled: this.editable(), onToggle: (next: boolean): void => {
              if (this.editable()) this.saveAsSubscription = next;
            } });
        }.width('100%');
        if (this.saveAsSubscription) {
          this.field('订阅名称（可选）', this.subscriptionName, '', (value: string): void => { this.subscriptionName = value; });
        }
      }.width('100%').padding(13).backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
        .border({ width: 1, color: this.color('TOK_LINE') });
    } else {
      Column({ space: 8 }) {
        this.label('JSON 内容', 12, 'TOK_MUTED', true);
        TextArea({ text: this.paste, placeholder: '粘贴一个书源对象或一组书源' })
          .height(168).width('100%').borderRadius(10).padding(12)
          .border({ width: 1, color: this.color('TOK_LINE_STRONG') })
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(12)
          .fontColor(this.color('TOK_INK')).placeholderColor(this.color('TOK_MUTED'))
          .backgroundColor(this.color('app.sourceUi.field')).accessibilityText('JSON 内容')
          .enabled(this.editable()).onChange((value: string): void => { if (this.editable()) this.paste = value; });
      }.width('100%').padding(13).alignItems(HorizontalAlign.Start)
        .backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
        .border({ width: 1, color: this.color('TOK_LINE') });
    }
  }

  @Builder
  private checkSettings(subscription: boolean) {
    if (!subscription) {
      this.segments(CHECK_MODES, this.checkMode, (id: string): void => { this.checkMode = id as SourceV9Mode; },
        '检测模式', 'reader-source-v9-import-mode');
    }
    this.segments(subscription ? SUBSCRIPTION_DEPTHS : IMPORT_DEPTHS, this.checkDepth,
      (id: string): void => { this.checkDepth = id as SourceV9Depth; }, '检测深度',
      subscription ? 'reader-source-v9-subscription-depth' : 'reader-source-v9-import-depth');
    if (this.checkMode === 'search') {
      this.field('自定义测试词', this.checkKeyword, '默认使用书源自带测试词或“我的”',
        (value: string): void => { this.checkKeyword = value; });
      Row({ space: 6 }) {
        ForEach(KEYWORDS, (word: string): void => {
          this.action(word, this.checkKeyword === word ? 'primary' : 'neutral', this.editable(),
            (): void => { this.checkKeyword = this.checkKeyword === word ? '' : word; }, 28);
        }, (word: string): string => word);
      }.width('100%');
    }
  }

  @Builder
  private checkProgress() {
    if (this.state.totalChecks > 0) {
      Column({ space: 5 }) {
        Text(this.state.runningCheck ?
          `检测中 ${this.state.completedChecks + this.state.activeChecks}/${this.state.totalChecks}` +
          (this.state.checkingName ? ' · ' + this.state.checkingName : '') +
          (this.state.checkingStage ? ' · ' + this.state.checkingStage : '') : '检测进度')
          .fontSize(12).fontColor(this.color('TOK_INK')).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM);
        Progress({ value: this.state.completedChecks, total: this.state.totalChecks, type: ProgressType.Linear })
          .width('100%').color(this.primary()).backgroundColor(this.color('app.sourceUi.field'));
        Text(this.state.completedChecks + ' / ' + this.state.totalChecks + ' · 通过 ' +
          (this.state.completedChecks - this.state.checkFailures - this.state.unavailableChecks) +
          ' · 未通过 ' + this.state.checkFailures)
          .fontSize(11).fontColor(this.color('TOK_MUTED')).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR);
        if (this.state.status.length > 0 && !this.state.runningCheck) this.label(this.state.status, 11, 'TOK_MUTED');
      }.width('100%').alignItems(HorizontalAlign.Start);
    }
    if (this.state.checkIssue.length > 0) {
      ReaderPageState({ variant: 'inline', padded: false, message: this.state.checkIssue });
    }
  }

  @Builder
  private checkPanel(subscription: boolean) {
    Column({ space: 14 }) {
      if (!subscription) {
        Row() {
          this.label('导入前可用性检测', 13, 'TOK_INK', true);
          Blank();
          ReaderToggle({ checkedColor: this.primary(), value: this.state.checkSupported && this.checkEnabled, accessibilityLabel: '导入前可用性检测',
            inputIdentity: 'source-v9-import-check-toggle', actionEnabled: this.editable() && this.state.checkSupported,
            onToggle: (next: boolean): void => {
              if (!this.editable()) return;
              this.checkEnabled = next;
              if (!next) this.flow?.skipImportChecks();
            } });
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
      .backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
      .border({ width: 1, color: this.color('TOK_LINE') });
  }

  @Builder
  private groupPanel() {
    Column({ space: 8 }) {
      this.label('分组归属', 13, 'TOK_INK', true);
      this.segments(GROUP_STRATEGIES, this.strategy,
        (id: string): void => { this.strategy = id as SourceV9GroupStrategy; },
        '分组归属', 'reader-source-v9-import-group');
      if (this.strategy !== 'preserve') {
        Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(6), cross: LengthMetrics.vp(12) } }) {
          ForEach(this.state.groups, (group: SourceGroupRecord): void => {
            this.action(group.name, this.groupId === group.groupId && !this.createGroup ? 'primary' : 'neutral',
              this.editable(), (): void => { this.groupId = group.groupId; this.createGroup = false; }, 32);
          }, (group: SourceGroupRecord): string => group.groupId);
          SourceV9AddAction({ label: '新建分组', actionEnabled: this.editable(), selected: this.createGroup,
            controlId: 'reader-source-v9-import-new-group', onTap: (): void => { this.createGroup = true; this.groupId = ''; } });
        }.width('100%');
        if (this.createGroup) {
          this.field('新分组名称', this.groupName, '', (value: string): void => { this.groupName = value; });
        }
      }
    }.width('100%').padding(12).alignItems(HorizontalAlign.Start)
      .backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
      .border({ width: 1, color: this.color('TOK_LINE') });
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
      }, (row: SourceV9ImportRow): string => String(row.index) + ':' + String(row.selected) + ':' +
        (row.report?.traceId ?? 'history:' + (row.previousReport?.report.traceId ?? '')));
    }.width('100%').backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
      .border({ width: 1, color: this.color('TOK_LINE') }).clip(true);
  }

  private importCaption(row: SourceV9ImportRow): string {
    if (row.problem !== undefined) return row.problem;
    if (row.candidate?.supported === false) return '已过滤 · 不支持的书源类型';
    const domain = sourceV9DisplayUrl(row.candidate?.sourceId ?? '');
    const rawGroup = row.candidate?.bookSource['bookSourceGroup'] as string | undefined;
    const group = typeof rawGroup === 'string' ? rawGroup.trim() : '';
    return domain.length > 0 && group.length > 0 ? domain + ' · ' + group : domain || group;
  }

  @Builder
  private importRow(row: SourceV9ImportRow, index: number) {
    Row({ space: 8 }) {
      this.checkbox(row.selected, this.editable() && row.candidate?.supported === true,
        row.candidate?.name ?? ('第 ' + (row.index + 1) + ' 项'), (checked: boolean): void => this.flow?.chooseImportRow(row.index, checked));
      Column({ space: 3 }) {
        Row({ space: 5 }) {
          Text(row.candidate?.name || ('第 ' + (row.index + 1) + ' 项')).flexShrink(1).maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis }).fontSize(13)
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontColor(this.color('TOK_INK'));
          if (row.candidate?.supported === true && this.state.knownSourceIds.includes(row.candidate.sourceId)) {
            this.badge('更新', 'app.sourceUi.primary', 'app.sourceUi.selected');
          }
        }.width('100%');
        if (this.importCaption(row).length > 0) {
          Text(this.importCaption(row)).maxLines(row.problem ? 3 : 1)
            .textOverflow({ overflow: TextOverflow.Ellipsis }).fontSize(11)
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .fontColor(this.color(row.candidate?.supported === false || row.problem !== undefined ? 'TOK_DANGER' : 'TOK_MUTED'));
        }
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      if (row.report !== undefined) this.reportAction(row.candidate?.name ?? '', row.report);
      else if (row.previousReport !== undefined) this.reportAction(row.candidate?.name ?? '', row.previousReport.report, '历史');
    }.width('100%').padding({ left: 9, right: 10, top: 8, bottom: 8 })
      .border({ width: { top: index === 0 ? 0 : 1 }, color: this.color('TOK_LINE') });
  }

  @Builder
  private reportAction(name: string, report: SourceCheckOutcome, origin: '' | '历史' | '预检' = '') {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Text(origin + (origin === '历史' ? '报告' : report.available ? '通过' : '未通过'))
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(11).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontColor(this.color(origin === '历史' ? 'TOK_MUTED' : report.available ? 'app.status.good' : 'app.sourceUi.danger'));
    }.height(28).constraintSize({ minWidth: 44, maxWidth: 100 }).padding({ left: 8, right: 8 }).flexShrink(0)
      .attributeModifier(new ReaderPressFeedback(this.color(origin === '历史' ? 'app.sourceUi.field' : report.available ? 'app.status.goodSoft' :
        'app.sourceUi.dangerSurface'), this.scheme, 14, 14, this.inputCurrent()))
      .responseRegion({ x: 0, y: -8, width: '100%', height: 44 })
      .enabled(this.inputCurrent()).opacity(this.inputCurrent() ? 1 : 0.45)
      .onClick((): void => this.showReport(origin === '历史' ? name + ' · 历史报告' : name, report));
  }

  @Builder
  private badge(label: string, ink: ReaderAppColorRole, surface: ReaderAppColorRole) {
    Text(label).fontSize(10).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).flexShrink(0).maxLines(1)
      .padding({ left: 6, right: 6, top: 2, bottom: 2 }).borderRadius(5)
      .fontColor(this.color(ink)).backgroundColor(this.color(surface));
  }

  @Builder
  private importResult() {
    Column({ space: 7 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(readerActionIcon('check', this.scheme)).width(22).height(22)
          .fillColor(this.color('app.status.good')).accessibilityLevel('no');
      }.width(44).height(44).borderRadius(22).backgroundColor(this.color('app.status.goodSoft'));
      this.label('导入完成', 17, 'TOK_INK', true);
      Row({ space: 8 }) {
        this.resultMetric('新增', this.state.importResult?.addedCount ?? 0);
        this.resultMetric('更新', this.state.importResult?.updatedCount ?? 0);
      }.width('100%');
      if ((this.state.importResult?.unsupportedCount ?? 0) > 0) {
        this.label('已自动过滤不支持 ' + (this.state.importResult?.unsupportedCount ?? 0) + ' 项', 12, 'TOK_MUTED');
      }
      if ((this.state.importResult?.invalidCount ?? 0) > 0) {
        this.label('另有 ' + (this.state.importResult?.invalidCount ?? 0) + ' 项未通过静态校验', 12, 'TOK_MUTED');
      }
      if ((this.state.importResult?.failedCount ?? 0) > 0) {
        this.label('导入失败 ' + (this.state.importResult?.failedCount ?? 0) + ' 项', 12, 'TOK_DANGER');
      }
    }.id('reader-source-v9-import-result').width('100%').alignItems(HorizontalAlign.Center)
      .padding(13).backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
      .border({ width: 1, color: this.color('TOK_LINE') });
    Column() {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row() {
          this.label('导入详情', 13, 'TOK_INK', true);
          Blank();
          Image($r('app.media.reader_chevron_down')).width(12).height(12).objectFit(ImageFit.Contain)
            .fillColor(this.color('TOK_MUTED')).rotate({ angle: this.detailExpanded ? 180 : 0 })
            .animation(this.reduceMotion ? undefined : readerMotionAnimateParam('app.control.press', false))
            .accessibilityLevel('no');
        }.width('100%').constraintSize({ minHeight: 44 }).padding(12);
      }.width('100%').padding(0).enabled(this.inputCurrent())
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.scheme, 0, 0, this.inputCurrent()))
        .accessibilityText(this.detailExpanded ? '收起导入详情' : '展开导入详情')
        .onClick((): void => { if (this.inputCurrent()) this.detailExpanded = !this.detailExpanded; });
      if (this.detailExpanded) {
        Column() {
          ForEach(this.state.importResult?.details ?? [], (detail: SourceV9TransferItemResult): void => {
            Row({ space: 8 }) {
              Text(detail.name).layoutWeight(1).fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
                .fontColor(this.color('TOK_INK')).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
              this.label(detail.outcome, 11, detail.outcome === '新增' || detail.outcome === '更新' ? 'TOK_MUTED' : 'TOK_DANGER');
              if (detail.preflightReport !== undefined) this.reportAction(detail.name, detail.preflightReport, '预检');
            }.width('100%').padding(10).border({ width: { top: 1 }, color: this.color('TOK_LINE') });
          }, (detail: SourceV9TransferItemResult): string => String(detail.index));
        }.width('100%').transition(TransitionEffect.OPACITY.animation(
          readerMotionAnimateParam('app.control.press', this.reduceMotion)));
      }
    }.width('100%').backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
      .border({ width: 1, color: this.color('TOK_LINE') }).clip(true);
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
        }, this.footerButtonHeight(), undefined, 1, 'reader-source-v9-import-parse');
      } else if (this.state.importStep === 2) {
        this.action((this.checkEnabled && this.state.completedChecks > 0 ? '导入已选 (' : '跳过检测并导入 (') +
          this.selectedImportCount() + ')', 'primary',
          this.editable() && this.selectedImportCount() > 0 && this.targetReady(),
          (): void => this.importSelected(), this.footerButtonHeight(), undefined, 1, 'reader-source-v9-import-commit');
      } else {
        this.action('继续导入', 'neutral', this.editable(), (): void => this.resetImport(), this.footerButtonHeight(), undefined, 1);
        this.action('返回书源列表', 'primary', !this.state.busy, (): void => this.back(),
          this.footerButtonHeight(), undefined, 1, 'reader-source-v9-import-return');
      }
    }.width('100%').padding({ left: this.geometry.content.frame.left,
      right: this.geometry.content.frame.right, top: TRANSFER_FOOTER_TOP })
      .backgroundColor(this.color('TOK_PAPER'))
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
        if (this.state.partialSubscriptionApply !== undefined) {
          this.partialSubscriptionApply(this.state.partialSubscriptionApply);
        }
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
          }.width('100%').backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
            .border({ width: 1, color: this.color('TOK_LINE') }).clip(true);
        } else {
          Column() {
            ForEach(this.state.subscriptions, (sub: ManagedRuleSubscription, index: number): void => {
              this.subscriptionRow(sub, index);
            }, (sub: ManagedRuleSubscription): string => [sub.id, sub.name, sub.url, sub.type, sub.update, sub.autoUpdate].join(':'));
          }.width('100%').backgroundColor(this.color('TOK_CARD_BG')).borderRadius(14)
            .border({ width: 1, color: this.color('TOK_LINE') }).clip(true);
        }
      }.width('100%').padding({ bottom: 18 });
    }.width('100%').layoutWeight(1).align(Alignment.Top).scrollBar(BarState.Off);
  }

  @Builder
  private partialSubscriptionApply(result: SourceV9PartialSubscriptionApply) {
    Column({ space: 8 }) {
      this.label('本次应用已确认 ' + result.confirmedCount + ' / ' + result.selectedCount + ' 项', 13, 'TOK_INK', true);
      if (result.message.length > 0) this.label(result.message, 12, 'TOK_DANGER');
      ForEach(result.details, (detail: SourceV9PartialApplyDetail): void => {
        Column({ space: 5 }) {
          this.label(detail.name + ' · 已确认 ' + detail.confirmedCount + ' / ' + detail.items.length, 12, 'TOK_INK', true);
          ForEach(detail.items, (item: SourceV9PartialApplyItem): void => {
            Row({ space: 8 }) {
              Column({ space: 2 }) {
                this.label(item.name, 12, 'TOK_INK');
                if (item.sourceId !== undefined) this.label(sourceV9DisplayUrl(item.sourceId), 10, 'TOK_MUTED');
              }.layoutWeight(1).alignItems(HorizontalAlign.Start);
              this.label(item.confirmed ? '已确认' : '待核对', 11, item.confirmed ? 'app.status.good' : 'TOK_MUTED');
            }.width('100%');
          }, (item: SourceV9PartialApplyItem): string => item.key);
        }.width('100%').alignItems(HorizontalAlign.Start).padding(8).borderRadius(8)
          .backgroundColor(this.color('app.sourceUi.field'));
      }, (detail: SourceV9PartialApplyDetail): string => String(detail.subscriptionId));
    }.width('100%').alignItems(HorizontalAlign.Start).padding(12).borderRadius(14)
      .backgroundColor(this.color('TOK_CARD_BG'))
      .border({ width: 1, color: this.color('TOK_LINE') });
  }

  @Builder
  private subscriptionRow(sub: ManagedRuleSubscription, index: number) {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        Column({ space: 3 }) {
          Row({ space: 6 }) {
            Text(sub.name).flexShrink(1).fontSize(14).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
              .fontColor(this.color('TOK_INK')).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
            if (sub.type === 0) this.badge('书源', 'app.sourceUi.primary', 'app.sourceUi.selected');
            else this.badge('净化规则', 'app.status.warning', 'app.status.warningSoft');
          }.width('100%');
          Text((httpUrlHostname(sub.url) ?? '订阅链接不可用') + ' · ' + this.formatSubscriptionUpdate(sub.update))
            .fontSize(11).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontColor(this.color('TOK_MUTED'))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }.layoutWeight(1).alignItems(HorizontalAlign.Start);
        ReaderToggle({ checkedColor: this.primary(), value: sub.autoUpdate, accessibilityLabel: '启用' + sub.name + '订阅',
          inputIdentity: String(sub.id), actionEnabled: this.editable(), onToggle: (next: boolean): void => {
            if (this.editable()) void this.flow?.saveSubscription({ id: sub.id, name: sub.name,
              url: sub.url, type: sub.type, customOrder: sub.customOrder, update: sub.update, autoUpdate: next });
          } });
      }.width('100%');
      Row({ space: 5 }) {
        this.action('检查更新', 'neutral', this.editable(),
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
  private modalFrame(layer: 'review' | 'edit' | 'report') {
    Stack({ alignContent: Alignment.Top }) {
      this.scrim();
      Stack({ alignContent: Alignment.Center }) {
        Scroll() {
          Column() {
            if (layer === 'review') this.subscriptionReview();
            else if (layer === 'edit') this.subscriptionDialog();
            else this.reportDialog();
          }.width('100%');
        }.width('100%').constraintSize({ maxHeight: this.paneHeight > 0 ? this.modalViewportHeight() : undefined })
          .scrollBar(BarState.Auto).hitTestBehavior(HitTestMode.Transparent)
          .transition(readerDialogCardTransition(this.reduceMotion));
      }.width('100%').height(this.paneHeight > 0 ? this.modalViewportHeight() : '100%')
        .hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%')
      .accessibilityLevel(layer !== 'report' && this.visibleReport !== undefined ? 'no-hide-descendants' : 'auto')
      .transition(readerDialogScrimTransition(this.reduceMotion));
  }

  @Builder
  private subscriptionReview() {
    ReaderDialogSurface({ specId: 'source-v9-check', primarySurfaceColor: this.primary(),
      title: '订阅更新预览', showCloseButton: true, closeEnabled: this.inputCurrent() && !this.state.busy,
      containerWidthVp: this.paneWidth,
      onClose: (): void => { if (this.inputCurrent()) this.flow?.closeReviews(); },
      actions: [new DialogActionView('cancel', '取消', 'default', this.inputCurrent() && !this.state.busy, true),
        new DialogActionView('apply', '应用更新 (' + this.applyCount() + ')', 'primary',
          this.editable() && this.applyCount() > 0)],
      onAction: (action: string): void => {
        if (!this.inputCurrent()) return;
        if (action === 'cancel') this.flow?.closeReviews();
        else if (this.editable()) void this.flow?.applyReviews();
      },
      body: (): void => { this.reviewBody(); },
    });
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
        this.reviewList();
      }.width('100%');
    }.width('100%').constraintSize({ maxHeight: this.modalBodyHeight() }).scrollBar(BarState.Off)
      .nestedScroll({ scrollForward: NestedScrollMode.SELF_FIRST, scrollBackward: NestedScrollMode.SELF_FIRST });
  }

  private currentReviewRows(id: number): SourceV9Change[] {
    return this.state.reviews.find((review: SourceV9SubscriptionReview): boolean => review.subscription.id === id)?.rows ?? [];
  }

  @Builder
  private reviewList() {
    Column() {
      ForEach(this.state.reviews, (review: SourceV9SubscriptionReview, reviewIndex: number): void => {
        if (this.currentReviewRows(review.subscription.id).length === 0) {
          Text(review.subscription.name + ' · 没有变更').width('100%').padding(10)
            .fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontColor(this.color('TOK_MUTED'))
            .border({ width: { top: reviewIndex === 0 ? 0 : 1 }, color: this.color('TOK_LINE') });
        }
        ForEach(this.currentReviewRows(review.subscription.id), (row: SourceV9Change, rowIndex: number): void => {
          this.reviewRow(row, review.subscription.name, reviewIndex > 0 || rowIndex > 0);
        }, (row: SourceV9Change): string => row.key + ':' + String(row.selected) + ':' +
          String(row.overwrite) + ':' + (row.report?.traceId ?? 'history:' + (row.previousReport?.report.traceId ?? '')));
      }, (review: SourceV9SubscriptionReview): string => String(review.subscription.id));
    }.id('reader-source-v9-subscription-review-list').width('100%').borderRadius(14)
      .backgroundColor(this.color('TOK_CARD_BG'))
      .border({ width: 1, color: this.color('TOK_LINE') }).clip(true);
  }

  @Builder
  private changeBadge(kind: SourceV9ChangeKind) {
    if (kind === 'added') this.badge('新增', 'app.status.good', 'app.status.goodSoft');
    else if (kind === 'update') this.badge('更新', 'app.sourceUi.primary', 'app.sourceUi.selected');
    else if (kind === 'conflict') this.badge('冲突', 'app.status.warning', 'app.status.warningSoft');
    else if (kind === 'removedRemote') this.badge('远端移除', 'app.sourceUi.danger', 'app.sourceUi.dangerSurface');
    else this.badge(kind === 'unchanged' ? '无变化' : '仅本地', 'app.sourceUi.muted', 'app.sourceUi.field');
  }

  private reviewCaption(row: SourceV9Change, subscriptionName: string): string {
    const domain = sourceV9DisplayUrl(row.sourceId ?? '');
    return domain.length > 0 ? domain + ' · ' + subscriptionName : subscriptionName;
  }

  @Builder
  private reviewRow(row: SourceV9Change, subscriptionName: string, divider: boolean) {
    Row({ space: 8 }) {
      this.checkbox(row.selected && (row.kind !== 'conflict' || row.overwrite),
        this.editable() && row.selectable && (row.kind !== 'conflict' || row.overwrite),
        row.name, (checked: boolean): void => this.flow?.selectReviewRow(row.key, checked));
      Column({ space: 4 }) {
        Row({ space: 5 }) {
          Text(row.name).flexShrink(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontColor(this.color('TOK_INK'));
          this.changeBadge(row.kind);
        }.width('100%');
        Text(this.reviewCaption(row, subscriptionName)).width('100%').maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis }).fontSize(11)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontColor(this.color('TOK_MUTED'));
        if (row.kind === 'conflict' && !row.selectable) {
          this.label('当前 Core 无法按版本覆盖，保留本地', 11, 'TOK_MUTED');
        } else if (row.kind === 'conflict') {
          Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(4), cross: LengthMetrics.vp(16) } }) {
            this.action('覆盖', row.overwrite ? 'primary' : 'neutral', this.editable() && row.selectable,
              (): void => this.flow?.resolveReviewConflict(row.key, true), 28);
            this.action('保留本地', !row.overwrite ? 'primary' : 'neutral', this.editable() && row.selectable,
              (): void => this.flow?.resolveReviewConflict(row.key, false), 28);
          }.width('100%');
        }
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      if (row.report !== undefined) this.reportAction(row.name, row.report);
      else if (row.previousReport !== undefined) this.reportAction(row.name, row.previousReport.report, '历史');
    }.width('100%').padding({ left: 10, right: 10, top: 8, bottom: 8 })
      .border({ width: { top: divider ? 1 : 0 }, color: this.color('TOK_LINE') });
  }

  @Builder
  private subscriptionDialog() {
    ReaderDialogSurface({ specId: 'source-v9-check', primarySurfaceColor: this.primary(), containerWidthVp: this.paneWidth,
      title: this.dialog === 'delete' ? '删除订阅' : this.edited === undefined ? '新建订阅' : '编辑订阅',
      actions: [new DialogActionView('cancel', '取消', 'default', this.canDismissDialog(), true),
        new DialogActionView('confirm', this.dialog === 'delete' ? '删除订阅' : '保存',
          this.dialog === 'delete' ? 'danger' : 'primary',
          this.editable() && (this.dialog === 'delete' || (this.formName.trim().length > 0 && this.formUrl.trim().length > 0)))],
      onAction: (action: string): void => { void this.confirmDialog(action); },
      body: (): void => {
        if (this.dialog === 'delete') this.deleteBody();
        else this.formBody();
      },
    });
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
          (id: string): void => { this.formType = id === '0' ? 0 : 2; }, '订阅类型', 'reader-source-v9-subscription-type');
        Row() {
          this.label('自动检查更新', 13, 'TOK_INK', true);
          Blank();
          ReaderToggle({ checkedColor: this.primary(), value: this.formEnabled, accessibilityLabel: '自动检查更新',
            inputIdentity: 'source-v9-sub-form-auto', actionEnabled: this.editable(),
            onToggle: (next: boolean): void => { if (this.editable()) this.formEnabled = next; } });
        }.width('100%');
        if (this.state.error.length > 0 && !this.state.writePending) {
          ReaderPageState({ variant: 'inline', padded: false, message: this.state.error });
        }
      }.width('100%');
    }.width('100%').constraintSize({ maxHeight: this.modalBodyHeight() }).scrollBar(BarState.Off)
      .nestedScroll({ scrollForward: NestedScrollMode.SELF_FIRST, scrollBackward: NestedScrollMode.SELF_FIRST });
  }

  @Builder
  private scrim() {
    Stack().width('100%').height('100%')
      .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.scheme,
        this.color('app.scrim.warmModal')))
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
      .accessibilityLevel('no').onClick((): void => { if (this.inputCurrent()) this.consumeBack(); });
  }

  @Builder
  private reportDialog() {
    ReaderDialogSurface({ specId: 'source-v9-check', primarySurfaceColor: this.primary(),
      title: '检测详情', showCloseButton: true, closeEnabled: this.inputCurrent(), containerWidthVp: this.paneWidth,
      onClose: (): void => { if (this.inputCurrent()) this.visibleReport = undefined; },
      actions: [new DialogActionView('close', '关闭', 'default', this.inputCurrent(), true)],
      onAction: (_action: string): void => { if (this.inputCurrent()) this.visibleReport = undefined; },
      body: (): void => { this.reportBody(); },
    });
  }

  @Builder
  private reportBody() {
    Scroll() {
      Column({ space: 8 }) {
        this.label(this.reportName, 13, 'TOK_INK', true);
        this.label((this.visibleReport?.available ? '通过' : '未通过') + ' · ' +
          (this.visibleReport?.durationMs ?? 0) + ' ms', 12, this.visibleReport?.available ? 'app.status.good' : 'TOK_DANGER');
        if (this.visibleReport?.failureReason) this.label(this.visibleReport?.failureReason ?? '', 12, 'TOK_MUTED');
        SourceV9ReportSteps({ report: this.visibleReport?.report, currentFailure: this.visibleReport?.failureReason });
      }.width('100%').alignItems(HorizontalAlign.Start);
    }.width('100%').constraintSize({ maxHeight: this.modalBodyHeight() }).scrollBar(BarState.Off)
      .nestedScroll({ scrollForward: NestedScrollMode.SELF_FIRST, scrollBackward: NestedScrollMode.SELF_FIRST });
  }
}
