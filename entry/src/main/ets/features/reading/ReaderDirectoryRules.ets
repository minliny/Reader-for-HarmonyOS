import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
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
  private generation: number = 0;
  private mounted: boolean = false;
  onApplied: () => void = (): void => {};

  aboutToAppear(): void { this.mounted = true; this.loadRules(); }
  private loadRules(): void {
    this.changed(); this.rules = []; this.loaded = false;
    const generation = this.generation, bookId = this.bookId;
    if (!this.mounted) return;
    this.busy = true;
    void ReaderRuntimeOwner.current().request('reading.directory.rules.get.v2', { sourceId: 'local', bookId },
      { shouldCancel: (): boolean => !this.mounted || generation !== this.generation || bookId !== this.bookId })
      .then((result: ReaderCoreResultEvent): void => {
        if (!this.mounted || generation !== this.generation || bookId !== this.bookId) return;
        if (result.data['status'] === 'unavailable' && result.data['reason'] === 'unsupportedFormat') {
          this.message = '层级规则适用于 TXT；本书使用格式自带目录';
          return;
        }
        const raw: JsonObject[] = result.data['rules'] as JsonObject[];
        if (result.data['status'] !== 'ready' || !Array.isArray(raw)) throw new Error('rules unavailable');
        this.rules = raw.map((value: JsonObject): DirectoryRuleDraft => {
          const rule: JsonObject = value;
          return new DirectoryRuleDraft(++this.nextRuleId, String(rule['pattern']), String(rule['level']), String(rule['boundary']));
        });
        this.loaded = true;
        this.message = this.rules.length === 0 ? '正在使用默认卷规则' : '已载入本书规则';
      }).catch((_error: Error): void => {
        if (this.mounted && generation === this.generation) this.message = '当前规则读取失败，请关闭后重试';
      }).finally((): void => { if (this.mounted && generation === this.generation) this.busy = false; });
  }
  private edit(id: number, field: string, value: string): void {
    this.rules = this.rules.map((rule: DirectoryRuleDraft): DirectoryRuleDraft => rule.id !== id ? rule :
      new DirectoryRuleDraft(id, field === 'pattern' ? value : rule.pattern,
        field === 'level' ? value : rule.level, field === 'boundary' ? value : rule.boundary));
    this.changed();
  }
  aboutToDisappear(): void { this.mounted = false; this.generation += 1; }
  private changed(): void { this.generation += 1; this.previewReady = false; this.busy = false; this.preview = []; }
  private async run(apply: boolean): Promise<void> {
    if (!this.loaded || this.busy || (apply && !this.previewReady)) return;
    if (this.rules.some((rule: DirectoryRuleDraft): boolean => rule.level.trim().length === 0 ||
      !Number.isInteger(Number(rule.level)) || Number(rule.level) < 0 || Number(rule.level) > 31 ||
      rule.pattern.trim().length === 0)) {
      this.message = '请填写匹配规则及 0–31 的层级；删除所有规则可恢复默认'; return;
    }
    const generation = ++this.generation, bookId = this.bookId;
    const current = (): boolean => this.mounted && generation === this.generation && this.bookId === bookId;
    const rules: JsonObject[] = this.rules.map((rule: DirectoryRuleDraft): JsonObject =>
      ({ pattern: rule.pattern, level: Number(rule.level), boundary: rule.boundary }));
    this.busy = true;
    try {
      const result: ReaderCoreResultEvent = await ReaderRuntimeOwner.current().request(
        apply ? 'reading.directory.rules.apply.v2' : 'reading.directory.rules.preview.v2',
        { sourceId: 'local', bookId, rules }, { shouldCancel: (): boolean => !current() });
      if (!current()) return;
      const data: JsonObject = result.data;
      this.previewReady = data['status'] === 'ready';
      if (!this.previewReady) { this.message = `无法应用：${String(data['reason'] ?? '没有可靠的层级边界')}`; return; }
      this.message = `${data['nodeCount']} 个目录节点 · ${data['readableChapterCount']} 个可读章节 · ${data['unmappedCount'] ?? 0} 个无法映射项`;
      const raw: JsonObject[] = data['nodes'] as JsonObject[];
      this.preview = Array.isArray(raw) ? raw.slice(0, 256).map((value: JsonObject): string => {
        const node: JsonObject = value;
        return `${'  '.repeat(Math.max(0, Math.min(32, Number(node['depth'] ?? 0))))}${String(node['title'] ?? '')}`;
      }) : [];
      if (apply) { this.message = '目录层级规则已应用，正文和分章保持原样'; this.onApplied(); }
    } catch (_error) { if (current()) { this.message = '规则预览失败，现有目录保持原样'; this.previewReady = false; } }
    finally { if (current()) this.busy = false; }
  }
  build() {
    Column({ space: 8 }) {
      Text('本书目录层级规则').fontSize(14).fontWeight(FontWeight.Bold);
      Text('只调整导航层级；0 为最外层，范围 0–31。删除所有规则可恢复默认，请先预览。').fontSize(11);
      Text('正则匹配完整标题或独立行，例如“第一卷.*”可匹配“第一卷 童子行”。').fontSize(11);
      if (this.rules.length > 0) {
        Scroll() { Column({ space: 8 }) {
      ForEach(this.rules, (rule: DirectoryRuleDraft) => {
        Column({ space: 6 }) {
          TextInput({ text: rule.pattern, placeholder: '匹配完整标题或独立正文行的正则表达式' })
            .height(40).fontSize(12).fontColor(readerAppColor('TOK_INK', this.scheme))
            .backgroundColor(readerAppColor('TOK_PAPER', this.scheme)).onChange((value: string): void => this.edit(rule.id, 'pattern', value));
          Row({ space: 8 }) {
            Text('层级').fontSize(11);
            TextInput({ text: rule.level }).width(64).height(40)
              .fontColor(readerAppColor('TOK_INK', this.scheme)).backgroundColor(readerAppColor('TOK_PAPER', this.scheme))
              .onChange((value: string): void => this.edit(rule.id, 'level', value));
            Select([{ value: '已有标题' }, { value: '章首独立行' }, { value: '章尾独立行' }, { value: '独立行边界' }])
              .selected(['title', 'head', 'tail', 'any'].indexOf(rule.boundary))
              .onSelect((index: number): void => this.edit(rule.id, 'boundary', ['title', 'head', 'tail', 'any'][index]));
            Button('删除').onClick((): void => { this.rules = this.rules.filter((item: DirectoryRuleDraft): boolean => item.id !== rule.id); this.changed(); });
          }
        }
      }, (rule: DirectoryRuleDraft): string => `${rule.id}`);
        } }.height(Math.min(240, this.rules.length * 94)).width('100%');
      }
      Row({ space: 8 }) {
        Button('添加规则').enabled(this.loaded && !this.busy && this.rules.length < 32).onClick((): void => {
          this.rules = [...this.rules, new DirectoryRuleDraft(++this.nextRuleId)]; this.changed();
        });
        Button('预览').enabled(this.loaded && !this.busy).onClick((): void => { void this.run(false); });
        Button('应用').enabled(this.loaded && !this.busy && this.previewReady).onClick((): void => { void this.run(true); });
      }
      Text(this.message).fontSize(11);
      if (this.preview.length > 0) {
        Scroll() { Column() { ForEach(this.preview, (title: string, index: number) => {
          Text(title).fontSize(11).width('100%');
        }, (_title: string, index: number): string => `${index}`); } }.height(120);
      }
    }.width('100%').padding(10).foregroundColor(readerAppColor('TOK_INK', this.scheme))
      .backgroundColor(readerAppColor('TOK_PAPER', this.scheme));
  }
}
