/** Route-owned transient viewport, separate from the durable projection choice. */
export class BookshelfViewState {
  // First entry keeps optional filters collapsed; subsequent route returns
  // preserve the user's explicit expand/collapse choice.
  filterExpanded: boolean = false;
  anchorKey: string = '';
  anchorOffset: number = 0;
  anchorItemY: number = 0;
}
