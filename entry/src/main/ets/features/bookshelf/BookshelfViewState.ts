/** Route-owned transient viewport, separate from the durable projection choice. */
export class BookshelfViewState {
  filterExpanded: boolean = false;
  groupExpanded: boolean = false;
  anchorKey: string = '';
  anchorOffset: number = 0;
  anchorItemY: number = 0;
}
