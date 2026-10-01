import { readerAppColor } from '../common/ReaderThemeRegistry';
/**
 * Empty shelf, rebuilt 2026-08-06 against live Figma node `State/BookshelfEmpty`
 * (`286:31`, icon `Icon/Bookshelf` `271:96`). The 352×350 card replaces the old
 * `574:198` reference geometry (which had swapped action roles, blue icon frame,
 * pills, and wrong card size). The top bar shares the populated shelf's text
 * title and actions. Empty-state text uses ReaderNotoSansSC per Figma.
 */
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  TOK_CONTENT_MAX_W_PHONE,
  TOK_SCREEN_INSET,
  TOK_SPACE_XS,
  TOK_SPACE_MD,
} from '../common/ReaderTokens';

import { registerReaderShelfFonts } from '../common/ReaderFonts';
import { BookshelfEmptyCard } from './BookshelfEmptyCard';

@Component
export struct BookshelfEmptyPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  onImportRequested: () => void = (): void => {};
  onSearchRequested: () => void = (): void => {};
  @State private viewportWidth: number = 0;

  aboutToAppear(): void {
    registerReaderShelfFonts(this.getUIContext().getFont());
  }

  build() {
    Scroll() {
      Column({ space: 9 }) {
        this.sectionHeader();
        BookshelfEmptyCard({
          cardWidth: this.contentFrame().width,
          onImportRequested: (): void => this.onImportRequested(),
          onSearchRequested: (): void => this.onSearchRequested(),
        })
      }
      .width(this.contentFrame().width)
      .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_MD });
    }
    .width('100%')
    .height('100%')
    .align(Alignment.Top)
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .scrollBar(BarState.Off)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = this.numericAreaLength(newValue.width);
      if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
        this.viewportWidth = width;
      }
    });
  }

  @Builder
  private sectionHeader() {
    Row() {
      Text('我的书架')
        .fontFamily('ReaderInter')
        .fontWeight(700)
        .fontSize(15)
        .lineHeight(18)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .layoutWeight(1);

      Row({ space: TOK_SPACE_XS }) {
        this.headerAction('bookshelf_grid');
        this.headerAction('bookshelf_list');
        this.headerAction('bookshelf_filter');
      }
      .height(34);
    }
    .width(this.contentFrame().width)
    .height(38)
    .alignItems(VerticalAlign.Center);
  }

  // Single unconditional Image: conditional nodes inside a multi-instance
  // @Builder get mis-diffed and whole actions can vanish from the tree.
  private headerActionAsset(asset: string): Resource {
    if (asset === 'bookshelf_grid') {
      return (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_grid_outline_theme_night') : $r('app.media.bookshelf_grid_outline'));
    }
    if (asset === 'bookshelf_list') {
      return (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_list_theme_night') : $r('app.media.bookshelf_list'));
    }
    if (asset === 'bookshelf_filter') {
      return (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_filter_theme_night') : $r('app.media.bookshelf_filter'));
    }
    return (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_filter_theme_night') : $r('app.media.bookshelf_filter'));
  }

  @Builder
  private headerAction(asset: string) {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.headerActionAsset(asset)).width(20).height(20);
    }
    .width(34)
    .height(34)
    .opacity(0.42)
    .borderRadius(17);
  }

  private contentFrame(): SurfaceHorizontalFrame {
    // Figma supplies only the Phone `State/BookshelfEmpty` card; no Tablet
    // empty assembly, so Tablet reuses the Phone-width layout. Card is 352
    // wide (matches Settings page 390 - 2*19), replacing the old 350.9 value.
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    const containerWidth = this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width;
    return resolveHorizontalFrame(
      containerWidth,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_PHONE, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
