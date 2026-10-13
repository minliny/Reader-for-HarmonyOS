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

  // Retained as the semantic icon selector for SDK probes and accessibility
  // contracts. The builder below uses direct branches for device rendering.
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
    Stack({ alignContent: Alignment.Center }) {
      // Keep the semantic selector as the first layer for shared SDK probes;
      // the explicit resource layer below is the device-safe fallback.
      Image(this.icon(kind)).width(24).height(24);
      // Keep each resource reference in the builder branch.  ArkUI's
      // runtime resource resolver can drop an Image when a Resource returned
      // from a helper is used inside a repeated component, leaving the
      // button background visible but the icon missing on device/VM.
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
