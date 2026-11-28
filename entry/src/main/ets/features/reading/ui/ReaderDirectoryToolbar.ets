import { readerPaperActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerReadableFontScale } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { LengthMetrics } from '@kit.ArkUI';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderAccessibilityActions, type ReaderAccessibleAction } from '../../../ui/controls/ReaderAccessibilityActions';
import { MangaDirectoryPressFeedback } from '../../../ui/foundation/MangaDirectoryPressFeedback';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { readerCompactSearchHeight } from '../../../ui/foundation/ReaderSearchControlGeometry';
import { TYPE_SEARCH_DIRECTORY_INPUT } from '../../../ui/foundation/ReaderTypography';
import { MANGA_DIRECTORY_VISUAL as manga, mangaDirectoryColor, mangaDirectoryLineBox } from '../../manga/ui/MangaDirectoryVisual';
import { DIRECTORY_TOOL_GAP, DIRECTORY_TOOL_OUTSET, DIRECTORY_TOOL_SIDE_INSET, DIRECTORY_TOOL_SIZE, DIRECTORY_TOOL_TARGET,
  readerDirectoryToolbarBudget, type ReaderDirectoryToolbarBudget } from '../presentation/ReaderFullDirectoryBudget';

type ReaderDirectoryTool = 'top' | 'bottom' | 'sort';

/** Shared directory tools. The owner retains query, scrolling and motion state. */
@Component
export struct ReaderDirectoryToolbar {
  editingHost: ReaderEditingVisibility | undefined = undefined;
  editingCurrent: (() => boolean) | undefined = undefined;
  @StorageProp('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageProp('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop text: string = '';
  @Prop placeholder: string = '搜索章节名称';
  @Prop ascending: boolean = true;
  @Prop showChapterTools: boolean = true;
  @Prop actionEnabled: boolean = true;
  @Prop variant: 'standard' | 'full-directory' | 'manga-catalog' | 'standalone-catalog' = 'standard';
  @Prop readingPalette: boolean = true;
  @Prop mangaFontScale: number = 1;
  @Prop locateEnabled: boolean = false;
  @Prop availableWidthVp: number = 0;
  @Prop naturalFieldHeightVp: number = 0;
  @Prop naturalInputHeightVp: number = 0;
  @Prop naturalToolbarHeightVp: number = 0;
  @Prop inputMinimumWidthVp: number = 0;
  @Prop directoryFocusId: string = '';
  @Prop directoryFocusAllowed: boolean = false;
  @Prop directoryFocusRevision: number = 0;
  @Prop directoryKeyboardOnFocus: boolean = true;
  directoryFocusCurrent: (id: string) => boolean = (_id: string): boolean => true;
  onDirectoryFocusChanged: (id: string, focused: boolean) => void = (_id: string, _focused: boolean): void => {};
  onDirectoryEditingRequested: (id: string) => void = (_id: string): void => {};
  onDirectoryKeyboardBack: (id: string) => void = (_id: string): void => {};
  onDirectoryKeyboardRestoreSettled: (id: string, requested: boolean) => void = (_id: string, _requested: boolean): void => {};
  onTextChange: (value: string) => void = (_value: string): void => {};
  onSearch: () => void = (): void => {};
  onTop: () => void = (): void => {};
  onBottom: () => void = (): void => {};
  onToggleSort: () => void = (): void => {};
  onLocateCurrent: () => void = (): void => {};
  onOpenCacheManagement: () => void = (): void => {};

  private directoryMounted: boolean = false;
  aboutToAppear(): void { this.directoryMounted = true; }
  aboutToDisappear(): void { this.directoryMounted = false; }
  private currentDirectoryInput(id: string): boolean {
    return this.directoryMounted && (id.length === 0 || (id === this.directoryFocusId && this.directoryFocusCurrent(id)));
  }

  private usesReadingPalette(): boolean {
    return this.readingPalette && (this.variant === 'standard' || this.variant === 'full-directory');
  }
  private controlFieldHeight(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : readerReadableFontScale(readerWindowMetrics().systemFontScale);
    return Math.max(readerCompactSearchHeight(DIRECTORY_TOOL_SIZE, TYPE_SEARCH_DIRECTORY_INPUT.lineHeightFp as number, scale),
      Number.isFinite(this.naturalFieldHeightVp) ? this.naturalFieldHeightVp : 0);
  }
  private controlToolbarHeight(): number {
    return this.variant === 'manga-catalog' ? this.controlFieldHeight() : this.toolbarBudget().height;
  }

  private mangaSortIcon(): Resource {
    if (this.appThemeScheme === 'night') return this.ascending ?
      $r('app.media.manga_directory_sort_ascending_theme_night') : $r('app.media.manga_directory_sort_descending_theme_night');
    return this.ascending ? $r('app.media.manga_directory_sort_ascending') : $r('app.media.manga_directory_sort_descending');
  }

  private toolLabel(kind: ReaderDirectoryTool): string {
    if (this.variant === 'full-directory') {
      if (kind === 'top') return '回到目录顶部';
      if (kind === 'bottom') return '前往目录底部';
      return this.ascending ? '按章节倒序排列' : '按章节正序排列';
    }
    if (kind === 'top') return '到顶部';
    if (kind === 'bottom') return '到底部';
    return '切换排序';
  }

  private directoryAccessibility(kind: ReaderDirectoryTool): ReaderAccessibilityActions {
    const focusId = this.directoryFocusId;
    const actions: ReaderAccessibleAction[] = [];
    if (kind === 'sort' && this.showChapterTools) {
      if (this.locateEnabled) actions.push({
        label: '定位当前章节',
        run: (): void => { if (this.locateEnabled) this.onLocateCurrent(); },
      });
      if (this.variant !== 'manga-catalog') {
        actions.push({ label: '回到目录顶部', run: (): void => this.onTop() });
        actions.push({ label: '前往目录底部', run: (): void => this.onBottom() });
      }
    }
    // Let the screen reader continue into the chapter list after the last tool.
    return new ReaderAccessibilityActions(actions, '',
      (): boolean => this.actionEnabled && focusId === this.directoryFocusId && this.currentDirectoryInput(focusId));
  }

  @Builder
  private tool(kind: ReaderDirectoryTool, action: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.Center }) {
      // Keep exactly one native image, with explicit resource branches. This
      // preserves the device-safe lookup without stacking a second copy.
      if (this.variant === 'manga-catalog') {
        Image(this.mangaSortIcon()).width(16).height(16);
      } else if (kind === 'top') {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_top_theme_night')).width(16).height(16);
        } else {
          Image($r('app.media.reader_directory_top')).width(16).height(16);
        }
      } else if (kind === 'bottom') {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_bottom_theme_night')).width(16).height(16);
        } else {
          Image($r('app.media.reader_directory_bottom')).width(16).height(16);
        }
      } else if (this.ascending) {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_sort_ascending_theme_night')).width(16).height(16);
        } else {
          Image($r('app.media.reader_directory_sort_ascending')).width(16).height(16);
        }
      } else {
        if (this.appThemeScheme === 'night') {
          Image($r('app.media.reader_directory_sort_descending_theme_night')).width(16).height(16);
        } else {
          Image($r('app.media.reader_directory_sort_descending')).width(16).height(16);
        }
      }
      }.width('100%').height('100%')
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }
      .width(DIRECTORY_TOOL_SIZE).height(DIRECTORY_TOOL_SIZE)
      .padding(0)
      .attributeModifier(new ReaderActionAccessibility(this.toolLabel(kind), this.actionEnabled, false, true,
        new ReaderPressFeedback(this.variant === 'manga-catalog' ? mangaDirectoryColor('soft', this.appThemeScheme) :
          readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme), this.appThemeScheme, 8, 8, this.actionEnabled),
        'nativeButton', this.directoryAccessibility(kind)))
      .responseRegion({ x: -DIRECTORY_TOOL_OUTSET, y: -DIRECTORY_TOOL_OUTSET,
        width: DIRECTORY_TOOL_TARGET, height: DIRECTORY_TOOL_TARGET })
      .onClick((): void => { if (this.actionEnabled) action(); });
  }

  private queryStacked(): boolean {
    return this.variant !== 'manga-catalog' && this.toolbarBudget().stacked;
  }

  private toolbarBudget(): ReaderDirectoryToolbarBudget {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : readerReadableFontScale(readerWindowMetrics().systemFontScale);
    const catalog = this.variant === 'standalone-catalog';
    return readerDirectoryToolbarBudget(this.availableWidthVp, this.showChapterTools, this.controlFieldHeight(),
      this.inputMinimumWidthVp > 0 ? this.inputMinimumWidthVp : TYPE_SEARCH_DIRECTORY_INPUT.fontSizeFp * 6 * scale,
      this.naturalToolbarHeightVp, catalog);
  }

  @Builder
  private queryField(inputFocusId: string) {
      Row() {
        ReaderSearchField({ editingHost: this.editingHost,
          editingCurrent: (): boolean => this.currentDirectoryInput(inputFocusId) && this.actionEnabled && (this.editingCurrent?.() ?? true),
          variant: 'readerDirectory', mode: 'live', readingPalette: this.usesReadingPalette(), text: this.text,
          naturalFieldHeightVp: this.controlFieldHeight(), naturalInputHeightVp: this.naturalInputHeightVp,
          placeholder: this.placeholder, accessibilityLabel: this.placeholder,
          clearable: true,
          directoryFocusId: inputFocusId, directoryFocusAllowed: this.directoryFocusAllowed,
          directoryFocusRevision: this.directoryFocusRevision, directoryKeyboardOnFocus: this.directoryKeyboardOnFocus,
          directoryFocusCurrent: (id: string): boolean => this.currentDirectoryInput(id),
          onDirectoryFocusChanged: (id: string, focused: boolean): void => {
            if (this.currentDirectoryInput(inputFocusId)) this.onDirectoryFocusChanged(id, focused);
          },
          onDirectoryEditingRequested: (id: string): void => {
            if (id === inputFocusId && this.currentDirectoryInput(inputFocusId)) this.onDirectoryEditingRequested(id);
          },
          onDirectoryKeyboardBack: (id: string): void => {
            if (id === inputFocusId && this.currentDirectoryInput(inputFocusId)) this.onDirectoryKeyboardBack(id);
          },
          onDirectoryKeyboardRestoreSettled: (id: string, requested: boolean): void => {
            if (this.currentDirectoryInput(inputFocusId)) this.onDirectoryKeyboardRestoreSettled(id, requested);
          },
          onTextChange: (value: string): void => { if (this.currentDirectoryInput(inputFocusId)) this.onTextChange(value); },
          onSubmit: (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onSearch(); } });
      }.flexGrow(this.queryStacked() ? 0 : 1).flexShrink(this.queryStacked() ? 0 : 1)
        .flexBasis(this.queryStacked() ? 'auto' : 0).width(this.queryStacked() ? '100%' : undefined)
        .constraintSize({ minWidth: 0 })
        .height(this.controlFieldHeight()).alignItems(VerticalAlign.Center);
  }

  @Builder
  private catalogTool(sort: boolean, inputFocusId: string) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
        Image(sort ? this.mangaSortIcon() : readerPaperActionIcon('download', this.appThemeScheme))
          .width(16).height(16).objectFit(ImageFit.Contain)
          .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      }.width(DIRECTORY_TOOL_SIZE).height(DIRECTORY_TOOL_SIZE).padding(0)
        .border({ width: 1, color: readerAppColor(sort && !this.ascending ? 'TOK_PRIMARY_BORDER' : 'TOK_LINE', this.appThemeScheme) })
        .attributeModifier(new ReaderActionAccessibility(sort ?
          (this.ascending ? '按章节倒序排列' : '按章节正序排列') : '缓存管理', this.actionEnabled, false, true,
          new ReaderPressFeedback(readerAppColor(sort && !this.ascending ? 'TOK_PRIMARY_SOFT' : 'TOK_CARD_BG', this.appThemeScheme),
            this.appThemeScheme, 18, 18, this.actionEnabled), 'nativeButton'))
        .responseRegion({ x: -DIRECTORY_TOOL_OUTSET, y: -DIRECTORY_TOOL_OUTSET,
          width: DIRECTORY_TOOL_TARGET, height: DIRECTORY_TOOL_TARGET })
        .onClick((): void => {
          if (!this.actionEnabled || !this.currentDirectoryInput(inputFocusId)) return;
          if (sort) this.onToggleSort();
          else this.onOpenCacheManagement();
        });
  }

  @Builder
  private queryTools(inputFocusId: string) {
      if (this.variant === 'standalone-catalog') {
        Row({ space: DIRECTORY_TOOL_GAP }) {
          this.catalogTool(false, inputFocusId);
          this.catalogTool(true, inputFocusId);
        }.width(this.queryStacked() ? '100%' : undefined).height(DIRECTORY_TOOL_SIZE)
          .justifyContent(FlexAlign.End).flexShrink(0);
      } else if (this.variant === 'manga-catalog') {
        this.tool('sort', (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onToggleSort(); });
      } else if (this.showChapterTools) {
        Row({ space: DIRECTORY_TOOL_GAP }) {
          this.tool('top', (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onTop(); });
          this.tool('bottom', (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onBottom(); });
          this.tool('sort', (): void => { if (this.currentDirectoryInput(inputFocusId)) this.onToggleSort(); });
        }.width(this.queryStacked() ? '100%' : undefined).justifyContent(FlexAlign.End)
          .height(DIRECTORY_TOOL_SIZE).flexShrink(0);
      }
  }

  @Builder
  private searchRow(inputFocusId: string = '') {
    // One parent chain for the native field, including width/stacked changes.
    Flex({ direction: this.queryStacked() ? FlexDirection.Column : FlexDirection.Row,
      wrap: FlexWrap.NoWrap, alignItems: ItemAlign.Center, justifyContent: FlexAlign.End,
      space: { main: LengthMetrics.vp(DIRECTORY_TOOL_GAP) } }) {
      this.queryField(inputFocusId);
      this.queryTools(inputFocusId);
    }.width('100%').height(this.controlToolbarHeight())
      .padding({ left: this.usesReadingPalette() ? DIRECTORY_TOOL_SIDE_INSET : 0,
        right: this.usesReadingPalette() ? DIRECTORY_TOOL_SIDE_INSET : 0,
        top: this.queryStacked() ? DIRECTORY_TOOL_OUTSET : 0,
        bottom: this.queryStacked() ? DIRECTORY_TOOL_OUTSET : 0 });
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
