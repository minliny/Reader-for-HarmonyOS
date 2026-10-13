import { ReaderStandardPage } from '../common/ReaderStandardPage';
import { RssOriginalRecoverySurface } from './RssOriginalRecoverySurface';
import type { RssOriginalMutationIdentity } from './RssMutationRecoveryContract';
import { ReaderButton } from '../common/ReaderButton';
import { ReaderFormField } from '../common/ReaderFormField';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { TYPE_FORM_HINT, TYPE_FORM_INPUT, TYPE_FORM_LABEL_ACTION, TYPE_FORM_NOTE, TYPE_FORM_SECTION_HEADING, TYPE_FORM_STATUS } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderToggle } from '../common/ReaderToggle';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_INK,
  TOK_MUTED,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';
import {
  type RssSubscriptionEditorSnapshot,
  type RssSourceTextField,
  EMPTY_RSS_EDITOR_SNAPSHOT,
} from './RssSubscriptionEditorOrchestrator';

@Component
export struct RssSubscriptionEditorPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop snapshot: RssSubscriptionEditorSnapshot = EMPTY_RSS_EDITOR_SNAPSHOT;
  onBack: () => void = (): void => {};
  onFeedUrlChanged: (value: string) => void = (_value: string): void => {};
  onTitleChanged: (value: string) => void = (_value: string): void => {};
  onEnabledChanged: (value: boolean) => void = (_value: boolean): void => {};
  onEnabledCookieJarChanged: (value: boolean) => void = (_value: boolean): void => {};
  onSourceFieldChanged: (field: RssSourceTextField, value: string) => void =
    (_field: RssSourceTextField, _value: string): void => {};
  onSave: () => void = (): void => {};
  @Prop presentationIdentity: string = '';
  onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  onContinueOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onRetryRead: (generation: number) => void = (_generation: number): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    ReaderStandardPage({
      variant: 'rssEditor',
      header: (): void => { this.pageHeader(); },
      content: (): void => { this.pageContent(); },
    });
  }

  @Builder
  private pageHeader() {
    PageBackBar({ title: this.snapshot.mode === 'create' ? '新增 RSS 订阅' : '编辑 RSS 订阅', onBack: (): void => this.onBack() });
  }

  @Builder
  private pageContent() {
    Text(this.snapshot.statusMessage)
      .width('100%')
      .fontFamily(TYPE_FORM_STATUS.fontFamily as string)
      .fontSize(TYPE_FORM_STATUS.fontSizeFp)
      .lineHeight(TYPE_FORM_STATUS.lineHeightFp as number)
      .fontColor(this.snapshot.busy ? readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
      .padding(TOK_SPACE_SM)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(8);
    this.operationRecovery();
    Column({ space: TOK_SPACE_MD }) {
      this.editorField('订阅名称', this.snapshot.title, '留空时由 Core 回退为 Feed URL',
        (value: string): void => this.onTitleChanged(value));
      this.editorField('Feed URL', this.snapshot.feedUrl, 'https://example.com/feed.xml',
        (value: string): void => this.onFeedUrlChanged(value));
      this.sectionTitle('来源组织与刷新');
      this.editorField('分组', this.snapshot.sourceGroup, '例如：技术 / 新闻',
        (value: string): void => this.onSourceFieldChanged('sourceGroup', value));
      this.editorField('自定义排序', this.snapshot.customOrder, '非负整数，数值小的在前',
        (value: string): void => this.onSourceFieldChanged('customOrder', value));
      this.editorField('更新间隔（分钟）', this.snapshot.updateIntervalMinutes, '正整数；留空由 Core 决定',
        (value: string): void => this.onSourceFieldChanged('updateIntervalMinutes', value));
      Row() {
        Column({ space: TOK_SPACE_XS }) {
          Text('启用订阅')
            .fontFamily(TYPE_FORM_LABEL_ACTION.fontFamily)
            .fontWeight(TYPE_FORM_LABEL_ACTION.fontWeight)
            .fontSize(TYPE_FORM_LABEL_ACTION.fontSizeFp)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
          Text('刷新、解析、未读统计均由 Core 维护')
            .fontFamily(TYPE_FORM_HINT.fontFamily as string)
            .fontSize(TYPE_FORM_HINT.fontSizeFp)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start);
        ReaderToggle({
          value: this.snapshot.enabled, specId: 'standard-toggle', accessibilityLabel: '启用订阅',
          inputIdentity: `${this.presentationIdentity}:${this.snapshot.mode}:${this.snapshot.subscriptionId}:enabled`,
          // Draft editing stays available while the original save is unresolved.
          actionEnabled: true,
          onToggle: (next: boolean): void => this.onEnabledChanged(next),
        });
      }
      .width('100%')
      .height(60)
      .alignItems(VerticalAlign.Center);
      Row() {
        Column({ space: TOK_SPACE_XS }) {
          Text('启用 Cookie 会话')
            .fontFamily(TYPE_FORM_LABEL_ACTION.fontFamily)
            .fontWeight(TYPE_FORM_LABEL_ACTION.fontWeight)
            .fontSize(TYPE_FORM_LABEL_ACTION.fontSizeFp)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
          Text('由 Host 隔离存储；导出不包含 Cookie 明文')
            .fontFamily(TYPE_FORM_HINT.fontFamily as string)
            .fontSize(TYPE_FORM_HINT.fontSizeFp)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start);
        ReaderToggle({
          value: this.snapshot.enabledCookieJar, specId: 'standard-toggle', accessibilityLabel: '启用 Cookie 会话',
          inputIdentity: `${this.presentationIdentity}:${this.snapshot.mode}:${this.snapshot.subscriptionId}:enabledCookieJar`,
          // Draft editing stays available while the original save is unresolved.
          actionEnabled: true,
          onToggle: (next: boolean): void => this.onEnabledCookieJarChanged(next),
        });
      }
      .width('100%')
      .height(60)
      .alignItems(VerticalAlign.Center);
      this.editorField('请求头规则', this.snapshot.header, 'JSON 对象；动态 JS 规则会由 Core fail-closed',
        (value: string): void => this.onSourceFieldChanged('header', value));
      this.sectionTitle('规则型 RSS（HTML）');
      this.editorField('文章列表规则', this.snapshot.ruleArticles, '.article',
        (value: string): void => this.onSourceFieldChanged('ruleArticles', value));
      this.editorField('标题规则', this.snapshot.ruleTitle, '.title@text',
        (value: string): void => this.onSourceFieldChanged('ruleTitle', value));
      this.editorField('链接规则', this.snapshot.ruleLink, '.title@href',
        (value: string): void => this.onSourceFieldChanged('ruleLink', value));
      this.editorField('发布日期规则', this.snapshot.rulePubDate, '.date@text',
        (value: string): void => this.onSourceFieldChanged('rulePubDate', value));
      this.editorField('摘要规则', this.snapshot.ruleDescription, '.summary@text',
        (value: string): void => this.onSourceFieldChanged('ruleDescription', value));
      this.editorField('图片规则', this.snapshot.ruleImage, '.cover@src',
        (value: string): void => this.onSourceFieldChanged('ruleImage', value));
      this.editorField('正文规则', this.snapshot.ruleContent, '.content@html',
        (value: string): void => this.onSourceFieldChanged('ruleContent', value));
      this.editorField('下一页规则', this.snapshot.ruleNextPage, '.next@href',
        (value: string): void => this.onSourceFieldChanged('ruleNextPage', value));
      this.saveAction();
    }
    .width('100%')
    .padding(TOK_SPACE_MD)
    .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(10);
    Text('完整来源配置由 Core 归一化并持久化；XML/Atom 与静态 HTML 规则共用同一订阅身份。')
      .width('100%')
      .fontFamily(TYPE_FORM_NOTE.fontFamily as string)
      .fontSize(TYPE_FORM_NOTE.fontSizeFp)
      .lineHeight(TYPE_FORM_NOTE.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
  }


  private recoveryActionIdentities(): string[] {
    if (this.snapshot.operation?.facts.canRetry) return [`write:${this.snapshot.operation.facts.generation}`];
    if (this.snapshot.readFacts.canRetry) return [`read:${this.snapshot.readFacts.generation}`];
    return [];
  }
  private recoveryGeneration(identity: string): number { return Number(identity.slice(identity.indexOf(':') + 1)); }
  private dispatchRecovery(identity: string): void {
    if (!this.recoveryActionIdentities().includes(identity)) return;
    if (identity.startsWith('write:')) this.onReconcile(this.recoveryGeneration(identity));
    else this.onRetryRead(this.recoveryGeneration(identity));
  }
  @Builder
  private operationRecovery() {
    RssOriginalRecoverySurface({ original: this.snapshot.original, presentationIdentity: this.presentationIdentity, scope: 'editor',
      subscriptionId: this.snapshot.subscriptionId ?? '',
      onReconcileOriginal: (expected: RssOriginalMutationIdentity): void => this.onReconcileOriginal(expected),
      onContinueOriginal: (expected: RssOriginalMutationIdentity): void => this.onContinueOriginal(expected) });
    ForEach(this.snapshot.original?.blocked === true ? [] : this.recoveryActionIdentities(), (identity: string): void => {
      ReaderRecoveryAction({ label: '重新读取', generation: this.recoveryGeneration(identity),
        onReconcile: (): void => this.dispatchRecovery(identity) });
    }, (identity: string): string => identity);
  }

  @Builder
  private saveAction() {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'form-busy-action', label: '保存', primary: true, layout: 'full',
      actionEnabled: this.snapshot.canSave && !this.snapshot.busy, onAction: (): void => this.onSave() });
  }


  @Builder
  private sectionTitle(label: string) {
    Text(label)
      .width('100%')
      .fontFamily(TYPE_FORM_SECTION_HEADING.fontFamily)
      .fontWeight(TYPE_FORM_SECTION_HEADING.fontWeight)
      .fontSize(TYPE_FORM_SECTION_HEADING.fontSizeFp)
      .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
      .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private editorField(label: string, value: string, placeholder: string, onChange: (value: string) => void) {
    Column({ space: TOK_SPACE_XS }) {
      Text(label)
        .width('100%')
        .fontFamily(TYPE_FORM_LABEL_ACTION.fontFamily)
        .fontWeight(TYPE_FORM_LABEL_ACTION.fontWeight)
        .fontSize(TYPE_FORM_LABEL_ACTION.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      ReaderFormField({ scheme: this.appThemeScheme, specId: 'form-body', text: value, placeholder, onTextChange: onChange });
    }
    .width('100%')
    .constraintSize({ minHeight: 60 });
  }


}
