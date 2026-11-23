import { BookRemovalDialog } from './BookRemovalDialog';
import { BookRemovalDialogPresentation, type BookRemovalDialogHandle } from '../presentation/BookRemovalDialogPresentation';

/** Mounted ArkUI owner for the native dialog. The scene supplies admission
 * and the existing bookshelf action through BookRemovalDialogPresentation. */
@Component
export struct BookRemovalDialogHost {
  presentation: BookRemovalDialogPresentation | undefined;
  private detach: (() => void) | undefined;

  aboutToAppear(): void {
    const presentation = this.presentation;
    if (presentation === undefined) return;
    this.detach = presentation.attach((message: string, id: number): BookRemovalDialogHandle =>
      this.createDialog(message, id, presentation));
  }

  aboutToDisappear(): void {
    this.detach?.();
    this.detach = undefined;
  }

  private createDialog(message: string, id: number, presentation: BookRemovalDialogPresentation): BookRemovalDialogHandle {
    const controller: CustomDialogController = new CustomDialogController({
      builder: (): void => this.dialogContent(message, id, controller, presentation),
      alignment: DialogAlignment.Center,
      customStyle: true,
      autoCancel: true,
      cancel: (): void => presentation.nativeDismissed(id),
      onDidDisappear: (): void => presentation.nativeDismissed(id),
    });
    return {
      open: (): void => controller.open(),
      close: (): boolean => { controller.close(); return true; },
    };
  }

  @Builder
  private dialogContent(message: string, id: number, controller: CustomDialogController,
    presentation: BookRemovalDialogPresentation) {
    BookRemovalDialog({
      controller, message,
      onCancel: (): void => { presentation.dismiss(id); },
      onConfirm: (): void => presentation.confirm(id),
    });
  }

  build() {
    Stack().width(0).height(0).hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
  }
}
