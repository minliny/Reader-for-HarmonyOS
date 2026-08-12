import { registerReaderFonts } from './ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_DANGER,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PRIMARY_DARK,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_FIELD,
  TOK_SURFACE_SOLID,
} from './ReaderTokens';

/**
 * Shared acquisition surface for portable JSON imports.
 *
 * The dialog owns only user intent and the URL draft. Local document access
 * and online HTTP remain Host capabilities; JSON validation and persistence
 * remain in each feature's existing Core import command.
 */
@Component
export struct JsonImportDialog {
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
      Column({ space: TOK_SPACE_MD }) {
        Row() {
          Text(this.title)
            .layoutWeight(1)
            .fontFamily('ReaderNotoSerifSCBold')
            .fontWeight(FontWeight.Bold)
            .fontSize(22)
            .fontColor(TOK_INK)
            .maxLines(1);
          Text('关闭')
            .width(52)
            .height(36)
            .textAlign(TextAlign.Center)
            .fontFamily('ReaderNotoSansSC')
            .fontSize(12)
            .fontColor(TOK_MUTED)
            .onClick((): void => this.onDismiss());
        }
        .width('100%')
        .alignItems(VerticalAlign.Center);

        Text(this.description)
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(12)
          .lineHeight(19)
          .fontColor(TOK_MUTED);

        this.actionButton('选择本地 JSON 文件', true, (): void => this.onSelectLocal());

        Column({ space: TOK_SPACE_XS }) {
          Text('在线链接')
            .width('100%')
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Bold)
            .fontSize(12)
            .fontColor(TOK_INK);
          TextInput({
            text: this.urlDraft,
            placeholder: 'https://example.com/data.json',
          })
            .width('100%')
            .height(44)
            .fontFamily('ReaderInter')
            .fontSize(12)
            .fontColor(TOK_INK)
            .placeholderColor(TOK_MUTED)
            .backgroundColor(TOK_SURFACE_FIELD)
            .border({ width: TOK_BORDER_W, color: TOK_BORDER })
            .borderRadius(8)
            .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
            .onChange((value: string): void => {
              this.urlDraft = value;
              if (this.validationMessage.length > 0) {
                this.validationMessage = '';
              }
            })
            .onSubmit((_enterKey: EnterKeyType): void => this.submitOnlineImport());
          Text('GitHub 仓库文件请使用 Raw 链接；普通 blob 页面不是 JSON。')
            .width('100%')
            .fontFamily('ReaderNotoSansSC')
            .fontSize(10)
            .lineHeight(16)
            .fontColor(TOK_MUTED);
          if (this.validationMessage.length > 0) {
            Text(this.validationMessage)
              .width('100%')
              .fontFamily('ReaderNotoSansSC')
              .fontSize(10)
              .lineHeight(16)
              .fontColor(TOK_DANGER);
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start);

        // Keep the control live across ArkUI TextInput partial refreshes; the
        // click reads the current draft and performs the actual admission.
        this.actionButton('从在线链接导入', true, (): void => this.submitOnlineImport());
      }
      .width(this.isTablet ? 520 : '90%')
      .padding(TOK_SPACE_MD)
      .backgroundColor(TOK_SURFACE_SOLID)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(14);
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#66000000')
    .zIndex(200);
  }

  @Builder
  private actionButton(label: string, enabled: boolean, action: () => void) {
    Text(label)
      .width('100%')
      .height(44)
      .textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(13)
      .fontColor(enabled ? TOK_ON_PRIMARY : TOK_MUTED)
      .backgroundColor(enabled ? TOK_PRIMARY_DARK : TOK_SURFACE_FIELD)
      .borderRadius(8)
      .opacity(enabled ? 1 : 0.62)
      .onClick((): void => {
        if (enabled) action();
      });
  }

  private submitOnlineImport(): void {
    const onlineUrl = this.urlDraft.trim();
    if (onlineUrl.length === 0) {
      this.validationMessage = '请输入在线 JSON 的 HTTP/HTTPS 地址';
      return;
    }
    this.onImportOnline(onlineUrl);
  }
}
