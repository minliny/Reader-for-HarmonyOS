import type { ReaderStartupFailureKind } from '../../app/ReaderRuntimeOwner';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_SPACE_LG,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

/** A deliberately small startup-only surface; retry ownership stays outside. */
@Component
export struct ReaderStartupFailurePage {
  @Prop failureKind: ReaderStartupFailureKind = 'unavailable';
  onRetry: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column({ space: 0 }) {
      Stack({ alignContent: Alignment.Center }) {
        Text('!')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(24)
          .fontColor(TOK_GREEN);
      }
      .width(56)
      .height(56)
      .borderRadius(28)
      .backgroundColor(TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER });

      Text(this.title())
        .margin({ top: TOK_SPACE_LG })
        .width('100%')
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(18)
        .lineHeight(27)
        .fontColor(TOK_INK)
        .textAlign(TextAlign.Center);

      Text(this.explanation())
        .margin({ top: TOK_SPACE_XS })
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(13)
        .lineHeight(20)
        .fontColor(TOK_MUTED)
        .textAlign(TextAlign.Center);

      Text('重试')
        .margin({ top: TOK_SPACE_LG })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .lineHeight(14)
        .fontColor(TOK_ON_PRIMARY)
        .padding({ left: 30, right: 30, top: TOK_SPACE_SM, bottom: TOK_SPACE_SM })
        .backgroundColor(TOK_GREEN)
        .borderRadius(999)
        .onClick((): void => this.onRetry());
    }
    .width('100%')
    .height('100%')
    .padding({ left: 32, right: 32 })
    .justifyContent(FlexAlign.Center)
    .backgroundColor(TOK_PAPER);
  }

  private title(): string {
    if (this.failureKind === 'storageIncompatible') {
      return '当前版本无法读取此数据';
    }
    return 'Reader 暂时无法启动';
  }

  private explanation(): string {
    if (this.failureKind === 'storageIncompatible') {
      return '数据由更新版本的 Reader 创建。请升级或安装相同/更高版本后重试。现有数据未被删除或降级。';
    }
    return 'Reader Core 当前不可用。请稍后重试。';
  }
}
