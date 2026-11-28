import { FrameCallback, type UIContext } from '@kit.ArkUI';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { ReaderSurfaceRect } from '../../../ui/layout/ReaderSurfaceRect';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
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

export class BookshelfRowDataSource implements IDataSource {
  private items: ShelfBook[][] = [];
  private listeners: DataChangeListener[] = [];
  private keys: string[] = [];
  private readonly positions: Map<string, number> = new Map();
  private readonly renderKey: (row: ShelfBook[]) => string;
  constructor(renderKey: (row: ShelfBook[]) => string) { this.renderKey = renderKey; }

  totalCount(): number { return this.items.length; }
  getData(index: number): ShelfBook[] { return this.items[index]; }
  positionForKey(key: string, fallback: number): () => number {
    return (): number => this.positions.get(key) ?? fallback;
  }
  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) this.listeners.push(listener);
  }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }
  replace(items: ShelfBook[][]): void {
    const keys = items.map((row: ShelfBook[]): string => this.renderKey(row));
    const previous = this.keys;
    const shared = Math.min(previous.length, keys.length);
    const samePrefix = previous.slice(0, shared).every((key: string, index: number): boolean => key === keys[index]);
    this.items = items;
    this.keys = keys;
    this.positions.clear();
    keys.forEach((key: string, index: number): void => { this.positions.set(key, index); });
    if (samePrefix && previous.length === keys.length) return;
    for (const listener of this.listeners) {
      if (samePrefix && keys.length > previous.length) listener.onDatasetChange([{
        type: DataOperationType.ADD, index: previous.length,
        count: keys.length - previous.length, key: keys.slice(previous.length),
      }]);
      else if (samePrefix && keys.length < previous.length) listener.onDatasetChange([{
        type: DataOperationType.DELETE, index: keys.length, count: previous.length - keys.length,
      }]);
      else listener.onDatasetChange([{ type: DataOperationType.RELOAD }]);
    }
  }
}

export function bookshelfRowRenderKey(row: ShelfBook[], _rowIndex: number): string {
  return JSON.stringify(row.map((book: ShelfBook): Array<string | number> => [
    book.sourceId, book.bookId, book.addedAt, book.title, book.author,
    book.sourceName ?? '', book.coverUrl ?? '', book.kind ?? '', book.contentKind ?? '', book.currentChapterTitle ?? '',
    book.currentChapterIndex ?? -1, book.chapterCount ?? -1, book.lastChapter ?? '',
    book.unreadCount ?? 0, book.readProgress ?? -1,
    book.readingPosition?.chapterIndex ?? -1, book.readingPosition?.chapterOffset ?? -1,
    book.readingPosition?.updatedAt ?? -1, book.readingPosition?.locationRevision ?? '',
    book.readingPosition?.bodyVersion ?? '', book.readingPosition?.processingVersion ?? '',
  ]));
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
