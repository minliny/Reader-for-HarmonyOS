import { MESSAGE_BODY } from '../common/ReaderMessageStyle';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../common/ReaderFonts';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderDialogSurface, DialogActionView } from '../common/ReaderDialogSurface';

/** Figma Library/BookDetail/DeleteDialog 2269:46. The caller owns removal
 * admission and persistence; this native modal owns only confirmation UI.
 * Surface/header/actions come from the shared dialog surface family; this
 * struct keeps the controller, message measurement and callbacks. */
@CustomDialog
export struct BookRemovalDialog {
  controller: CustomDialogController;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop message: string = '';
  @State private measuredMessageHeight: number = 50;
  onCancel: () => void = (): void => {};
  onConfirm: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    ReaderDialogSurface({
      specId: 'book-removal',
      title: '移出书架',
      actions: [
        new DialogActionView('cancel', '取消', 'default', true, true),
        new DialogActionView('confirm', '移除', 'danger', true, false),
      ],
      onAction: (id: string): void => {
        if (id === 'cancel') {
          this.onCancel();
        } else if (id === 'confirm') {
          this.onConfirm();
        }
      },
      body: (): void => {
        this.messageBody();
      },
    })
  }

  @Builder
  private messageBody() {
    Scroll() {
      Text(this.message)
        .width('100%')
        .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight).fontSize(MESSAGE_BODY.fontSizeFp)
        .lineHeight(MESSAGE_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
        .constraintSize({ minHeight: 50 })
        .onAreaChange((_old: Area, area: Area): void => {
          const height = typeof area.height === 'number' ? area.height :
            (typeof area.height === 'string' ? Number.parseFloat(area.height) : 0);
          if (Number.isFinite(height) && height > 0 && Math.abs(height - this.measuredMessageHeight) > 0.5) {
            this.measuredMessageHeight = height;
          }
        });
    }
    .width('100%')
    .height(Math.min(Math.max(50, this.measuredMessageHeight), this.messageMaxHeight()))
    .align(Alignment.TopStart)
    .scrollBar(BarState.Auto);
  }

  private messageMaxHeight(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    // Reserve title, actions, spacing and window insets. Long names and the
    // truthful local-book purge notice scroll instead of being ellipsized.
    return Math.max(50, metrics.windowRect.height - metrics.systemInsets.top -
      metrics.systemInsets.bottom - 200 * Math.max(1, metrics.systemFontScale));
  }
}
