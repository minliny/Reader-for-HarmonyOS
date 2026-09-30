import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../common/ReaderWindowMetrics';
import { SurfaceWidthSpec, resolveHorizontalFrame } from '../common/SurfaceHorizontalGeometry';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderPressFeedback } from '../common/ReaderPressFeedback';

/** Figma Library/BookDetail/DeleteDialog 2269:46. The caller owns removal
 * admission and persistence; this native modal owns only confirmation UI. */
@CustomDialog
export struct BookRemovalDialog {
  controller: CustomDialogController;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop message: string = '';
  @State private measuredMessageHeight: number = 50;
  onCancel: () => void = (): void => {};
  onConfirm: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      Text('移除书架')
        .width('100%')
        .fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold).fontSize(17).lineHeight(20)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .margin({ bottom: 16 });
      Scroll() {
        Text(this.message)
          .width('100%')
          .fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Regular).fontSize(13)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
      .scrollBar(BarState.Auto)
      .margin({ bottom: 30 });
      Row({ space: 10 }) {
        this.action('取消', false, (): void => this.onCancel());
        this.action('移除', true, (): void => this.onConfirm());
      }.width('100%');
    }
    .width(this.dialogWidth())
    // ArkUI includes the 1vp border in the content inset: 17 + 1 = Figma 18.
    .padding(17)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: 1, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(12)
    .shadow({ radius: 46, offsetX: 0, offsetY: 18,
      color: readerAppColor('app.BookshelfBookActionSheet.build.color.29594632', this.appThemeScheme) });
  }

  @Builder
  private action(label: string, danger: boolean, action: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Text(label).fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold).fontSize(13).lineHeight(16)
        .fontColor(readerAppColor(danger ? 'TOK_CARD_BG_HI' : 'TOK_INK', this.appThemeScheme));
    }
    .layoutWeight(1).height(38).padding(0)
    .attributeModifier(new ReaderPressFeedback(
      readerAppColor(danger ? 'app.BookshelfBookActionSheet.actionSlot.fontColor.FFD7473E' :
        'TOK_SURFACE_PANEL_SOFT', this.appThemeScheme), this.appThemeScheme, 12))
    .responseRegion({ x: 0, y: -3, width: '100%', height: 44 })
    .defaultFocus(!danger)
    .onClick(action);
  }

  private dialogWidth(): number {
    if (this.readerWindowMetricsRevision < 0) return 0;
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(metrics.windowRect.width, readerInteractiveSafeLeft(metrics),
      readerInteractiveSafeRight(metrics), new SurfaceWidthSpec(306, 20, 20)).width;
  }

  private messageMaxHeight(): number {
    if (this.readerWindowMetricsRevision < 0) return 50;
    const metrics = ReaderWindowCoordinator.metrics();
    // Reserve title, actions, spacing and window insets. Long names and the
    // truthful local-book purge notice scroll instead of being ellipsized.
    return Math.max(50, metrics.windowRect.height - metrics.systemInsets.top -
      metrics.systemInsets.bottom - 200 * Math.max(1, metrics.systemFontScale));
  }
}
