import { BookRemovalDialog } from './BookRemovalDialog';
import { BookRemovalDialogPresentation, type BookRemovalDialogHandle } from '../presentation/BookRemovalDialogPresentation';
import { readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { readerReduceMotionFromStorage } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';

/** Mounted ArkUI owner for the native dialog. The scene supplies admission
 * and the existing bookshelf action through BookRemovalDialogPresentation. */
@Component
export struct BookRemovalDialogHost {
  presentation: BookRemovalDialogPresentation | undefined;
  private detach: (() => void) | undefined;
  @State private backdropTicket: number = 0;
  private backdropSequence: number = 0;

  aboutToAppear(): void {
    const presentation = this.presentation;
    if (presentation === undefined) return;
    this.detach = presentation.attach((message: string, id: number): BookRemovalDialogHandle =>
      this.createDialog(message, id, presentation));
  }

  aboutToDisappear(): void {
    this.backdropTicket = 0;
    this.detach?.();
    this.detach = undefined;
  }

  private createDialog(message: string, id: number, presentation: BookRemovalDialogPresentation): BookRemovalDialogHandle {
    const backdropTicket = ++this.backdropSequence;
    const reducedMotion = readerReduceMotionFromStorage();
    const curve = readerMotionStandardCurve();
    const scheme = AppStorage.get<string>('readerAppScheme') ?? 'day';
    const controller: CustomDialogController = new CustomDialogController({
      builder: (): void => this.dialogContent(message, id, controller, presentation, reducedMotion),
      alignment: DialogAlignment.Center,
      customStyle: true,
      autoCancel: true,
      maskColor: readerAppColor('app.scrim.modal', scheme),
      // The native transition moves the whole dialog, so the reduced mode fades only its content.
      openAnimation: { duration: reducedMotion ? 0 : 220, curve },
      closeAnimation: { duration: reducedMotion ? 0 : 180, curve },
      cancel: (): void => presentation.nativeDismissed(id),
      onDidDisappear: (): void => {
        this.clearBackdrop(backdropTicket);
        presentation.nativeDismissed(id);
      },
    });
    return {
      open: (): void => {
        this.backdropTicket = backdropTicket;
        try {
          controller.open();
        } catch (error) {
          this.clearBackdrop(backdropTicket);
          throw error as Error;
        }
      },
      close: (): boolean => {
        try {
          controller.close();
          return true;
        } catch (error) {
          this.clearBackdrop(backdropTicket);
          throw error as Error;
        }
      },
    };
  }

  private clearBackdrop(ticket: number): void {
    if (this.backdropTicket === ticket) this.backdropTicket = 0;
  }

  @Builder
  private dialogContent(message: string, id: number, controller: CustomDialogController,
    presentation: BookRemovalDialogPresentation, reducedMotion: boolean) {
    BookRemovalDialog({
      controller, message, reducedMotion,
      onCancel: (): void => { presentation.dismiss(id); },
      onConfirm: (): void => presentation.confirm(id),
    });
  }

  build() {
    Stack()
      .width(this.backdropTicket > 0 ? '100%' : 0)
      .height(this.backdropTicket > 0 ? '100%' : 0)
      .backgroundColor(Color.Transparent)
      .backdropBlur(this.backdropTicket > 0 ? 6 : 0)
      .hitTestBehavior(HitTestMode.None)
      .accessibilityLevel('no-hide-descendants')
      .focusable(false);
  }
}
