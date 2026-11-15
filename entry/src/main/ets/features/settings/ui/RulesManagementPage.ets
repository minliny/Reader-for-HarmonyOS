import { LengthMetrics } from '@kit.ArkUI';
import { ReaderStandardPage } from '../../../ui/layout/ReaderStandardPage';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { TYPE_APP_INHERITED_BODY, TYPE_APP_INHERITED_CAPTION, TYPE_FORM_STATUS, TYPE_RULES_COMPACT_ACTION, TYPE_RULES_ENTITY_TITLE, TYPE_RULES_INHERITED_DESCRIPTION, TYPE_RULES_INHERITED_NOTE } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_INK,
  TOK_MUTED,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
  TOK_SURFACE_SOLID,
} from '../../../ui/foundation/ReaderTokens';
import {
  EMPTY_RULES_MANAGEMENT_SNAPSHOT,
  type RulesManagementSnapshot,
} from '../application/RulesManagementOrchestrator';
import type {
  DictRuleDraft,
  ManagedDictRule,
  ManagedReplaceRule,
  ManagedRuleSubscription,
  ManagedTxtTocRule,
  ReplaceRuleDraft,
  RuleSubscriptionDraft,
  TxtTocRuleDraft,
} from '../application/RulesManagementGateway';
import {
  TYPE_RULES_MANAGEMENT_ACTION,
  TYPE_RULES_MANAGEMENT_HEADING,
  TYPE_RULES_MANAGEMENT_INPUT,
} from '../../../ui/foundation/ReaderTypography';

type RulesDraftKind = 'replace' | 'txt' | 'dict' | 'subscription';
let nextRulesDraftOpening: number = 0;

@Component
export struct RulesManagementPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  private mounted: boolean = false;
  @State private draftOpening: number = 0;
  @State private replaceDraftRevision: number = 0;
  @State private txtDraftRevision: number = 0;
  @State private dictDraftRevision: number = 0;
  @State private subscriptionDraftRevision: number = 0;

  @Prop snapshot: RulesManagementSnapshot = EMPTY_RULES_MANAGEMENT_SNAPSHOT;
  onReconcile: (generation: number) => void = (_generation: number): void => {};
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
    this.mounted = true;
    this.draftOpening = ++nextRulesDraftOpening;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void {
    this.mounted = false;
  }

  private draftKey(kind: RulesDraftKind): string {
    let revision: number;
    switch (kind) {
      case 'replace': revision = this.replaceDraftRevision; break;
      case 'txt': revision = this.txtDraftRevision; break;
      case 'dict': revision = this.dictDraftRevision; break;
      case 'subscription': revision = this.subscriptionDraftRevision; break;
    }
    return `rules-draft:${this.draftOpening}:${kind}:${revision}`;
  }

  private draftIsCurrent(key: string): boolean {
    return this.mounted && [this.draftKey('replace'), this.draftKey('txt'),
      this.draftKey('dict'), this.draftKey('subscription')].includes(key);
  }

  build() {
    ReaderStandardPage({
      variant: 'management',
      header: (): void => { this.pageHeader(); },
      content: (): void => { this.pageContent(); },
    });
  }

  @Builder
  private pageHeader() {
    PageBackBar({ title: '规则实体管理', onBack: (): void => this.onBack() });
  }

  @Builder
  private pageContent() {
    this.statusCard();
    this.recoveryAction();
    this.bundleCard();
    this.replaceCard();
    this.txtTocCard();
    this.dictCard();
    this.subscriptionCard();
  }


  @Builder
  private recoveryAction() {
    if (this.recovery().canRetry) {
      ReaderRecoveryAction({ label: this.snapshot.ruleMutation?.canRetryOriginal === true ? '重试原规则操作' : this.snapshot.ruleMutation?.blocked === true ? '核对原规则操作' : '刷新列表', generation: this.recovery().generation, onReconcile: this.onReconcile });
    }
  }

  private recovery(): ReaderRecoveryView { return readerRecoveryView(this.snapshot.receipt, this.snapshot.readFacts, this.snapshot.confirmedParts ?? 0); }

  @Builder
  private statusCard() {
    Text(this.recovery().visible ? this.recovery().message : this.snapshot.statusMessage.length > 0 ? this.snapshot.statusMessage :
      '校验、CRUD、导入导出与持久化均由 Rust Core 负责')
      .width('100%')
      .fontFamily(TYPE_FORM_STATUS.fontFamily as string)
      .fontSize(TYPE_FORM_STATUS.fontSizeFp)
      .lineHeight(TYPE_FORM_STATUS.lineHeightFp as number)
      .fontColor(this.snapshot.busy ? readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
      .padding(TOK_SPACE_SM)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(8);
  }

  @Builder
  private bundleCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading((): string => '可携带规则包');
      Text('Core schema v1 包含替换、字典、TXT 目录和规则订阅；导入默认合并且同主键覆盖。')
        .width('100%').fontSize(TYPE_RULES_INHERITED_DESCRIPTION.fontSizeFp).lineHeight(TYPE_RULES_INHERITED_DESCRIPTION.lineHeightFp as number).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('导入并合并', false, (): void => this.onImportBundle(), true, true);
        this.actionButton('导出全部', true, (): void => this.onExportBundle(), false, true);
      }.width('100%');
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(10);
  }

  @Builder
  private replaceCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading((): string => `替换规则（${this.snapshot.replaceRules.length}）`);
      ForEach([this.draftKey('replace')], (draftKey: string): void => {
        this.input((): string => this.replaceName, '名称', (value: string): void => { this.replaceName = value; }, draftKey);
        this.input((): string => this.replacePattern, '查找表达式', (value: string): void => { this.replacePattern = value; }, draftKey);
        this.input((): string => this.replaceValue, '替换为', (value: string): void => { this.replaceValue = value; }, draftKey);
        Row({ space: TOK_SPACE_SM }) {
          this.booleanField('启用', (): boolean => this.replaceEnabled, (next: boolean): void => { this.replaceEnabled = next; }, draftKey);
          this.booleanField('正则', (): boolean => this.replaceRegex, (next: boolean): void => { this.replaceRegex = next; }, draftKey);
        }.width('100%');
        this.input((): string => this.replaceOrder, '排序', (value: string): void => { this.replaceOrder = value; }, draftKey);
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
        }, true, false, draftKey);
      }, (key: string): string => key);
      ForEach(this.snapshot.replaceRules, (rule: ManagedReplaceRule) => {
        this.entityRow((): string => this.currentReplace(rule.id)?.name ?? rule.name,
          (): string => this.currentReplace(rule.id)?.pattern ?? rule.pattern,
          (): void => {
            const current = this.currentReplace(rule.id);
            if (current !== undefined) this.editReplace(current);
          }, (): void => { if (this.currentReplace(rule.id) !== undefined) this.onDeleteReplace(rule.id); },
          (): boolean => this.currentReplace(rule.id) !== undefined);
      }, (rule: ManagedReplaceRule): string => `managed-replace-${rule.id}`);
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(10);
  }

  @Builder
  private txtTocCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading((): string => `TXT 目录规则（${this.snapshot.txtTocRules.length}）`);
      Text('启用的规则会在下一次 TXT 导入时由 Core 用于切分章节。')
        .width('100%').fontSize(TYPE_RULES_INHERITED_DESCRIPTION.fontSizeFp).lineHeight(TYPE_RULES_INHERITED_DESCRIPTION.lineHeightFp as number).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      ForEach([this.draftKey('txt')], (draftKey: string): void => {
        this.input((): string => this.txtName, '名称', (value: string): void => { this.txtName = value; }, draftKey);
        this.input((): string => this.txtRule, '章节标题正则', (value: string): void => { this.txtRule = value; }, draftKey);
        this.input((): string => this.txtExample, '示例标题', (value: string): void => { this.txtExample = value; }, draftKey);
        this.booleanField('启用', (): boolean => this.txtEnabled, (next: boolean): void => { this.txtEnabled = next; }, draftKey);
        this.input((): string => this.txtOrder, '序号', (value: string): void => { this.txtOrder = value; }, draftKey);
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
        }, true, false, draftKey);
      }, (key: string): string => key);
      ForEach(this.snapshot.txtTocRules, (rule: ManagedTxtTocRule) => {
        this.entityRow((): string => this.currentTxt(rule.id)?.name ?? rule.name,
          (): string => this.currentTxt(rule.id)?.rule ?? rule.rule,
          (): void => {
            const current = this.currentTxt(rule.id);
            if (current !== undefined) this.editTxt(current);
          }, (): void => { if (this.currentTxt(rule.id) !== undefined) this.onDeleteTxtToc(rule.id); },
          (): boolean => this.currentTxt(rule.id) !== undefined);
      }, (rule: ManagedTxtTocRule): string => `managed-txt-${rule.id}`);
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(10);
  }

  @Builder
  private dictCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading((): string => `字典规则（${this.snapshot.dictRules.length}）`);
      ForEach([this.draftKey('dict')], (draftKey: string): void => {
        this.input((): string => this.dictName, '名称（主键）', (value: string): void => { this.dictName = value; }, draftKey);
        this.input((): string => this.dictUrl, 'URL 规则，使用 {{key}}', (value: string): void => { this.dictUrl = value; }, draftKey);
        this.input((): string => this.dictShow, '展示规则（留空返回原文）', (value: string): void => { this.dictShow = value; }, draftKey);
        this.booleanField('启用', (): boolean => this.dictEnabled, (next: boolean): void => { this.dictEnabled = next; }, draftKey);
        this.input((): string => this.dictOrder, '排序', (value: string): void => { this.dictOrder = value; }, draftKey);
        this.actionButton('保存字典规则', true, (): void => this.onSaveDict({
          name: this.dictName,
          urlRule: this.dictUrl,
          showRule: this.dictShow,
          enabled: this.dictEnabled,
          sortNumber: this.integerOrZero(this.dictOrder),
        }), true, false, draftKey);
      }, (key: string): string => key);
      ForEach(this.snapshot.dictRules, (rule: ManagedDictRule) => {
        this.entityRow((): string => this.currentDict(rule.name)?.name ?? rule.name,
          (): string => this.currentDict(rule.name)?.urlRule ?? rule.urlRule,
          (): void => {
            const current = this.currentDict(rule.name);
            if (current !== undefined) this.editDict(current);
          }, (): void => { if (this.currentDict(rule.name) !== undefined) this.onDeleteDict(rule.name); },
          (): boolean => this.currentDict(rule.name) !== undefined);
      }, (rule: ManagedDictRule): string => `managed-dict-${rule.name}`);
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(10);
  }

  @Builder
  private subscriptionCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading((): string => `规则订阅（${this.snapshot.subscriptions.length}）`);
      ForEach([this.draftKey('subscription')], (draftKey: string): void => {
        this.input((): string => this.subName, '名称', (value: string): void => { this.subName = value; }, draftKey);
        this.input((): string => this.subUrl, '订阅 URL', (value: string): void => { this.subUrl = value; }, draftKey);
        Row({ space: TOK_SPACE_XS }) {
          this.subscriptionTypeButton('书源', 0, draftKey);
          this.subscriptionTypeButton('RSS 源', 1, draftKey);
          this.subscriptionTypeButton('替换规则', 2, draftKey);
        }.width('100%');
        this.booleanField('自动更新标记', (): boolean => this.subAutoUpdate, (next: boolean): void => { this.subAutoUpdate = next; }, draftKey);
        this.input((): string => this.subOrder, '排序', (value: string): void => { this.subOrder = value; }, draftKey);
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
        }, true, false, draftKey);
        Text('“拉取”会按类型复用书源、RSS 或替换规则的 Core 导入；自动更新仅保存标记，不启动后台调度。')
          .width('100%').fontSize(TYPE_RULES_INHERITED_NOTE.fontSizeFp).lineHeight(TYPE_RULES_INHERITED_NOTE.lineHeightFp as number).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }, (key: string): string => key);
      ForEach(this.snapshot.subscriptions, (rule: ManagedRuleSubscription) => {
        this.subscriptionRow(rule);
      }, (rule: ManagedRuleSubscription): string => `managed-sub-${rule.id}`);
    }
    .width('100%').padding(TOK_SPACE_SM).backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(10);
  }

  @Builder
  private heading(value: () => string) {
    Text(value()).width('100%').fontFamily(TYPE_RULES_MANAGEMENT_HEADING.fontFamily)
      .fontWeight(TYPE_RULES_MANAGEMENT_HEADING.fontWeight)
      .fontSize(TYPE_RULES_MANAGEMENT_HEADING.fontSizeFp)
      .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
  }

  @Builder
  private input(value: () => string, placeholder: string, changed: (value: string) => void, draftKey: string) {
    ReaderFormField({ scheme: this.appThemeScheme, specId: 'rules-input', text: value(), placeholder,
      inputIdentity: `${draftKey}:${placeholder}`,
      onTextChange: (next: string): void => { if (this.draftIsCurrent(draftKey)) changed(next); } });
  }

  @Builder
  private booleanField(label: string, value: () => boolean, action: (next: boolean) => void, draftKey: string) {
    Row() {
      Text(label).layoutWeight(1).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      ReaderToggle({ value: value(), specId: 'standard-toggle', accessibilityLabel: label,
        inputIdentity: `${draftKey}:${label}`,
        actionEnabled: true,
        onToggle: (next: boolean): void => { if (this.draftIsCurrent(draftKey)) action(next); } });
    }.layoutWeight(1).constraintSize({ minHeight: 44 });
  }

  @Builder
  private actionButton(label: string, primary: boolean, action: () => void, mutation: boolean = true,
    shareRow: boolean = false, draftKey: string = '') {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'rules-action', label, primary, layout: 'full',
      actionEnabled: this.actionAllowed(mutation, draftKey),
      onAction: (): void => { if (this.actionAllowed(mutation, draftKey)) action(); } }).layoutWeight(shareRow ? 1 : undefined);
  }

  private actionAllowed(mutation: boolean, draftKey: string = ''): boolean {
    return this.mounted && (draftKey.length === 0 || this.draftIsCurrent(draftKey)) && !this.snapshot.busy &&
      (!mutation || (this.snapshot.ruleMutation?.blocked !== true && this.snapshot.receipt?.receipt.confirmation !== 'unknown'));
  }

  @Builder
  private subscriptionTypeButton(label: string, type: 0 | 1 | 2, draftKey: string) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'rules-action', label, layout: 'full',
      primary: this.subType === type, selectionSemantic: true, actionEnabled: this.actionAllowed(false, draftKey),
      onAction: (): void => { if (this.actionAllowed(false, draftKey)) this.subType = type; } }).layoutWeight(1);
  }

  @Builder
  private entityRow(title: () => string, detail: () => string, edit: () => void, remove: () => void,
    exists: () => boolean = (): boolean => true) {
    Column({ space: TOK_SPACE_XS }) {
      Column({ space: 3 }) {
        Text(title().length > 0 ? title() : '未命名').width('100%').fontSize(TYPE_RULES_ENTITY_TITLE.fontSizeFp).fontWeight(TYPE_RULES_ENTITY_TITLE.fontWeight as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        Text(detail()).width('100%').fontSize(TYPE_APP_INHERITED_CAPTION.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .wordBreak(WordBreak.BREAK_WORD);
      }.width('100%').alignItems(HorizontalAlign.Start);
      Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(TOK_SPACE_XS), cross: LengthMetrics.vp(TOK_SPACE_XS) } }) {
        this.smallButton('编辑', edit, false, exists);
        this.smallButton('删除', remove, true, exists);
      }.width('100%');
    }
    .width('100%').constraintSize({ minHeight: 56 }).padding(TOK_SPACE_XS)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_BORDER', this.appThemeScheme) });
  }

  @Builder
  private subscriptionRow(rule: ManagedRuleSubscription) {
    Column({ space: TOK_SPACE_XS }) {
      Column({ space: 3 }) {
        Text((this.currentSubscription(rule.id)?.name ?? rule.name) || '未命名').width('100%').fontSize(TYPE_RULES_ENTITY_TITLE.fontSizeFp)
          .fontWeight(TYPE_RULES_ENTITY_TITLE.fontWeight as number).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        Text(`${this.subscriptionTypeLabel(this.currentSubscription(rule.id)?.type ?? rule.type)} · ${this.currentSubscription(rule.id)?.url ?? rule.url}`).width('100%').fontSize(TYPE_APP_INHERITED_CAPTION.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).wordBreak(WordBreak.BREAK_WORD);
      }.width('100%').alignItems(HorizontalAlign.Start);
      Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(TOK_SPACE_XS), cross: LengthMetrics.vp(TOK_SPACE_XS) } }) {
        this.smallButton('编辑', (): void => {
          const current = this.currentSubscription(rule.id);
          if (current !== undefined) this.editSubscription(current);
        }, false, (): boolean => this.currentSubscription(rule.id) !== undefined);
        this.smallButton('拉取', (): void => {
          const current = this.currentSubscription(rule.id);
          if (current !== undefined) this.onRefreshSubscription(current);
        }, true, (): boolean => this.currentSubscription(rule.id) !== undefined);
        this.smallButton('删除', (): void => {
          if (this.currentSubscription(rule.id) !== undefined) this.onDeleteSubscription(rule.id);
        }, true, (): boolean => this.currentSubscription(rule.id) !== undefined);
      }.width('100%');
    }
    .width('100%').constraintSize({ minHeight: 60 }).padding(TOK_SPACE_XS)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_BORDER', this.appThemeScheme) });
  }

  @Builder
  private smallButton(label: string, action: () => void, mutation: boolean = true,
    exists: () => boolean = (): boolean => true) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'rules-compact', label,
      actionEnabled: exists() && this.actionAllowed(mutation),
      onAction: (): void => { if (exists() && this.actionAllowed(mutation)) action(); } });
  }

  private currentReplace(id: number): ManagedReplaceRule | undefined {
    return this.snapshot.replaceRules.find((rule: ManagedReplaceRule): boolean => rule.id === id);
  }

  private currentTxt(id: number): ManagedTxtTocRule | undefined {
    return this.snapshot.txtTocRules.find((rule: ManagedTxtTocRule): boolean => rule.id === id);
  }

  private currentDict(name: string): ManagedDictRule | undefined {
    return this.snapshot.dictRules.find((rule: ManagedDictRule): boolean => rule.name === name);
  }

  private currentSubscription(id: number): ManagedRuleSubscription | undefined {
    return this.snapshot.subscriptions.find((rule: ManagedRuleSubscription): boolean => rule.id === id);
  }

  private editReplace(rule: ManagedReplaceRule): void {
    this.replaceId = rule.id;
    this.replaceName = rule.name;
    this.replacePattern = rule.pattern;
    this.replaceValue = rule.replacement;
    this.replaceEnabled = rule.isEnabled;
    this.replaceRegex = rule.isRegex;
    this.replaceOrder = `${rule.order}`;
    this.replaceDraftRevision += 1;
  }

  private editTxt(rule: ManagedTxtTocRule): void {
    this.txtId = rule.id;
    this.txtName = rule.name;
    this.txtRule = rule.rule;
    this.txtExample = rule.example;
    this.txtEnabled = rule.enable;
    this.txtOrder = `${rule.serialNumber}`;
    this.txtDraftRevision += 1;
  }

  private editDict(rule: ManagedDictRule): void {
    this.dictName = rule.name;
    this.dictUrl = rule.urlRule;
    this.dictShow = rule.showRule;
    this.dictEnabled = rule.enabled;
    this.dictOrder = `${rule.sortNumber}`;
    this.dictDraftRevision += 1;
  }

  private editSubscription(rule: ManagedRuleSubscription): void {
    this.subId = rule.id;
    this.subName = rule.name;
    this.subUrl = rule.url;
    this.subType = rule.type;
    this.subAutoUpdate = rule.autoUpdate;
    this.subOrder = `${rule.customOrder}`;
    this.subUpdate = rule.update;
    this.subscriptionDraftRevision += 1;
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
