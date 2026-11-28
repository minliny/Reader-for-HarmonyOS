import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';

export function readerDirectoryQuickActionsHeight(fontScale: number, showPosition: boolean): number {
  return Math.max(44, Math.ceil((showPosition ? 28 : 16) * fontScale) + 8) + 12;
}

/** Standalone directory's non-scrolling shortcuts. List operations stay with its owner. */
@Component
export struct ReaderDirectoryQuickActions {
  @Prop title: string = '';
  @Prop positionLabel: string = '';
  @Prop scheme: string = 'day';
  @Prop fontScale: number = 1;
  @Prop locateEnabled: boolean = false;
  @Prop edgeEnabled: boolean = false;
  onLocateCurrent: () => void = (): void => {};
  onTop: () => void = (): void => {};
  onBottom: () => void = (): void => {};

  private actionHeight(): number {
    return readerDirectoryQuickActionsHeight(this.fontScale, this.positionLabel.length > 0) - 12;
  }

  @Builder
  private locate() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 6 }) {
        Image(this.scheme === 'night' ? $r('app.media.manga_sheet_locate_theme_night') : $r('app.media.manga_sheet_locate'))
          .width(14).height(14).flexShrink(0);
        Column() {
          Text(`在读：${this.title}`).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(12).fontWeight(FontWeight.Medium).lineHeight(16).halfLeading(true)
            .fontColor(readerAppColor('TOK_PRIMARY_DARK', this.scheme));
          if (this.positionLabel.length > 0) {
            Text(this.positionLabel).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(10).lineHeight(12).halfLeading(true).fontFeature('"tnum" 1')
              .fontColor(readerAppColor('TOK_MUTED', this.scheme));
          }
        }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
      }.width('100%').height(this.actionHeight() - 8).padding({ left: 12, right: 8 })
        .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    }.layoutWeight(1).constraintSize({ minWidth: 44 }).height(this.actionHeight()).padding(0)
      .opacity(this.locateEnabled ? 1 : .55)
      .attributeModifier(new ReaderActionAccessibility(`在读：${this.title}${this.positionLabel.length > 0 ? `，${this.positionLabel}` : ''}`,
        this.locateEnabled, false, true, new ReaderPressFeedback(readerAppColor('TOK_PRIMARY_SOFT', this.scheme),
          this.scheme, this.actionHeight() / 2, this.actionHeight() / 2, this.locateEnabled), 'nativeButton'))
      .onClick((): void => { if (this.locateEnabled) this.onLocateCurrent(); });
  }

  @Builder
  private edge(top: boolean) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 4 }) {
        Image(top ?
          (this.scheme === 'night' ? $r('app.media.reader_directory_top_theme_night') : $r('app.media.reader_directory_top')) :
          (this.scheme === 'night' ? $r('app.media.reader_directory_bottom_theme_night') : $r('app.media.reader_directory_bottom')))
          .width(13).height(13).flexShrink(0);
        Text(top ? '顶部' : '底部').fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
          .fontSize(12).fontWeight(FontWeight.Medium).lineHeight(16).halfLeading(true).maxLines(1)
          .fontColor(readerAppColor('TOK_INK', this.scheme));
      }.constraintSize({ minWidth: 44 }).height(this.actionHeight() - 8).padding({ left: 8, right: 8 })
        .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    }.height(this.actionHeight()).constraintSize({ minWidth: 44 }).flexShrink(0).padding(0)
      .opacity(this.edgeEnabled ? 1 : .55)
      .attributeModifier(new ReaderActionAccessibility(top ? '回到目录顶部' : '前往目录底部',
        this.edgeEnabled, false, true, new ReaderPressFeedback(readerAppColor('TOK_SURFACE_FIELD', this.scheme),
          this.scheme, this.actionHeight() / 2, this.actionHeight() / 2, this.edgeEnabled), 'nativeButton'))
      .onClick((): void => {
        if (!this.edgeEnabled) return;
        if (top) this.onTop();
        else this.onBottom();
      });
  }

  build() {
    Row({ space: 6 }) {
      this.locate();
      this.edge(true);
      this.edge(false);
    }.width('100%').padding(6).borderRadius((this.actionHeight() + 12) / 2)
      .backgroundColor(readerAppColor('app.navigation.floatingSurface', this.scheme))
      .border({ width: 1, color: readerAppColor('app.navigation.floatingBorder', this.scheme) })
      .shadow(readerSurfaceElevation('floating', this.scheme))
      .hitTestBehavior(HitTestMode.Default)
      .onTouch((): void => {});
  }
}
