import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderSearchField } from '../common/ReaderSearchField';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerReadableFontScale, readerScaledControlHeight } from '../common/ReaderSurfaceResolvers';

export const READER_DIRECTORY_TOOLBAR_HEIGHT = 50;

/** Shared directory tools. The owner retains query, scrolling and motion state. */
@Component
export struct ReaderDirectoryToolbar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop text: string = '';
  @Prop placeholder: string = '搜索章节名称';
  @Prop ascending: boolean = true;
  @Prop showChapterTools: boolean = true;
  @Prop directoryFocusId: string = '';
  @Prop directoryFocusAllowed: boolean = false;
  @Prop directoryFocusRevision: number = 0;
  @Prop directoryKeyboardOnFocus: boolean = true;
  directoryFocusCurrent: (id: string) => boolean = (_id: string): boolean => true;
  onDirectoryFocusChanged: (id: string, focused: boolean) => void = (_id: string, _focused: boolean): void => {};
  onTextChange: (value: string) => void = (_value: string): void => {};
  onSearch: () => void = (): void => {};
  onTop: () => void = (): void => {};
  onBottom: () => void = (): void => {};
  onToggleSort: () => void = (): void => {};
  private directoryMounted: boolean = false;
  aboutToAppear(): void { this.directoryMounted = true; }
  aboutToDisappear(): void { this.directoryMounted = false; }
  private currentDirectoryInput(id: string): boolean {
    return id.length === 0 || (this.directoryMounted && id === this.directoryFocusId && this.directoryFocusCurrent(id));
  }

  private queryHeight(): number {
    const scale = !Number.isFinite(this.readerWindowMetricsRevision) || this.readerWindowMetricsRevision < 0 ? 1 :
      readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
    return readerScaledControlHeight(44, 24, scale);
  }

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
      .width(44).height(44).backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8)
      .accessibilityText(title).accessibilityRole(AccessibilityRoleType.BUTTON).focusable(true).onClick(action);
  }

  @Builder
  private toolbarBody(focusId: string) {
    Row({ space: 5 }) {
      Row() {
        ReaderSearchField({ variant: 'readerDirectory', mode: 'submit', text: this.text,
          placeholder: this.placeholder, accessibilityLabel: this.placeholder,
          directoryFocusId: focusId, directoryFocusAllowed: this.directoryFocusAllowed,
          directoryFocusRevision: this.directoryFocusRevision,
          directoryKeyboardOnFocus: this.directoryKeyboardOnFocus,
          directoryFocusCurrent: (id: string): boolean => this.currentDirectoryInput(id),
          onDirectoryFocusChanged: (id: string, focused: boolean): void => { if (this.currentDirectoryInput(focusId)) this.onDirectoryFocusChanged(id, focused); },
          onTextChange: (value: string): void => { if (this.currentDirectoryInput(focusId)) this.onTextChange(value); },
          onSubmit: (): void => { if (this.currentDirectoryInput(focusId)) this.onSearch(); } });
      }.layoutWeight(1).height(this.queryHeight());
      this.tool('search', '搜索', (): void => { if (this.currentDirectoryInput(focusId)) this.onSearch(); });
      if (this.showChapterTools) {
        this.tool('top', '到顶部', (): void => { if (this.currentDirectoryInput(focusId)) this.onTop(); });
        this.tool('bottom', '到底部', (): void => { if (this.currentDirectoryInput(focusId)) this.onBottom(); });
        this.tool('sort', '切换排序', (): void => { if (this.currentDirectoryInput(focusId)) this.onToggleSort(); });
      }
    }.width('100%').height(READER_DIRECTORY_TOOLBAR_HEIGHT + this.queryHeight() - 44).padding({ left: 10, right: 10, top: 3, bottom: 3 });
  }
  build() {
    if (this.directoryFocusId.length > 0) {
      ForEach([this.directoryFocusId], (id: string): void => { this.toolbarBody(id); }, (id: string): string => id);
    } else { this.toolbarBody(''); }
  }
}
