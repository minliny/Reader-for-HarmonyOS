/** Route-owned transient viewport, separate from the durable projection choice. */
export class BookshelfViewState {
  // The manga bookshelf design keeps the content/source chips visible on
  // first entry; subsequent route returns preserve the user's collapse choice.
  filterExpanded: boolean = true;
  anchorKey: string = '';
  anchorOffset: number = 0;
  anchorItemY: number = 0;
}
