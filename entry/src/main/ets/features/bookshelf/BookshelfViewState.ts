/** Route-owned transient viewport, separate from the durable projection choice. */
export class BookshelfViewState {
  // First entry keeps optional filters collapsed; subsequent route returns
  // preserve the user's explicit expand/collapse choice.
  filterExpanded: boolean = false;
  // Preserve only the clicked host identity. Return geometry is measured anew.
  openedBookKey: string = '';
  openedFromContinueReading: boolean = false;
  anchorKey: string = '';
  /** A native viewport sample exists; zero is also a valid saved offset. */
  anchorCaptured: boolean = false;
  anchorOffset: number = 0;
  anchorItemY: number = 0;
}
