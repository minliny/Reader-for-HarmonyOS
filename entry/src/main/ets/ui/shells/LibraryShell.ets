// LibraryShell — shell for library/secondary pages (book-detail, search, rss-detail, …).
// Slots: topArea (BackTopBar) · content (ViewStateRenderer) · overlayHost.
//
// Immersive: outermost Stack expands paper behind the system bars; the content
// Column expands into the status-bar region and pads with the real device inset
// (safeAreaTop) so BackTopBar clears the status bar, and the scroll body pads its
// bottom with safeAreaBottom so the last row clears the navigation bar.
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { BackTopBar } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail } from '../store/ReaderUiState';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';

// Native rendering of the attached Figma Library/BookDetail/ActionBar child.
// This is deliberately separate from the legacy generic Library fixed action
// button so Book Detail's 52px bar and 46px actions cannot change other routes.
@Component
struct BookDetailActionBarButton {
  @Prop label: string = '';
  @Prop variant: string = 'primary';

  private isDanger(): boolean {
    return this.variant === 'danger';
  }

  build() {
    Text(this.label)
      .fontFamily(ReaderUiVisualTokens.bookDetailControlFontFamily)
      .fontSize(13)
      .fontWeight(900)
      .fontColor(this.isDanger() ? ReaderUiVisualTokens.bookDetailDanger : ReaderUiVisualTokens.bookDetailActionPrimaryLabel)
      .width('100%')
      .height(ReaderUiVisualTokens.bookDetailActionBarButtonHeight)
      .border({
        width: 1,
        color: this.isDanger() ? ReaderUiVisualTokens.bookDetailActionSecondaryBorder : ReaderUiVisualTokens.bookDetailActionPrimary,
      })
      .borderRadius(999)
      .backgroundColor(this.isDanger()
        ? ReaderUiVisualTokens.bookDetailActionSecondarySurface
        : ReaderUiVisualTokens.bookDetailActionPrimary)
      .textAlign(TextAlign.Center)
  }
}

@Component
export struct LibraryShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'overlayHost'];
  @StorageProp('reader.displayedRouteId') routeId: string = 'book-detail';
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  private continueReading(): void {
    if (this.currentBook === null) return;
    ReaderUiStore.dispatchContinueReading(this.currentBook.bookId, this.currentBook.sourceId ?? '');
  }

  private hasFixedActionBar(): boolean {
    return this.routeId === 'book-detail'
      || this.routeId === 'book-detail-toc-preview';
  }

  private isBookDetailRoute(): boolean {
    return this.routeId === 'book-detail' || this.routeId === 'book-detail-toc-preview';
  }

  private isFigmaSearchRoute(): boolean {
    return this.routeId === 'book-search' || this.routeId === 'search-home' ||
      this.routeId === 'search-results' || this.routeId === 'search-loading' ||
      this.routeId === 'search-empty' || this.routeId === 'search-error';
  }

  // Figma Book Detail masters: x=19, width=350 on 390 Phone and width=720 on
  // 760 Tablet. The runtime owns no independent inset: its source token is
  // measured from the current Book Detail master itself.
  private contentInsetLeft(): number {
    if (this.isFigmaSearchRoute()) return 0;
    return ReaderUiVisualTokens.bookDetailContentHorizontalInset;
  }

  private contentInsetRight(): number {
    if (this.isFigmaSearchRoute()) return 0;
    return ReaderUiVisualTokens.bookDetailContentHorizontalInset;
  }

  private scrollBottomPadding(): number {
    if (this.isFigmaSearchRoute()) return this.safeAreaBottom + 16;
    return this.hasFixedActionBar() ? this.bookDetailActionBarHeight() + 16 : 112 + this.safeAreaBottom;
  }

  private scrollTopPadding(): number {
    return this.isFigmaSearchRoute() ? 0 : 8;
  }

  private pageSurface(): string {
    if (this.isBookDetailRoute()) return ReaderUiVisualTokens.bookDetailPageSurface;
    // Any other Library route is gated by the generated Figma admission
    // contract. Keep this defensive surface source-led rather than allowing
    // an old generic paper page to become visible on a future routing drift.
    return this.isFigmaSearchRoute()
      ? ReaderUiVisualTokens.searchPageSurface
      : ReaderUiVisualTokens.bookDetailPageSurface;
  }

  private bookDetailActionBarHeight(): number {
    // The Figma outer gradient is a 10px lead-in followed by the 52px action
    // bar. The platform safe area is appended below, never folded into that
    // revision-bound visual height.
    return ReaderUiVisualTokens.bookDetailActionBarOuterHeight + this.safeAreaBottom;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        if (!this.isFigmaSearchRoute()) {
          BackTopBar()
        }
        Scroll() {
          Column() {
            ViewStateRenderer()
          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollable(ScrollDirection.Vertical)
        .scrollBar(BarState.Auto)
        .align(Alignment.Top)
        .padding({
          top: this.scrollTopPadding(),
          left: this.contentInsetLeft(),
          right: this.contentInsetRight(),
          bottom: this.scrollBottomPadding(),
        })
        .backgroundColor(this.pageSurface())
        this.renderBottomActionBar()
      }
      .width('100%')
      .height('100%')
      .padding({ top: this.safeAreaTop })
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.START, SafeAreaEdge.END])
      .zIndex(ZIndexTokens.content)

      OverlayHost()
        .zIndex(ZIndexTokens.dialog)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.pageSurface())
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }

  @Builder renderBottomActionBar() {
    if ((this.routeId === 'book-detail' || this.routeId === 'book-detail-toc-preview') && this.currentBook !== null) {
      Column() {
        Row({ space: ReaderUiVisualTokens.bookDetailActionBarButtonGap }) {
          BookDetailActionBarButton({ label: '继续阅读' })
            .layoutWeight(1)
            .onClick(() => this.continueReading())
          BookDetailActionBarButton({ label: '移除书架', variant: 'danger' })
            .layoutWeight(1)
            .onClick(() => ReaderUiStore.dispatch({ type: 'book-action', bookAction: 'delete' }))
        }
        .width('100%')
        .height(ReaderUiVisualTokens.bookDetailActionBarHeight)
        .padding({ top: ReaderUiVisualTokens.bookDetailActionBarContentTopInset })
      }
      .width('100%')
      .height(this.bookDetailActionBarHeight())
      .padding({
        left: this.contentInsetLeft(),
        right: this.contentInsetRight(),
        top: ReaderUiVisualTokens.bookDetailActionBarTopInset,
        bottom: this.safeAreaBottom,
      })
      .linearGradient({
        angle: 180,
        colors: [
          [ReaderUiVisualTokens.bookDetailActionBarGradientTransparent, 0],
          [ReaderUiVisualTokens.bookDetailActionBarGradientTranslucent, 42],
          [ReaderUiVisualTokens.bookDetailActionBarGradientOpaque, 100]
        ]
      })
      .zIndex(ZIndexTokens.mainNav)
    }
  }
}
