import { FrameCallback } from '@kit.ArkUI';
import { BookshelfMutationPresentation } from '../presentation/BookshelfMutationPresentation';
import { LocalImportDialog } from './LocalImportDialog';

class BookshelfImportFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

@Component
export struct BookshelfImportScene {
  @ObjectLink presentation: BookshelfMutationPresentation;
  @Prop navigation: number = 0;
  @Prop reduceMotion: boolean = false;
  canRestoreFocus: () => boolean = (): boolean => false;

  build() {
    if (this.presentation.snapshot.importPresentation !== undefined) {
      ForEach([this.presentation.snapshot.importIdentity], (identity: number): void => {
        this.importDialog(identity, this.navigation);
      }, (identity: number): string => identity.toString());
    }
  }

  @Builder
  private importDialog(identity: number, navigation: number) {
    LocalImportDialog({
      state: this.presentation.snapshot.importPresentation?.state ?? 'fileSelection',
      batch: this.presentation.snapshot.importPresentation?.batch,
      reduceMotion: this.reduceMotion,
      failureMessage: this.presentation.snapshot.importFailureMessage,
      selectionEnabled: this.presentation.importBlockMessage().length === 0,
      selectionBlockedMessage: this.presentation.importBlockMessage(),
      recovery: this.presentation.importRecovery(),
      originalPending: this.presentation.snapshot.action === 'import' && this.presentation.hasUnknownWrite(),
      onReconcile: (generation: number): void => { void this.presentation.reconcile(generation, identity, navigation); },
      onSelectFiles: (mayOpenPicker: () => boolean): void => {
        void this.presentation.selectImport(identity, navigation, mayOpenPicker);
      },
      onClose: (): void => { this.presentation.dismissImport(identity, navigation); },
    }).onDisAppear((): void => { this.restoreFocus(identity); });
  }

  private restoreFocus(identity: number): void {
    const restore = this.presentation.importFocusReturn(identity);
    if (restore === undefined) return;
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new BookshelfImportFocusFrame((): void => {
        if (!restore.isCurrent() || !this.canRestoreFocus()) return;
        const focus = context.getFocusController();
        if (restore.target !== undefined && restore.target.length > 0) {
          try { focus.requestFocus(restore.target); return; } catch (_unavailableTarget) {}
        }
        try { focus.requestFocus('reader-bookshelf-search-entry'); } catch (_unavailableFallback) {}
      }));
    } catch (_detached) {}
  }
}
