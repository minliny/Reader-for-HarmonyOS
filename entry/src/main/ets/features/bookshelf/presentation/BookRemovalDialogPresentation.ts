export interface BookRemovalDialogHandle {
  open: () => void;
  close: () => boolean;
}

export type BookRemovalDialogPhase = 'open' | 'close';
type BookRemovalDialogDiagnostic = (phase: BookRemovalDialogPhase, error: Object) => void;
type BookRemovalDialogFactory = (message: string, id: number) => BookRemovalDialogHandle;

interface BookRemovalOpening {
  readonly id: number;
  readonly current: () => boolean;
  readonly action: () => void;
  readonly diagnostic: BookRemovalDialogDiagnostic;
  dialog?: BookRemovalDialogHandle;
}

/** Owns the confirmation opening. Bookshelf operation owners still admit writes. */
export class BookRemovalDialogPresentation {
  private sequence: number = 0;
  private opening: BookRemovalOpening | undefined;
  private createDialog: BookRemovalDialogFactory | undefined;

  isOpen(): boolean {
    return this.opening !== undefined;
  }

  attach(createDialog: BookRemovalDialogFactory): () => void {
    this.dismiss();
    this.createDialog = createDialog;
    return (): void => {
      if (this.createDialog !== createDialog) return;
      this.createDialog = undefined;
      this.dismiss();
    };
  }

  open(message: string, current: () => boolean, action: () => void, diagnostic: BookRemovalDialogDiagnostic): void {
    const createDialog = this.createDialog;
    if (createDialog === undefined || this.opening !== undefined || !current()) return;
    const opening: BookRemovalOpening = { id: ++this.sequence, current, action, diagnostic };
    this.opening = opening;
    try {
      opening.dialog = createDialog(message, opening.id);
      opening.dialog.open();
    } catch (error) {
      this.dismiss(opening.id);
      diagnostic('open', error as Object);
    }
  }

  dismiss(id?: number): boolean {
    const opening = this.opening;
    if (opening === undefined || (id !== undefined && opening.id !== id)) return false;
    this.opening = undefined;
    try {
      return opening.dialog?.close() ?? true;
    } catch (error) {
      opening.diagnostic('close', error as Object);
      return false;
    }
  }

  nativeDismissed(id: number): void {
    if (this.opening?.id === id) this.opening = undefined;
  }

  confirm(id?: number): void {
    const opening = this.opening;
    if (opening === undefined || (id !== undefined && opening.id !== id)) return;
    if (this.dismiss(opening.id) && this.sequence === opening.id && opening.current()) opening.action();
  }
}
