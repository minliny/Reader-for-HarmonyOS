import { ReaderBoundedSurface } from '../common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../common/ReaderBoundedSurfaceHeader';
import { ReaderSheetActionList } from '../common/ReaderSheetActionList';
import { ReaderTransientToast } from '../common/ReaderTransientToast';

/** Business callbacks only. The native host retains presentation ownership;
 * the common frame/header/actions own the existing physical surface. */
@Component
export struct BookshelfBookActionSheet {
  @Prop presentationId: string = '';
  isCurrent: (presentationId: string) => boolean = (_id: string): boolean => false;
  onDismiss: () => void = (): void => {};
  onMultiSelect: () => void = (): void => {};
  onEditGroup: () => void = (): void => {};
  onBookInfo: () => void = (): void => {};
  onRemoveFromBookshelf: () => void = (): void => {};

  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  @Builder private sheetHeader() {
    ReaderBoundedSurfaceHeader({ specId: 'bookshelf-book-action', title: '书籍操作',
      onClose: this.dismissAction(this.presentationId) });
  }
  @Builder private sheetActions() {
    ReaderSheetActionList({ presentationId: this.presentationId, isCurrent: (id: string): boolean => this.isCurrent(id),
      onMultiSelect: (): void => this.onMultiSelect(), onBookInfo: (): void => this.onBookInfo(),
      onEditGroup: (): void => this.onEditGroup(), onRemoveFromBookshelf: (): void => this.onRemoveFromBookshelf(),
    });
  }
  private dismissAction(presentationId: string): () => void {
    return (): void => {
      if (!this.mounted || presentationId.length === 0 || presentationId !== this.presentationId) return;
      try { if (!this.isCurrent(presentationId)) return; } catch (_error) { return; }
      this.onDismiss();
    };
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      ReaderBoundedSurface({ specId: 'bookshelf-book-action',
        header: (): void => { this.sheetHeader(); }, actions: (): void => { this.sheetActions(); },
      });
      this.transientMessageHost();
    }.width('100%');
  }

  @Builder
  private transientMessageHost() {
    // A positioned child does not contribute to the native FIT_CONTENT
    // height. It mounts and retires with this one keyed sheet presentation.
    ReaderTransientToast({ priority: 2, bounded: true }).position({ left: 0, bottom: 0 });
  }
}
