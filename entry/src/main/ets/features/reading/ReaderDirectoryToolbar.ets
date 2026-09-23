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

  private icon(kind: string): Resource {
    if (kind === 'search') return this.appThemeScheme === 'night' ?
      $r('app.media.reader_directory_search_theme_night') : $r('app.media.reader_directory_search');
    if (kind === 'top') return this.appThemeScheme === 'night' ?
      $r('app.media.reader_directory_top_theme_night') : $r('app.media.reader_directory_top');
    if (kind === 'bottom') return this.appThemeScheme === 'night' ?
      $r('app.media.reader_directory_bottom_theme_night') : $r('app.media.reader_directory_bottom');
    if (this.ascending) return this.appThemeScheme === 'night' ?
      $r('app.media.reader_directory_sort_ascending_theme_night') : $r('app.media.reader_directory_sort_ascending');
    return this.appThemeScheme === 'night' ?
      $r('app.media.reader_directory_sort_descending_theme_night') : $r('app.media.reader_directory_sort_descending');
  }

  @Builder
  private tool(kind: string, title: string, action: () => void) {
    Stack() { Image(this.icon(kind)).width(16).height(16); }
      .width(32).height(32).backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8)
      .accessibilityText(title).onClick(action);
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
