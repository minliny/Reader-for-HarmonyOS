import { BookRemovalDialog } from './BookRemovalDialog';
import { BookRemovalDialogPresentation, type BookRemovalDialogHandle } from '../presentation/BookRemovalDialogPresentation';
import { readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam, readerReduceMotionFromStorage } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { defaultNavigationPreferences, readerSheetBackdropBlur } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { resolveReaderModalScrimSpec, type ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';

/** Mounted ArkUI owner for the native dialog. The scene supplies admission
 * and the existing bookshelf action through BookRemovalDialogPresentation. */
@Component
export struct BookRemovalDialogHost {
  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  presentation: BookRemovalDialogPresentation | undefined;
  private detach: (() => void) | undefined;
  @State private backdropTicket: number = 0;
  @State private backdropOpacity: number = 0;
  private backdropSequence: number = 0;

  aboutToAppear(): void {
    const presentation = this.presentation;
    if (presentation === undefined) return;
    this.detach = presentation.attach((message: string, id: number): BookRemovalDialogHandle =>
      this.createDialog(message, id, presentation));
  }

  aboutToDisappear(): void {
    this.clearBackdrop(this.backdropTicket);
    this.detach?.();
    this.detach = undefined;
  }

  private createDialog(message: string, id: number, presentation: BookRemovalDialogPresentation): BookRemovalDialogHandle {
    const backdropTicket = ++this.backdropSequence;
    const reducedMotion = readerReduceMotionFromStorage();
    const curve = readerMotionStandardCurve();
    const scheme = AppStorage.get<string>('readerAppScheme') ?? 'day';
    const openDuration = 220;
    const closeDuration = 180;
    let backdropExiting = false;
    const fadeBackdrop = (opacity: number, duration: number, onFinish?: () => void): void => {
      if (this.backdropTicket !== backdropTicket) return;
      const update = (): void => { this.backdropOpacity = opacity; };
      try {
        this.getUIContext().animateTo(reducedMotion ? readerMotionReducedFadeParam(onFinish) :
          { duration, curve, onFinish }, update);
      } catch (_detached) {
        update();
        onFinish?.();
      }
    };
    const beginBackdropExit = (): void => {
      if (backdropExiting || this.backdropTicket !== backdropTicket) return;
      backdropExiting = true;
      fadeBackdrop(0, closeDuration, (): void => this.clearBackdrop(backdropTicket));
    };
    const controller: CustomDialogController = new CustomDialogController({
      builder: (): void => this.dialogContent(message, id, controller, presentation, reducedMotion),
      alignment: DialogAlignment.Center,
      customStyle: true,
      autoCancel: true,
      maskColor: resolveReaderModalScrimSpec(this.appearancePreferences, scheme, readerAppColor('app.scrim.modal', scheme)).scrimColor,
      // The content owns the reduced entrance fade after its first layout.
      openAnimation: { duration: reducedMotion ? 0 : openDuration, curve },
      closeAnimation: reducedMotion ? readerMotionReducedFadeParam() : { duration: closeDuration, curve },
      cancel: (): void => presentation.nativeDismissed(id),
      onWillDisappear: beginBackdropExit,
      onDidDisappear: (): void => {
        // Fallback when the native dismissal did not deliver its start event.
        beginBackdropExit();
        presentation.nativeDismissed(id);
      },
    });
    return {
      open: (): void => {
        this.backdropTicket = backdropTicket;
        try {
          controller.open();
          if (!backdropExiting) fadeBackdrop(1, openDuration);
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
    if (this.backdropTicket !== ticket) return;
    this.backdropOpacity = 0;
    this.backdropTicket = 0;
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

  private backdropEffect(): BackgroundEffectOptions | undefined {
    if (this.backdropTicket === 0) return undefined;
    const radius = readerSheetBackdropBlur(this.appearancePreferences);
    return radius > 0 ? { radius, color: Color.Transparent } : undefined;
  }

  build() {
    Stack()
      .width(this.backdropTicket > 0 ? '100%' : 0)
      .height(this.backdropTicket > 0 ? '100%' : 0)
      .backgroundColor(Color.Transparent)
      .backgroundEffect(this.backdropEffect())
      .opacity(this.backdropOpacity)
      .expandSafeArea(this.backdropTicket > 0 ? [SafeAreaType.SYSTEM] : [],
        this.backdropTicket > 0 ? [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END] : [])
      .hitTestBehavior(HitTestMode.None)
      .accessibilityLevel('no-hide-descendants')
      .focusable(false);
  }
}
