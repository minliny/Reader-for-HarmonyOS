import { ReaderBoundedSurface } from '../common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../common/ReaderBoundedSurfaceHeader';
import { ReaderSheetActionList } from '../common/ReaderSheetActionList';

/** Business callbacks only. The native host retains presentation ownership;
 * the common frame/header/actions own the existing physical surface. */
@Component
export struct BookshelfBookActionSheet {
  @Prop presentationId: string = '';
  isCurrent: (presentationId: string) => boolean = (_id: string): boolean => false;
  onMultiSelect: () => void = (): void => {};
  onEditGroup: () => void = (): void => {};
  onBookInfo: () => void = (): void => {};
  onRemoveFromBookshelf: () => void = (): void => {};

  @Builder private sheetHeader() {
    ReaderBoundedSurfaceHeader({ specId: 'bookshelf-book-action', title: '书籍操作' });
  }
  @Builder private sheetActions() {
    ReaderSheetActionList({ presentationId: this.presentationId, isCurrent: (id: string): boolean => this.isCurrent(id),
      onMultiSelect: (): void => this.onMultiSelect(), onBookInfo: (): void => this.onBookInfo(),
      onEditGroup: (): void => this.onEditGroup(), onRemoveFromBookshelf: (): void => this.onRemoveFromBookshelf(),
    });
  }
  build() {
    ReaderBoundedSurface({ specId: 'bookshelf-book-action',
      header: (): void => { this.sheetHeader(); }, actions: (): void => { this.sheetActions(); },
    });
  }
}
