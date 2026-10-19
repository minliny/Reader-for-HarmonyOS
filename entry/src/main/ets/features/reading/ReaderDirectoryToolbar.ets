import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderSearchField } from '../common/ReaderSearchField';

/** Shared directory tools. The owner retains query, scrolling and motion state. */
@Component
export struct ReaderDirectoryToolbar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop text: string = '';
  @Prop placeholder: string = '搜索章节名称';
  @Prop ascending: boolean = true;
  @Prop showChapterTools: boolean = true;
  onTextChange: (value: string) => void = (_value: string): void => {};
  onSearch: () => void = (): void => {};
  onTop: () => void = (): void => {};
  onBottom: () => void = (): void => {};
  onToggleSort: () => void = (): void => {};

  @Builder
  private tool(kind: string, title: string, action: () => void) {
    Stack({ alignContent: Alignment.Center }) {
      // Keep exactly one native image, with explicit resource branches. This
      // preserves the device-safe lookup without stacking a second copy.
      if (kind === 'search') {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_search_theme_night')).width(24).height(24);
        } else {
          Image($r('app.media.reader_directory_search')).width(24).height(24);
        }
      } else if (kind === 'top') {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_top_theme_night')).width(24).height(24);
        } else {
          Image($r('app.media.reader_directory_top')).width(24).height(24);
        }
      } else if (kind === 'bottom') {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_bottom_theme_night')).width(24).height(24);
        } else {
          Image($r('app.media.reader_directory_bottom')).width(24).height(24);
        }
      } else if (this.ascending) {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_sort_ascending_theme_night')).width(24).height(24);
        } else {
          Image($r('app.media.reader_directory_sort_ascending')).width(24).height(24);
        }
      } else {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_sort_descending_theme_night')).width(24).height(24);
        } else {
          Image($r('app.media.reader_directory_sort_descending')).width(24).height(24);
        }
      }
    }
      .width(32).height(32).backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8)
      .accessibilityText(title).accessibilityRole(AccessibilityRoleType.BUTTON).focusable(true).onClick(action);
  }

  build() {
    Row({ space: 5 }) {
      Row() {
        ReaderSearchField({ variant: 'readerDirectory', mode: 'submit', text: this.text,
          placeholder: this.placeholder, accessibilityLabel: this.placeholder,
          onTextChange: (value: string): void => this.onTextChange(value),
          onSubmit: (): void => this.onSearch() });
      }.layoutWeight(1).height(32);
      this.tool('search', '搜索', (): void => this.onSearch());
      if (this.showChapterTools) {
        this.tool('top', '到顶部', (): void => this.onTop());
        this.tool('bottom', '到底部', (): void => this.onBottom());
        this.tool('sort', '切换排序', (): void => this.onToggleSort());
      }
    }.width('100%').height(50).padding({ left: 10, right: 10, top: 9 });
  }
}
