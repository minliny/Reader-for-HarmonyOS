import { ReaderButton } from './ReaderButton';
import { ReaderFormField } from './ReaderFormField';
import { TYPE_FORM_ACTION, TYPE_FORM_LABEL_ACTION, TYPE_FORM_NOTE, TYPE_FORM_URL_INPUT, TYPE_JSON_IMPORT_DESCRIPTION } from './ReaderTypography';
import { readerAppColor } from './ReaderThemeRegistry';
import { registerReaderFonts } from './ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_DANGER,
  TOK_INK,
  TOK_MUTED,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_FIELD,
} from './ReaderTokens';
import { ReaderDialogSurface, DialogActionView } from './ReaderDialogSurface';
import { MESSAGE_BODY, MESSAGE_META } from './ReaderMessageStyle';

/**
 * Shared acquisition surface for portable JSON imports.
 *
 * The dialog owns only user intent and the URL draft. Local document access
 * and online HTTP remain Host capabilities; JSON validation and persistence
 * remain in each feature's existing Core import command.
 *
 * The framed card (header/actions/spec geometry) comes from the shared dialog
 * surface family under the 'json-import' spec; this struct keeps the
 * self-drawn full-height overlay (mask + zIndex), the URL draft, validation
 * and the import admission.
 */
@Component
export struct JsonImportDialog {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  title: string = '导入 JSON';
  description: string = '支持选择本地 JSON 文件，或从在线链接下载后导入。';
  isTablet: boolean = false;
  onDismiss: () => void = (): void => {};
  onSelectLocal: () => void = (): void => {};
  onImportOnline: (url: string) => void = (_url: string): void => {};
  @State private urlDraft: string = '';
  @State private validationMessage: string = '';

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      ReaderDialogSurface({
        specId: 'json-import',
        title: this.title,
        showCloseButton: true,
        actions: [
          new DialogActionView('importOnline', '从在线链接导入', 'primary', true, false),
        ],
        onAction: (id: string): void => {
          if (id === 'importOnline') {
            this.submitOnlineImport();
          }
        },
        onClose: (): void => this.onDismiss(),
        body: (): void => {
          this.formBody();
        },
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(readerAppColor('app.JsonImportDialog.build.backgroundColor.66000000', this.appThemeScheme))
    .zIndex(200);
  }

  @Builder
  private formBody() {
    Column({ space: 16 }) {
      Text(this.description)
        .width('100%')
        .fontFamily(MESSAGE_BODY.fontFamily as string)
        .fontSize(MESSAGE_BODY.fontSizeFp)
        .lineHeight(MESSAGE_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));

      this.localButton();

      Column({ space: TOK_SPACE_XS }) {
        Text('在线链接')
          .width('100%')
          .fontFamily(TYPE_FORM_ACTION.fontFamily)
          .fontWeight(TYPE_FORM_ACTION.fontWeight)
          .fontSize(TYPE_FORM_ACTION.fontSizeFp)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        ReaderFormField({ scheme: this.appThemeScheme, specId: 'form-url', text: this.urlDraft, placeholder: 'https://example.com/data.json',
          onTextChange: (value: string): void => {
            this.urlDraft = value;
            if (this.validationMessage.length > 0) this.validationMessage = '';
          }, onSubmit: (): void => this.submitOnlineImport() });
        Text('GitHub 仓库文件请使用 Raw 链接；普通 blob 页面不是 JSON。')
          .width('100%')
          .fontFamily(MESSAGE_META.fontFamily as string)
          .fontSize(MESSAGE_META.fontSizeFp)
          .lineHeight(MESSAGE_META.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
        if (this.validationMessage.length > 0) {
          Text(this.validationMessage)
            .width('100%')
            .fontFamily(MESSAGE_BODY.fontFamily as string)
            .fontSize(MESSAGE_BODY.fontSizeFp)
            .lineHeight(MESSAGE_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MESSAGE_DANGER', this.appThemeScheme));
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start);
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start);
  }

  // The original business order keeps the local-file action between the
  // description and the URL form; it is a content action, not a trailing
  // dialog action, so the body renders it in place.
  @Builder
  private localButton() {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'form-action', label: '选择本地 JSON 文件', primary: true, layout: 'full',
      onAction: (): void => this.onSelectLocal() });
  }

  private submitOnlineImport(): void {
    const onlineUrl = this.urlDraft.trim();
    if (onlineUrl.length === 0) {
      this.validationMessage = '请输入在线 JSON 的 HTTP/HTTPS 地址';
      return;
    }
    if (!/^https?:\/\//i.test(onlineUrl)) {
      this.validationMessage = '请使用以 http:// 或 https:// 开头的 JSON 链接';
      return;
    }
    this.onImportOnline(onlineUrl);
  }
}
