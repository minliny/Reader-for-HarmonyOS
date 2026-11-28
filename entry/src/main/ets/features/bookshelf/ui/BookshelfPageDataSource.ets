import { FrameCallback, type UIContext } from '@kit.ArkUI';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { ReaderSurfaceRect } from '../../../ui/layout/ReaderSurfaceRect';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import {
  bookshelfBookIdentityKey,
  bookshelfBookRenderKey,
  bookshelfRowRenderKey,
  bookshelfRowSlotKey,
  reconcileBookshelfRows,
  type BookshelfBookSlotLike,
  type BookshelfRowSlotLike,
} from './BookshelfRowReconciler';
import {
  TOK_BORDER_W,
  TOK_RADIUS_MD,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_MD,
  TOK_SPACE_XS,
} from '../../../ui/foundation/ReaderTokens';
import { TYPE_SECTION_HEADING } from '../../../ui/foundation/ReaderTypography';

@Builder
export function bookshelfFileDropHint(topInset: number, scheme: string) {
  Row() {
    Text('松开以导入书籍')
      .fontFamily(TYPE_SECTION_HEADING.fontFamily)
      .fontWeight(TYPE_SECTION_HEADING.fontWeight)
      .fontSize(TYPE_SECTION_HEADING.fontSizeFp)
      .fontColor(readerAppColor('TOK_PRIMARY_TEXT', scheme))
      .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING, top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .backgroundColor(readerAppColor('TOK_PAPER', scheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_PRIMARY_BORDER', scheme) })
      .borderRadius(TOK_RADIUS_MD);
  }
  .width('100%')
  .padding({ top: topInset + TOK_SPACE_MD })
  .justifyContent(FlexAlign.Center)
  .hitTestBehavior(HitTestMode.None);
}

export class BookshelfMotionFrameCallback extends FrameCallback {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    super();
    this.callback = callback;
  }
  onFrame(_time: number): void { this.callback(); }
  onIdle(_remaining: number): void {}
}

export class BookshelfBookActionFocusFrame extends FrameCallback {
  private readonly callback: () => void;
  constructor(callback: () => void) { super(); this.callback = callback; }
  onFrame(_time: number): void { this.callback(); }
  onIdle(_remaining: number): void {}
}

export { bookshelfBookIdentityKey, bookshelfBookRenderKey, bookshelfRowRenderKey, bookshelfRowSlotKey };

@Observed
export class BookshelfBookSlot implements BookshelfBookSlotLike {
  readonly key: string;
  book: ShelfBook;
  columnIndex: number;
  signature: string;

  constructor(key: string, book: ShelfBook, columnIndex: number, signature: string) {
    this.key = key;
    this.book = book;
    this.columnIndex = columnIndex;
    this.signature = signature;
  }
}

@Observed
export class BookshelfRowSlot implements BookshelfRowSlotLike<BookshelfBookSlot> {
  readonly rowIndex: number;
  books: ShelfBook[];
  slots: BookshelfBookSlot[];
  signature: string;

  constructor(rowIndex: number, books: ShelfBook[], slots: BookshelfBookSlot[], signature: string) {
    this.rowIndex = rowIndex;
    this.books = books;
    this.slots = slots;
    this.signature = signature;
  }
}

export class BookshelfRowDataSource implements IDataSource {
  private rows: BookshelfRowSlot[] = [];
  private listeners: DataChangeListener[] = [];
  private readonly renderKey: (row: ShelfBook[]) => string;
  constructor(renderKey: (row: ShelfBook[]) => string) { this.renderKey = renderKey; }

  totalCount(): number { return this.rows.length; }
  getData(index: number): BookshelfRowSlot { return this.rows[index]; }
  booksAt(index: number): ShelfBook[] {
    return index >= 0 && index < this.rows.length ? this.rows[index].books : [];
  }
  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) this.listeners.push(listener);
  }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }
  replace(items: ShelfBook[][]): void {
    void this.renderKey;
    const delta = reconcileBookshelfRows<BookshelfBookSlot, BookshelfRowSlot>(
      this.rows,
      items,
      (key: string, book: ShelfBook, columnIndex: number, signature: string): BookshelfBookSlot =>
        new BookshelfBookSlot(key, book, columnIndex, signature),
      (rowIndex: number, books: ShelfBook[], slots: BookshelfBookSlot[], signature: string): BookshelfRowSlot =>
        new BookshelfRowSlot(rowIndex, books, slots, signature),
    );
    if (delta.kind === 'none') return;
    for (const listener of this.listeners) {
      if (delta.kind === 'add') listener.onDatasetChange([{
        type: DataOperationType.ADD, index: delta.index, count: delta.count, key: delta.addedKeys,
      }]);
      else listener.onDatasetChange([{
        type: DataOperationType.DELETE, index: delta.index, count: delta.count,
      }]);
    }
  }
}

export interface BookshelfMeasureBookOriginParams {
  context: UIContext;
  coverId: string;
  viewportId: string;
  expectedCoverWidth: number;
  expectedCoverHeight: number;
  expectedViewportWidth: number;
  headerClearance: number;
  contentEndInset: number;
}

export function measureBookshelfBookOrigin(params: BookshelfMeasureBookOriginParams): ReaderSurfaceRect | undefined {
  try {
    const context = params.context;
    const node = context.getFrameNodeById(params.coverId);
    const viewport = context.getFrameNodeById(params.viewportId);
    if (node === null || viewport === null) return undefined;
    const cover = context.getComponentUtils().getRectangleById(params.coverId);
    const list = context.getComponentUtils().getRectangleById(params.viewportId);
    const position = node.getPositionToWindowWithTransform();
    const bounds = viewport.getPositionToWindowWithTransform();
    const width = context.px2vp(cover.size.width) * cover.scale.x;
    const height = context.px2vp(cover.size.height) * cover.scale.y;
    const viewportWidth = context.px2vp(list.size.width);
    const viewportHeight = context.px2vp(list.size.height);
    if (![position.x, position.y, width, height, bounds.x, bounds.y, viewportWidth, viewportHeight]
      .every((value: number): boolean => Number.isFinite(value)) || width <= 0 || height <= 0) return undefined;
    if (Math.abs(width - params.expectedCoverWidth) > 2 || Math.abs(height - params.expectedCoverHeight) > 2 ||
      Math.abs(viewportWidth - params.expectedViewportWidth) > 2) return undefined;
    if (position.x < bounds.x - 0.5 || position.x + width > bounds.x + viewportWidth + 0.5 ||
      position.y < bounds.y + params.headerClearance - 0.5 ||
      position.y + height > bounds.y + viewportHeight - params.contentEndInset + 0.5) return undefined;
    return { x: position.x, y: position.y, width, height };
  } catch (_error) {
    return undefined;
  }
}
