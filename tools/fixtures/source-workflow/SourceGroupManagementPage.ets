import inputMethod from '@ohos.inputMethod';
import { ReaderWindowCoordinator } from '../../../entry/src/main/ets/app/ReaderWindowCoordinator';
import type { ReaderRecoveryView } from '../../../entry/src/main/ets/app/ReaderRecoveryProjection';
import { PageBackBar } from '../../../entry/src/main/ets/features/common/PageBackBar';
import { ReaderButton } from '../../../entry/src/main/ets/features/common/ReaderButton';
import { ReaderFormField } from '../../../entry/src/main/ets/features/common/ReaderFormField';
import { ReaderSearchField } from '../../../entry/src/main/ets/features/common/ReaderSearchField';
import { ReaderPageScaffold } from '../../../entry/src/main/ets/features/common/ReaderPageScaffold';
import { ReaderPageState } from '../../../entry/src/main/ets/features/common/ReaderPageState';
import { ReaderRecoveryNotice } from '../../../entry/src/main/ets/features/common/ReaderRecoveryNotice';
import { ReaderRecoveryAction } from '../../../entry/src/main/ets/features/common/ReaderRecoveryAction';
import { ReaderMeasurementStore } from '../../../entry/src/main/ets/features/common/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../entry/src/main/ets/features/common/ReaderPageGeometry';
import { ReaderFrameStyle, readerFrameStyle } from '../../../entry/src/main/ets/features/common/ReaderFrameStyle';
import { readerPageAreaLength, readerPageContentStartInset, readerStandardPageSpec } from '../../../entry/src/main/ets/features/common/ReaderPageShell';
import { readerScrollLayout, readerScrollStartOffset, readerScrollEndOffset } from '../../../entry/src/main/ets/features/common/ReaderScrollLayout';
import { readerInteractiveSafeBottom } from '../../../entry/src/main/ets/features/common/ReaderWindowMetrics';
import { readerAppColor } from '../../../entry/src/main/ets/features/common/ReaderThemeRegistry';
import { registerReaderFonts } from '../../../entry/src/main/ets/features/common/ReaderFonts';
import { MESSAGE_TITLE, MESSAGE_BODY, MESSAGE_META } from '../../../entry/src/main/ets/features/common/ReaderMessageStyle';
import { TYPE_FORM_HINT, TYPE_FORM_LABEL_ACTION, TYPE_SOURCE_MANAGEMENT_TITLE, TYPE_SOURCE_MANAGEMENT_META } from '../../../entry/src/main/ets/features/common/ReaderTypography';
import { TOK_SCREEN_INSET, TOK_BORDER_W, TOK_SPACE_XS, TOK_SPACE_SM } from '../../../entry/src/main/ets/features/common/ReaderTokens';
import type { BookSource } from '../../../entry/src/main/ets/features/source/SourceGateway';
import { emptySourceGroupManagement, sourceGroupCommand, sourceGroupName, sourceGroupMemberIds, sourceGroupNameError,
  type SourceGroupManagementSnapshot, type SourceGroupIntent } from '../../../entry/src/main/ets/features/source/SourceGroupManagementModel';
import { sourceManagementGroupId, sourceManagementGroupName } from '../../../entry/src/main/ets/features/source/SourceManagementPresentation';

let sourceGroupPresentationGeneration: number = 0;

class SourceGroupDisplayRow {
  kind: 'group' | 'target' | 'source';
  id: string;
  name: string;
  detail: string;
  count: number;
  selected: boolean;
  constructor(kind: 'group' | 'target' | 'source', id: string, name: string, detail: string = '', count: number = 0, selected: boolean = false) {
    this.kind = kind; this.id = id; this.name = name; this.detail = detail; this.count = count; this.selected = selected;
  }
}

class SourceGroupPageDataSource implements IDataSource {
  private rows: SourceGroupDisplayRow[] = [];
  private listeners: DataChangeListener[] = [];
  totalCount(): number { return this.rows.length; }
  getData(index: number): SourceGroupDisplayRow { return this.rows[index]; }
  registerDataChangeListener(listener: DataChangeListener): void { if (!this.listeners.includes(listener)) this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener); if (index >= 0) this.listeners.splice(index, 1);
  }
  replace(rows: SourceGroupDisplayRow[]): void {
    this.rows = rows;
    this.listeners.forEach((listener: DataChangeListener): void => listener.onDataReloaded());
  }
}

/** SourceGroupsOwner owns all drafts, membership, writes and receipts. This
 * page renders those facts and dispatches guarded intents only. */
@Component
export struct SourceGroupManagementPage {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop @Watch('snapshotChanged') snapshot: SourceGroupManagementSnapshot = emptySourceGroupManagement();
  @Prop expandedLayout: boolean = false;
  @Prop reduceMotion: boolean = false;
  onBack: () => void = (): void => {};
  onIntent: (intent: SourceGroupIntent) => void = (_intent: SourceGroupIntent): void => {};
  onImport: (() => void) | undefined = undefined;
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  @State private visibleCount: number = 0;
  @State private viewportWidth: number = 0;
  @State private measurementRevision: number = 0;
  @State private recoveryHeight: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  private readonly rows: SourceGroupPageDataSource = new SourceGroupPageDataSource();
  private mounted: boolean = false;
  private presentationIdentity: string = '';

  aboutToAppear(): void {
    this.mounted = true;
    this.presentationIdentity = `source-group-page:${++sourceGroupPresentationGeneration}`;
    registerReaderFonts(this.getUIContext().getFont());
    this.projectRows();
    const identity = this.presentationIdentity;
    this.onTemporaryBackBridge((): boolean => {
      if (!this.mounted || identity !== this.presentationIdentity || this.snapshot.view === 'directory') return false;
      // Busy work remains owned by the original operation. Back is never cancel.
      if (!this.busy()) this.send({ type: 'back' });
      return true;
    }, identity);
  }
  aboutToDisappear(): void {
    const identity = this.presentationIdentity;
    this.mounted = false; this.presentationIdentity = '';
    this.onTemporaryBackBridge(undefined, identity);
  }
  private busy(): boolean { return this.snapshot.busy || this.snapshot.original?.busy === true; }
  private blocked(): boolean { return this.snapshot.original?.blocked === true || this.snapshot.original?.confirmation === 'unknown'; }
  private writable(): boolean { return this.mounted && !this.busy() && !this.blocked() && this.snapshot.read === 'ready'; }
  private send(intent: SourceGroupIntent): void { if (this.mounted) this.onIntent(intent); }
  private back(): void {
    if (!this.mounted) return;
    this.getUIContext().getFocusController().clearFocus();
    if (this.snapshot.view === 'directory') this.onBack();
    else if (!this.busy()) this.send({ type: 'back' });
  }
  private snapshotChanged(): void {
    if (!this.blocked()) this.recoveryHeight = 0;
    this.projectRows();
  }
  private groupExists(groupId: string): boolean {
    return groupId === '' || this.snapshot.catalog.groups.some(group => group.groupId === groupId);
  }
  private sourceKnown(sourceId: string): boolean {
    return this.snapshot.sources.some(source => source.sourceId === sourceId);
  }
  private projectRows(): void {
    const rows: SourceGroupDisplayRow[] = [];
    const query = this.snapshot.query.trim().toLowerCase();
    if (this.snapshot.view === 'directory' || this.snapshot.view === 'assign' || this.snapshot.view === 'delete') {
      const kind: 'group' | 'target' = this.snapshot.view === 'directory' ? 'group' : 'target';
      if (this.snapshot.view !== 'delete' || this.snapshot.groupId !== '') {
        if (query.length === 0 || '未分组'.includes(query)) rows.push(new SourceGroupDisplayRow(kind, '', '未分组', '',
          sourceGroupMemberIds(this.snapshot.catalog, '', this.snapshot.sources).length, this.snapshot.targetGroupId === ''));
      }
      this.snapshot.catalog.groups.forEach(group => {
        if (this.snapshot.view === 'delete' && group.groupId === this.snapshot.groupId) return;
        if (query.length > 0 && !group.name.toLowerCase().includes(query)) return;
        rows.push(new SourceGroupDisplayRow(kind, group.groupId, sourceManagementGroupName(group.groupId, this.snapshot.catalog), '',
          sourceGroupMemberIds(this.snapshot.catalog, group.groupId, this.snapshot.sources).length, this.snapshot.targetGroupId === group.groupId));
      });
    } else if (this.snapshot.view === 'addMembers') {
      this.snapshot.sources.forEach((source: BookSource): void => {
        if (query.length > 0 && !source.name.toLowerCase().includes(query) && !source.baseUrl.toLowerCase().includes(query)) return;
        rows.push(new SourceGroupDisplayRow('source', source.sourceId, source.name,
          `${source.baseUrl}\n当前：${sourceManagementGroupName(sourceManagementGroupId(source, this.snapshot.catalog), this.snapshot.catalog)}`,
          0, this.snapshot.sourceIds.includes(source.sourceId)));
      });
    }
    this.visibleCount = rows.length; this.rows.replace(rows);
  }
  private title(): string {
    switch (this.snapshot.view) {
      case 'create': return '新建分组';
      case 'rename': return '重命名分组';
      case 'delete': return '删除分组';
      case 'assign': return '更改书源分组';
      case 'addMembers': return '添加已有书源';
      case 'result': return '分组操作结果';
      default: return '管理分组';
    }
  }
  private primaryLabel(): string {
    switch (this.snapshot.view) {
      case 'create': return '新建分组';
      case 'rename': return '保存名称';
      case 'delete': return '继续删除分组';
      case 'assign': return `确认更改 ${this.snapshot.sourceIds.length} 个书源`;
      case 'addMembers': return `确认归组 ${this.snapshot.sourceIds.length} 个书源`;
      default: return '返回分组列表';
    }
  }
  private blockingReason(): string {
    if (this.busy()) return '正在处理，请等待原操作结果';
    if (this.blocked()) return '先核对或继续原操作，再进行其他分组修改';
    if (this.snapshot.read !== 'ready') return this.snapshot.read === 'error' ? '请先重新读取分组目录' : '正在读取分组目录';
    if (this.snapshot.view === 'create' || this.snapshot.view === 'rename') {
      if (this.snapshot.view === 'rename' && !this.groupExists(this.snapshot.groupId)) return '原分组已删除，请返回重新选择';
      return sourceGroupNameError(this.snapshot.catalog, this.snapshot.name, this.snapshot.view === 'rename' ? this.snapshot.groupId : undefined);
    }
    if (this.snapshot.view === 'delete' && !this.snapshot.catalog.groups.some(group => group.groupId === this.snapshot.groupId)) return '原分组已删除，请返回重新选择';
    if (!this.groupExists(this.snapshot.targetGroupId)) return '目标分组已删除，请重新选择';
    if (this.snapshot.view === 'assign' || this.snapshot.view === 'addMembers') {
      if (this.snapshot.sourceIds.length === 0) return '请先选择书源';
      if (this.snapshot.sourceIds.some(id => !this.sourceKnown(id))) return '所选书源已变化，请返回重新选择';
    }
    return sourceGroupCommand(this.snapshot) === undefined ? '当前条件已变化，请重新选择' : '';
  }
  private async submit(): Promise<void> {
    if (!this.writable() || sourceGroupCommand(this.snapshot) === undefined) return;
    const identity = this.presentationIdentity;
    const intentKey = `${this.snapshot.view}:${JSON.stringify(sourceGroupCommand(this.snapshot))}`;
    this.getUIContext().getFocusController().clearFocus();
    try { await inputMethod.getController().hideTextInput(); } catch (_) {}
    if (!this.mounted || identity !== this.presentationIdentity || intentKey !== `${this.snapshot.view}:${JSON.stringify(sourceGroupCommand(this.snapshot))}` ||
      !this.writable() || sourceGroupCommand(this.snapshot) === undefined) return;
    // Delete submits are intercepted by Index's native confirmation owner.
    this.send({ type: 'submit' });
  }
  private recoveryView(): ReaderRecoveryView {
    return { message: this.snapshot.original?.message || '原分组操作仍需核对', visible: this.blocked(),
      canRetry: true, generation: this.snapshot.original?.generation ?? 0 };
  }
  private recoveryIdentity(): string {
    return `${this.snapshot.original?.generation ?? 0}:${this.snapshot.original?.operationId ?? ''}:` +
      `${this.snapshot.original?.writeStage ?? ''}:${this.snapshot.original?.canRetryOriginal ?? false}:${this.busy()}:${this.snapshot.original?.message ?? ''}`;
  }
  private reconcile(generation: number, continueOriginal: boolean): void {
    if (!this.mounted || this.busy() || generation !== this.snapshot.original?.generation) return;
    if (continueOriginal && this.snapshot.original?.canRetryOriginal !== true) return;
    this.send({ type: 'reconcile', generation, continueOriginal });
  }
  private resultTitle(): string {
    if (this.busy()) return '正在处理分组操作';
    if (this.blocked()) return this.snapshot.original?.confirmation === 'confirmed' ? '已确认写入，仍需完成清理' : '分组操作等待核对';
    if (this.snapshot.receipt !== undefined) return this.snapshot.receipt.action === 'create' ? '分组已新建' :
      this.snapshot.receipt.action === 'rename' ? '分组已重命名' : this.snapshot.receipt.action === 'delete' ? '分组已删除，书源已保留' : '书源分组已更新';
    return this.snapshot.error.length > 0 ? '本次操作未完成' : '暂无分组操作结果';
  }
  private resultMessage(): string {
    if (this.busy()) return '返回或关闭界面不会取消已提交的原操作。';
    if (this.blocked()) return '请通过上方原操作入口核对或继续；原书源与归属以回执为准。';
    const receipt = this.snapshot.receipt;
    if (receipt !== undefined) {
      if (receipt.action === 'delete') return `已迁移 ${receipt.affectedSourceIds.length} 个成员并删除分组；书源定义、启用状态和阅读数据保留。`;
      if (receipt.action === 'assign') return `已确认处理 ${receipt.affectedSourceIds.length} 个书源。`;
      const name = this.snapshot.name.trim() || this.snapshot.catalog.groups.find(group => group.groupId === receipt.groupId)?.name;
      return name ? `“${name}”已保存。` : '分组信息已保存。';
    }
    return this.snapshot.error || '可以返回分组列表继续整理。';
  }
  private frameStyle(): ReaderFrameStyle {
    const paper = readerAppColor('TOK_PAPER', this.scheme);
    return readerFrameStyle({ backgroundColor: paper, headerBackground: readerAppColor('TOK_SURFACE_SOLID', this.scheme), footerBackground: paper });
  }
  private geometry(): ReaderPageGeometry {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.viewportWidth; input.measurementRevision = this.measurementRevision;
    input.headerHeight = this.measurements.read('groups:header', readerPageContentStartInset());
    input.footerHeight = this.measurements.read('groups:footer', 0);
    input.footerBottom = Math.max(TOK_SPACE_XS, readerInteractiveSafeBottom(metrics, true));
    input.contentGap = TOK_SPACE_XS + (this.blocked() ? this.recoveryHeight : 0);
    input.contentEndInset = input.footerHeight + input.footerBottom;
    input.contentMaxWidth = readerStandardPageSpec('sourceManagement').maxWidth;
    input.contentHorizontalPadding = TOK_SCREEN_INSET;
    return resolveReaderPageGeometry(input);
  }
  @Builder private text(value: string, muted: boolean = false) {
    Text(value).width('100%').fontFamily(TYPE_FORM_HINT.fontFamily).fontSize(TYPE_FORM_HINT.fontSizeFp)
      .lineHeight(TYPE_FORM_HINT.lineHeightFp as number)
      .fontColor(readerAppColor(muted ? 'TOK_MUTED' : 'TOK_INK', this.scheme)).wordBreak(WordBreak.BREAK_WORD);
  }
  @Builder private formError() {
    if (this.snapshot.error.length > 0 && this.snapshot.view !== 'result' && !this.blocked()) {
      Text(this.snapshot.error).width('100%').fontFamily(TYPE_FORM_HINT.fontFamily).fontSize(TYPE_FORM_HINT.fontSizeFp)
        .fontColor(readerAppColor('TOK_MESSAGE_DANGER', this.scheme)).accessibilityText(this.snapshot.error);
    }
  }
  @Builder private readState() {
    if (this.snapshot.read === 'loading' && this.snapshot.catalog.revision === 0 && this.snapshot.sources.length === 0) {
      ReaderPageState({ title: '正在读取分组目录', loading: true });
    } else if (this.snapshot.read === 'error') {
      ReaderPageState({ title: this.snapshot.catalog.revision > 0 ? '分组目录刷新失败' : '分组目录读取失败',
        message: this.snapshot.readError || '请稍后重试。', actionLabel: '重新读取', actionEnabled: !this.busy(),
        onAction: (): void => this.send({ type: 'refresh' }) });
    } else if (this.snapshot.read === 'loading') {
      Row({ space: TOK_SPACE_XS }) {
        LoadingProgress().width(24).height(24).color(readerAppColor('TOK_MESSAGE_SOFT_INK', this.scheme));
        Text('正在刷新分组目录，保留当前内容').layoutWeight(1).fontFamily(MESSAGE_BODY.fontFamily as string)
          .fontSize(MESSAGE_BODY.fontSizeFp).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.scheme));
      }.width('100%');
    }
  }
  @Builder private nameForm() {
    this.text(this.snapshot.view === 'create' ? '新组可以暂时没有成员，创建后再添加已有书源。' : '改名保留分组身份和成员归属，搜索中的组名也会同步更新。', true);
    Text('分组名称').fontFamily(TYPE_FORM_LABEL_ACTION.fontFamily).fontSize(TYPE_FORM_LABEL_ACTION.fontSizeFp)
      .fontWeight(TYPE_FORM_LABEL_ACTION.fontWeight).fontColor(readerAppColor('TOK_INK', this.scheme));
    ReaderFormField({ scheme: this.scheme, specId: 'source-debug', text: this.snapshot.name,
      placeholder: '输入分组名称', fieldAccessibilityLabel: '分组名称', isEditable: this.writable(),
      onTextChange: (value: string): void => this.send({ type: 'name', value }) });
    this.text('最多 32 个字；名称去首尾空白，不能与已有分组或系统选项同名。', true);
    if (this.snapshot.name.length > 0 && sourceGroupNameError(this.snapshot.catalog, this.snapshot.name,
      this.snapshot.view === 'rename' ? this.snapshot.groupId : undefined).length > 0) {
      Text(sourceGroupNameError(this.snapshot.catalog, this.snapshot.name, this.snapshot.view === 'rename' ? this.snapshot.groupId : undefined))
        .width('100%').fontFamily(TYPE_FORM_HINT.fontFamily).fontSize(TYPE_FORM_HINT.fontSizeFp)
        .fontColor(readerAppColor('TOK_MESSAGE_DANGER', this.scheme));
    }
  }
  @Builder private operationResult() {
    Column({ space: TOK_SPACE_SM }) {
      if (this.busy()) {
        LoadingProgress().width(32).height(32).color(readerAppColor('TOK_MESSAGE_SOFT_INK', this.scheme));
      }
      Text(this.resultTitle()).width('100%').fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
        .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MESSAGE_INK', this.scheme)).wordBreak(WordBreak.BREAK_WORD);
      Text(this.resultMessage()).width('100%').fontFamily(MESSAGE_BODY.fontFamily as string).fontSize(MESSAGE_BODY.fontSizeFp)
        .lineHeight(MESSAGE_BODY.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.scheme))
        .wordBreak(WordBreak.BREAK_WORD);
    }.width('100%').alignItems(HorizontalAlign.Start);
  }
  @Builder private introFacts() {
      if (this.snapshot.view === 'directory') {
        this.text(`${this.snapshot.catalog.groups.length} 个自定义分组 · 全库 ${this.snapshot.sources.length} 个书源`, true);
        this.text('查看分组成员，或整理组名与归属。删除分组会保留书源。', true);

      } else if (this.snapshot.view === 'delete') {
        this.text(`删除“${sourceGroupName(this.snapshot.catalog, this.snapshot.groupId)}”`);
        this.text(`当前 ${sourceGroupMemberIds(this.snapshot.catalog, this.snapshot.groupId).length} 个成员将迁入下方目标组。只删除分组，保留全部书源定义、启用状态、书架、缓存和阅读进度。`, true);
        this.text('成员迁移与删除分组一起提交；取消不会产生修改。', true);
      } else if (this.snapshot.view === 'assign') {
        this.text(`本次更改 ${this.snapshot.sourceIds.length} 个书源的分组`);
        this.text(this.snapshot.sourceIds.slice(0, 3).map(id => this.snapshot.sources.find(source => source.sourceId === id)?.name ?? id).join('、') +
          (this.snapshot.sourceIds.length > 3 ? ` 等 ${this.snapshot.sourceIds.length} 个` : ''), true);
        this.text('选择已有分组或未分组。只处理本次选中的书源，不随列表变化扩大范围。', true);
      } else if (this.snapshot.view === 'addMembers') {
        this.text(`目标分组：${sourceGroupName(this.snapshot.catalog, this.snapshot.targetGroupId)}`);
        this.text(`已选 ${this.snapshot.sourceIds.length} 个书源 · 下方查找不清除选择`, true);
        if (!this.groupExists(this.snapshot.targetGroupId)) { this.text('目标分组已删除，请返回重新选择。'); }
      } else if (this.snapshot.view === 'result') {
        this.operationResult();
        if (this.snapshot.read === 'error') {
          this.text(this.snapshot.receipt !== undefined ? '已确认的写入保留，目录尚未刷新。' : '分组目录尚未刷新。', true);
          ReaderRecoveryAction({ label: '重新读取分组目录', actionEnabled: !this.busy(),
            onReconcile: (): void => this.send({ type: 'refresh' }) });
        }
      }
  }
  @Builder private intro() {
    Column({ space: TOK_SPACE_SM }) {
      if (this.snapshot.view !== 'result') { this.readState(); }
      ForEach([`${this.snapshot.view}:${this.snapshot.read}:${this.snapshot.readError}:${this.snapshot.catalog.revision}:${JSON.stringify(this.snapshot.sourceIds)}:${this.snapshot.targetGroupId}:${this.snapshot.receiptGeneration}:${this.snapshot.error}:${this.recoveryIdentity()}`],
        (_key: string): void => { this.introFacts(); this.formError(); }, (key: string): string => key);
      if (this.snapshot.view === 'create' || this.snapshot.view === 'rename') { this.nameForm(); }
      if (this.snapshot.view === 'directory' || this.snapshot.view === 'assign' || this.snapshot.view === 'delete' || this.snapshot.view === 'addMembers') {
        ReaderSearchField({ variant: 'sourceManagement', mode: 'live', text: this.snapshot.query,
          placeholder: this.snapshot.view === 'addMembers' ? '查找书源名称或域名' : '查找分组',
          accessibilityLabel: this.snapshot.view === 'addMembers' ? '查找书源名称或域名' : '查找分组',
          onTextChange: (value: string): void => { if (!this.busy()) this.send({ type: 'query', value }); } })
          .enabled(!this.busy());
      }
    }.width('100%').alignItems(HorizontalAlign.Start).padding({ bottom: TOK_SPACE_SM });
  }
  @Builder private groupRow(row: SourceGroupDisplayRow) {
    Column({ space: TOK_SPACE_XS }) {
      ReaderButton({ scheme: this.scheme, specId: 'shelf-row-edit', label: `${row.name} · ${row.count} 个 ›`, layout: 'full',
        actionAccessibilityLabel: `查看${row.name}成员，共${row.count}个书源`,
        onAction: (): void => this.send({ type: 'openMembers', groupId: row.id }) });
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.End }) {
        ReaderButton({ scheme: this.scheme, specId: 'source-compact', label: '添加已有源', actionEnabled: this.writable(),
          onAction: (): void => this.send({ type: 'addMembers', groupId: row.id }) });
        if (row.id !== '') {
          ReaderButton({ scheme: this.scheme, specId: 'source-compact', label: '改名', actionEnabled: this.writable(),
            onAction: (): void => this.send({ type: 'rename', groupId: row.id }) });
          ReaderButton({ scheme: this.scheme, specId: 'source-compact', label: '删除', actionEnabled: this.writable(),
            onAction: (): void => this.send({ type: 'delete', groupId: row.id }) });
        }
      }.width('100%');
    }.width('100%').alignItems(HorizontalAlign.Start).padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_SM })
      .border({ width: { bottom: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.scheme) });
  }
  @Builder private targetRow(row: SourceGroupDisplayRow) {
    ReaderButton({ scheme: this.scheme, specId: 'source-filter-option', label: `${row.name} · ${row.count} 个`,
      primary: row.selected, layout: 'full', actionEnabled: this.writable(),
      actionAccessibilityLabel: `${row.name}，${row.count}个书源${row.selected ? '，已选' : ''}`,
      onAction: (): void => this.send({ type: 'target', groupId: row.id }) });
  }
  @Builder private sourceRow(row: SourceGroupDisplayRow) {
    Row({ space: TOK_SPACE_XS }) {
      Column({ space: TOK_SPACE_XS }) {
        Text(row.name).width('100%').fontFamily(TYPE_SOURCE_MANAGEMENT_TITLE.fontFamily).fontSize(TYPE_SOURCE_MANAGEMENT_TITLE.fontSizeFp)
          .fontWeight(TYPE_SOURCE_MANAGEMENT_TITLE.fontWeight).fontColor(readerAppColor('TOK_INK', this.scheme))
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(row.detail).width('100%').fontFamily(TYPE_SOURCE_MANAGEMENT_META.fontFamily).fontSize(TYPE_SOURCE_MANAGEMENT_META.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.scheme)).maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
      Checkbox({ name: row.id }).width(44).height(44).select(row.selected)
        .selectedColor(readerAppColor('TOK_GREEN', this.scheme)).enabled(this.writable() && this.groupExists(this.snapshot.targetGroupId) && this.sourceKnown(row.id))
        .accessibilityText(`${row.selected ? '取消选择' : '选择'}${row.name}`)
        .onChange((selected: boolean): void => {
          if (this.writable() && this.groupExists(this.snapshot.targetGroupId) && this.sourceKnown(row.id) && selected !== this.snapshot.sourceIds.includes(row.id)) this.send({ type: 'toggleSource', sourceId: row.id });
        });
    }.width('100%').padding({ top: TOK_SPACE_SM, bottom: TOK_SPACE_SM }).alignItems(VerticalAlign.Center)
      .border({ width: { bottom: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.scheme) });
  }
  @Builder private emptyRows() {
    if (this.visibleCount === 0 && (this.snapshot.view === 'directory' || this.snapshot.view === 'assign' || this.snapshot.view === 'delete' || this.snapshot.view === 'addMembers') && this.snapshot.read === 'ready') {
      ReaderPageState({ title: this.snapshot.view === 'addMembers' ? (this.snapshot.sources.length === 0 ? '暂无书源可添加' : '没有匹配的书源') : '没有匹配的分组',
        message: this.snapshot.view === 'addMembers' && this.snapshot.sources.length === 0 ? '可先返回书源管理导入书源。' : '',
        actionLabel: this.snapshot.query.trim().length > 0 ? '清空查找' : '',
        onAction: (): void => this.send({ type: 'query', value: '' }) });
    }
  }
  @Builder private body() {
    List() {
      ListItem() { this.intro(); }
      LazyForEach(this.rows, (row: SourceGroupDisplayRow): void => {
        ListItem() {
          if (row.kind === 'group') { this.groupRow(row); }
          else if (row.kind === 'target') { this.targetRow(row); }
          else { this.sourceRow(row); }
        }.padding({ bottom: row.kind === 'target' ? TOK_SPACE_XS : 0 });
      }, (row: SourceGroupDisplayRow): string => `${this.snapshot.view}:${row.kind}:${row.id}:${row.name}:${row.count}:${row.selected}:${this.writable()}:${this.snapshot.catalog.revision}:${row.detail}`);
      ListItem() { this.emptyRows(); }
      if (this.snapshot.view === 'directory' && this.snapshot.catalog.groups.length === 0 && this.snapshot.read === 'ready' && this.snapshot.query.length === 0) {
        ListItem() { ReaderPageState({ title: '还没有自定义分组', message: '可以先新建一个空分组，再添加已有书源。' }); }
      }
    }.width('100%').height('100%').padding({ left: this.geometry().content.frame.left, right: this.geometry().content.frame.right })
      .contentStartOffset(readerScrollStartOffset(readerScrollLayout(this.geometry(), { mode: 'contentOffset' })))
      .contentEndOffset(readerScrollEndOffset(readerScrollLayout(this.geometry(), { mode: 'contentOffset' }))).scrollBar(BarState.Auto);
  }
  @Builder private footerContent() {
    Column({ space: TOK_SPACE_XS }) {
      if (this.snapshot.view === 'directory') {
        Row({ space: TOK_SPACE_XS }) {
          ReaderButton({ scheme: this.scheme, specId: 'source-action', label: '新建分组', primary: true, layout: 'equal', actionEnabled: this.writable(),
            onAction: (): void => this.send({ type: 'create' }) });
          if (this.onImport !== undefined && this.snapshot.sources.length === 0) {
            ReaderButton({ scheme: this.scheme, specId: 'source-action', label: '导入书源', layout: 'equal', actionEnabled: this.writable(),
              onAction: (): void => { if (this.mounted && this.writable()) this.onImport?.(); } });
          }
        }.width('100%');
      } else if (this.snapshot.view === 'result') {
        ReaderButton({ scheme: this.scheme, specId: 'source-action', label: '返回分组列表', layout: 'full', actionEnabled: !this.busy(),
          onAction: (): void => this.send({ type: 'back' }) });
      } else {
        if (this.blockingReason().length > 0) { this.text(this.blockingReason(), true); }
        if (this.snapshot.view === 'delete' && this.groupExists(this.snapshot.targetGroupId)) { this.text(`成员迁入：${sourceGroupName(this.snapshot.catalog, this.snapshot.targetGroupId)}`, true); }
        if (this.snapshot.view === 'assign' && this.groupExists(this.snapshot.targetGroupId)) { this.text(`目标分组：${sourceGroupName(this.snapshot.catalog, this.snapshot.targetGroupId)}`, true); }
        Row({ space: TOK_SPACE_XS }) {
          ReaderButton({ scheme: this.scheme, specId: 'source-action', label: '返回', layout: 'equal', actionEnabled: !this.busy(),
            onAction: (): void => this.back() });
          ReaderButton({ scheme: this.scheme, specId: 'source-action', label: this.primaryLabel(), primary: true, layout: 'equal',
            actionEnabled: this.writable() && sourceGroupCommand(this.snapshot) !== undefined, isBusy: this.busy(),
            onAction: (): void => { void this.submit(); } });
        }.width('100%');
      }
    }.width('100%').padding({ left: this.geometry().content.frame.left, right: this.geometry().content.frame.right, top: TOK_SPACE_XS, bottom: TOK_SPACE_XS });
  }
  @Builder private footer() {
    ForEach([`${this.snapshot.view}:${this.snapshot.busy}:${this.snapshot.read}:${JSON.stringify(this.snapshot.sourceIds)}:${this.snapshot.targetGroupId}:${this.snapshot.catalog.revision}:${this.snapshot.name}:${this.recoveryIdentity()}`],
      (_key: string): void => { this.footerContent(); }, (key: string): string => key);
  }
  @Builder private recovery() {
    if (this.blocked()) {
      Column() {
        ForEach([this.recoveryIdentity()], (_key: string): void => {
          ReaderRecoveryNotice({ view: this.recoveryView(), actionLabel: this.snapshot.original?.method === 'source.group.mutate' ? '核对' : '处理原操作', busy: this.busy(),
            secondaryActionLabel: this.snapshot.original?.method === 'source.group.mutate' && this.snapshot.original?.canRetryOriginal ? (this.snapshot.original?.writeStage === 'cleanup' ? '继续清理' : '继续原操作') : '',
            onReconcile: (generation: number): void => this.reconcile(generation, false),
            onSecondaryAction: (generation: number): void => this.reconcile(generation, true) });
        }, (key: string): string => key);
      }.width(this.geometry().content.frame.width)
        .onAreaChange((_old: Area, next: Area): void => {
          const height = readerPageAreaLength(next.height);
          if (Number.isFinite(height) && Math.abs(height - this.recoveryHeight) > .1) this.recoveryHeight = height;
        }).margin({ left: this.geometry().content.frame.left, top: this.geometry().header.bottom + TOK_SPACE_XS });
    }
  }
  build() {
    ReaderPageScaffold({ frameStyle: this.frameStyle(), geometry: this.geometry(),
      headerMeasurementKey: this.metricsRevision, footerMeasurementKey: this.metricsRevision,
      header: (): void => { PageBackBar({ title: this.title(), onBack: (): void => this.back() }); },
      content: (): void => { this.body(); }, footer: (): void => { this.footer(); }, overlayContent: (): void => { this.recovery(); },
      onHeaderHeightChange: (height: number, generation: number): void => {
        if (this.measurements.record('groups:header', height, generation)) this.measurementRevision += 1;
      }, onFooterHeightChange: (height: number): void => {
        if (this.measurements.record('groups:footer', height, this.metricsRevision)) this.measurementRevision += 1;
      } }).onAreaChange((_old: Area, next: Area): void => {
        const width = readerPageAreaLength(next.width);
        if (Number.isFinite(width) && width > 0 && Math.abs(width - this.viewportWidth) > .1) this.viewportWidth = width;
      });
  }
}
