import { readerMainViewport } from '../shell/MainNavigationSpec';
/**
 * Empty shelf, rebuilt 2026-08-06 against live Figma node `State/BookshelfEmpty`
 * (`286:31`, icon `Icon/Bookshelf` `271:96`). The 352×350 card replaces the old
 * `574:198` reference geometry (which had swapped action roles, blue icon frame,
 * pills, and wrong card size). The top bar shares the populated shelf's text
 * title and actions. Empty-state text uses ReaderNotoSansSC per Figma.
 */
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { bookshelfHeaderSpec } from '../common/ReaderHeaderSpecs';
import { readerFloatingTabContentInset } from '../common/ReaderFloatingBarMetrics';
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
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_SCREEN_INSET,
  TOK_SPACE_XS,
  TOK_SPACE_MD,
} from '../common/ReaderTokens';
import {
  readerMainNavigationMode,
  readerMainRailBottomInset,
  readerMainRailContentLeft,
  readerMainRailContentRight,
} from '../shell/MainNavigationSpec';

import { registerReaderShelfFonts } from '../common/ReaderFonts';
import { BookshelfEmptyCard } from './BookshelfEmptyCard';
import { BookshelfSectionHeader } from './BookshelfSectionHeader';

@Component
export struct BookshelfEmptyPage {
  @StorageLink('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerWideNavigationRail') private wideNavigationRail: boolean = false;
  /** Presented header bottom (top + measured height), owned by the route. */
  @Prop headerBottom: number = bookshelfHeaderSpec().frameHeight;
  onImportRequested: () => void = (): void => {};
  onSearchRequested: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderShelfFonts(this.getUIContext().getFont());
  }

  build() {
    Scroll() {
      Column({ space: 9 }) {
        this.sectionHeader();
        BookshelfEmptyCard({
          cardWidth: this.emptyCardWidth(),
          onImportRequested: (): void => this.onImportRequested(),
          onSearchRequested: (): void => this.onSearchRequested(),
        })
      }
      .width(this.contentFrame().width)
      .alignItems(HorizontalAlign.Center)
      .padding({ top: this.headerBottom + TOK_SPACE_XS, bottom: this.bottomContentInset() });
    }
    .width('100%')
    .height('100%')
    .align(Alignment.Top)
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .scrollBar(BarState.Off);
  }

  private bottomContentInset(): number {
    if (this.readerWindowMetricsRevision < 0) return TOK_SPACE_MD;
    return this.railActive() ? readerMainRailBottomInset() :
      readerFloatingTabContentInset(ReaderWindowCoordinator.metrics());
  }

  private railActive(): boolean {
    return readerMainNavigationMode(this.wideNavigationRail, this.mainViewportRevision, this.readerWindowMetricsRevision) === 'rail';
  }

  private emptyCardWidth(): number {
    return Math.min(TOK_CONTENT_MAX_W_PHONE, this.contentFrame().width);
  }

  @Builder
  private sectionHeader() {
    BookshelfSectionHeader({
      contentWidth: this.contentFrame().width,
      actionsEnabled: false,
      actionsOpacity: 0.42,
    });
  }

  private contentFrame(): SurfaceHorizontalFrame {
    // Figma supplies only the Phone `State/BookshelfEmpty` card; the card keeps
    // its 352 width. In rail mode the surrounding content column adopts the
    // shelf rail frame and the card stays centered inside it.
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    const containerWidth = readerMainViewport(this.mainViewportRevision).width;
    const rail = this.railActive();
    return resolveHorizontalFrame(
      containerWidth,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(
        rail ? TOK_CONTENT_RAIL_W_TABLET : TOK_CONTENT_MAX_W_PHONE,
        rail ? readerMainRailContentLeft() : TOK_SCREEN_INSET,
        rail ? readerMainRailContentRight() : TOK_SCREEN_INSET,
      ),
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
