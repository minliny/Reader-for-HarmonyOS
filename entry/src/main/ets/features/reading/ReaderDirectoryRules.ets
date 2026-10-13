import { ReaderFormField } from '../common/ReaderFormField';
import { ReaderInlineSelect } from '../common/ReaderInlineSelect';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { TYPE_APP_INHERITED_BODY, TYPE_APP_INHERITED_HINT, TYPE_READER_DIRECTORY_RULE_HEADING } from '../common/ReaderTypography';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderDirectoryRulesGateway } from './ReaderDirectoryRulesGateway';
import type { RulesMutationSnapshot } from '../settings/RulesMutationOwner';
import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { readerAppColor } from '../common/ReaderThemeRegistry';

class DirectoryRuleDraft {
  id: number; pattern: string; level: string; boundary: string;
  constructor(id: number, pattern: string = '', level: string = '0', boundary: string = 'title') {
    this.id = id; this.pattern = pattern; this.level = level; this.boundary = boundary;
  }
}

/** Per-book navigation rules use Core's existing regex adapter and preview;
 * the editor never changes TXT splitting or derives a tree in Host. */
@Component
export struct ReaderDirectoryRules {
  @Prop @Watch('loadRules') bookId: string = '';
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @State private rules: DirectoryRuleDraft[] = [];
  private nextRuleId: number = 0;
  @State private message: string = '';
  @State private preview: string[] = [];
  @State private previewReady: boolean = false;
  @State private busy: boolean = false;
  @State private loaded: boolean = false;
  @State private directoryRefreshFailed: boolean = false;
  private generation: number = 0;
  private mounted: boolean = false;
  private presentationGeneration: number = 0;
  private gateway: ReaderDirectoryRulesGateway | undefined = undefined;
  @State private operation: RulesMutationSnapshot = { generation: 0, busy: false, confirmation: 'undispatched',
    label: '', method: '', message: '', blocked: false, canRetryOriginal: false, writeStage: 'intent' };
  onApplied: () => void = (): void => {};

  aboutToAppear(): void {
    this.gateway = new ReaderDirectoryRulesGateway(ReaderRuntimeOwner.current());
    this.mounted = true; this.loadRules();
  }
  private loadRules(): void {
    this.changed(); this.presentationGeneration += 1; this.loaded = false; this.directoryRefreshFailed = false;
    const generation = this.generation, bookId = this.bookId;
    const gateway = this.gateway;
    if (!this.mounted || gateway === undefined) return;
    const current = (): boolean => this.mounted && generation === this.generation && bookId === this.bookId &&
      gateway === this.gateway && gateway.ownsRuntime();
    this.busy = true;
    this.message = '正在读取本书目录层级规则';
    void gateway.inspect(current).then(async (): Promise<JsonObject> => {
      if (!current()) throw new Error('目录规则读取入口已退役');
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
          '已载入本书规则；当前 Core 尚不支持原操作回执，仅可预览';
      }).catch((_error: Error): void => {
        if (current()) { this.operation = gateway.snapshot(); this.message = '当前规则读取尚未完成，草稿已保留，请重新读取'; }
      }).finally((): void => { if (current()) this.busy = false; });
  }
  private edit(id: number, field: string, value: string): void {
    if (!this.canEdit() || !this.rules.some((rule: DirectoryRuleDraft): boolean => rule.id === id)) return;
    this.rules = this.rules.map((rule: DirectoryRuleDraft): DirectoryRuleDraft => rule.id !== id ? rule :
      new DirectoryRuleDraft(id, field === 'pattern' ? value : rule.pattern,
        field === 'level' ? value : rule.level, field === 'boundary' ? value : rule.boundary));
    this.changed();
  }
  aboutToDisappear(): void { this.mounted = false; this.generation += 1; this.presentationGeneration += 1; }
  private changed(): void { this.generation += 1; this.previewReady = false; this.busy = false; this.preview = []; }
  private async run(apply: boolean): Promise<void> {
    const gateway = this.gateway;
    if (!this.canEdit() || gateway === undefined || (apply && (!this.previewReady || !gateway.supportsApply()))) return;
    if (this.rules.some((rule: DirectoryRuleDraft): boolean => rule.level.trim().length === 0 ||
      !Number.isInteger(Number(rule.level)) || Number(rule.level) < 0 || Number(rule.level) > 31 ||
      rule.pattern.trim().length === 0)) {
      this.message = '请填写匹配规则及 0–31 的层级；删除所有规则可恢复默认'; return;
    }
    const generation = ++this.generation, bookId = this.bookId;
    const current = (): boolean => this.mounted && generation === this.generation && this.bookId === bookId &&
      gateway === this.gateway && gateway.ownsRuntime();
    const rules: JsonObject[] = this.rules.map((rule: DirectoryRuleDraft): JsonObject =>
      ({ pattern: rule.pattern, level: Number(rule.level), boundary: rule.boundary }));
    this.busy = true;
    this.message = apply ? '正在应用本书目录层级规则' : '正在预览，本次修改尚未应用';
    try {
      const data: JsonObject = apply ? await gateway.apply(bookId, rules, current) : await gateway.preview(bookId, rules, current);
      if (!current()) return;
      this.operation = gateway.snapshot();
      this.previewReady = data['status'] === 'ready';
      if (!this.previewReady) { this.message = `无法应用：${String(data['reason'] ?? '没有可靠的层级边界')}`; return; }
      this.message = `${data['nodeCount']} 个目录节点 · ${data['readableChapterCount']} 个可读章节 · ${data['unmappedCount'] ?? 0} 个无法映射项`;
      const raw: JsonObject[] = data['nodes'] as JsonObject[];
      this.preview = Array.isArray(raw) ? raw.slice(0, 256).map((value: JsonObject): string => {
        const node: JsonObject = value;
        return `${'  '.repeat(Math.max(0, Math.min(32, Number(node['depth'] ?? 0))))}${String(node['title'] ?? '')}`;
      }) : [];
      if (apply) { this.message = '目录层级规则已应用，正文和分章保持原样'; this.notifyApplied(); }
    } catch (_error) { if (current()) {
      this.operation = gateway.snapshot();
      this.message = apply ? (this.operation.confirmation === 'unknown' ? '本书目录规则应用尚未确认，原草稿已保留，请核对原操作' :
        this.operation.confirmation === 'confirmed' ? (this.operation.blocked && this.operation.writeStage === 'cleanup' ?
          '本书目录规则写入已确认，原记录清理尚未完成' : '本书目录规则写入已确认，当前目录刷新尚未完成') :
          '本书目录规则未确认应用，草稿已保留') :
        '规则预览失败，草稿已保留';
      this.previewReady = false;
    } }
    finally { if (current()) this.busy = false; }
  }
  private canEdit(): boolean {
    const snapshot = this.gateway?.snapshot();
    return this.mounted && this.loaded && !this.busy && this.gateway?.ownsRuntime() === true &&
      snapshot !== undefined && !snapshot.busy && !snapshot.blocked && snapshot.confirmation !== 'unknown';
  }
  private actorIdentity(): string { return `${this.presentationGeneration}:${this.bookId}`; }
  private ownsActor(identity: string): boolean {
    return this.mounted && identity === this.actorIdentity() && this.gateway?.ownsRuntime() === true;
  }
  private recoveryIdentity(): string { return `${this.actorIdentity()}\u0000${this.operation.operationId ?? ''}`; }
  private ownsRecovery(identity: string): boolean { return this.ownsActor(identity.slice(0, identity.lastIndexOf('\u0000'))) && identity === this.recoveryIdentity(); }
  private recoveryView(): ReaderRecoveryView {
    return { visible: this.operation.blocked || this.operation.confirmation === 'unknown' || this.directoryRefreshFailed,
      message: this.operation.blocked || this.operation.confirmation === 'unknown' ? this.operation.message : this.message,
      canRetry: false, generation: this.operation.generation };
  }
  private notifyApplied(): void {
    try { this.onApplied(); this.directoryRefreshFailed = false; }
    catch (_) { this.directoryRefreshFailed = true; this.message = '本书目录规则写入已确认，当前目录刷新尚未完成，请重试刷新'; }
  }
  private retryDirectoryRefresh(identity: string): void {
    if (this.busy || !this.directoryRefreshFailed || !this.ownsRecovery(identity)) return;
    this.notifyApplied();
    if (!this.directoryRefreshFailed) this.message = '当前目录刷新已请求，请重新预览当前草稿';
  }
  private canContinueOriginal(): boolean {
    const original = this.operation.original;
    return this.operation.canRetryOriginal && original?.method === 'reading.directory.rules.apply.v2' &&
      original.params['sourceId'] === 'local' && original.params['bookId'] === this.bookId;
  }
  private async recover(identity: string, continuing: boolean): Promise<void> {
    const gateway = this.gateway;
    if (gateway === undefined || this.busy || !this.ownsRecovery(identity) || (continuing && !this.canContinueOriginal())) return;
    const bookId = this.bookId, operationId = this.operation.operationId, generation = ++this.generation;
    const current = (): boolean => this.ownsRecovery(identity) && generation === this.generation && gateway === this.gateway;
    this.busy = true;
    try {
      if (continuing && operationId !== undefined) await gateway.continueOriginal(bookId, operationId, current);
      else await gateway.inspect(current, operationId);
      if (!current()) return;
      this.operation = gateway.snapshot();
      if (continuing && !this.operation.blocked) {
        // History only settles the original write. Fresh directory reads remain
        // authoritative for current navigation, never the old ACK's nodes.
        this.previewReady = false;
        if (this.operation.confirmation === 'confirmed') {
          this.message = '原目录规则操作已核对完成，请重新预览当前草稿';
          this.notifyApplied();
        } else this.message = `${this.operation.message || 'Core 已确认原操作未执行'}；原草稿已保留，请重新预览`;
      }
    } catch (_error) { if (current()) { this.operation = gateway.snapshot(); this.message = this.operation.message; } }
    finally { if (current()) this.busy = false; }
  }
  build() {
    Column({ space: 8 }) {
      Text('本书目录层级规则').fontSize(TYPE_READER_DIRECTORY_RULE_HEADING.fontSizeFp).fontWeight(TYPE_READER_DIRECTORY_RULE_HEADING.fontWeight as number);
      Text('只调整导航层级；0 为最外层，范围 0–31。删除所有规则可恢复默认，请先预览。').fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp);
      Text('正则匹配完整标题或独立行，例如“第一卷.*”可匹配“第一卷 童子行”。').fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp);
      ForEach([this.actorIdentity()], (identity: string) => {
      if (this.rules.length > 0) {
        Scroll() { Column({ space: 8 }) {
      ForEach(this.rules, (rule: DirectoryRuleDraft) => {
        Column({ space: 6 }) {
          ReaderFormField({ specId: 'directory-rule-pattern', scheme: this.scheme, text: rule.pattern,
            isEditable: this.canEdit(), placeholder: '匹配完整标题或独立正文行的正则表达式',
            onTextChange: (value: string): void => { if (this.ownsActor(identity)) this.edit(rule.id, 'pattern', value); } });
          Row({ space: 8 }) {
            Text('层级').fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp);
            ReaderFormField({ specId: 'directory-rule-level', scheme: this.scheme, text: rule.level,
              isEditable: this.canEdit(),
              onTextChange: (value: string): void => { if (this.ownsActor(identity)) this.edit(rule.id, 'level', value); } });
            ReaderInlineSelect({
              value: ['已有标题', '章首独立行', '章尾独立行', '独立行边界'][Math.max(0, ['title', 'head', 'tail', 'any'].indexOf(rule.boundary))],
              options: ['已有标题', '章首独立行', '章尾独立行', '独立行边界'],
              selectedIndex: Math.max(0, ['title', 'head', 'tail', 'any'].indexOf(rule.boundary)),
              actionEnabled: this.canEdit(),
              onSelect: (index: number, _value: string): void => { if (this.ownsActor(identity)) this.edit(rule.id, 'boundary', ['title', 'head', 'tail', 'any'][index]); },
            });
            Button('删除').enabled(this.canEdit()).onClick((): void => {
              if (!this.ownsActor(identity) || !this.canEdit() || !this.rules.some((item: DirectoryRuleDraft): boolean => item.id === rule.id)) return;
              this.rules = this.rules.filter((item: DirectoryRuleDraft): boolean => item.id !== rule.id); this.changed();
            });
          }
        }
      }, (rule: DirectoryRuleDraft): string => `${rule.id}`);
        } }.height(Math.min(240, this.rules.length * 94)).width('100%');
      }
      Row({ space: 8 }) {
        Button('添加规则').enabled(this.canEdit() && this.rules.length < 32).onClick((): void => {
          if (!this.ownsActor(identity) || !this.canEdit() || this.rules.length >= 32) return;
          this.rules = [...this.rules, new DirectoryRuleDraft(++this.nextRuleId)]; this.changed();
        });
        Button('预览').enabled(this.canEdit()).onClick((): void => { if (this.ownsActor(identity)) void this.run(false); });
        Button('应用').enabled(this.canEdit() && this.previewReady && this.gateway?.supportsApply() === true)
          .onClick((): void => { if (this.ownsActor(identity)) void this.run(true); });
      }
      }, (identity: string): string => identity);
      Text(this.message).fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp);
      ForEach([this.recoveryIdentity()], (identity: string) => {
        ReaderRecoveryNotice({ view: this.recoveryView() });
        if (this.operation.blocked || this.operation.confirmation === 'unknown') {
          ReaderRecoveryAction({ label: '核对原操作回执', generation: this.operation.generation,
            actionEnabled: !this.busy && this.ownsRecovery(identity), onReconcile: (): void => { void this.recover(identity, false); } });
          if (this.canContinueOriginal()) {
            ReaderRecoveryAction({ label: '继续原操作', generation: this.operation.generation,
              actionEnabled: !this.busy && this.ownsRecovery(identity), onReconcile: (): void => { void this.recover(identity, true); } });
          }
        } else if (!this.loaded && !this.busy) {
          ReaderRecoveryAction({ label: '重新读取规则', generation: this.operation.generation,
            actionEnabled: this.ownsRecovery(identity), onReconcile: (): void => { if (this.ownsRecovery(identity)) this.loadRules(); } });
        }
        if (this.directoryRefreshFailed) {
          ReaderRecoveryAction({ label: '刷新当前目录', generation: this.operation.generation,
            actionEnabled: !this.busy && this.ownsRecovery(identity), onReconcile: (): void => { this.retryDirectoryRefresh(identity); } });
        }
      }, (identity: string): string => identity);
      if (this.preview.length > 0) {
        Scroll() { Column() { ForEach(this.preview, (title: string, index: number) => {
          Text(title).fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp).width('100%');
        }, (_title: string, index: number): string => `${index}`); } }.height(120);
      }
    }.width('100%').padding(10).foregroundColor(readerAppColor('TOK_INK', this.scheme))
      .backgroundColor(readerAppColor('TOK_PAPER', this.scheme));
  }
}
