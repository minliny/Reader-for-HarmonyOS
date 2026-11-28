import { ReaderDirectoryRulesPreviewDataSource, type ReaderDirectoryRulesPreviewItem } from './ReaderDirectoryRulesPreviewDataSource';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import { LengthMetrics } from '@kit.ArkUI';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { ReaderInlineSelect } from '../../../ui/controls/ReaderInlineSelect';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { TYPE_APP_INHERITED_HINT, TYPE_READER_DIRECTORY_RULE_HEADING } from '../../../ui/foundation/ReaderTypography';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderDirectoryRulesGateway } from '../application/ReaderDirectoryRulesGateway';
import type { RulesMutationSnapshot } from '../../settings/application/RulesMutationOwner';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';

class DirectoryRuleDraft {
  id: number; pattern: string; level: string; boundary: string;
  constructor(id: number, pattern: string = '', level: string = '0', boundary: string = 'title') {
    this.id = id; this.pattern = pattern; this.level = level; this.boundary = boundary;
  }
}

/** A view of this editor's retained original operation. The page owns placement;
 * all actions still enter this mounted editor and its original gateway. */
export interface ReaderDirectoryRulesRecoveryProjection {
  bookId: string;
  identity: string;
  view: ReaderRecoveryView;
  actionLabel: string;
  secondaryActionLabel: string;
  busy: boolean;
  onReconcile: (generation: number) => void;
  onSecondaryAction: (generation: number) => void;
}

/** Per-book navigation rules use Core's existing regex adapter and preview;
 * the editor never changes TXT splitting or derives a tree in Host. */
@Component
export struct ReaderDirectoryRules {
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();
  private readonly editingScroller: Scroller = new Scroller();
  @Prop reduceMotion: boolean = false;
  @Prop @Watch('onPreviewActiveChanged') previewActive: boolean = true;
  @Prop @Watch('loadRules') bookId: string = '';
  @Prop @Watch('onInteractionChanged') interactionEnabled: boolean = true;
  @Prop focusTargetId: string = '';
  @Prop availableWidthVp: number = -1;
  @Prop availableHeightVp: number = -1;
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @State private rules: DirectoryRuleDraft[] = [];
  private nextRuleId: number = 0;
  @State private message: string = '';
  private readonly previewSource: ReaderDirectoryRulesPreviewDataSource = new ReaderDirectoryRulesPreviewDataSource((offset: number): void => { void this.loadPreviewPage(offset); });
  @State private previewCount: number = 0;
  @State private previewReadFailed: boolean = false;
  @State private previewReady: boolean = false;
  @State private busy: boolean = false;
  @State private loaded: boolean = false;
  @State private directoryRefreshFailed: boolean = false;
  private generation: number = 0;
  private mounted: boolean = false;
  @State private presentationGeneration: number = 0;
  private refreshedOperationIdentity: string = '';
  private gateway: ReaderDirectoryRulesGateway | undefined = undefined;
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @State private operation: RulesMutationSnapshot = { generation: 0, busy: false, confirmation: 'undispatched',
    label: '', method: '', message: '', blocked: false, canRetryOriginal: false, writeStage: 'intent' };
  onApplied: () => void = (): void => {};
  isPresentationCurrent: () => boolean = (): boolean => true;
  onRecoveryChanged: (projection: ReaderDirectoryRulesRecoveryProjection | undefined) => void =
    (_projection: ReaderDirectoryRulesRecoveryProjection | undefined): void => {};

  aboutToAppear(): void {
    this.gateway = new ReaderDirectoryRulesGateway(ReaderRuntimeOwner.current());
    this.mounted = true; this.loadRules();
  }
  private onInteractionChanged(): void {
    if (!this.interactionEnabled || !this.isPresentationCurrent()) this.releasePreview();
    const gateway = this.gateway;
    if (!this.interactionEnabled || !this.mounted || !this.isPresentationCurrent() || this.busy ||
      gateway?.ownsRuntime() !== true) return;
    if (!this.loaded) { this.loadRules(); return; }
    this.operation = gateway.snapshot();
    this.publishRecovery();
  }

  private loadRules(): void {
    this.changed(); this.presentationGeneration += 1; this.loaded = false; this.directoryRefreshFailed = false;
    this.feedback.reset(); this.onRecoveryChanged(undefined);
    const generation = this.generation, bookId = this.bookId;
    const gateway = this.gateway;
    if (!this.mounted || gateway === undefined) return;
    const mountedRequest = (): boolean => this.mounted && generation === this.generation &&
      bookId === this.bookId && gateway === this.gateway && gateway.ownsRuntime();
    const current = (): boolean => mountedRequest() && this.isPresentationCurrent();
    this.busy = true;
    this.message = '正在读取本书目录层级规则';
    void gateway.inspect(current).then(async (): Promise<JsonObject> => {
      if (!current()) throw new Error('目录规则读取入口已退役');
      this.operation = gateway.snapshot(); this.publishRecovery();
      return await gateway.read(bookId, current);
    }).then((data: JsonObject): void => {
        if (!current()) return;
        this.operation = gateway.snapshot();
        if (data['status'] === 'unavailable' && data['reason'] === 'unsupportedFormat') {
          this.message = '层级规则适用于 TXT；本书使用格式自带目录';
          return;
        }
        const original = this.operation.original;
        const retained = this.operation.blocked && original?.method === 'reading.directory.rules.apply.v2' &&
          original.params['bookId'] === bookId && original.params['sourceId'] === 'local';
        const raw: JsonObject[] = (retained ? original?.params['rules'] : data['rules']) as JsonObject[];
        if (data['status'] !== 'ready' || !Array.isArray(raw)) throw new Error('rules unavailable');
        this.rules = raw.map((value: JsonObject): DirectoryRuleDraft => {
          const rule: JsonObject = value;
          return new DirectoryRuleDraft(++this.nextRuleId, String(rule['pattern']), String(rule['level']), String(rule['boundary']));
        });
        this.loaded = true;
        this.message = gateway.supportsApply() ? (this.rules.length === 0 ? '正在使用默认卷规则' : '已载入本书规则') :
          '已载入本书规则（当前仅支持预览）';
      }).catch((_error: Error): void => {
        if (current()) { this.operation = gateway.snapshot(); this.message = '当前规则读取尚未完成，草稿已保留，请重新读取'; }
      }).finally((): void => {
        if (mountedRequest()) this.busy = false;
        if (current()) this.publishRecovery();
      });
  }
  private edit(id: number, field: string, value: string): void {
    if (!this.canEdit() || !this.rules.some((rule: DirectoryRuleDraft): boolean => rule.id === id)) return;
    this.rules = this.rules.map((rule: DirectoryRuleDraft): DirectoryRuleDraft => rule.id !== id ? rule :
      new DirectoryRuleDraft(id, field === 'pattern' ? value : rule.pattern,
        field === 'level' ? value : rule.level, field === 'boundary' ? value : rule.boundary));
    this.changed();
  }
  private currentRule(id: number): DirectoryRuleDraft | undefined {
    return this.rules.find((rule: DirectoryRuleDraft): boolean => rule.id === id);
  }
  aboutToDisappear(): void {
    this.releasePreview();
    this.mounted = false; this.generation += 1; this.presentationGeneration += 1;
    this.feedback.reset(); this.onRecoveryChanged(undefined);
  }
  private onPreviewActiveChanged(): void { if (!this.previewActive) this.releasePreview(); }
  private releasePreview(): void {
    if ((this.previewCount > 0 || this.previewReady || this.busy) && (!this.busy || this.gateway?.snapshot().busy !== true))
      this.message = '请重新预览当前草稿';
    this.gateway?.releasePreview(); this.previewSource.clear(); this.previewCount=0; this.previewReadFailed=false; this.previewReady=false;
  }
  private changed(): void { this.generation += 1; this.releasePreview(); this.busy = false; }
  private async loadPreviewPage(offset: number): Promise<void> {
    const gateway=this.gateway,id=this.previewSource.currentId(),generation=this.generation;
    const current=(): boolean=>this.mounted && this.previewActive && this.interactionEnabled && this.isPresentationCurrent() &&
      gateway===this.gateway && gateway?.ownsRuntime()===true && generation===this.generation && id===this.previewSource.currentId();
    if(gateway===undefined || !current())return;
    try { const page=await gateway.previewPage(offset,current);if(current())this.previewSource.admit(page); }
    catch(_error) { if(current()) {this.previewSource.reject(offset);this.previewReadFailed=true;} }
    if(current())this.previewReadFailed=this.previewSource.firstFailure()!==undefined;
  }
  private prefetchPreview(end: number): void {
    if(this.previewReady && this.previewActive && this.interactionEnabled && end>=0) this.previewSource.request(Math.floor((end+5)/256)*256);
  }
  private async run(apply: boolean): Promise<void> {
    const gateway = this.gateway;
    if (!this.canEdit() || gateway === undefined || (apply && (!this.previewReady || !gateway.supportsApply()))) return;
    if (this.rules.some((rule: DirectoryRuleDraft): boolean => rule.level.trim().length === 0 ||
      !Number.isInteger(Number(rule.level)) || Number(rule.level) < 0 || Number(rule.level) > 31 ||
      rule.pattern.trim().length === 0)) {
      this.message = '请填写匹配规则及 0–31 的层级；删除所有规则可恢复默认'; return;
    }
    if (!apply) this.releasePreview();
    const generation = ++this.generation, bookId = this.bookId;
    const mountedRequest = (): boolean => this.mounted && generation === this.generation &&
      bookId === this.bookId && gateway === this.gateway && gateway.ownsRuntime();
    const current = (): boolean => mountedRequest() && this.previewActive && this.interactionEnabled && this.isPresentationCurrent();
    const rules: JsonObject[] = this.rules.map((rule: DirectoryRuleDraft): JsonObject =>
      ({ pattern: rule.pattern, level: Number(rule.level), boundary: rule.boundary }));
    this.busy = true;
    this.message = apply ? '正在应用本书目录层级规则' : '正在预览，本次修改尚未应用';
    this.publishRecovery();
    try {
      const data: JsonObject = apply ? await gateway.apply(bookId, rules, current) : await gateway.preview(bookId, rules, current);
      if (!current()) return;
      this.operation = gateway.snapshot();
      this.previewReady = data['status'] === 'ready';
      if (!this.previewReady) { this.message = `无法应用：${String(data['reason'] ?? '没有可靠的层级边界')}`; return; }
      this.message = `${data['nodeCount']} 个目录节点 · ${data['readableChapterCount']} 个可读章节 · ${data['unmappedCount'] ?? 0} 个无法映射项`;
      if (!apply) {
        const preview=gateway.currentPreview();
        if(preview===undefined)throw new Error('完整预览身份缺失');
        this.previewSource.replace(preview);this.previewCount=preview.nodeCount;this.previewReadFailed=false;
      } else {
        this.releasePreview();this.message='目录层级规则已应用，正文和分章保持原样';this.notifyApplied();
      }
    } catch (_error) { if (current()) {
      this.operation = gateway.snapshot();
      this.message = apply ? (this.operation.confirmation === 'unknown' ? '本书目录规则应用尚未确认，原草稿已保留，请核对原操作' :
        this.operation.confirmation === 'confirmed' ? (this.operation.blocked && this.operation.writeStage === 'cleanup' ?
          '本书目录规则写入已确认，原记录清理尚未完成' : '本书目录规则写入已确认，当前目录刷新尚未完成') :
          (!this.operation.blocked ? '本书目录规则未应用，请重新预览当前草稿' : '本书目录规则未确认应用，草稿已保留')) :
        '规则预览失败，草稿已保留';
      this.previewReady = false;
    } }
    finally {
      if (mountedRequest()) this.busy = false;
      if (current()) this.publishRecovery();
    }
  }
  private canEdit(): boolean {
    const snapshot = this.gateway?.snapshot();
    return this.previewActive && this.interactionEnabled && this.mounted && this.isPresentationCurrent() &&
      this.loaded && !this.busy && this.gateway?.ownsRuntime() === true &&
      snapshot !== undefined && !snapshot.busy && !snapshot.blocked && snapshot.confirmation !== 'unknown';
  }
  private actorIdentity(): string { return `${this.presentationGeneration}:${this.bookId}`; }
  private ownsMountedActor(identity: string): boolean {
    return this.mounted && identity === this.actorIdentity() && this.gateway?.ownsRuntime() === true;
  }
  private ownsActor(identity: string): boolean { return this.ownsMountedActor(identity) && this.isPresentationCurrent(); }
  private recoveryIdentity(): string { return `${this.actorIdentity()}\u0000${this.operation.operationId ?? ''}`; }
  private ownsRecovery(identity: string): boolean { return this.ownsActor(identity.slice(0, identity.lastIndexOf('\u0000'))) && identity === this.recoveryIdentity(); }
  private recoveryView(): ReaderRecoveryView {
    return { visible: this.operation.blocked || this.operation.confirmation === 'unknown',
      message: this.operation.message || this.message,
      canRetry: !this.busy, generation: this.operation.generation };
  }
  private publishRecovery(): void {
    const view = this.recoveryView(), identity = this.recoveryIdentity(), generation = this.operation.generation;
    if (!view.visible || !this.ownsRecovery(identity)) { this.onRecoveryChanged(undefined); return; }
    this.onRecoveryChanged({ bookId: this.bookId, identity, view, actionLabel: '核对原操作',
      secondaryActionLabel: this.canContinueOriginal() ? '继续原操作' : '', busy: this.busy,
      onReconcile: (expected: number): void => {
        if (expected === generation && generation === this.operation.generation && this.ownsRecovery(identity))
          void this.recover(identity, false);
      },
      onSecondaryAction: (expected: number): void => {
        if (expected === generation && generation === this.operation.generation && this.ownsRecovery(identity))
          void this.recover(identity, true);
      } });
  }
  private notifyApplied(): void {
    const operationIdentity = this.operation.operationId === undefined ? '' : this.recoveryIdentity();
    if (operationIdentity.length > 0 && operationIdentity === this.refreshedOperationIdentity) return;
    try {
      this.onApplied(); this.directoryRefreshFailed = false;
      this.refreshedOperationIdentity = operationIdentity;
    }
    catch (_) {
      this.directoryRefreshFailed = true;
      const identity = this.actorIdentity();
      this.feedback.show(() => this.getUIContext(), {
        message: '目录规则已应用，当前目录刷新失败，可重新刷新', key: `${identity}:directory-refresh`,
      }, (): boolean => this.ownsActor(identity));
    }
  }
  private retryDirectoryRefresh(identity: string): void {
    if (!this.interactionEnabled || this.busy || !this.directoryRefreshFailed || !this.ownsRecovery(identity)) return;
    this.notifyApplied();
    if (!this.directoryRefreshFailed) this.message = '当前目录刷新已请求，请重新预览当前草稿';
  }
  private originalBelongsToBook(): boolean {
    const original = this.operation.original;
    return original?.method === 'reading.directory.rules.apply.v2' &&
      original.params['sourceId'] === 'local' && original.params['bookId'] === this.bookId;
  }
  private canContinueOriginal(): boolean { return this.operation.canRetryOriginal && this.originalBelongsToBook(); }
  private async recover(identity: string, continuing: boolean): Promise<void> {
    const gateway = this.gateway;
    if (gateway === undefined || this.busy || !this.ownsRecovery(identity) || (continuing && !this.canContinueOriginal())) return;
    const bookId = this.bookId, operationId = this.operation.operationId, generation = ++this.generation;
    const actorIdentity = this.actorIdentity();
    const mountedRequest = (): boolean => this.ownsMountedActor(actorIdentity) &&
      generation === this.generation && gateway === this.gateway;
    const current = (): boolean => mountedRequest() && this.isPresentationCurrent();
    this.busy = true;
    this.publishRecovery();
    try {
      if (continuing && operationId !== undefined) await gateway.continueOriginal(bookId, operationId, current);
      else await gateway.inspect(current, operationId);
      if (!current()) return;
      this.operation = gateway.snapshot();
      if (operationId !== undefined && this.originalBelongsToBook() && this.operation.operationId === operationId &&
        this.operation.confirmation === 'confirmed') {
        // History only settles the original write. Fresh directory reads remain
        // authoritative for current navigation, never the old ACK's nodes.
        // Inspection may confirm Core while Host cleanup remains blocked; ask
        // for the fresh directory without clearing that retained operation.
        this.previewReady = false;
        if (!this.operation.blocked)
          this.message = '原目录规则操作已核对完成，请重新预览当前草稿';
        this.notifyApplied();
      } else if (continuing && !this.operation.blocked) {
        this.previewReady = false;
        this.message = `${this.operation.message || '原修改未生效'}；原草稿已保留，请重新预览`;
      }
    } catch (_error) { if (current()) { this.operation = gateway.snapshot(); this.message = this.operation.message; } }
    finally {
      if (mountedRequest()) this.busy = false;
      if (current()) this.publishRecovery();
    }
  }
  build() {
    Column({ space: 8 }) {
      Text('本书目录层级规则').fontSize(TYPE_READER_DIRECTORY_RULE_HEADING.fontSizeFp)
        .fontFamily(TYPE_READER_DIRECTORY_RULE_HEADING.fontFamily)
        .fontColor(readerAppColor('TOK_INK', this.scheme))
        .fontWeight(TYPE_READER_DIRECTORY_RULE_HEADING.fontWeight as number)
        .id(this.focusTargetId.length > 0 ? this.focusTargetId : undefined)
        .focusable(this.interactionEnabled && this.focusTargetId.length > 0);
      Text('仅调整目录层级（0 为最外层，0–31）；清空规则恢复默认。')
        .fontFamily(TYPE_APP_INHERITED_HINT.fontFamily).fontWeight(TYPE_APP_INHERITED_HINT.fontWeight).fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.scheme));
      ForEach([this.actorIdentity()], (identity: string) => {
      if (this.rules.length > 0) {
        Scroll(this.editingScroller) { Column({ space: 8 }) {
      ForEach(this.rules, (rule: DirectoryRuleDraft) => {
        Column({ space: 6 }) {
          ReaderFormField({ editingHost: this.editingHost, specId: 'directory-rule-pattern', scheme: this.scheme, text: this.currentRule(rule.id)?.pattern ?? '',
            fieldAccessibilityLabel: `规则${rule.id}匹配表达式`,
            isEditable: this.canEdit(), placeholder: '输入标题正则表达式，如 第一卷.*',
            onTextChange: (value: string): void => { if (this.ownsActor(identity)) this.edit(rule.id, 'pattern', value); } });
          Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
            space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(8) } }) {
            Text('层级').fontFamily(TYPE_APP_INHERITED_HINT.fontFamily).fontWeight(TYPE_APP_INHERITED_HINT.fontWeight).fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.scheme));
            ReaderFormField({ editingHost: this.editingHost, specId: 'directory-rule-level', scheme: this.scheme, text: this.currentRule(rule.id)?.level ?? '',
              fieldAccessibilityLabel: `规则${rule.id}层级`,
              isEditable: this.canEdit(),
              onTextChange: (value: string): void => { if (this.ownsActor(identity)) this.edit(rule.id, 'level', value); } });
            ReaderInlineSelect({ reduceMotion: this.reduceMotion,
              value: ['已有标题', '章首独立行', '章尾独立行', '独立行边界'][Math.max(0, ['title', 'head', 'tail', 'any'].indexOf(this.currentRule(rule.id)?.boundary ?? 'title'))],
              options: ['已有标题', '章首独立行', '章尾独立行', '独立行边界'],
              selectedIndex: Math.max(0, ['title', 'head', 'tail', 'any'].indexOf(this.currentRule(rule.id)?.boundary ?? 'title')),
              actionEnabled: this.canEdit(),
              maxTriggerWidthVp: this.availableWidthVp >= 0 ? Math.max(0, this.availableWidthVp - 20) : -1,
              onSelect: (index: number, _value: string): void => { if (this.ownsActor(identity)) this.edit(rule.id, 'boundary', ['title', 'head', 'tail', 'any'][index]); },
            });
            ReaderButton({ scheme: this.scheme, specId: 'rules-compact', variant: 'danger', visualSize: 'small', label: '删除', actionEnabled: this.canEdit(), onAction: (): void => {
              if (!this.ownsActor(identity) || !this.canEdit() || !this.rules.some((item: DirectoryRuleDraft): boolean => item.id === rule.id)) return;
              this.rules = this.rules.filter((item: DirectoryRuleDraft): boolean => item.id !== rule.id); this.changed();
            } });
          }.width('100%');
        }
      }, (rule: DirectoryRuleDraft): string => `${rule.id}`);
        } }.height(Math.min(
            readerScaledControlHeight(240, 36, readerReadableFontScale(this.readerWindowMetricsRevision < 0 ? 1 : readerWindowMetrics().systemFontScale)),
            this.rules.length * readerScaledControlHeight(94, 36, readerReadableFontScale(this.readerWindowMetricsRevision < 0 ? 1 : readerWindowMetrics().systemFontScale)),
            this.availableHeightVp >= 0 ? this.availableHeightVp : 240)).width('100%')
          .id(this.editingScroll.id)
          .onAppear((): void => this.editingScroll.mount(this.getUIContext(), this.editingHost, this.editingScroller))
          .onDisAppear((): void => this.editingScroll.unmount())
          .onAreaChange((): void => this.editingHost.refresh());
      }
      Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(8) } }) {
        ReaderButton({ scheme: this.scheme, specId: 'rules-compact', variant: 'tonal', visualSize: 'small', label: '添加规则', actionEnabled: this.canEdit() && this.rules.length < 32, onAction: (): void => {
          if (!this.ownsActor(identity) || !this.canEdit() || this.rules.length >= 32) return;
          this.rules = [...this.rules, new DirectoryRuleDraft(++this.nextRuleId)]; this.changed();
        } });
        ReaderButton({ scheme: this.scheme, specId: 'rules-compact', variant: 'tonal', visualSize: 'small', label: '预览', actionEnabled: this.canEdit(),
          onAction: (): void => { if (this.ownsActor(identity)) void this.run(false); } });
        ReaderButton({ scheme: this.scheme, specId: 'rules-compact', variant: 'primary', visualSize: 'small', label: '应用', actionEnabled: this.canEdit() && this.previewReady && this.gateway?.supportsApply() === true,
          onAction: (): void => { if (this.ownsActor(identity)) void this.run(true); } });
      }.width('100%');
      }, (identity: string): string => identity);
      if (!this.recoveryView().visible) {
        Text(this.message).fontFamily(TYPE_APP_INHERITED_HINT.fontFamily).fontWeight(TYPE_APP_INHERITED_HINT.fontWeight).fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.scheme));
      }
      ForEach([this.recoveryIdentity()], (identity: string) => {
        if (!this.recoveryView().visible && !this.loaded && !this.busy) {
          ReaderRecoveryAction({ label: '重新读取规则', generation: this.operation.generation,
            actionEnabled: this.interactionEnabled && this.ownsRecovery(identity),
            onReconcile: (): void => { if (this.interactionEnabled && this.ownsRecovery(identity)) this.loadRules(); } });
        }
        if (this.directoryRefreshFailed) {
          ReaderRecoveryAction({ label: '刷新当前目录', generation: this.operation.generation,
            actionEnabled: this.interactionEnabled && !this.busy && this.ownsRecovery(identity),
            onReconcile: (): void => { this.retryDirectoryRefresh(identity); } });
        }
      }, (identity: string): string => identity);
      if (this.previewCount > 0) {
        List({space:0}) {
          LazyForEach(this.previewSource,(item: ReaderDirectoryRulesPreviewItem)=>{
            ListItem() {
              Text(item.node===undefined ? '' : `${'  '.repeat(Math.max(0,Math.min(32,item.node.depth)))}${item.node.title}`)
                .fontFamily(TYPE_APP_INHERITED_HINT.fontFamily).fontWeight(TYPE_APP_INHERITED_HINT.fontWeight).fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.scheme)).width('100%');
            }
          },(item: ReaderDirectoryRulesPreviewItem): string=>item.key);
        }.height(120).width('100%').cachedCount(2).maintainVisibleContentPosition(true)
          .onScrollIndex((_start: number,end: number): void=>this.prefetchPreview(end));
      }
      if(this.previewReadFailed) {
        ReaderRecoveryAction({label:'重试读取预览',generation:this.generation,
          actionEnabled:this.previewActive && this.interactionEnabled && !this.busy,
          onReconcile:(expected: number): void=>{if(expected===this.generation && this.previewActive && this.interactionEnabled)this.previewSource.retry();}});
      }
    }.width('100%').padding(10).foregroundColor(readerAppColor('TOK_INK', this.scheme))
      .backgroundColor(readerAppColor('TOK_PAPER', this.scheme));
  }
}
