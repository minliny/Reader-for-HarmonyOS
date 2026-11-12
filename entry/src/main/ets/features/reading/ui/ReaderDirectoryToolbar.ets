import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { LengthMetrics } from '@kit.ArkUI';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TOK_SPACE_CONTROL_INLINE } from '../../../ui/foundation/ReaderTokens';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { MangaDirectoryPressFeedback } from '../../../ui/foundation/MangaDirectoryPressFeedback';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { MANGA_DIRECTORY_VISUAL as manga, mangaDirectoryColor, mangaDirectoryLineBox } from '../../manga/ui/MangaDirectoryVisual';

export const READER_DIRECTORY_TOOLBAR_HEIGHT = 50;
type ReaderDirectoryTool = 'search' | 'top' | 'bottom' | 'sort';

/** Shared directory tools. The owner retains query, scrolling and motion state. */
@Component
export struct ReaderDirectoryToolbar {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop text: string = '';
  @Prop placeholder: string = '搜索章节名称';
  @Prop ascending: boolean = true;
  @Prop showChapterTools: boolean = true;
  @Prop variant: 'standard' | 'full-directory' | 'manga-catalog' = 'standard';
  @Prop mangaFontScale: number = 1;
  @Prop locateEnabled: boolean = false;
  @Prop availableWidthVp: number = 0;
  @Prop naturalFieldHeightVp: number = 0;
  @Prop naturalInputHeightVp: number = 0;
  @Prop naturalToolbarHeightVp: number = 0;
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
  onLocateCurrent: () => void = (): void => {};

  private directoryMounted: boolean = false;
  aboutToAppear(): void { this.directoryMounted = true; }
  aboutToDisappear(): void { this.directoryMounted = false; }
  private currentDirectoryInput(id: string): boolean {
    return id.length === 0 || (this.directoryMounted && id === this.directoryFocusId && this.directoryFocusCurrent(id));
  }

  private iconSize(): number { return this.variant === 'standard' ? 24 : 16; }
  private controlFieldHeight(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : readerReadableFontScale(readerWindowMetrics().systemFontScale);
    return Math.max(readerScaledControlHeight(44, 24, scale),
      Number.isFinite(this.naturalFieldHeightVp) ? this.naturalFieldHeightVp : 0);
  }
  private controlToolbarHeight(): number {
    return this.variant === 'standard' && Number.isFinite(this.naturalToolbarHeightVp) ?
      Math.max(this.controlFieldHeight() + 6, this.naturalToolbarHeightVp) :
      this.variant === 'manga-catalog' ? 44 : Math.max(READER_DIRECTORY_TOOLBAR_HEIGHT, this.controlFieldHeight() + 6);
  }

  private mangaSortIcon(): Resource {
    if (this.appThemeScheme === 'night') return this.ascending ?
      $r('app.media.manga_directory_sort_ascending_theme_night') : $r('app.media.manga_directory_sort_descending_theme_night');
    return this.ascending ? $r('app.media.manga_directory_sort_ascending') : $r('app.media.manga_directory_sort_descending');
  }

  private toolLabel(kind: ReaderDirectoryTool): string {
    if (this.variant === 'full-directory') {
      if (kind === 'search') return this.showChapterTools ? '搜索章节' : '搜索书签内容';
      if (kind === 'top') return '回到目录顶部';
      if (kind === 'bottom') return '前往目录底部';
      return this.ascending ? '按章节倒序排列' : '按章节正序排列';
    }
    if (kind === 'search') return '搜索';
    if (kind === 'top') return '到顶部';
    if (kind === 'bottom') return '到底部';
    return '切换排序';
  }

  @Builder
  private tool(kind: ReaderDirectoryTool, action: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.Center }) {
      // Keep exactly one native image, with explicit resource branches. This
      // preserves the device-safe lookup without stacking a second copy.
      if (this.variant === 'manga-catalog') {
        Image(this.mangaSortIcon()).width(this.iconSize()).height(this.iconSize());
      } else if (kind === 'search') {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_search_theme_night')).width(this.iconSize()).height(this.iconSize());
        } else {
          Image($r('app.media.reader_directory_search')).width(this.iconSize()).height(this.iconSize());
        }
      } else if (kind === 'top') {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_top_theme_night')).width(this.iconSize()).height(this.iconSize());
        } else {
          Image($r('app.media.reader_directory_top')).width(this.iconSize()).height(this.iconSize());
        }
      } else if (kind === 'bottom') {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_bottom_theme_night')).width(this.iconSize()).height(this.iconSize());
        } else {
          Image($r('app.media.reader_directory_bottom')).width(this.iconSize()).height(this.iconSize());
        }
      } else if (this.ascending) {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_sort_ascending_theme_night')).width(this.iconSize()).height(this.iconSize());
        } else {
          Image($r('app.media.reader_directory_sort_ascending')).width(this.iconSize()).height(this.iconSize());
        }
      } else {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_sort_descending_theme_night')).width(this.iconSize()).height(this.iconSize());
        } else {
          Image($r('app.media.reader_directory_sort_descending')).width(this.iconSize()).height(this.iconSize());
        }
      }
      }.width(this.variant === 'standard' ? 44 : 32).height(this.variant === 'standard' ? this.controlFieldHeight() : 32)
        .backgroundColor(this.variant === 'manga-catalog' ? mangaDirectoryColor('soft', this.appThemeScheme) :
          readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8)
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }
      .width(44).height(this.controlFieldHeight())
      .padding(0)
      .backgroundColor(Color.Transparent).borderRadius(8)
      .attributeModifier(new ReaderActionAccessibility(this.toolLabel(kind), true, false, true,
        new MangaDirectoryPressFeedback(true, this.variant === 'manga-catalog', this.appThemeScheme, 'nativeButton'), 'nativeButton'))
      .responseRegion({ x: 0, y: 0, width: 44, height: this.controlFieldHeight() })
      .onClick(action);
  }

  private queryStacked(): boolean {
    const count = this.showChapterTools ? 4 : 1;
    return this.variant !== 'manga-catalog' && this.availableWidthVp > 0 &&
      this.availableWidthVp - TOK_SPACE_CONTROL_INLINE * 2 - count * 49 < 44;
  }

  @Builder
  private queryField(inputFocusId: string) {
      Row() {
        ReaderSearchField({ variant: 'readerDirectory', mode: this.variant === 'manga-catalog' ? 'live' : 'submit', text: this.text,
          naturalFieldHeightVp: this.variant === 'standard' ? this.naturalFieldHeightVp : 0,
          naturalInputHeightVp: this.variant === 'standard' ? this.naturalInputHeightVp : 0,
          placeholder: this.placeholder, accessibilityLabel: this.placeholder,
          clearable: this.variant === 'manga-catalog',
          directoryFocusId: inputFocusId, directoryFocusAllowed: this.directoryFocusAllowed,
          directoryFocusRevision: this.directoryFocusRevision, directoryKeyboardOnFocus: this.directoryKeyboardOnFocus,
          directoryFocusCurrent: (id: string): boolean => this.currentDirectoryInput(id),
          onDirectoryFocusChanged: (id: string, focused: boolean): void => {
            if (this.currentDirectoryInput(inputFocusId)) this.onDirectoryFocusChanged(id, focused);
          },
          onTextChange: (value: string): void => { if (this.currentDirectoryInput(inputFocusId)) this.onTextChange(value); },
          onSubmit: (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onSearch(); } });
      }.layoutWeight(1).height(this.controlFieldHeight()).alignItems(VerticalAlign.Center);
  }

  @Builder
  private queryTools(inputFocusId: string) {
      if (this.variant !== 'manga-catalog') {
        this.tool('search', (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onSearch(); });
        if (this.showChapterTools) {
          this.tool('top', (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onTop(); });
          this.tool('bottom', (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onBottom(); });
        }
      }
      if (this.variant === 'manga-catalog' || this.showChapterTools) {
        this.tool('sort', (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onToggleSort(); });
      }
  }

  @Builder
  private searchRow(inputFocusId: string = '') {
    if (this.queryStacked()) {
      Column({ space: 0 }) {
        Row() { this.queryField(inputFocusId); }.width('100%').height(this.controlFieldHeight() + 6)
          .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE, top: 3, bottom: 3 });
        Row({ space: 5 }) { this.queryTools(inputFocusId); }.width('100%').height(50)
          .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE, top: 3, bottom: 3 });
      }.width('100%').height(this.controlFieldHeight() + 56);
    } else {
      Row({ space: 5 }) { this.queryField(inputFocusId); this.queryTools(inputFocusId); }
        .width('100%').height(this.controlToolbarHeight())
        .padding(this.variant === 'manga-catalog' ? { left: 0, right: 0 } :
          { left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE, top: 3, bottom: 3 });
    }
  }

  @Builder
  private locateTool() {
    Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween,
      alignItems: ItemAlign.Center, space: { main: LengthMetrics.vp(manga.toolsGap), cross: LengthMetrics.vp(manga.toolsGap) } }) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: manga.toolGap }) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.manga_sheet_locate_theme_night') :
            $r('app.media.manga_sheet_locate')).width(manga.toolIcon).height(manga.toolIcon);
          Text('定位当前条目').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400)
            .fontSize(manga.toolFontSize).lineHeight(manga.toolLineHeight).halfLeading(true)
            .minFontScale(Math.min(1, this.mangaFontScale)).maxFontScale(Math.max(1, this.mangaFontScale))
            .fontColor(mangaDirectoryColor('accent', this.appThemeScheme));
        }.accessibilityLevel('no-hide-descendants');
      }.padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .constraintSize({ minWidth: 44, minHeight: Math.max(44, mangaDirectoryLineBox(manga.toolHeight, manga.toolLineHeight, manga.toolPaddingY * 2, this.mangaFontScale)) })
        .opacity(this.locateEnabled ? 1 : manga.disabledOpacity)
        .attributeModifier(new ReaderActionAccessibility('定位当前条目', this.locateEnabled, false, true,
          new MangaDirectoryPressFeedback(this.locateEnabled, true, this.appThemeScheme, 'nativeButton'), 'nativeButton'))
        .onClick((): void => { if (this.locateEnabled) this.onLocateCurrent(); });
    }.width('100%').margin({ top: manga.toolsTop, bottom: manga.toolsBottom });
  }

  build() {
    if (this.variant === 'manga-catalog') {
      Column() {
        this.searchRow();
        this.locateTool();
      }.width('100%');
    } else {
      if (this.directoryFocusId.length > 0) {
        ForEach([this.directoryFocusId], (id: string): void => { this.searchRow(id); }, (id: string): string => id);
      } else { this.searchRow(); }
    }
  }
}
