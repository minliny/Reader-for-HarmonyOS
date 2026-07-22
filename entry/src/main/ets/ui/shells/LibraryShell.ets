// LibraryShell — shell for library/secondary pages (book-detail, search, rss-detail, …).
// Slots: topArea (BackTopBar) · content (ViewStateRenderer) · overlayHost · stateHost.
//
// Immersive: outermost Stack expands paper behind the system bars; the content
// Column expands into the status-bar region and pads with the real device inset
// (safeAreaTop) so BackTopBar clears the status bar, and the scroll body pads its
// bottom with safeAreaBottom so the last row clears the navigation bar.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { TokenAdapter } from '../adapters/TokenAdapter';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SpacingTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { BackTopBar } from '../components/SharedComponents';
import { ViewStateRenderer } from '../components/ViewStateRenderer';
import { OverlayHost } from '../slots/OverlayHost';
import { StateHost } from '../slots/StateHost';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail } from '../store/ReaderUiState';
import { ReaderTypography } from '../tokens/ReaderTypography';

@Component
struct LibraryFixedActionButton {
  @Prop label: string = '操作';
  @Prop variant: string = 'primary';

  private fillColor(): string {
    if (this.variant === 'dangerSoft') {
      return DemoAliasTokens.surface;
    }
    if (this.variant === 'danger') {
      return ColorTokens.accent;
    }
    if (this.variant === 'secondary') {
      return DemoAliasTokens.surface;
    }
    return ColorTokens.primary;
  }

  private textColor(): string {
    if (this.variant === 'dangerSoft') {
      return ColorTokens.accent;
    }
    return this.variant === 'secondary' ? ColorTokens.primaryDark : DemoAliasTokens.onPrimary;
  }

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(this.textColor())
      .width('100%')
      .height(42)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.fillColor())
      .border({ width: this.variant === 'secondary' || this.variant === 'dangerSoft' ? 1 : 0, color: ColorTokens.border })
      .textAlign(TextAlign.Center)
  }
}

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
      .fontFamily(ReaderTypography.sansFamily())
      .fontSize(13)
      .fontWeight(900)
      .fontColor(this.isDanger() ? ColorTokens.accent : DemoAliasTokens.onPrimary)
      .width('100%')
      .height(46)
      .border({ width: 1, color: this.isDanger() ? ColorTokens.border : ColorTokens.primaryDark })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.isDanger() ? DemoAliasTokens.surface : ColorTokens.primaryDark)
      .textAlign(TextAlign.Center)
  }
}

@Component
export struct LibraryShell {
  static readonly SLOT_NAMES: string[] = ['topArea', 'content', 'overlayHost', 'stateHost'];
  @StorageProp('reader.displayedRouteId') routeId: string = 'book-detail';
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  private continueReading(): void {
    if (this.currentBook === null) return;
    ReaderUiStore.dispatchContinueReading(this.currentBook.bookId, this.currentBook.sourceId ?? '');
  }

  private hasFixedActionBar(): boolean {
    return this.routeId === 'group-management'
      || this.routeId === 'book-detail'
      || this.routeId === 'book-detail-toc-preview';
  }

  private isBookDetailRoute(): boolean {
    return this.routeId === 'book-detail' || this.routeId === 'book-detail-toc-preview';
  }

  // Figma Book Detail masters: x=19, width=350 on 390 Phone and width=720 on
  // 760 Tablet. The explicit 19/21 split preserves those attached-master
  // measurements without changing the shared LibraryShell spacing of other routes.
  private contentInsetLeft(): number {
    return SpacingTokens.safeAreaHorizontal + 3;
  }

  private contentInsetRight(): number {
    return SpacingTokens.safeAreaHorizontal + (this.isBookDetailRoute() ? 5 : 3);
  }

  private scrollBottomPadding(): number {
    return this.hasFixedActionBar() ? 18 : 112 + this.safeAreaBottom;
  }

  private actionBarHeight(): number {
    return 62 + this.safeAreaBottom;
  }

  private bookDetailActionBarHeight(): number {
    // The safe-area strip is host-owned; the visible Figma ActionBar remains
    // exactly 52px, with two 46px controls and 3px vertical insets.
    return 52 + this.safeAreaBottom;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        BackTopBar()
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
          top: 8,
          left: this.contentInsetLeft(),
          right: this.contentInsetRight(),
          bottom: this.scrollBottomPadding(),
        })
        .backgroundColor(ColorTokens.paper)
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
      StateHost()
        .zIndex(ZIndexTokens.mainNav)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(ColorTokens.paper)
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }

  @Builder renderBottomActionBar() {
    if (this.routeId === 'group-management') {
      Row() {
        LibraryFixedActionButton({ label: '完成' })
          .layoutWeight(1)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      }
      .width('100%')
      .height(this.actionBarHeight())
      .padding({ left: this.contentInsetLeft(), right: this.contentInsetRight(), top: 10, bottom: this.safeAreaBottom + 10 })
      .linearGradient({
        angle: 180,
        colors: [
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0), 0],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0.96), 0.42],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 1.0), 1.0]
        ]
      })
      .zIndex(ZIndexTokens.mainNav)
    } else if (this.routeId === 'book-detail' || this.routeId === 'book-detail-toc-preview') {
      Row({ space: 10 }) {
        BookDetailActionBarButton({ label: '继续阅读' })
          .layoutWeight(1)
          .onClick(() => this.continueReading())
        BookDetailActionBarButton({ label: '移除书架', variant: 'danger' })
          .layoutWeight(1)
          .onClick(() => ReaderUiStore.dispatch({ type: 'book-action', bookAction: 'delete' }))
      }
      .width('100%')
      .height(this.bookDetailActionBarHeight())
      .padding({ left: this.contentInsetLeft(), right: this.contentInsetRight(), top: 3, bottom: this.safeAreaBottom + 3 })
      .linearGradient({
        angle: 180,
        colors: [
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0), 0],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 0.96), 0.42],
          [TokenAdapter.colorWithAlpha(ColorTokens.bottomBarBg, 1.0), 1.0]
        ]
      })
      .zIndex(ZIndexTokens.mainNav)
    }
  }
}
