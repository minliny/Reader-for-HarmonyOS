import { BookshelfManagementPage } from './BookshelfManagementPage';
import { BookshelfManagementPresentation } from '../presentation/BookshelfManagementPresentation';

@Component
export struct BookshelfManagementSurface {
  @ObjectLink presentation: BookshelfManagementPresentation;
  onBack: () => void = (): void => {};

  build() {
    ForEach([this.presentation.identity], (identity: string): void => {
      this.managementPage(identity);
    }, (identity: string): string => identity);
  }

  @Builder
  private managementPage(identity: string) {
    BookshelfManagementPage({
      snapshot: this.presentation.snapshot,
      onBack: (): void => { if (this.presentation.host(identity) !== undefined) this.onBack(); },
      onGroupNameChanged: (value: string): void => this.presentation.host(identity)?.updateGroupName(value, identity),
      onGroupOrderChanged: (value: string): void => this.presentation.host(identity)?.updateGroupOrder(value, identity),
      onSelectGroup: (groupId: number): void => this.presentation.host(identity)?.selectGroup(groupId, identity),
      onClearGroupEditor: (): void => this.presentation.host(identity)?.clearGroupEditor(identity),
      onSaveGroup: (): void => this.presentation.host(identity)?.saveGroup(identity),
      onToggleGroupShown: (groupId: number): void => this.presentation.host(identity)?.toggleGroupShown(groupId, identity),
      onDeleteGroup: (groupId: number): void => this.presentation.host(identity)?.deleteGroup(groupId, identity),
      onSelectBook: (sourceId: string, bookId: string): void => this.presentation.host(identity)?.selectBook(sourceId, bookId, identity),
      onAssignmentGroupChanged: (value: string): void => this.presentation.host(identity)?.updateAssignmentGroup(value, identity),
      onAssignBook: (): void => this.presentation.host(identity)?.assignSelectedBook(identity),
      onReconcile: (expected: number): void => this.presentation.host(identity)?.reconcileManagement(expected, identity),
      onContinueOriginal: (expected: number): void => this.presentation.host(identity)?.continueOriginalManagement(expected, identity),
    });
  }
}
