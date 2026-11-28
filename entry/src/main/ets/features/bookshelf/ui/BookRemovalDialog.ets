import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import { ReaderLayoutOverlayRoot } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { ReaderDialogSurface, DialogActionView } from '../../../ui/surfaces/ReaderDialogSurface';
import { resolveDialogSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderInsetsVp, ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerOverlayViewport } from '../../../ui/layout/ReaderOverlayGeometry';

/** Figma Library/BookDetail/DeleteDialog 2269:46. The caller owns removal
 * admission and persistence; this native modal owns only confirmation UI.
 * Surface/header/actions come from the shared dialog surface family; this
 * struct keeps the controller and callbacks. */
@CustomDialog
export struct BookRemovalDialog {
  controller: CustomDialogController;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop message: string = '';
  @Prop reducedMotion: boolean = false;
  @State private contentOpacity: number = 1;
  private motionGeneration: number = 0;
  private readonly layoutOverlay = ReaderLayoutOverlayRoot.diagnostic('book-removal');
  onCancel: () => void = (): void => {};
  onConfirm: () => void = (): void => {};

  aboutToAppear(): void {
    const context = this.getUIContext();
    registerReaderFonts(context.getFont());
    this.contentOpacity = this.reducedMotion ? 0 : 1;
    const generation = ++this.motionGeneration;
    if (!this.reducedMotion) return;
    try {
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (generation !== this.motionGeneration) return;
        try {
          context.animateTo(readerMotionReducedFadeParam(), (): void => { this.contentOpacity = 1; });
        } catch (_) { this.contentOpacity = 1; }
      }));
    } catch (_) { this.contentOpacity = 1; }
  }

  aboutToDisappear(): void {
    this.motionGeneration += 1;
  }

  build() {
    Scroll() {
      ReaderDialogSurface({
        specId: 'book-removal',
        containerWidthVp: this.viewport().width,
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
        body: (): void => { this.messageBody(); },
      });
    }.id(this.layoutOverlay?.id()).width(this.cardWidth()).constraintSize({ maxHeight: this.viewport().height })
      .onAppear((): void => this.layoutOverlay?.mount(this.getUIContext()))
      .onDisAppear((): void => this.layoutOverlay?.unmount())
      .scrollBar(BarState.Auto).opacity(this.contentOpacity);
  }

  @Builder
  private messageBody() {
    Text(this.message)
      .width('100%')
      .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight).fontSize(MESSAGE_BODY.fontSizeFp)
      .lineHeight(MESSAGE_BODY.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
      .constraintSize({ minHeight: 50 });
  }

  private viewport(): ReaderRectVp {
    this.metricsRevision;
    return readerOverlayViewport(ReaderWindowCoordinator.metrics(), undefined, new ReaderInsetsVp(0, 12, 0, 12));
  }

  private cardWidth(): number {
    const spec = resolveDialogSpec('book-removal');
    return Math.max(0, Math.min(spec.maxWidth, this.viewport().width - spec.edgeGap * 2));
  }
}
