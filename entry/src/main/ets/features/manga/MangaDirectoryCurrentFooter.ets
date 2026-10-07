import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../common/ReaderFontFamilies';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryScale, mangaDirectoryFooterStacked } from './MangaDirectoryVisual';

/** Shared current-position surface; only its title may be ellipsized. */
@Component
export struct MangaDirectoryCurrentFooter {
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop title: string = '';
  @Prop pagePosition: string = '';
  @Prop scheme: string = 'day';
  @Prop availableWidth: number = 0;
  onHeightChanged: (height: number) => void = (_height: number): void => {};
  @State private measuredWidth: number = 0;

  private footerFontScale(): number {
    const revision = this.metricsRevision;
    return mangaDirectoryScale(revision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale);
  }
  private stacked(): boolean { return mangaDirectoryFooterStacked(this.availableWidth > 0 ? this.availableWidth : this.measuredWidth, this.footerFontScale(), this.pagePosition); }

  @Builder
  private label() {
    Text('当前章节').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
      .fontSize(visual.footerMetaFontSize).lineHeight(visual.footerMetaLineHeight).halfLeading(true)
      .minFontScale(Math.min(1, this.footerFontScale())).maxFontScale(Math.max(1, this.footerFontScale()))
      .fontColor(mangaDirectoryColor('muted', this.scheme)).flexShrink(0);
  }
  @Builder
  private chapter() {
    Text(this.title).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontWeight(visual.footerFontWeight)
      .fontSize(visual.footerTitleFontSize).lineHeight(visual.footerTitleLineHeight).halfLeading(true)
      .minFontScale(Math.min(1, this.footerFontScale())).maxFontScale(Math.max(1, this.footerFontScale()))
      .fontColor(mangaDirectoryColor('ink', this.scheme)).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
  }
  @Builder
  private page() {
    if (this.pagePosition.length > 0) {
      Text(this.pagePosition).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
        .fontSize(visual.footerMetaFontSize).lineHeight(visual.footerMetaLineHeight).halfLeading(true).fontFeature("'tnum' 1")
        .minFontScale(Math.min(1, this.footerFontScale())).maxFontScale(Math.max(1, this.footerFontScale()))
        .fontColor(mangaDirectoryColor('muted', this.scheme)).wordBreak(WordBreak.BREAK_WORD).flexShrink(0);
    }
  }
  build() {
    Column() {
      if (this.stacked()) {
        Column({ space: visual.footerStackGap }) {
          this.label();
          this.chapter();
          this.page();
        }.width('100%').alignItems(HorizontalAlign.Start);
      } else {
        Row({ space: visual.footerGap }) {
          this.label();
          Row() { this.chapter(); }.layoutWeight(1).constraintSize({ minWidth: 0 });
          this.page();
        }.width('100%');
      }
    }.width('100%').constraintSize({ minHeight: visual.footerHeight })
      .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Start)
      .padding({ left: visual.footerPaddingX, right: visual.footerPaddingX, top: visual.footerPaddingY, bottom: visual.footerPaddingY })
      .backgroundColor(mangaDirectoryColor('soft', this.scheme))
      .border({ width: visual.borderWidth, color: mangaDirectoryColor('line', this.scheme) }).borderRadius(visual.footerRadius)
      .accessibilityText('当前阅读位置')
      .onAreaChange((_old: Area, area: Area): void => {
        const width = Number(area.width), height = Number(area.height);
        if (Number.isFinite(width) && width > 0 && Math.abs(width - this.measuredWidth) > .1) this.measuredWidth = width;
        if (Number.isFinite(height) && height > 0) this.onHeightChanged(height);
      });
  }
}
