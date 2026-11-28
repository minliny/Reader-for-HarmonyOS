import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { LengthMetrics } from '@kit.ArkUI';
import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { readerAppColor, type ReaderAppColorRole } from '../../../ui/foundation/ReaderThemeRegistry';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { APP_FLOATING_HEADER_BAR_HEIGHT } from '../../../ui/foundation/ReaderHeaderMetrics';
import { readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { TOK_SCREEN_INSET } from '../../../ui/foundation/ReaderTokens';
import { readerUnionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import type { ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderPageGeometry, ReaderPageGeometryInput, applyReaderStandardFloatingHeader,
  resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { readerPageAreaLength, readerStandardPageContentEndInset, readerStandardPageSpec,
  READER_STANDARD_PAGE_CONTENT_GAP } from '../../../ui/layout/ReaderPageShell';
import { DialogActionView, ReaderDialogSurface, readerDialogCardTransition,
  readerDialogScrimTransition } from '../../../ui/surfaces/ReaderDialogSurface';
import { ReaderDialogViewport } from '../../../ui/surfaces/ReaderDialogViewport';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import type { BookSource, SourceGroupCatalogData, SourceGroupMutateParams, SourceGroupRecord } from '../application/SourceGateway';
import { SourceInitialMembershipUnconfirmed } from '../application/SourceInitialMembershipUnconfirmed';
import type { SourceManagementProjection, SourceManagementStatusKind } from '../application/SourceOrchestrator';
import { sourceV9DisplayUrl, sourceV9ReportTone, sourceV9Supports } from '../presentation/SourceManagementV9';
import { SourceV9AddAction, SourceV9CircleCheck, SourceV9DetectButton, SourceV9TypeSeal } from './SourceV9Chrome';

type GroupDialog = 'none' | 'create' | 'rename' | 'delete' | 'add' | 'move';
type GroupActionTone = 'primary' | 'soft' | 'neutral' | 'danger';

const GROUP_MEMBER_INSET = 10;
const GROUP_MEMBER_GAP = 6;
const GROUP_TITLE_GAP = 8;
const GROUP_TITLE_BUDGET = 132;
const GROUP_MEMBER_CHROME_WIDTH = 34 + GROUP_TITLE_GAP + 28 + 44 + 2 * GROUP_MEMBER_GAP;

interface GroupRow {
  id: string;
  name: string;
  members: number;
  enabled: number;
}

class GroupSourceData implements IDataSource {
  private rows: BookSource[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number { return this.rows.length; }
  getData(index: number): BookSource { return this.rows[index]; }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (!this.listeners.includes(listener)) this.listeners.push(listener);
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((item: DataChangeListener): boolean => item !== listener);
  }

  replace(rows: BookSource[]): void {
    this.rows = rows;
    for (const listener of this.listeners) listener.onDataReloaded();
  }

  notifySelection(sourceId: string): void {
    const index = this.rows.findIndex((source: BookSource): boolean => source.sourceId === sourceId);
    if (index >= 0) {
      for (const listener of this.listeners) listener.onDataChange(index);
    }
  }
}

@Component
export struct SourceV9GroupsPage {
  @StorageProp('readerNavigationAppearancePreferences')
  private appearancePreferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @StorageLink('readerWindowMetricsRevision') private windowRevision: number = 0;
  @Prop @Watch('refreshGroups') catalog: SourceGroupCatalogData | undefined = undefined;
  @Prop catalogError: string = '';
  @Prop @Watch('refreshGroups') sources: BookSource[] = [];
  @Prop @Watch('refreshGroups') detailGroupId: string | undefined = undefined;
  @Prop detailTransitionActive: boolean = false;
  @Prop detailTranslation: number = 0;
  @Prop detailOpacity: number = 1;
  @Prop @Watch('externalMoveChanged') moveSourceIds: string[] = [];
  @Prop inputEnabled: boolean = true;
  @Prop moveOnly: boolean = false;
  @Prop embeddedWide: boolean = false;
  @Prop modalHost: ReaderRectVp | undefined = undefined;
  @Prop statusKind: SourceManagementStatusKind = 'idle';
  @Prop statusMessage: string = '';
  @Prop operation: SourceManagementProjection = { action: 'load', sourceId: '' };
  onBack: () => void = (): void => {};
  onOpenGroup: (groupId: string) => void = (_groupId: string): void => {};
  onRetryCatalog: () => void = (): void => {};
  onCloseMove: (applied?: boolean) => void = (_applied?: boolean): void => {};
  onMutate: (params: SourceGroupMutateParams) => Promise<void> = async (_params: SourceGroupMutateParams): Promise<void> => {};
  onToggle: (ids: string[], enabled: boolean) => void = (_ids: string[], _enabled: boolean): void => {};
  onCheck: (ids: string[], group?: boolean) => void = (_ids: string[], _group?: boolean): void => {};
  onBatchUngrouped: (ids: string[]) => void = (_ids: string[]): void => {};
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onContinueOriginal: (generation: number) => void = (_generation: number): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined) => void = (_handler: (() => boolean) | undefined): void => {};
  isInputAllowed: () => boolean = (): boolean => true;

  @State private groups: GroupRow[] = [];
  @State private detailName: string = '';
  @State private detailCount: number = 0;
  @State private candidateCount: number = 0;
  @State private dialog: GroupDialog = 'none';
  @State private pending: boolean = false;
  @State private name: string = '';
  @State private query: string = '';
  @State private selection: string[] = [];
  @State private target: string | undefined = '';
  @State private paneWidth: number = 0;
  @State private paneHeight: number = 0;
  @State private paneLeft: number = 0;
  @State private headerHeight: number = APP_FLOATING_HEADER_BAR_HEIGHT;
  @State private mutationProblem: string = '';
  private mounted: boolean = false;
  private externalMove: boolean = false;
  private externalIds: string[] = [];
  private movingIds: string[] = [];
  private dialogGroupId: string = '';
  private supported: BookSource[] = [];
  private groupBySource: Map<string, string> = new Map();
  private groupNames: Map<string, string> = new Map();
  private detailData: GroupSourceData = new GroupSourceData();
  private candidateData: GroupSourceData = new GroupSourceData();

  aboutToAppear(): void {
    this.mounted = true;
    this.refreshGroups();
    this.externalMoveChanged();
    this.onTemporaryBackBridge((): boolean => this.consumeBack());
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.onTemporaryBackBridge(undefined);
  }

  private refreshGroups(): void {
    if (!this.mounted) return;
    this.groupBySource = new Map<string, string>();
    this.groupNames = new Map<string, string>();
    this.supported = this.sources.filter(sourceV9Supports);
    for (const entry of this.catalog?.memberships ?? []) this.groupBySource.set(entry.sourceId, entry.groupId);
    const counts: Map<string, GroupRow> = new Map<string, GroupRow>();
    for (const group of this.catalog?.groups ?? []) {
      this.groupNames.set(group.groupId, group.name);
      counts.set(group.groupId, { id: group.groupId, name: group.name, members: 0, enabled: 0 });
    }
    counts.set('', { id: '', name: '未分组书源', members: 0, enabled: 0 });
    for (const source of this.supported) {
      const group = counts.get(this.sourceGroup(source));
      if (group !== undefined) {
        group.members += 1;
        if (source.enabled) group.enabled += 1;
      }
    }
    this.groups = Array.from(counts.values());
    this.detailName = this.detailGroupId === '' ? '未分组书源' : this.groupNames.get(this.detailGroupId ?? '') ?? '';
    const rows = this.detailGroupId === undefined ? [] : this.groupMembers(this.detailGroupId);
    this.detailCount = rows.length;
    this.detailData.replace(rows);
    this.refreshCandidates();
  }

  private sourceGroup(source: BookSource): string { return this.groupBySource.get(source.sourceId) ?? ''; }

  private groupMembers(groupId: string): BookSource[] {
    return this.supported.filter((source: BookSource): boolean => this.sourceGroup(source) === groupId);
  }

  private groupIds(groupId: string): string[] {
    return this.groupMembers(groupId).map((source: BookSource): string => source.sourceId);
  }

  private refreshCandidates(): void {
    if (this.dialog !== 'create' && this.dialog !== 'add') {
      if (this.candidateCount > 0) {
        this.candidateCount = 0;
        this.candidateData.replace([]);
      }
      return;
    }
    const query = this.query.trim().toLowerCase();
    const candidates = this.supported.filter((source: BookSource): boolean => {
      const groupId = this.sourceGroup(source);
      if (this.dialog === 'add' && groupId === this.dialogGroupId) return false;
      return query.length === 0 || source.name.toLowerCase().includes(query) ||
        this.displayUrl(source).toLowerCase().includes(query) ||
        (this.groupNames.get(groupId) ?? '').toLowerCase().includes(query);
    });
    this.candidateCount = candidates.length;
    this.candidateData.replace(candidates);
  }

  private inputCurrent(): boolean { return this.mounted && this.inputEnabled && this.isInputAllowed(); }
  private pageEditable(): boolean {
    return this.inputCurrent() && this.catalog !== undefined && !this.pending && this.dialog === 'none' && !this.hasPendingRecovery();
  }
  private dialogEditable(): boolean { return this.inputCurrent() && !this.pending && this.dialog !== 'none'; }

  private hasPendingRecovery(): boolean {
    return this.operation.original?.blocked === true || this.operation.receipt?.receipt.confirmation === 'unknown';
  }

  private recoveryBusy(): boolean {
    return this.pending || this.operation.original?.busy === true || this.operation.receipt?.facts.fact === 'refreshing';
  }

  private recoveryView(): ReaderRecoveryView {
    const original = this.operation.original;
    if (original?.blocked === true) {
      return { message: original.message, visible: true, canRetry: true, generation: original.generation };
    }
    const receipt = this.operation.receipt;
    return { message: receipt?.receipt.message ?? '', visible: receipt?.receipt.confirmation === 'unknown',
      canRetry: receipt?.facts.canRetry === true, generation: receipt?.facts.generation ?? 0 };
  }

  private recoveryKeys(): string[] {
    if (!this.hasPendingRecovery()) return [];
    const original = this.operation.original;
    return [JSON.stringify([this.detailGroupId ?? null, this.dialog, this.dialogGroupId, this.moveOnly,
      original?.blocked === true ? original.operationId ?? '' : null, this.recoveryView().generation,
      original?.blocked === true ? original.writeStage : null])];
  }

  private continueLabel(): string {
    const original = this.operation.original;
    if (original?.blocked !== true || !original.canRetryOriginal) return '';
    return original.confirmation === 'confirmed' && original.writeStage === 'cleanup' ? '继续清理' : '继续';
  }

  private recover(key: string, generation: number, retry: boolean): void {
    if (!this.inputCurrent() || this.recoveryBusy() || !this.recoveryKeys().includes(key)) return;
    if (this.dialog === 'none' && this.feedbackHeight() <= 0) return;
    const view = this.recoveryView();
    if (view.generation !== generation) return;
    if (retry && this.continueLabel().length > 0) this.onContinueOriginal(generation);
    else if (!retry && view.canRetry) this.onReconcile(generation);
  }

  private externalMoveChanged(): void {
    if (!this.mounted) return;
    if (this.externalIds.length === this.moveSourceIds.length &&
      this.externalIds.every((id: string, index: number): boolean => id === this.moveSourceIds[index])) return;
    this.externalIds = this.moveSourceIds.slice();
    if (this.externalIds.length > 0) {
      this.openMove(this.externalIds, this.catalog?.groups[0]?.groupId ?? '', true);
    } else if (this.externalMove) {
      this.resetDialog();
    }
  }

  private openDialog(kind: GroupDialog): void {
    if (!this.pageEditable()) return;
    this.mutationProblem = '';
    this.dialogGroupId = this.detailGroupId ?? '';
    this.name = kind === 'rename' ? this.detailName : '';
    this.query = '';
    this.selection = [];
    this.dialog = kind;
    this.refreshCandidates();
  }

  private openMove(ids: string[], target: string, external: boolean = false): void {
    if ((!external && !this.pageEditable()) || ids.length === 0) return;
    this.mutationProblem = '';
    this.externalMove = external;
    this.movingIds = ids.slice();
    this.target = target;
    this.name = '';
    this.dialog = 'move';
  }

  private resetDialog(): void {
    this.dialog = 'none';
    this.mutationProblem = '';
    this.externalMove = false;
    this.movingIds = [];
    this.selection = [];
    this.refreshCandidates();
  }

  private closeDialog(applied: boolean = false): void {
    const wasExternal = this.externalMove;
    this.resetDialog();
    if (wasExternal) this.onCloseMove(applied);
  }

  private consumeBack(): boolean {
    if (!this.inputCurrent()) return false;
    if (this.pending) return true;
    if (this.dialog === 'none') return false;
    if (consumeReaderControlKeyboardBack(ReaderWindowCoordinator.metrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (this.mounted) hilog.warn(0x5244, 'Reader', 'Source group keyboard dismissal: %{private}s', error.message);
      },
    })) return true;
    this.closeDialog();
    return true;
  }

  private back(): void {
    if (this.inputCurrent() && !this.consumeBack()) this.onBack();
  }

  private displayUrl(source: BookSource): string {
    return sourceV9DisplayUrl(source.baseUrl);
  }

  private groupExists(groupId: string): boolean { return groupId === '' || this.groupNames.has(groupId); }

  private nameError(excludedId: string = ''): string {
    const name = this.name.trim();
    if (name.length === 0) return '请输入分组名称';
    if (Array.from(name).length > 32) return '分组名称最多 32 个字符';
    if (name === '全部分组' || name === '未分组') return '该名称由系统保留';
    if (this.groups.some((row: GroupRow): boolean => row.id !== '' &&
      row.id !== excludedId && row.name === name)) return '已存在同名分组';
    return '';
  }

  private selectedSources(ids: string[], exceptGroup?: string): string[] {
    const requested = new Set<string>(ids);
    return this.supported.filter((source: BookSource): boolean =>
      requested.has(source.sourceId) && (exceptGroup === undefined || this.sourceGroup(source) !== exceptGroup))
      .map((source: BookSource): string => source.sourceId);
  }

  private toggleSelection(id: string): void {
    if (!this.dialogEditable() || (this.dialog !== 'create' && this.dialog !== 'add')) return;
    this.selection = this.selection.includes(id) ? this.selection.filter((item: string): boolean => item !== id) :
      [...this.selection, id];
    this.candidateData.notifySelection(id);
  }

  private setName(name: string): void { if (this.dialogEditable()) this.name = name; }

  private setQuery(query: string): void {
    if (!this.dialogEditable()) return;
    this.query = query;
    this.refreshCandidates();
  }

  private setTarget(target: string | undefined): void {
    if (this.dialogEditable()) this.target = target;
  }

  private dialogParams(): SourceGroupMutateParams | undefined {
    const expectedRevision = this.catalog?.revision;
    if (!this.dialogEditable() || this.hasPendingRecovery() || expectedRevision === undefined) return undefined;
    const name = this.name.trim();
    const groupId = this.dialogGroupId;
    switch (this.dialog) {
      case 'create':
        return this.nameError().length === 0 ? { expectedRevision, action: 'create', name,
          sourceIds: this.selectedSources(this.selection) } : undefined;
      case 'rename':
        return this.groupExists(groupId) && groupId !== '' && this.nameError(groupId).length === 0 ?
          { expectedRevision, action: 'rename', groupId, name } : undefined;
      case 'delete':
        return this.groupExists(groupId) && groupId !== '' ? { expectedRevision, action: 'delete', groupId, targetGroupId: '' } : undefined;
      case 'add': {
        const sourceIds = this.selectedSources(this.selection, groupId);
        return sourceIds.length > 0 && this.groupExists(groupId) && groupId !== '' ?
          { expectedRevision, action: 'assign', targetGroupId: groupId, sourceIds } : undefined;
      }
      case 'move': {
        const target = this.target;
        const sourceIds = this.selectedSources(this.movingIds, target);
        if (sourceIds.length === 0) return undefined;
        if (target === undefined) {
          return this.nameError().length === 0 ? { expectedRevision, action: 'create', name, sourceIds } : undefined;
        }
        return this.groupExists(target) ? { expectedRevision, action: 'assign', targetGroupId: target, sourceIds } : undefined;
      }
      default:
        return undefined;
    }
  }

  private async confirmDialog(action: string): Promise<void> {
    if (!this.dialogEditable()) return;
    if (action === 'cancel') {
      this.closeDialog();
      return;
    }
    const params = this.dialogParams();
    if (params !== undefined) await this.mutate(params, true);
  }

  private async mutate(params: SourceGroupMutateParams, close: boolean): Promise<void> {
    this.pending = true;
    this.mutationProblem = '';
    const dialog = this.dialog;
    try {
      await this.onMutate(params);
      if (!this.mounted || dialog !== this.dialog) return;
      if (close) this.closeDialog(true);
      if (params.action === 'delete') {
        this.pending = false;
        this.onBack();
      }
    } catch (error) {
      if (!this.mounted || dialog !== this.dialog) return;
      if (error instanceof SourceInitialMembershipUnconfirmed) {
        this.mutationProblem = error.message;
        if (dialog === 'create') {
          this.dialogGroupId = error.groupId;
          this.dialog = 'add';
          this.refreshCandidates();
        } else if (dialog === 'move') {
          this.target = error.groupId;
        }
      } else {
        this.mutationProblem = '未能确认分组操作，请核对当前分组。';
      }
    } finally {
      if (this.mounted) this.pending = false;
    }
  }

  private removeMember(sourceId: string): void {
    const expectedRevision = this.catalog?.revision;
    if (!this.pageEditable() || expectedRevision === undefined || this.detailGroupId === '' ||
      !this.groupIds(this.detailGroupId ?? '').includes(sourceId)) return;
    void this.mutate({ expectedRevision, action: 'assign', targetGroupId: '', sourceIds: [sourceId] }, false);
  }

  private openGroup(groupId: string): void {
    if (this.pageEditable() && this.groupExists(groupId)) this.onOpenGroup(groupId);
  }

  private toggleGroup(groupId: string, next: boolean): void {
    if (!this.pageEditable() || !this.groupExists(groupId)) return;
    const ids = this.groupIds(groupId);
    if (ids.length > 0) this.onToggle(ids, next);
  }

  private rowValid(sourceId: string): boolean {
    return this.pageEditable() && this.detailGroupId !== undefined && this.groupIds(this.detailGroupId).includes(sourceId);
  }

  private checkGroup(): void {
    if (!this.pageEditable() || this.detailGroupId === undefined) return;
    const ids = this.groupIds(this.detailGroupId);
    if (ids.length > 0) this.onCheck(ids, true);
  }

  private checkMember(sourceId: string): void { if (this.rowValid(sourceId)) this.onCheck([sourceId]); }

  private batchUngrouped(): void {
    if (!this.pageEditable() || this.detailGroupId !== '') return;
    const ids = this.groupIds('');
    if (ids.length > 0) this.onBatchUngrouped(ids);
  }

  private color(role: ReaderAppColorRole): string { return readerAppColor(role, this.scheme); }

  private actionSurface(tone: GroupActionTone): ResourceColor {
    if (tone === 'primary') return this.color('app.sourceUi.primary');
    if (tone === 'soft') return this.color('app.sourceUi.selected');
    if (tone === 'danger') return this.color('app.sourceUi.dangerSurface');
    return this.color('TOK_CARD_BG');
  }

  private actionInk(tone: GroupActionTone): ResourceColor {
    if (tone === 'primary') return this.color('app.sourceUi.onPrimary');
    if (tone === 'soft') return this.color('app.sourceUi.primary');
    if (tone === 'danger') return this.color('app.sourceUi.danger');
    return this.color('TOK_INK');
  }

  private rowKey(source: BookSource): string {
    return JSON.stringify([source.sourceId, source.name, source.baseUrl, source.category, source.enabled,
      source.checkState, sourceV9ReportTone(source)]);
  }

  private dialogTitle(): string {
    switch (this.dialog) {
      case 'create': return '新建分组';
      case 'rename': return '重命名分组';
      case 'delete': return '删除分组';
      case 'add': return '添加书源';
      default: return '移至分组';
    }
  }

  private confirmLabel(): string {
    switch (this.dialog) {
      case 'create': return '创建分组';
      case 'rename': return '保存';
      case 'delete': return '删除分组';
      case 'add': return `添加 (${this.selection.length})`;
      default: return '移动';
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (!this.moveOnly) this.page();
      if (this.dialog !== 'none') this.groupDialog();
    }.width('100%').height('100%').clip(true)
      .onAreaChange((_previous: Area, next: Area): void => this.recordPane(next));
  }

  private recordPane(area: Area): void {
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    const left = readerPageAreaLength(area.globalPosition.x);
    if (!this.mounted || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
    if (Math.abs(width - this.paneWidth) > .1) this.paneWidth = width;
    if (Math.abs(height - this.paneHeight) > .1) this.paneHeight = height;
    if (Number.isFinite(left) && Math.abs(left - this.paneLeft) > .1) this.paneLeft = left;
  }

  private bodyLimit(viewportHeight: number): number {
    return Math.max(72, Math.min(440, viewportHeight - Math.max(128, 98 * this.fontScale())));
  }

  private fontScale(): number {
    this.windowRevision;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }

  private pageGeometry(): ReaderPageGeometry {
    this.windowRevision;
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.paneWidth;
    input.viewportHeight = this.paneHeight;
    input.originX = this.embeddedWide ? this.paneLeft : undefined;
    input.headerHeight = this.headerHeight;
    // Index has already applied the interactive top inset for this route.
    applyReaderStandardFloatingHeader(input);
    input.contentGap = READER_STANDARD_PAGE_CONTENT_GAP;
    input.contentMaxWidth = readerStandardPageSpec('sourceManagement').maxWidth;
    input.contentHorizontalPadding = TOK_SCREEN_INSET;
    input.contentHorizontalSafeArea = 'interactive';
    input.contentEndInset = readerStandardPageContentEndInset('sourceManagement', metrics);
    return resolveReaderPageGeometry(input);
  }

  private frameStyle(): ReaderFrameStyle {
    const background = this.color('TOK_PAPER');
    return readerFrameStyle({ backgroundColor: background, headerBackground: background,
      headerTransparent: true, footerBackground: background });
  }

  @Builder
  private page() {
    Column() {
      ReaderPageScaffold({ frameStyle: this.frameStyle(), geometry: this.pageGeometry(),
        headerMeasurementKey: this.windowRevision,
        content: (): void => { this.pageBody(this.pageGeometry()); },
        header: (): void => { this.header(); },
        overlayContent: (): void => {
          if (this.dialog === 'none' && this.feedbackHeight() > 0) this.pageFeedback();
        },
        onHeaderHeightChange: (height: number, key: number): void => {
          if (this.mounted && key === this.windowRevision && height > 0 && Math.abs(height - this.headerHeight) > .1) {
            this.headerHeight = height;
          }
        },
      });
    }.id('reader-source-v9-groups').width('100%').height('100%')
      .accessibilityLevel(this.dialog === 'none' ? 'auto' : 'no-hide-descendants')
      .enabled(this.dialog === 'none' && this.inputEnabled);
  }

  @Builder
  private pageBody(geometry: ReaderPageGeometry) {
    Column() {
      if (this.catalog === undefined) {
        ReaderPageState({ title: this.catalogError.length > 0 ? '书源分组读取失败' : '正在读取书源分组',
          message: this.catalogError, loading: this.catalogError.length === 0, loadingActive: this.inputEnabled,
          actionLabel: this.catalogError.length > 0 ? '重试' : '', actionEnabled: this.inputEnabled,
          onAction: (): void => {
            if (this.inputCurrent() && this.catalog === undefined && this.catalogError.length > 0) this.onRetryCatalog();
          } })
          .layoutWeight(1);
      } else {
        Stack({ alignContent: Alignment.TopStart }) {
          if (this.detailGroupId === undefined || this.detailTransitionActive) {
            Column() {
              this.groupList();
            }.width('100%').height('100%').enabled(this.detailGroupId === undefined)
              .hitTestBehavior(this.detailGroupId === undefined ? HitTestMode.Default : HitTestMode.None)
              .accessibilityLevel(this.detailGroupId === undefined ? 'auto' : 'no-hide-descendants')
              .customProperty('readerLayoutDebugExcluded', this.detailGroupId !== undefined);
          }
          if (this.detailGroupId !== undefined) {
            Column() {
              this.groupDetail();
            }.id(readerTransitionsEnabled() ? 'reader-source-v9-group-detail-motion' : undefined)
              .width('100%').height('100%').backgroundColor(this.color('TOK_PAPER'))
              .translate({ x: this.detailTranslation }).opacity(this.detailOpacity);
          }
        }.width('100%').layoutWeight(1).clip(true);
      }
    }.width('100%').height('100%').padding({ left: geometry.content.frame.left, right: geometry.content.frame.right,
      top: geometry.content.startInset, bottom: geometry.content.endInset });
  }

  private feedbackHeight(): number {
    const content = this.pageGeometry().content;
    return Math.max(0, Math.min(208, this.paneHeight - content.startInset - content.endInset));
  }

  @Builder
  private pageFeedback() {
    Column() {
      this.actionFeedback(this.feedbackHeight());
    }.id('reader-source-v9-group-feedback').width('100%')
      .padding({ left: this.pageGeometry().content.frame.left, right: this.pageGeometry().content.frame.right })
      .margin({ top: this.pageGeometry().content.startInset }).hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private actionFeedback(maxRecoveryHeight: number) {
    if (this.hasPendingRecovery()) {
      ForEach(this.recoveryKeys(), (key: string): void => {
        ReaderRecoveryNotice({ view: this.recoveryView(), busy: this.recoveryBusy(), actionEnabled: this.inputEnabled,
          secondaryActionEnabled: this.inputEnabled, actionLabel: '核对', secondaryActionLabel: this.continueLabel(),
          focusIdPrefix: 'reader-source-v9-group-original', maxHeightVp: maxRecoveryHeight,
          onReconcile: (generation: number): void => this.recover(key, generation, false),
          onSecondaryAction: (generation: number): void => this.recover(key, generation, true) });
      }, (key: string): string => key);
    } else if (this.mutationProblem.length > 0) {
      ReaderPageState({ variant: 'inline', padded: false, message: this.mutationProblem });
    } else if ((this.statusKind === 'error' || this.statusKind === 'warning') && this.statusMessage.length > 0) {
      ReaderPageState({ variant: 'inline', padded: false, message: this.statusMessage });
    }
  }

  @Builder
  private header() {
    PageBackBar({ floating: true, centered: true, elevation: 'floating',
      balancedCenteredSlots: this.detailGroupId === undefined,
      trailingWidthVp: this.detailGroupId === '' ? 24 + Math.ceil(48 * this.fontScale()) :
        36 + Math.ceil(24 * this.fontScale()),
      title: this.detailGroupId === undefined ? '分组管理' : this.detailName,
      backFocusId: 'reader-source-v9-group-back', onBack: (): void => this.back(),
      trailing: (): void => { this.headerActions(); },
    });
  }

  @Builder
  private headerActions() {
    if (this.detailGroupId === undefined) {
      SourceV9AddAction({ label: '新建', actionEnabled: this.pageEditable(), controlId: 'reader-source-v9-group-create',
        onTap: (): void => this.openDialog('create') });
    } else if (this.detailGroupId === '') {
      this.action('批量归组', 'soft', this.pageEditable() && this.detailCount > 0, (): void => this.batchUngrouped(), 32, 12,
        'reader-source-v9-group-batch-ungrouped');
    } else {
      SourceV9AddAction({ label: '添加', actionEnabled: this.pageEditable(), controlId: 'reader-source-v9-group-add',
        onTap: (): void => this.openDialog('add') });
    }
  }

  @Builder
  private action(label: string, tone: GroupActionTone, enabled: boolean, run: () => void,
    height: number = 32, size: number = 12, controlId: string = '') {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Text(label).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontColor(this.actionInk(tone))
        .fontSize(size).minFontSize(10).maxFontSize(size).maxLines(1)
        .heightAdaptivePolicy(TextHeightAdaptivePolicy.LAYOUT_CONSTRAINT_FIRST)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }.constraintSize({ minHeight: readerScaledControlHeight(height, 16, this.fontScale()) })
      .padding({ left: height < 30 ? 7 : 12, right: height < 30 ? 7 : 12, top: 2, bottom: 2 })
      .id(controlId).accessibilityText(label)
      .attributeModifier(new ReaderPressFeedback(this.actionSurface(tone), this.scheme,
        readerScaledControlHeight(height, 16, this.fontScale()) / 2,
        readerScaledControlHeight(height, 16, this.fontScale()) / 2, enabled))
      .border({ width: tone === 'neutral' ? 1 : 0, color: this.color('TOK_LINE_STRONG') })
      .opacity(enabled ? 1 : 0.45).enabled(enabled).flexShrink(0)
      .responseRegion(readerUnionTouchRegion('100%', readerScaledControlHeight(height, 16, this.fontScale())))
      .onClick((): void => { if (enabled && this.pageEditable()) run(); });
  }

  @Builder
  private groupList() {
    Scroll() {
      Column({ space: 10 }) {
        ForEach(this.groups, (group: GroupRow): void => {
          this.groupRow(group);
        }, (group: GroupRow): string => JSON.stringify([group.id, group.name, group.members, group.enabled]));
      }.width('100%').padding({ bottom: 4 });
    }.width('100%').layoutWeight(1).scrollBar(BarState.Off).align(Alignment.Top);
  }

  @Builder
  private groupRow(group: GroupRow) {
    Row({ space: 10 }) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: 12 }) {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.source_group_folder')).width(17).height(17)
              .fillColor(this.color(group.id === '' ? 'app.sourceUi.muted' : 'app.sourceUi.primary'));
          }.width(36).height(36).borderRadius(10).backgroundColor(this.color('app.sourceUi.field')).flexShrink(0);
          Column({ space: 2 }) {
            Text(group.name).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(15).fontColor(this.color('TOK_INK'));
            Text(`共 ${group.members} 个 · 已启用 ${group.enabled} 个`)
              .width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(12)
              .fontColor(this.color('app.sourceUi.muted'));
          }.layoutWeight(1).alignItems(HorizontalAlign.Start);
          Image(this.scheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') :
            $r('app.media.reader_chevron_right'))
            .width(15).height(15).flexShrink(0);
        }.width('100%');
      }.id(`reader-source-v9-group-row-${group.id === '' ? 'ungrouped' : group.id}`)
        .layoutWeight(1).constraintSize({ minHeight: 44 }).padding(0)
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.scheme, 10, 10, this.pageEditable()))
        .enabled(this.pageEditable())
        .accessibilityText(`${group.name}，共 ${group.members} 个，已启用 ${group.enabled} 个`)
        .onClick((): void => this.openGroup(group.id));
      if (group.id !== '') {
        ReaderToggle({ checkedColor: this.color('app.sourceUi.primary'), value: group.members > 0 && group.enabled === group.members, inputIdentity: group.id,
          actionEnabled: this.pageEditable() && group.members > 0, accessibilityLabel: `启用${group.name}全部书源`,
          onToggle: (next: boolean): void => this.toggleGroup(group.id, next) }).flexShrink(0);
      }
    }.width('100%').padding({ left: 14, right: 14, top: 8, bottom: 8 }).borderRadius(14)
      .border({ width: 1, color: this.color('TOK_LINE') }).backgroundColor(this.color('TOK_CARD_BG'))
      .shadow(readerSurfaceElevation('card', this.scheme));
  }

  @Builder
  private groupDetail() {
    Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(8) } }) {
      this.action('整组检测', 'primary', this.pageEditable() && this.detailCount > 0, (): void => this.checkGroup(), 32, 12,
        'reader-source-v9-group-check');
      this.action('全部启用', 'neutral', this.pageEditable() && this.detailCount > 0,
        (): void => this.toggleGroup(this.detailGroupId ?? '', true), 32, 12, 'reader-source-v9-group-enable');
      this.action('全部停用', 'neutral', this.pageEditable() && this.detailCount > 0,
        (): void => this.toggleGroup(this.detailGroupId ?? '', false), 32, 12, 'reader-source-v9-group-disable');
      if (this.detailGroupId !== '') {
        this.action('重命名', 'neutral', this.pageEditable(), (): void => this.openDialog('rename'), 32, 12,
          'reader-source-v9-group-rename');
        this.action('删除分组', 'danger', this.pageEditable(), (): void => this.openDialog('delete'), 32, 12,
          'reader-source-v9-group-delete');
      }
    }.width('100%').padding({ bottom: 8 });
    Column() {
      if (this.detailCount === 0) {
        ReaderPageState({ title: '当前分组暂无书源', variant: 'inline', padded: true })
          .width('100%').borderRadius(14).border({ width: 1, color: this.color('TOK_LINE') })
          .backgroundColor(this.color('TOK_CARD_BG'));
      } else {
        List() {
          LazyForEach(this.detailData, (source: BookSource): void => {
            ListItem() {
              this.sourceRow(source);
            }
          }, (source: BookSource): string => this.rowKey(source));
        }.width('100%').constraintSize({ maxHeight: '100%' }).scrollBar(BarState.Off).cachedCount(4)
          .divider({ strokeWidth: 1, color: this.color('TOK_LINE') })
          .borderRadius(14).clip(true).border({ width: 1, color: this.color('TOK_LINE') })
          .backgroundColor(this.color('TOK_CARD_BG'));
      }
    }.width('100%').layoutWeight(1).padding({ top: 4, bottom: 4 })
      .justifyContent(FlexAlign.Start);
  }

  @Builder
  private sourceRow(source: BookSource) {
    Column() {
      Row({ space: GROUP_MEMBER_GAP }) {
        this.memberTitle(source);
        Stack({ alignContent: Alignment.Center }) {
          SourceV9DetectButton({ tone: sourceV9ReportTone(source), checking: source.checkState === 'checking',
            actionEnabled: this.pageEditable(), label: `${source.name}，检测`,
            controlId: `reader-source-v9-group-source-check-${source.sourceId}`,
            onTap: (): void => this.checkMember(source.sourceId) });
        }.width(28).height(28).flexShrink(0).clip(false);
        if (!this.memberActionsStacked()) this.memberActions(source);
        ReaderToggle({ checkedColor: this.color('app.sourceUi.primary'), value: source.enabled, inputIdentity: source.sourceId,
          actionEnabled: this.pageEditable(), accessibilityLabel: `启用${source.name}`,
          onToggle: (next: boolean): void => { if (this.rowValid(source.sourceId)) this.onToggle([source.sourceId], next); } })
          .flexShrink(0);
      }.width('100%').constraintSize({ minHeight: 44 });
      if (this.memberActionsStacked()) {
        Row({ space: GROUP_MEMBER_GAP }) {
          this.memberActions(source);
        }.id(`reader-source-v9-group-member-actions-${source.sourceId}`).width('100%')
          .margin({ top: 9 }).justifyContent(FlexAlign.End);
      }
    }.width('100%').padding({ left: GROUP_MEMBER_INSET, right: GROUP_MEMBER_INSET,
      top: this.memberActionsStacked() ? 2 : 6, bottom: this.memberActionsStacked() ? 9 : 6 });
  }

  private memberActionsStacked(): boolean {
    return this.memberTitleWidth(true) < GROUP_TITLE_BUDGET;
  }

  private memberTitleWidth(inlineActions: boolean): number {
    const available = this.pageGeometry().content.frame.width - 2 * (GROUP_MEMBER_INSET + 1);
    const scale = this.fontScale();
    const actionCount = this.detailGroupId === '' ? 1 : 2;
    // Each action has two 11fp glyphs and 7vp horizontal padding on either side.
    const actions = actionCount * (Math.ceil(22 * scale) + 14 + GROUP_MEMBER_GAP);
    return Math.max(0, available - GROUP_MEMBER_CHROME_WIDTH - (inlineActions ? actions : 0));
  }

  @Builder
  private memberTitle(source: BookSource) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: GROUP_TITLE_GAP }) {
        SourceV9TypeSeal({ category: source.category });
        Column({ space: 1 }) {
          Text(source.name).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(14).lineHeight(20).maxFontScale(this.fontScale())
            .fontColor(this.color('TOK_INK'));
          Text(this.displayUrl(source)).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11).lineHeight(16).maxFontScale(this.fontScale())
            .fontColor(this.color('app.sourceUi.muted'));
        }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      }.width('100%');
    }.id(`reader-source-v9-group-source-row-${source.sourceId}`)
      .layoutWeight(1).constraintSize({ minHeight: 44 }).padding(0)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.scheme, 8, 8, this.pageEditable()))
      .enabled(this.pageEditable()).accessibilityText(`${source.name}，检测详情`)
      .onClick((): void => this.checkMember(source.sourceId));
  }

  @Builder
  private memberActions(source: BookSource) {
    this.action(this.detailGroupId === '' ? '归组' : '移动', 'neutral', this.pageEditable(),
      (): void => { if (this.rowValid(source.sourceId)) this.openMove([source.sourceId], this.sourceGroup(source)); }, 26, 11,
      `reader-source-v9-group-source-move-${source.sourceId}`);
    if (this.detailGroupId !== '') {
      this.action('移出', 'danger', this.pageEditable(), (): void => this.removeMember(source.sourceId), 26, 11,
        `reader-source-v9-group-source-remove-${source.sourceId}`);
    }
  }

  @Builder
  private groupDialog() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.scheme,
          this.color('app.scrim.warmModal')))
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
        .accessibilityLevel('no').onClick((): void => { this.consumeBack(); });
      ReaderDialogViewport({ host: this.modalHost,
        content: (width: number, height: number): void => { this.groupDialogCard(width, height); },
      }).transition(readerDialogCardTransition(this.reduceMotion));
    }.width('100%').height('100%').transition(readerDialogScrimTransition(this.reduceMotion));
  }

  @Builder
  private groupDialogCard(width: number, height: number) {
    ReaderDialogSurface({ specId: 'source-v9-check', containerWidthVp: width,
      primarySurfaceColor: this.color('app.sourceUi.primary'), title: this.dialogTitle(),
      actions: [new DialogActionView('cancel', '取消', 'default', this.dialogEditable(), true),
        new DialogActionView('confirm', this.confirmLabel(), this.dialog === 'delete' ? 'danger' : 'primary',
          this.dialogParams() !== undefined)],
      onAction: (id: string): void => { void this.confirmDialog(id); },
      body: (): void => { this.dialogBody(this.bodyLimit(height)); },
    });
  }

  @Builder
  private dialogBody(bodyLimit: number) {
    Scroll() {
      Column({ space: 8 }) {
        if (this.dialog === 'create' || this.dialog === 'rename') {
          this.nameField('分组名称', this.dialog === 'rename' ? this.dialogGroupId : '');
        }
        if (this.dialog === 'create') {
          Text('添加首批成员（可选）').width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
            .fontSize(12).fontColor(this.color('app.sourceUi.muted'));
          this.candidateList(bodyLimit);
        } else if (this.dialog === 'delete') {
          Text(`删除「${this.groupNames.get(this.dialogGroupId) ?? this.detailName}」后，成员将移入未分组。`)
            .width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13)
            .fontColor(this.color('app.sourceUi.muted'));
        } else if (this.dialog === 'add') {
          this.field(this.query, '搜索书源名称、域名', (input: string): void => this.setQuery(input));
          this.candidateList(bodyLimit);
        } else if (this.dialog === 'move') {
          this.moveTargets(bodyLimit);
        }
        this.actionFeedback(bodyLimit);
      }.width('100%').alignItems(HorizontalAlign.Start);
    }.width('100%').constraintSize({ maxHeight: bodyLimit }).scrollBar(BarState.Auto)
      .nestedScroll({ scrollForward: NestedScrollMode.SELF_FIRST, scrollBackward: NestedScrollMode.SELF_FIRST });
  }

  @Builder
  private nameField(placeholder: string, excludedId: string) {
    this.field(this.name, placeholder, (input: string): void => this.setName(input));
    if (this.nameError(excludedId).length > 0) {
      Text(this.nameError(excludedId)).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
        .fontSize(12).lineHeight(17).maxFontScale(this.fontScale()).fontColor(this.color('app.sourceUi.danger'));
    }
  }

  @Builder
  private field(value: string, placeholder: string, emit: (value: string) => void) {
    TextInput({ text: value, placeholder }).width('100%')
      .constraintSize({ minHeight: readerScaledControlHeight(40, 18, this.fontScale()) }).borderRadius(10)
      .border({ width: 1, color: this.color('TOK_LINE_STRONG') })
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13).fontColor(this.color('TOK_INK'))
      .placeholderColor(this.color('app.sourceUi.muted')).backgroundColor(this.color('app.sourceUi.field'))
      .accessibilityText(placeholder).enabled(this.dialogEditable())
      .onChange((next: string): void => { if (this.dialogEditable()) emit(next); });
  }

  @Builder
  private candidateList(bodyLimit: number) {
    if (this.candidateCount === 0) {
      Text('没有可选书源').width('100%').padding({ top: 12, bottom: 12 }).textAlign(TextAlign.Center)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(12).fontColor(this.color('app.sourceUi.muted'));
    } else {
      List() {
        LazyForEach(this.candidateData, (source: BookSource): void => {
          ListItem() {
            this.candidateRow(source);
          }
        }, (source: BookSource): string => JSON.stringify([source.sourceId, source.name, source.baseUrl,
          this.sourceGroup(source), this.groupNames.get(this.sourceGroup(source)), this.selection.includes(source.sourceId)]));
      }.width('100%').constraintSize({ maxHeight: Math.min(208, bodyLimit) }).scrollBar(BarState.Auto).cachedCount(3)
        .nestedScroll({ scrollForward: NestedScrollMode.SELF_FIRST, scrollBackward: NestedScrollMode.SELF_FIRST });
    }
  }

  @Builder
  private candidateRow(source: BookSource) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 8 }) {
        SourceV9CircleCheck({ selected: this.selection.includes(source.sourceId), actionEnabled: this.dialogEditable(), interactive: false });
        Column({ space: 1 }) {
          Text(source.name).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(13).lineHeight(18).maxFontScale(this.fontScale())
            .fontColor(this.color('TOK_INK'));
          Text(this.displayUrl(source)).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11).lineHeight(16).maxFontScale(this.fontScale())
            .fontColor(this.color('app.sourceUi.muted'));
        }.layoutWeight(1).alignItems(HorizontalAlign.Start);
        if (this.sourceGroup(source) !== '') {
          Text(this.groupNames.get(this.sourceGroup(source)) ?? '').constraintSize({ maxWidth: 82 })
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11).fontColor(this.color('app.sourceUi.muted'));
        }
      }.width('100%');
    }.width('100%').constraintSize({ minHeight: 44 }).padding({ left: 10, right: 10 })
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.scheme, 10, 10, this.dialogEditable()))
      .enabled(this.dialogEditable()).accessibilityText(source.name)
      .accessibilitySelected(this.selection.includes(source.sourceId))
      .onClick((): void => this.toggleSelection(source.sourceId));
  }

  @Builder
  private moveTargets(bodyLimit: number) {
    Scroll() {
      Column({ space: 4 }) {
        this.targetOption('', '未分组');
        ForEach(this.catalog?.groups ?? [], (group: SourceGroupRecord): void => {
          this.targetOption(group.groupId, group.name);
        }, (group: SourceGroupRecord): string => JSON.stringify([group.groupId, group.name]));
        this.targetOption(undefined, '新建分组');
      }.width('100%');
    }.width('100%').constraintSize({ maxHeight: Math.min(208, bodyLimit) }).scrollBar(BarState.Auto)
      .nestedScroll({ scrollForward: NestedScrollMode.SELF_FIRST, scrollBackward: NestedScrollMode.SELF_FIRST });
    if (this.target === undefined) {
      this.nameField('新分组名称', '');
    }
  }

  @Builder
  private targetOption(id: string | undefined, label: string) {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Row({ space: 8 }) {
        SourceV9CircleCheck({ selected: this.target === id, actionEnabled: this.dialogEditable(), interactive: false });
        Text(label).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(13)
          .fontColor(this.color(id === undefined ? 'app.sourceUi.primary' : 'TOK_INK'));
      }.width('100%');
    }.width('100%').constraintSize({ minHeight: readerScaledControlHeight(44, 18, this.fontScale()) })
      .padding({ left: 12, right: 12, top: 6, bottom: 6 })
      .attributeModifier(new ReaderPressFeedback(this.color(id === undefined ? 'app.sourceUi.selected' : 'app.sourceUi.field'),
        this.scheme, 22, 22, this.dialogEditable()))
      .enabled(this.dialogEditable()).accessibilityText(label).accessibilitySelected(this.target === id)
      .onClick((): void => this.setTarget(id));
  }
}
