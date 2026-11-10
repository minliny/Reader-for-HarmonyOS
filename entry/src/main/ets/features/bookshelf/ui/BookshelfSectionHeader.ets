import { readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { TYPE_APP_SECTION_LABEL } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TOK_SPACE_XS } from '../../../ui/foundation/ReaderTokens';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';

const SHELF_SECTION_ACTION_SIZE = 34;

/** The font-scaled shelf section header shared by the populated list and the empty
 * state. The empty state omits unavailable actions; the
 * populated shelf owns the view-mode and filter actions. */
@Component
export struct BookshelfSectionHeader {
  @StorageLink('readerWindowMetricsRevision') private windowRevision: number = 0;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop contentWidth: number = 0;
  @Prop titleOpacity: number = 1;
  @Prop actionsEnabled: boolean = true;
  @Prop actionsOpacity: number = 1;
  @Prop viewMode: 'cover' | 'list' = 'cover';
  @Prop filterExpanded: boolean = false;
  @Prop hasActiveFilters: boolean = false;
  onCover: () => void = (): void => {};
  onList: () => void = (): void => {};
  onFilter: () => void = (): void => {};

  build() {
    Row() {
      Text('我的书架')
        .layoutWeight(1)
        .fontFamily(TYPE_APP_SECTION_LABEL.fontFamily)
        .fontWeight(TYPE_APP_SECTION_LABEL.fontWeight)
        .fontSize(TYPE_APP_SECTION_LABEL.fontSizeFp)
        .lineHeight(`${TYPE_APP_SECTION_LABEL.lineHeightFp}fp`)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .opacity(this.titleOpacity);

      if (this.actionsEnabled) {
      Row({ space: TOK_SPACE_XS }) {
        this.sectionAction('bookshelf_grid');
        this.sectionAction('bookshelf_list');
        this.sectionAction('bookshelf_filter');
      }
      .height(SHELF_SECTION_ACTION_SIZE)
      .opacity(this.actionsOpacity);
      }
    }
    .width(this.contentWidth)
    .constraintSize({ minHeight: readerScaledControlHeight(38, TYPE_APP_SECTION_LABEL.lineHeightFp as number,
      this.windowRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale) })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private sectionAction(assetName: string) {
    ReaderIconButton({ specId: 'shelf-section', icon: this.sectionActionAsset(assetName),
      accessibilityLabel: this.actionLabel(assetName), actionEnabled: this.actionsEnabled, scheme: this.appThemeScheme,
      selectionState: !this.isActive(assetName) ? 'none' : assetName === 'bookshelf_filter' ? 'active' : 'selected',
      onTap: (): void => this.activate(assetName) });
  }

  private isActive(assetName: string): boolean {
    if (assetName === 'bookshelf_grid') return this.viewMode === 'cover';
    if (assetName === 'bookshelf_list') return this.viewMode === 'list';
    if (assetName === 'bookshelf_filter') return this.filterExpanded || this.hasActiveFilters;
    return false;
  }

  private sectionActionAsset(assetName: string): Resource {
    if (assetName === 'bookshelf_grid') {
      return this.actionsEnabled && this.viewMode === 'cover'
        ? (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_grid_theme_night') : $r('app.media.bookshelf_grid'))
        : (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_grid_outline_theme_night') : $r('app.media.bookshelf_grid_outline'));
    }
    if (assetName === 'bookshelf_list') {
      return this.actionsEnabled && this.viewMode === 'list'
        ? (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_list_active_theme_night') : $r('app.media.bookshelf_list_active'))
        : (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_list_theme_night') : $r('app.media.bookshelf_list'));
    }
    if (this.actionsEnabled && (this.filterExpanded || this.hasActiveFilters)) {
      return this.appThemeScheme === 'night' ? $r('app.media.bookshelf_filter_active_theme_night') : $r('app.media.bookshelf_filter_active');
    }
    return this.appThemeScheme === 'night' ? $r('app.media.bookshelf_filter_theme_night') : $r('app.media.bookshelf_filter');
  }

  private actionLabel(assetName: string): string {
    if (assetName === 'bookshelf_grid') {
      return '封面模式';
    }
    if (assetName === 'bookshelf_list') {
      return '列表模式';
    }
    return `${this.filterExpanded ? '收起筛选' : '展开筛选'}${this.hasActiveFilters ? '，已有筛选条件' : ''}`;
  }

  private activate(assetName: string): void {
    if (!this.actionsEnabled) return;
    if (assetName === 'bookshelf_grid') this.onCover();
    else if (assetName === 'bookshelf_list') this.onList();
    else if (assetName === 'bookshelf_filter') this.onFilter();
  }
}
