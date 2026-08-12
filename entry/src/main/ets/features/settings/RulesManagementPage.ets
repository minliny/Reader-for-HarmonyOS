import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderToggle } from '../common/ReaderToggle';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_SCREEN_INSET,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';
import {
  EMPTY_RULES_MANAGEMENT_SNAPSHOT,
  type RulesManagementSnapshot,
} from './RulesManagementOrchestrator';
import type {
  DictRuleDraft,
  ManagedDictRule,
  ManagedReplaceRule,
  ManagedRuleSubscription,
  ManagedTxtTocRule,
  ReplaceRuleDraft,
  RuleSubscriptionDraft,
  TxtTocRuleDraft,
} from './RulesManagementGateway';

@Component
export struct RulesManagementPage {
  @Prop snapshot: RulesManagementSnapshot = EMPTY_RULES_MANAGEMENT_SNAPSHOT;
  onBack: () => void = (): void => {};
  onSaveReplace: (draft: ReplaceRuleDraft) => void = (_draft: ReplaceRuleDraft): void => {};
  onDeleteReplace: (id: number) => void = (_id: number): void => {};
  onSaveTxtToc: (draft: TxtTocRuleDraft) => void = (_draft: TxtTocRuleDraft): void => {};
  onDeleteTxtToc: (id: number) => void = (_id: number): void => {};
  onSaveDict: (draft: DictRuleDraft) => void = (_draft: DictRuleDraft): void => {};
  onDeleteDict: (name: string) => void = (_name: string): void => {};
  onSaveSubscription: (draft: RuleSubscriptionDraft) => void = (_draft: RuleSubscriptionDraft): void => {};
  onDeleteSubscription: (id: number) => void = (_id: number): void => {};
  onRefreshSubscription: (subscription: ManagedRuleSubscription) => void =
    (_subscription: ManagedRuleSubscription): void => {};
  onExportBundle: () => void = (): void => {};
  onImportBundle: () => void = (): void => {};

  @State private replaceId: number = -1;
  @State private replaceName: string = '';
  @State private replacePattern: string = '';
  @State private replaceValue: string = '';
  @State private replaceEnabled: boolean = true;
  @State private replaceRegex: boolean = true;
  @State private replaceOrder: string = '0';

  @State private txtId: number = -1;
  @State private txtName: string = '';
  @State private txtRule: string = '';
  @State private txtExample: string = '';
  @State private txtEnabled: boolean = true;
  @State private txtOrder: string = '-1';

  @State private dictName: string = '';
  @State private dictUrl: string = '';
  @State private dictShow: string = '';
  @State private dictEnabled: boolean = true;
  @State private dictOrder: string = '0';

  @State private subId: number = -1;
  @State private subName: string = '';
  @State private subUrl: string = '';
  @State private subType: number = 0;
  @State private subAutoUpdate: boolean = false;
  @State private subOrder: string = '0';
  @State private subUpdate: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      PageBackBar({ title: '规则实体管理', onBack: (): void => this.onBack() });
      Scroll() {
        Column({ space: TOK_SPACE_MD }) {
          this.statusCard();
          this.bundleCard();
          this.replaceCard();
          this.txtTocCard();
          this.dictCard();
          this.subscriptionCard();
        }
        .width('100%')
        .padding({ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET, top: TOK_SPACE_XS, bottom: TOK_SPACE_MD });
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .height('100%')
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private statusCard() {
    Text(this.snapshot.statusMessage.length > 0 ? this.snapshot.statusMessage :
      '校验、CRUD、导入导出与持久化均由 Rust Core 负责')
      .width('100%')
      .fontFamily('ReaderNotoSansSC')
      .fontSize(12)
      .lineHeight(18)
      .fontColor(this.snapshot.busy ? TOK_PRIMARY_DARK : TOK_MUTED)
      .padding(TOK_SPACE_SM)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(8);
  }

  @Builder
  private bundleCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading('可携带规则包');
      Text('Core schema v1 包含替换、字典、TXT 目录和规则订阅；导入默认合并且同主键覆盖。')
        .width('100%').fontSize(11).lineHeight(17).fontColor(TOK_MUTED);
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('导入并合并', false, (): void => this.onImportBundle());
        this.actionButton('导出全部', true, (): void => this.onExportBundle());
      }.width('100%');
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(TOK_SURFACE_SOLID)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER }).borderRadius(10);
  }

  @Builder
  private replaceCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(`替换规则（${this.snapshot.replaceRules.length}）`);
      this.input(this.replaceName, '名称', (value: string): void => { this.replaceName = value; });
      this.input(this.replacePattern, '查找表达式', (value: string): void => { this.replacePattern = value; });
      this.input(this.replaceValue, '替换为', (value: string): void => { this.replaceValue = value; });
      Row({ space: TOK_SPACE_SM }) {
        this.booleanField('启用', this.replaceEnabled, (): void => { this.replaceEnabled = !this.replaceEnabled; });
        this.booleanField('正则', this.replaceRegex, (): void => { this.replaceRegex = !this.replaceRegex; });
      }.width('100%');
      this.input(this.replaceOrder, '排序', (value: string): void => { this.replaceOrder = value; });
      this.actionButton(this.replaceId < 0 ? '新增替换规则' : '保存替换规则', true, (): void => {
        const draft: ReplaceRuleDraft = {
          name: this.replaceName,
          pattern: this.replacePattern,
          replacement: this.replaceValue,
          isEnabled: this.replaceEnabled,
          isRegex: this.replaceRegex,
          order: this.integerOrZero(this.replaceOrder),
        };
        if (this.replaceId >= 0) draft.id = this.replaceId;
        this.onSaveReplace(draft);
      });
      ForEach(this.snapshot.replaceRules, (rule: ManagedReplaceRule) => {
        this.entityRow(rule.name, rule.pattern, (): void => this.editReplace(rule),
          (): void => this.onDeleteReplace(rule.id));
      }, (rule: ManagedReplaceRule): string => `managed-replace-${rule.id}`);
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER }).borderRadius(10);
  }

  @Builder
  private txtTocCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(`TXT 目录规则（${this.snapshot.txtTocRules.length}）`);
      Text('启用的规则会在下一次 TXT 导入时由 Core 用于切分章节。')
        .width('100%').fontSize(11).lineHeight(17).fontColor(TOK_MUTED);
      this.input(this.txtName, '名称', (value: string): void => { this.txtName = value; });
      this.input(this.txtRule, '章节标题正则', (value: string): void => { this.txtRule = value; });
      this.input(this.txtExample, '示例标题', (value: string): void => { this.txtExample = value; });
      this.booleanField('启用', this.txtEnabled, (): void => { this.txtEnabled = !this.txtEnabled; });
      this.input(this.txtOrder, '序号', (value: string): void => { this.txtOrder = value; });
      this.actionButton(this.txtId < 0 ? '新增 TXT 规则' : '保存 TXT 规则', true, (): void => {
        const draft: TxtTocRuleDraft = {
          name: this.txtName,
          rule: this.txtRule,
          example: this.txtExample,
          enable: this.txtEnabled,
          serialNumber: this.integerOrZero(this.txtOrder),
        };
        if (this.txtId >= 0) draft.id = this.txtId;
        this.onSaveTxtToc(draft);
      });
      ForEach(this.snapshot.txtTocRules, (rule: ManagedTxtTocRule) => {
        this.entityRow(rule.name, rule.rule, (): void => this.editTxt(rule),
          (): void => this.onDeleteTxtToc(rule.id));
      }, (rule: ManagedTxtTocRule): string => `managed-txt-${rule.id}`);
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(TOK_SURFACE_SOLID)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER }).borderRadius(10);
  }

  @Builder
  private dictCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(`字典规则（${this.snapshot.dictRules.length}）`);
      this.input(this.dictName, '名称（主键）', (value: string): void => { this.dictName = value; });
      this.input(this.dictUrl, 'URL 规则，使用 {{key}}', (value: string): void => { this.dictUrl = value; });
      this.input(this.dictShow, '展示规则（留空返回原文）', (value: string): void => { this.dictShow = value; });
      this.booleanField('启用', this.dictEnabled, (): void => { this.dictEnabled = !this.dictEnabled; });
      this.input(this.dictOrder, '排序', (value: string): void => { this.dictOrder = value; });
      this.actionButton('保存字典规则', true, (): void => this.onSaveDict({
        name: this.dictName,
        urlRule: this.dictUrl,
        showRule: this.dictShow,
        enabled: this.dictEnabled,
        sortNumber: this.integerOrZero(this.dictOrder),
      }));
      ForEach(this.snapshot.dictRules, (rule: ManagedDictRule) => {
        this.entityRow(rule.name, rule.urlRule, (): void => this.editDict(rule),
          (): void => this.onDeleteDict(rule.name));
      }, (rule: ManagedDictRule): string => `managed-dict-${rule.name}`);
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER }).borderRadius(10);
  }

  @Builder
  private subscriptionCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(`规则订阅（${this.snapshot.subscriptions.length}）`);
      this.input(this.subName, '名称', (value: string): void => { this.subName = value; });
      this.input(this.subUrl, '订阅 URL', (value: string): void => { this.subUrl = value; });
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('书源', this.subType === 0, (): void => { this.subType = 0; });
        this.actionButton('RSS 源', this.subType === 1, (): void => { this.subType = 1; });
        this.actionButton('替换规则', this.subType === 2, (): void => { this.subType = 2; });
      }.width('100%');
      this.booleanField('自动更新标记', this.subAutoUpdate,
        (): void => { this.subAutoUpdate = !this.subAutoUpdate; });
      this.input(this.subOrder, '排序', (value: string): void => { this.subOrder = value; });
      this.actionButton(this.subId < 0 ? '新增订阅' : '保存订阅', true, (): void => {
        const draft: RuleSubscriptionDraft = {
          name: this.subName,
          url: this.subUrl,
          type: this.requireSubscriptionType(this.subType),
          autoUpdate: this.subAutoUpdate,
          customOrder: this.integerOrZero(this.subOrder),
          update: this.subUpdate,
        };
        if (this.subId >= 0) draft.id = this.subId;
        this.onSaveSubscription(draft);
      });
      Text('“拉取”会按类型复用书源、RSS 或替换规则的 Core 导入；自动更新仅保存标记，不启动后台调度。')
        .width('100%').fontSize(10).lineHeight(16).fontColor(TOK_MUTED);
      ForEach(this.snapshot.subscriptions, (rule: ManagedRuleSubscription) => {
        this.subscriptionRow(rule);
      }, (rule: ManagedRuleSubscription): string => `managed-sub-${rule.id}`);
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(TOK_SURFACE_SOLID)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER }).borderRadius(10);
  }

  @Builder
  private heading(value: string) {
    Text(value).width('100%').fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold)
      .fontSize(14).fontColor(TOK_INK);
  }

  @Builder
  private input(value: string, placeholder: string, changed: (value: string) => void) {
    TextInput({ text: value, placeholder })
      .width('100%').height(40).fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(TOK_INK)
      .backgroundColor(TOK_PAPER).border({ width: TOK_BORDER_W, color: TOK_BORDER }).borderRadius(8)
      .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM }).onChange(changed);
  }

  @Builder
  private booleanField(label: string, value: boolean, action: () => void) {
    Row() {
      Text(label).layoutWeight(1).fontSize(12).fontColor(TOK_INK);
      ReaderToggle({ value, onToggle: action });
    }.layoutWeight(1).height(40);
  }

  @Builder
  private actionButton(label: string, primary: boolean, action: () => void) {
    Text(label).layoutWeight(1).height(40).textAlign(TextAlign.Center).fontWeight(FontWeight.Bold)
      .fontSize(12).fontColor(primary ? TOK_ON_PRIMARY : TOK_PRIMARY_DARK)
      .backgroundColor(primary ? TOK_PRIMARY_DARK : TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: primary ? TOK_PRIMARY_DARK : TOK_BORDER }).borderRadius(8)
      .opacity(this.snapshot.busy ? 0.62 : 1).onClick((): void => {
        if (!this.snapshot.busy) action();
      });
  }

  @Builder
  private entityRow(title: string, detail: string, edit: () => void, remove: () => void) {
    Row({ space: TOK_SPACE_XS }) {
      Column({ space: 3 }) {
        Text(title.length > 0 ? title : '未命名').width('100%').fontSize(12).fontWeight(FontWeight.Bold)
          .fontColor(TOK_INK).maxLines(1);
        Text(detail).width('100%').fontSize(10).fontColor(TOK_MUTED).maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      this.smallButton('编辑', edit);
      this.smallButton('删除', remove);
    }
    .width('100%').height(56).padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS })
    .border({ width: { top: TOK_BORDER_W }, color: TOK_BORDER });
  }

  @Builder
  private subscriptionRow(rule: ManagedRuleSubscription) {
    Row({ space: TOK_SPACE_XS }) {
      Column({ space: 3 }) {
        Text(rule.name.length > 0 ? rule.name : '未命名').width('100%').fontSize(12)
          .fontWeight(FontWeight.Bold).fontColor(TOK_INK).maxLines(1);
        Text(`${this.subscriptionTypeLabel(rule.type)} · ${rule.url}`).width('100%').fontSize(10)
          .fontColor(TOK_MUTED).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      this.smallButton('编辑', (): void => this.editSubscription(rule));
      this.smallButton('拉取', (): void => this.onRefreshSubscription(rule));
      this.smallButton('删除', (): void => this.onDeleteSubscription(rule.id));
    }
    .width('100%').height(60).padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS })
    .border({ width: { top: TOK_BORDER_W }, color: TOK_BORDER });
  }

  @Builder
  private smallButton(label: string, action: () => void) {
    Text(label).height(30).padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
      .textAlign(TextAlign.Center).fontSize(11).fontWeight(FontWeight.Bold).fontColor(TOK_PRIMARY_DARK)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT).border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(7).opacity(this.snapshot.busy ? 0.62 : 1).onClick((): void => {
        if (!this.snapshot.busy) action();
      });
  }

  private editReplace(rule: ManagedReplaceRule): void {
    this.replaceId = rule.id;
    this.replaceName = rule.name;
    this.replacePattern = rule.pattern;
    this.replaceValue = rule.replacement;
    this.replaceEnabled = rule.isEnabled;
    this.replaceRegex = rule.isRegex;
    this.replaceOrder = `${rule.order}`;
  }

  private editTxt(rule: ManagedTxtTocRule): void {
    this.txtId = rule.id;
    this.txtName = rule.name;
    this.txtRule = rule.rule;
    this.txtExample = rule.example;
    this.txtEnabled = rule.enable;
    this.txtOrder = `${rule.serialNumber}`;
  }

  private editDict(rule: ManagedDictRule): void {
    this.dictName = rule.name;
    this.dictUrl = rule.urlRule;
    this.dictShow = rule.showRule;
    this.dictEnabled = rule.enabled;
    this.dictOrder = `${rule.sortNumber}`;
  }

  private editSubscription(rule: ManagedRuleSubscription): void {
    this.subId = rule.id;
    this.subName = rule.name;
    this.subUrl = rule.url;
    this.subType = rule.type;
    this.subAutoUpdate = rule.autoUpdate;
    this.subOrder = `${rule.customOrder}`;
    this.subUpdate = rule.update;
  }

  private requireSubscriptionType(value: number): 0 | 1 | 2 {
    if (value === 0 || value === 1 || value === 2) return value;
    return 0;
  }

  private subscriptionTypeLabel(value: number): string {
    if (value === 0) return '书源';
    if (value === 1) return 'RSS 源';
    return '替换规则';
  }

  private integerOrZero(value: string): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : 0;
  }
}
