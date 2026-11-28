import { ReaderAccessibilityActions, type ReaderAccessibleAction } from '../../../ui/controls/ReaderAccessibilityActions';
import { ReaderPaperMaterial } from '../../../ui/foundation/ReaderPaperMaterial';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import { readerPressOpacity, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { TYPE_READER_CONTROL_CHAPTER_TITLE, TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL,
  TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL } from '../../../ui/foundation/ReaderTypography';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { READER_CONTROL_PROGRESS_MAX, READER_CONTROL_PROGRESS_MIN, READER_CONTROL_PROGRESS_STEP } from './ReaderControlGeometry';

/** The existing Home card surface. The panel provides measured extents, owns
 * press/preview state, and binds actions to the current control session. */
@Component
export struct ReaderControlChapterProgressCard {
  @Prop appScheme: string = 'day';
  @Prop chapterTitle: string = '';
  @Prop titleHeight: number = 34;
  @Prop titleLaneHeight: number = 36;
  @Prop cardHeight: number = 0;
  @Prop totalChapters: number = 0;
  @Prop readableChapterPosition: number = -1;
  @Prop previousEnabled: boolean = false;
  @Prop nextEnabled: boolean = false;
  @Prop menuOccludesActions: boolean = false;
  @Prop actionScope: string = '';
  @Prop bookmarkLaneHeight: number = 44;
  @Prop bookmarkWidth: number = 86;
  @Prop bookmarkHeight: number = 28;
  @Prop pageBookmarkStatus: 'unknown' | 'empty' | 'bookmarked' = 'unknown';
  @Prop pageBookmarkEnabled: boolean = false;
  @Prop bookmarkInputEnabled: boolean = false;
  // Observe the panel's own animation targets, including its shared press state.
  @Link quickOrModulePress: string;
  @Link pageBookmarkFill: number;
  @Link pageBookmarkTuck: number;
  @Prop sessionFontScale: number = 1;
  @Prop reduceMotion: boolean = false;
  @Prop progressPercent: number = 0;
  @Prop progressLabelWidth: number = 26.23;
  @Prop progressLaneHeight: number = 36;
  @Prop progressInputRevision: number = 0;
  chapterActionsCurrent: (scope: string) => boolean = (_scope: string): boolean => false;
  onPreviousChapter: () => void = (): void => {};
  onNextChapter: () => void = (): void => {};
  onBookmarkPress: (event: TouchEvent) => void = (_event: TouchEvent): void => {};
  // Rebind the panel's guard when its presented action scope changes.
  bookmarkClickHandler: (scope: string) => () => void = (_scope: string): (() => void) => (): void => {};
  progressChangeHandler: (revision: number) => (value: number, mode: SliderChangeMode) => void =
    (_revision: number): ((value: number, mode: SliderChangeMode) => void) =>
    (_value: number, _mode: SliderChangeMode): void => {};

  build() {
    Column({ space: 0 }) {
      this.chapterRow();
      this.chapterBookmarkRow();
      this.progressRow();
    }
    .width('100%')
    .id('reader-control-chapter-progress-card')
    .height(this.cardHeight)
    .alignItems(HorizontalAlign.Start)
    .attributeModifier(new ReaderPanelFrame('reader-card', this.appScheme));
  }

  @Builder
  private chapterRow() {
    Row({ space: 8 }) {
      ReaderIconButton({ specId: 'reader-chapter-step', scheme: this.appScheme,
        icon: $r(this.appScheme === 'night' ? 'app.media.rc_chevron_left_theme_night' : 'app.media.rc_chevron_left'),
        accessibilityLabel: '上一章', actionEnabled: this.previousEnabled,
        actionScope: this.actionScope,
        onTap: this.onPreviousChapter,
      });

      // ChapterTitle Inter Bold 13 居中 (layoutWeight 吃剩余宽)。
      Text(this.chapterTitle)
        .layoutWeight(1)
        .height(this.titleHeight)
        .fontFamily(TYPE_READER_CONTROL_CHAPTER_TITLE.fontFamily)
        .fontWeight(TYPE_READER_CONTROL_CHAPTER_TITLE.fontWeight)
        .fontSize(TYPE_READER_CONTROL_CHAPTER_TITLE.fontSizeFp)
        .lineHeight(TYPE_READER_CONTROL_CHAPTER_TITLE.lineHeightFp)
        .letterSpacing(TYPE_READER_CONTROL_CHAPTER_TITLE.letterSpacingFp)
        .fontColor(readerAppColor('TOK_READ_INK', this.appScheme))
        .attributeModifier(this.chapterAccessibility())
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      ReaderIconButton({ specId: 'reader-chapter-step', scheme: this.appScheme,
        icon: $r(this.appScheme === 'night' ? 'app.media.rc_chevron_right_theme_night' : 'app.media.rc_chevron_right'),
        focusId: this.nextChapterFocusId(), accessibilityLabel: '下一章', actionEnabled: this.nextEnabled,
        actionScope: this.actionScope,
        onTap: this.onNextChapter,
      });
    }
    .width('100%')
    .id('reader-control-chapter-title-lane')
    .height(this.titleLaneHeight)
    .padding({ left: 11, right: 11 })
    .alignItems(VerticalAlign.Center)
    .accessibilityLevel(this.menuOccludesActions ? 'no-hide-descendants' : 'auto');
  }

  private nextChapterFocusId(): string { return `reader-control-next-chapter:${this.actionScope}`; }

  private chapterAccessibility(): ReaderAccessibilityActions {
    const scope = this.actionScope;
    const actions: ReaderAccessibleAction[] = [];
    if (this.previousEnabled) actions.push({ label: '上一章', run: (): void => this.onPreviousChapter() });
    if (this.nextEnabled) actions.push({ label: '下一章', run: (): void => this.onNextChapter() });
    return new ReaderAccessibilityActions(actions, this.nextEnabled ? this.nextChapterFocusId() : '',
      (): boolean => this.actionScope === scope && this.chapterActionsCurrent(scope));
  }

  @Builder
  private chapterBookmarkRow() {
    Row({ space: 8 }) {
      Text(`第 ${this.readableChapterPosition >= 0 ? this.readableChapterPosition + 1 : '—'} / 共 ${this.totalChapters} 章`)
        .layoutWeight(1).fontFamily(TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL.fontFamily)
        .fontWeight(TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL.fontWeight)
        .fontSize(11).fontFeature('"tnum" 1').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appScheme));
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: 4 }) {
          Stack({ alignContent: Alignment.TopStart }) {
            Image(this.appScheme === 'night' ? $r('app.media.reader_control_bookmark_outline_theme_night') :
              $r('app.media.reader_control_bookmark_outline')).width(14).height(14);
            Stack({ alignContent: Alignment.TopStart }) {
              Image(this.appScheme === 'night' ? $r('app.media.reader_control_bookmark_filled_theme_night') :
                $r('app.media.reader_control_bookmark_filled')).width(14).height(14).position({ x: 0, y: 0 });
            }.width(14).height(14 * (this.reduceMotion ? 1 : this.pageBookmarkFill)).clip(true)
              .opacity(this.reduceMotion ? this.pageBookmarkFill : 1).scale({ x: 1, y: this.pageBookmarkTuck, centerY: 0 });
          }.width(14).height(14).accessibilityLevel('no');
          Text(this.pageBookmarkStatus === 'bookmarked' ? '已加书签' : '加书签')
            .fontFamily(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontFamily)
            .fontWeight(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontWeight)
            .fontSize(11).lineHeight(15 * Math.max(1, this.sessionFontScale)).halfLeading(true).maxLines(1)
            .fontColor(readerAppColor(this.pageBookmarkStatus === 'bookmarked' ? 'TOK_READ_PRIMARY' : 'TOK_READ_INK', this.appScheme));
        }.width(this.bookmarkWidth).height(this.bookmarkHeight).justifyContent(FlexAlign.Center).borderRadius(14)
          .backgroundColor(readerPressSurface(readerAppColor(this.pageBookmarkStatus === 'bookmarked' ?
            'TOK_READ_ACTIVE_SOFT' : 'TOK_SURFACE_PANEL_SOFT', this.appScheme),
          this.appScheme, this.quickOrModulePress === 'bookmark', this.reduceMotion))
          .scale(readerPressScale(this.quickOrModulePress === 'bookmark', this.reduceMotion))
          .opacity(readerPressOpacity(this.quickOrModulePress === 'bookmark', this.reduceMotion))
          .border({ width: 1, color: readerAppColor(this.pageBookmarkStatus === 'bookmarked' ? 'TOK_READ_PRIMARY' :
            'app.border.readerConfig', this.appScheme) });
      }.id('novel-bookmark-pill').width(this.bookmarkWidth).height(this.bookmarkHeight)
        .responseRegion({ x: 0, y: -(Math.max(0, 44 - this.bookmarkHeight) / 2),
          width: '100%', height: Math.max(44, this.bookmarkHeight) })
        .padding(0).backgroundColor(Color.Transparent)
        .accessibilityText(this.pageBookmarkStatus === 'bookmarked' ? '已加书签，点击移除' : '加书签')
        .enabled(this.bookmarkInputEnabled)
        .onTouch(this.onBookmarkPress)
        .opacity(this.pageBookmarkEnabled ? 1 : .45)
        .onClick(this.bookmarkClickHandler(this.actionScope));
    }.width('100%').id('reader-control-chapter-bookmark-lane').height(this.bookmarkLaneHeight).padding({ left: 11, right: 11 });
  }

  @Builder
  private progressRow() {
    Row() {
      // 进度百分比 Inter Regular 9 (固定 26.23 宽容器, 使 slider 起点对齐 Figma)。
      Text(`${Math.round(this.progressPercent)}%`)
        .width(Math.max(32, this.progressLabelWidth))
        .fontFamily(TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL.fontFamily)
        .fontWeight(TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL.fontWeight)
        .fontSize(11)
        .lineHeight(15)
        .fontFeature('"tnum" 1')
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appScheme))
        .maxLines(1);

      // Native Slider owns pointer/keyboard semantics; its visual parameters
      // retain the Figma 5vp track and 18vp bordered thumb. The owner receives
      // only the final value and resolves it to a real chapter/scalar anchor.
      Slider({
        value: this.progressPercent,
        min: READER_CONTROL_PROGRESS_MIN,
        max: READER_CONTROL_PROGRESS_MAX,
        step: READER_CONTROL_PROGRESS_STEP,
        style: SliderStyle.OutSet,
        direction: Axis.Horizontal,
        reverse: false,
      })
      .trackThickness(5)
      .blockSize({ width: 18, height: 18 })
      .blockColor(readerAppColor('TOK_SURFACE_SOLID_OPAQUE', this.appScheme))
      .blockBorderColor(readerAppColor('TOK_ACCENT', this.appScheme))
      .blockBorderWidth(2.778)
      .selectedColor(readerAppColor('TOK_ACCENT', this.appScheme))
      .trackColor(readerAppColor('TOK_BORDER', this.appScheme))
      .showSteps(false)
      .showTips(false)
      .accessibilityText('阅读进度')
      .attributeModifier(new ReaderPaperMaterial())
      .onChange(this.progressChangeHandler(this.progressInputRevision))
      .layoutWeight(1)
      .height(this.progressLaneHeight);

    }
    .width('100%')
    .id('reader-control-chapter-progress-lane')
    .height(this.progressLaneHeight)
    .padding({ left: 11, right: 11 })
    .alignItems(VerticalAlign.Center);
  }
}
