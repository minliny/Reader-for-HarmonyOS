import { readerAppColor } from '../foundation/ReaderThemeRegistry';

/** One visual surface for independent original-operation notices in one host.
 * The supplied children retain their own identity, generation and admission. */
@Component
export struct ReaderRecoveryGroup {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @BuilderParam content: () => void = this.emptyContent;

  @Builder private emptyContent() {}

  build() {
    Column() { this.content(); }
      .width('100%').padding({ left: 12, right: 12, top: 10, bottom: 10 })
      .borderRadius(14).backgroundColor(readerAppColor('TOK_MESSAGE_NOTICE', this.appThemeScheme))
      .shadow({ radius: 16, offsetY: 4, color: '#18000000' })
      .hitTestBehavior(HitTestMode.Default);
  }
}
