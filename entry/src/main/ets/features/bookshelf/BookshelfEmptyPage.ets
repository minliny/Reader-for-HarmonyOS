import { readerAppColor } from '../common/ReaderThemeRegistry';
/**
 * Empty shelf, rebuilt 2026-08-06 against live Figma node `State/BookshelfEmpty`
 * (`286:31`, icon `Icon/Bookshelf` `271:96`). The 352×350 card replaces the old
 * `574:198` reference geometry (which had swapped action roles, blue icon frame,
 * pills, and wrong card size). Page chrome (top bar, section header, bottom
 * navigation) is unchanged. Empty-state text uses ReaderNotoSansSC per Figma.
 */
import { MainTabShell } from '../shell/MainTabShell';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  TOK_CONTENT_MAX_W_PHONE,
  TOK_INK,
  TOK_SCREEN_INSET,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

import { registerReaderShelfFonts } from '../common/ReaderFonts';
import { BookshelfEmptyCard } from './BookshelfEmptyCard';
import { BookshelfMoreMenu } from './BookshelfMoreMenu';

@Component
export struct BookshelfEmptyPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop reduceMotion: boolean = false;
  onImportRequested: () => void = (): void => {};
  onSearchRequested: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onSettingsRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  onBatchManageRequested: () => void = (): void => {};
  // Keep the menu action on the same semantic settings boundary as the
  // populated shelf; the host decides the concrete route.
  onBookshelfSettingsRequested: () => void = (): void => {};
  @State private viewportWidth: number = 0;
  @State private moreMenuVisible: boolean = false;
  @State private moreAnchorRight: number = 0;
  @State private moreAnchorBottom: number = 0;
  @State private overlayOriginX: number = 0;
  @State private overlayOriginY: number = 0;

  aboutToAppear(): void {
    registerReaderShelfFonts(this.getUIContext().getFont());
  }

  build() {
    MainTabShell({
      activeTab: 'bookshelf',
      // Tablet empty has no Figma variant (phone-reuse), so keep the bottom
      // nav here; BookshelfPage's tablet rail branch does not apply.
      showBottomNav: true,
      onMainTab: (key: string): void => this.onMainTab(key),
    }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Column() {
          this.topBar();
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
            .padding({ top: TOK_SPACE_XS, bottom: 116 });
          }
          .layoutWeight(1)
          .width('100%')
          .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
          .scrollBar(BarState.Off);
        }
        .width('100%')
        .height('100%');

        if (this.moreMenuVisible) {
          BookshelfMoreMenu({
            anchorRight: this.moreAnchorRight - this.overlayOriginX,
            anchorBottom: this.moreAnchorBottom - this.overlayOriginY,
            reduceMotion: this.reduceMotion,
            canCheckUpdates: false,
            onBatchManage: (): void => {
              this.moreMenuVisible = false;
              this.onBatchManageRequested();
            },
            onLocalImport: (): void => {
              this.moreMenuVisible = false;
              this.onImportRequested();
            },
            onBookshelfSettings: (): void => {
              this.moreMenuVisible = false;
              this.onBookshelfSettingsRequested();
            },
            onDismiss: (): void => {
              this.moreMenuVisible = false;
            },
          });
        }
      }
      .width('100%')
      .height('100%')
      .clip(true)
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
        this.overlayOriginX = Number(newValue.globalPosition.x);
        this.overlayOriginY = Number(newValue.globalPosition.y);
      });
    }
  }

  @Builder
  private topBar() {
    Row({ space: 18 }) {
      Image($r('app.media.bookshelf_title'))
        .width(56)
        .height(28)
        .objectFit(ImageFit.Contain)
        .layoutWeight(1);

      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_search_theme_night') : $r('app.media.bookshelf_search'))).width(24).height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onSearchRequested());

      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_theme_night') : $r('app.media.bookshelf_more'))).width(24).height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .accessibilityText('更多')
      .onClick((): void => {
        this.moreMenuVisible = true;
      })
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        this.moreAnchorRight = Number(newValue.globalPosition.x) + Number(newValue.width);
        this.moreAnchorBottom = Number(newValue.globalPosition.y) + Number(newValue.height);
      });
    }
    .width('100%')
    .height(58)
    .padding({ left: this.topBarLeftInset(), right: this.topBarRightInset(), top: 6 })
    .alignItems(VerticalAlign.Center);
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

  private onMainTab(key: string): void {
    if (key === 'discover') {
      this.onDiscoverRequested();
    } else if (key === 'rss') {
      this.onRssRequested();
    } else if (key === 'settings') {
      this.onSettingsRequested();
    }
    // 'bookshelf' is this page; MainTabBar suppresses the current tab.
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

  private topBarLeftInset(): number {
    return Math.max(20, readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()));
  }

  private topBarRightInset(): number {
    return Math.max(20, readerInteractiveSafeRight(ReaderWindowCoordinator.metrics()));
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
