import { LengthMetrics } from '@kit.ArkUI';
import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { readerAppColor, type ReaderAppColorRole } from '../../../ui/foundation/ReaderThemeRegistry';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../../../ui/foundation/ReaderWindowMetrics';
import { DialogActionView, ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { httpUrlHostname } from '../../../platform/network/HttpTransportPolicy';
import type { BookSource, SourceGroupCatalogData, SourceGroupMutateParams, SourceGroupRecord } from '../application/SourceGateway';
import type { SourceManagementStatusKind } from '../application/SourceOrchestrator';
import { sourceV9Primary, sourceV9ReportFill, sourceV9ReportTone, sourceV9Supports } from '../presentation/SourceManagementV9';

type GroupDialog = 'none' | 'create' | 'rename' | 'delete' | 'add' | 'move';
type GroupActionTone = 'primary' | 'soft' | 'neutral' | 'danger';

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
}

@Component
export struct SourceV9GroupsPage {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private windowRevision: number = 0;
  @Prop @Watch('refreshGroups') catalog: SourceGroupCatalogData | undefined = undefined;
  @Prop @Watch('refreshGroups') sources: BookSource[] = [];
  @Prop @Watch('refreshGroups') detailGroupId: string | undefined = undefined;
  @Prop @Watch('externalMoveChanged') moveSourceIds: string[] = [];
  @Prop inputEnabled: boolean = true;
  @Prop moveOnly: boolean = false;
  @Prop statusKind: SourceManagementStatusKind = 'idle';
  @Prop statusMessage: string = '';
  onBack: () => void = (): void => {};
  onOpenGroup: (groupId: string) => void = (_groupId: string): void => {};
  onCloseMove: (applied?: boolean) => void = (_applied?: boolean): void => {};
  onMutate: (params: SourceGroupMutateParams) => Promise<void> = async (_params: SourceGroupMutateParams): Promise<void> => {};
  onToggle: (ids: string[], enabled: boolean) => void = (_ids: string[], _enabled: boolean): void => {};
  onCheck: (ids: string[], group?: boolean) => void = (_ids: string[], _group?: boolean): void => {};
  onBatchUngrouped: (ids: string[]) => void = (_ids: string[]): void => {};
  onLogin: (id: string, url: string) => void = (_id: string, _url: string): void => {};
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
  @State private bodyLimit: number = 200;
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
    return this.inputCurrent() && this.catalog !== undefined && !this.pending && this.dialog === 'none';
  }
  private dialogEditable(): boolean { return this.inputCurrent() && !this.pending && this.dialog !== 'none'; }

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
    const host = httpUrlHostname(source.baseUrl);
    const scheme = source.baseUrl.toLowerCase().startsWith('http://') ? 'http://' : 'https://';
    return host !== undefined ? scheme + host : source.baseUrl;
  }

  private groupExists(groupId: string): boolean { return groupId === '' || this.groupNames.has(groupId); }

  private usableName(excludedId: string = ''): boolean {
    const name = this.name.trim();
    return name.length > 0 && Array.from(name).length <= 32 && name !== '全部分组' && name !== '未分组' &&
      !this.groups.some((row: GroupRow): boolean => row.id !== '' &&
      row.id !== excludedId && row.name === name);
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
    if (!this.dialogEditable() || expectedRevision === undefined) return undefined;
    const name = this.name.trim();
    const groupId = this.dialogGroupId;
    switch (this.dialog) {
      case 'create':
        return this.usableName() ? { expectedRevision, action: 'create', name,
          sourceIds: this.selectedSources(this.selection) } : undefined;
      case 'rename':
        return this.groupExists(groupId) && groupId !== '' && this.usableName(groupId) ?
          { expectedRevision, action: 'rename', groupId, name } : undefined;
      case 'delete':
        return this.groupExists(groupId) && groupId !== '' ? { expectedRevision, action: 'delete', groupId, targetGroupId: '' } : undefined;
      case 'add': {
        const sourceIds = this.selectedSources(this.selection, groupId);
        return sourceIds.length > 0 && this.groupExists(groupId) && groupId !== '' ?
          { expectedRevision, action: 'assign', targetGroupId: groupId, sourceIds } : undefined;
      }
      case 'move': {
        const sourceIds = this.selectedSources(this.movingIds);
        if (sourceIds.length === 0) return undefined;
        const target = this.target;
        if (target === undefined) {
          return this.usableName() ? { expectedRevision, action: 'create', name, sourceIds } : undefined;
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
    } catch (_) {
      if (this.mounted && dialog === this.dialog)
        this.mutationProblem = '未能确认分组操作，请核对当前分组。';
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

  private color(role: ReaderAppColorRole): ResourceColor { return role === 'app.sourceUi.primary' ? sourceV9Primary(this.scheme) : readerAppColor(role, this.scheme); }

  private frameInset(left: boolean): number {
    if (this.windowRevision < 0) return 14;
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(14, left ? readerInteractiveSafeLeft(metrics) : readerInteractiveSafeRight(metrics));
  }

  private actionSurface(tone: GroupActionTone): ResourceColor {
    if (tone === 'primary') return this.color('app.sourceUi.primary');
    if (tone === 'soft') return this.color('app.sourceUi.selected');
    if (tone === 'danger') return this.color('app.sourceUi.dangerSurface');
    return this.color('app.sourceUi.surface');
  }

  private actionInk(tone: GroupActionTone): ResourceColor {
    if (tone === 'primary') return this.color('app.sourceUi.onPrimary');
    if (tone === 'soft') return this.color('app.sourceUi.primary');
    if (tone === 'danger') return this.color('app.sourceUi.danger');
    return this.color('app.sourceUi.muted');
  }

  private rowKey(source: BookSource): string {
    return JSON.stringify([source.sourceId, source.name, source.baseUrl, source.category, source.enabled,
      source.checkState, sourceV9ReportTone(source)]);
  }

  private checkGlyph(source: BookSource): string {
    if (source.checkState === 'checking') return '…';
    const tone = sourceV9ReportTone(source);
    if (tone === 'unverified') return '–';
    return tone === 'earlyFailure' || tone === 'deepFailure' ? '×' : '✓';
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
    Stack({ alignContent: Alignment.Center }) {
      if (!this.moveOnly) {
        this.page();
      }
      if (this.dialog !== 'none') {
        this.groupDialog();
      }
    }.width('100%').height('100%').clip(true)
      .onSizeChange((_previous: SizeOptions, next: SizeOptions): void => {
        const height = Number(next.height);
        if (Number.isFinite(height) && height > 0) this.bodyLimit = Math.max(84, Math.min(208, height - 245));
      });
  }

  @Builder
  private page() {
    Column() {
      this.header();
      if (this.dialog === 'none') this.actionFeedback();
      if (this.catalog === undefined) {
        ReaderPageState({ title: '正在读取书源分组', loading: true, loadingActive: this.inputEnabled })
          .layoutWeight(1);
      } else if (this.detailGroupId === undefined) {
        this.groupList();
      } else {
        this.groupDetail();
      }
    }.width('100%').height('100%').backgroundColor(this.color('TOK_PAPER'))
      .accessibilityLevel(this.dialog === 'none' ? 'auto' : 'no-hide-descendants')
      .enabled(this.dialog === 'none' && this.inputEnabled);
  }

  @Builder
  private actionFeedback() {
    if (this.mutationProblem.length > 0) {
      ReaderPageState({ variant: 'inline', padded: false, message: this.mutationProblem });
    } else if ((this.statusKind === 'error' || this.statusKind === 'warning') && this.statusMessage.length > 0) {
      ReaderPageState({ variant: 'inline', padded: false, message: this.statusMessage });
    }
  }

  @Builder
  private header() {
    Row({ space: 6 }) {
      ReaderIconButton({
        icon: this.scheme === 'night' ? $r('app.media.book_detail_back_theme_night') : $r('app.media.book_detail_back'),
        specId: 'navigation-back', minimumTargetSize: 44, accessibilityLabel: '返回',
        actionEnabled: this.inputEnabled, onTap: (): void => this.back(),
      });
      Text(this.detailGroupId === undefined ? '分组管理' : this.detailName).layoutWeight(1).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis }).fontSize(18).fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD)
        .fontColor(this.color('TOK_INK'));
      if (this.detailGroupId === undefined) {
        this.action('＋ 新建', 'soft', this.pageEditable(), (): void => this.openDialog('create'), 36);
      } else if (this.detailGroupId === '') {
        this.action('批量归组', 'soft', this.pageEditable() && this.detailCount > 0, (): void => this.batchUngrouped(), 36);
      } else {
        this.action('＋ 添加', 'soft', this.pageEditable(), (): void => this.openDialog('add'), 36);
      }
    }.width('100%').height(48).padding({ left: this.frameInset(true), right: this.frameInset(false) })
      .border({ width: { bottom: 1 }, color: this.color('TOK_LINE') });
  }

  @Builder
  private action(label: string, tone: GroupActionTone, enabled: boolean, run: () => void,
    height: number = 32, size: number = 12) {
    Button(label, { type: ButtonType.Capsule }).height(height).padding({ left: height < 30 ? 8 : 12, right: height < 30 ? 8 : 12 })
      .fontSize(size).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
      .fontColor(this.actionInk(tone)).backgroundColor(this.actionSurface(tone))
      .border({ width: tone === 'neutral' ? 1 : 0, color: this.color('TOK_LINE_STRONG') })
      .opacity(enabled ? 1 : 0.48).enabled(enabled).flexShrink(0)
      .responseRegion({ y: height < 30 ? -(44 - height) / 2 : -4, height: height < 30 ? 44 : height + 8 })
      .onClick((): void => { if (this.pageEditable()) run(); });
  }

  @Builder
  private groupList() {
    Scroll() {
      Column({ space: 10 }) {
        ForEach(this.groups, (group: GroupRow): void => {
          this.groupRow(group);
        }, (group: GroupRow): string => JSON.stringify([group.id, group.name, group.members, group.enabled]));
      }.width('100%').padding({ left: Math.max(16, this.frameInset(true)),
        right: Math.max(16, this.frameInset(false)), top: 12, bottom: 16 });
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
          Image(this.scheme === 'night' ? $r('app.media.source_group_chevron_theme_night') : $r('app.media.source_group_chevron'))
            .width(15).height(15).flexShrink(0);
        }.width('100%');
      }.layoutWeight(1).constraintSize({ minHeight: 44 }).padding(0)
        .backgroundColor(Color.Transparent).enabled(this.pageEditable())
        .accessibilityText(`${group.name}，共 ${group.members} 个，已启用 ${group.enabled} 个`)
        .onClick((): void => this.openGroup(group.id));
      if (group.id !== '') {
        ReaderToggle({ checkedColor: sourceV9Primary(this.scheme), value: group.members > 0 && group.enabled === group.members, inputIdentity: group.id,
          actionEnabled: this.pageEditable() && group.members > 0, accessibilityLabel: `启用${group.name}全部书源`,
          onToggle: (next: boolean): void => this.toggleGroup(group.id, next) }).flexShrink(0);
      }
    }.width('100%').padding({ left: 14, right: 14, top: 8, bottom: 8 }).borderRadius(14)
      .border({ width: 1, color: this.color('TOK_LINE') }).backgroundColor(this.color('app.sourceUi.surface'))
      .shadow(readerSurfaceElevation('card', this.scheme));
  }

  @Builder
  private groupDetail() {
    Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(8) } }) {
      this.action('整组检测', 'primary', this.pageEditable() && this.detailCount > 0, (): void => this.checkGroup());
      this.action('全部启用', 'neutral', this.pageEditable() && this.detailCount > 0,
        (): void => this.toggleGroup(this.detailGroupId ?? '', true));
      this.action('全部停用', 'neutral', this.pageEditable() && this.detailCount > 0,
        (): void => this.toggleGroup(this.detailGroupId ?? '', false));
      if (this.detailGroupId !== '') {
        this.action('重命名', 'neutral', this.pageEditable(), (): void => this.openDialog('rename'));
        this.action('删除分组', 'danger', this.pageEditable(), (): void => this.openDialog('delete'));
      }
    }.width('100%').padding({ left: Math.max(16, this.frameInset(true)),
      right: Math.max(16, this.frameInset(false)), top: 12, bottom: 8 });
    Column() {
      if (this.detailCount === 0) {
        ReaderPageState({ title: '当前分组暂无书源', variant: 'inline', padded: true })
          .width('100%').borderRadius(14).border({ width: 1, color: this.color('TOK_LINE') })
          .backgroundColor(this.color('app.sourceUi.surface'));
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
          .backgroundColor(this.color('app.sourceUi.surface'));
      }
    }.width('100%').layoutWeight(1).padding({ left: Math.max(16, this.frameInset(true)),
      right: Math.max(16, this.frameInset(false)), top: 4, bottom: 16 })
      .justifyContent(FlexAlign.Start);
  }

  @Builder
  private sourceRow(source: BookSource) {
    Row({ space: 6 }) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: 8 }) {
          Text(source.category === 'comic' ? '漫' : '文').width(34).height(34).textAlign(TextAlign.Center)
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(14).borderRadius(10).flexShrink(0)
            .fontColor(this.color(source.category === 'comic' ? 'app.status.warning' : 'app.sourceUi.primary'))
            .backgroundColor(this.color(source.category === 'comic' ? 'app.status.warningSoft' : 'app.sourceUi.selected'));
          Column({ space: 1 }) {
            Text(source.name).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(14).fontColor(this.color('TOK_INK'));
            Text(this.displayUrl(source)).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11).fontColor(this.color('app.sourceUi.faint'));
          }.layoutWeight(1).alignItems(HorizontalAlign.Start);
        }.width('100%');
      }.layoutWeight(1).constraintSize({ minHeight: 44 }).padding(0)
        .backgroundColor(Color.Transparent).enabled(this.pageEditable()).accessibilityText(`${source.name}，检测详情`)
        .onClick((): void => this.checkMember(source.sourceId));
      Button({ type: ButtonType.Circle }) {
        Text(this.checkGlyph(source)).fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(14)
          .fontColor(this.color(sourceV9ReportTone(source) === 'unverified' ? 'app.sourceUi.muted' : 'app.sourceUi.onPrimary'));
      }.width(28).height(28).padding(0).flexShrink(0).responseRegion({ y: -8, height: 44 })
        .backgroundColor(sourceV9ReportFill(sourceV9ReportTone(source), this.scheme) ?? this.color('app.sourceUi.field'))
        .enabled(this.pageEditable()).accessibilityText(`${source.name}，检测`)
        .onClick((): void => this.checkMember(source.sourceId));
      this.action(this.detailGroupId === '' ? '归入分组' : '移动', 'neutral', this.pageEditable(),
        (): void => { if (this.rowValid(source.sourceId)) this.openMove([source.sourceId], this.sourceGroup(source)); }, 26, 11);
      if (this.detailGroupId !== '') {
        this.action('移出', 'danger', this.pageEditable(), (): void => this.removeMember(source.sourceId), 26, 11);
      }
      ReaderToggle({ checkedColor: sourceV9Primary(this.scheme), value: source.enabled, inputIdentity: source.sourceId,
        actionEnabled: this.pageEditable(), accessibilityLabel: `启用${source.name}`,
        onToggle: (next: boolean): void => { if (this.rowValid(source.sourceId)) this.onToggle([source.sourceId], next); } })
        .flexShrink(0);
    }.width('100%').padding({ left: 10, right: 10, top: 6, bottom: 6 });
  }

  @Builder
  private groupDialog() {
    Stack({ alignContent: Alignment.Center }) {
      Rect().width('100%').height('100%').fill(this.color('app.scrim.warmModal'))
        .accessibilityLevel('no').onClick((): void => { this.consumeBack(); });
      ReaderDialogSurface({ specId: 'source-v9-check', primarySurfaceColor: sourceV9Primary(this.scheme), title: this.dialogTitle(),
        actions: [new DialogActionView('cancel', '取消', 'default', this.dialogEditable(), true),
          new DialogActionView('confirm', this.confirmLabel(), this.dialog === 'delete' ? 'danger' : 'primary',
            this.dialogParams() !== undefined)],
        onAction: (id: string): void => { void this.confirmDialog(id); },
        body: (): void => { this.dialogBody(); },
      });
    }.width('100%').height('100%');
  }

  @Builder
  private dialogBody() {
    Column({ space: 8 }) {
      if (this.dialog === 'create' || this.dialog === 'rename') {
        this.field(this.name, '分组名称', (input: string): void => this.setName(input));
      }
      if (this.dialog === 'create') {
        Text('添加首批成员（可选）').width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
          .fontSize(12).fontColor(this.color('app.sourceUi.muted'));
        this.candidateList();
      } else if (this.dialog === 'delete') {
        Text(`删除「${this.groupNames.get(this.dialogGroupId) ?? this.detailName}」后，成员将移入未分组。`)
          .width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13)
          .fontColor(this.color('app.sourceUi.muted'));
      } else if (this.dialog === 'add') {
        this.field(this.query, '搜索书源名称、域名', (input: string): void => this.setQuery(input));
        this.candidateList();
      } else if (this.dialog === 'move') {
        this.moveTargets();
      }
      this.actionFeedback();
    }.width('100%').alignItems(HorizontalAlign.Start);
  }

  @Builder
  private field(value: string, placeholder: string, emit: (value: string) => void) {
    TextInput({ text: value, placeholder }).width('100%').height(40).borderRadius(10)
      .border({ width: 1, color: this.color('TOK_LINE_STRONG') })
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13).fontColor(this.color('TOK_INK'))
      .placeholderColor(this.color('app.sourceUi.muted')).backgroundColor(this.color('app.sourceUi.field'))
      .accessibilityText(placeholder).enabled(this.dialogEditable())
      .onChange((next: string): void => { if (this.dialogEditable()) emit(next); });
  }

  @Builder
  private candidateList() {
    if (this.candidateCount === 0) {
      Text('没有可选书源').width('100%').padding({ top: 12, bottom: 12 }).textAlign(TextAlign.Center)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(12).fontColor(this.color('app.sourceUi.muted'));
    } else {
      List() {
        LazyForEach(this.candidateData, (source: BookSource): void => {
          ListItem() {
            this.candidateRow(source);
          }
        }, (source: BookSource): string => JSON.stringify([source.sourceId, source.name, source.baseUrl, this.sourceGroup(source)]));
      }.width('100%').constraintSize({ maxHeight: this.bodyLimit }).scrollBar(BarState.Off).cachedCount(3);
    }
  }

  @Builder
  private mark(selected: boolean) {
    Text(selected ? '✓' : '').width(18).height(18).borderRadius(5).textAlign(TextAlign.Center)
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(12).flexShrink(0)
      .fontColor(this.color('app.sourceUi.onPrimary'))
      .border({ width: 1, color: this.color(selected ? 'app.sourceUi.primary' : 'TOK_LINE_STRONG') })
      .backgroundColor(selected ? this.color('app.sourceUi.primary') : Color.Transparent);
  }

  @Builder
  private candidateRow(source: BookSource) {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      Row({ space: 8 }) {
        this.mark(this.selection.includes(source.sourceId));
        Column({ space: 1 }) {
          Text(source.name).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(13).fontColor(this.color('TOK_INK'));
          Text(this.displayUrl(source)).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11).fontColor(this.color('app.sourceUi.faint'));
        }.layoutWeight(1).alignItems(HorizontalAlign.Start);
        if (this.sourceGroup(source) !== '') {
          Text(this.groupNames.get(this.sourceGroup(source)) ?? '').constraintSize({ maxWidth: 82 })
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11).fontColor(this.color('app.sourceUi.muted'));
        }
      }.width('100%');
    }.width('100%').constraintSize({ minHeight: 44 }).padding({ left: 10, right: 10 }).borderRadius(10)
      .backgroundColor(Color.Transparent).enabled(this.dialogEditable()).accessibilityText(source.name)
      .accessibilitySelected(this.selection.includes(source.sourceId))
      .onClick((): void => this.toggleSelection(source.sourceId));
  }

  @Builder
  private moveTargets() {
    Scroll() {
      Column({ space: 4 }) {
        this.targetOption('', '未分组');
        ForEach(this.catalog?.groups ?? [], (group: SourceGroupRecord): void => {
          this.targetOption(group.groupId, group.name);
        }, (group: SourceGroupRecord): string => JSON.stringify([group.groupId, group.name]));
        this.targetOption(undefined, '新建分组');
      }.width('100%');
    }.width('100%').constraintSize({ maxHeight: this.bodyLimit }).scrollBar(BarState.Off);
    if (this.target === undefined) {
      this.field(this.name, '新分组名称', (input: string): void => this.setName(input));
    }
  }

  @Builder
  private targetOption(id: string | undefined, label: string) {
    Button({ type: ButtonType.Capsule }) {
      Row({ space: 8 }) {
        this.mark(this.target === id);
        Text(label).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(13)
          .fontColor(this.color(id === undefined ? 'app.sourceUi.primary' : 'TOK_INK'));
      }.width('100%');
    }.width('100%').height(36).padding({ left: 12, right: 12 })
      .backgroundColor(this.color(id === undefined ? 'app.sourceUi.selected' : 'app.sourceUi.field'))
      .enabled(this.dialogEditable()).accessibilityText(label).accessibilitySelected(this.target === id)
      .onClick((): void => this.setTarget(id));
  }
}
