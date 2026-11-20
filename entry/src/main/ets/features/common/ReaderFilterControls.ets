import { ReaderButton } from './ReaderButton';
import { ReaderPressFeedback } from './ReaderPressFeedback';
import { ColorMetrics, type DrawContext } from '@kit.ArkUI';
import { drawing } from '@kit.ArkGraphics2D';
import { readerAppColor } from './ReaderThemeRegistry';
import { TYPE_FORM_HINT, TYPE_SOURCE_FILTER_GROUP_TITLE, TYPE_SOURCE_FILTER_GROUP_COUNT } from './ReaderTypography';

/** Paint decoration from the node's resolved size; it must never measure the row. */
class ReaderFilterSelectionMarker extends DrawModifier {
  private readonly selected: boolean;
  private readonly scheme: string;
  private readonly pixelsPerVp: number;
  constructor(selected: boolean, scheme: string, pixelsPerVp: number) {
    super(); this.selected = selected; this.scheme = scheme; this.pixelsPerVp = pixelsPerVp;
  }
  drawFront(context: DrawContext): void {
    if (!this.selected || context.size.width <= 0) return;
    const density = this.pixelsPerVp;
    if (!Number.isFinite(density) || density <= 0) return;
    const inset = 14 * density;
    if (context.sizeInPixel.height <= inset * 2) return;
    const color = ColorMetrics.resourceColor(readerAppColor('TOK_GREEN', this.scheme));
    const brush = new drawing.Brush();
    brush.setColor({ alpha: color.alpha, red: color.red, green: color.green, blue: color.blue });
    brush.setAntiAlias(true);
    const canvas = context.canvas;
    canvas.attachBrush(brush);
    try {
      canvas.drawRoundRect(new drawing.RoundRect({ left: 0, top: inset, right: Math.min(3 * density, context.sizeInPixel.width),
        bottom: context.sizeInPixel.height - inset }, 3 * density, 3 * density));
    } finally { canvas.detachBrush(); }
  }
}

/** Visual trigger only; the consuming host attaches bindSheet and owns its identity. */
@Component
export struct ReaderFilterTrigger {
  @Prop scheme: string = 'day';
  @Prop count: number = 0;
  @Prop expanded: boolean = false;
  @Prop actionAccessibilityLabel: string = '';
  onAction: () => void = (): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  private badgeCount(): number { return Math.min(3, Math.max(0, Math.floor(this.count))); }
  private icon(): Resource {
    if (this.scheme === 'night') return this.badgeCount() > 0 ?
      $r('app.media.bookshelf_filter_active_theme_night') : $r('app.media.bookshelf_filter_theme_night');
    return this.badgeCount() > 0 ? $r('app.media.bookshelf_filter_active') : $r('app.media.bookshelf_filter');
  }
  build() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.icon()).width(20).height(20).objectFit(ImageFit.Contain).accessibilityLevel('no');
      if (this.badgeCount() > 0) {
        Text(`${this.badgeCount()}`).fontFamily('ReaderNotoSansSCUIMedium').fontWeight(500)
          .fontSize(10).lineHeight(14).maxFontScale(1.3).textAlign(TextAlign.Center)
          .constraintSize({ minWidth: 16, minHeight: 16 }).padding({ left: 3, right: 3 })
          .borderRadius(999).backgroundColor(readerAppColor('TOK_GREEN', this.scheme))
          .fontColor(readerAppColor('TOK_ON_PRIMARY', this.scheme)).position({ top: 2, right: 2 })
          .hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
      }
    }.width(44).height(44)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.scheme, 12))
      .focusable(true).accessibilityGroup(true).accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityText(this.actionAccessibilityLabel.length > 0 ? this.actionAccessibilityLabel :
        `${this.expanded ? '收起筛选' : '展开筛选'}，已启用${this.badgeCount()}项`)
      .onClick((): void => { if (this.mounted) this.onAction(); });
  }
}

/** The parent supplies the selected fact and admits every business callback. */
@Component
export struct ReaderFilterGroupRow {
  @Prop scheme: string = 'day';
  @Prop label: string = '';
  @Prop count: number = 0;
  @Prop selected: boolean = false;
  @Prop actionEnabled: boolean = true;
  onAction: () => void = (): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column({ space: 3 }) {
        Text(this.label).width('100%').fontFamily(TYPE_SOURCE_FILTER_GROUP_TITLE.fontFamily)
          .fontSize(TYPE_SOURCE_FILTER_GROUP_TITLE.fontSizeFp).lineHeight(TYPE_SOURCE_FILTER_GROUP_TITLE.lineHeightFp as number)
          .fontWeight(TYPE_SOURCE_FILTER_GROUP_TITLE.fontWeight).wordBreak(WordBreak.BREAK_ALL)
          .fontColor(readerAppColor(this.selected ? 'TOK_GREEN' : 'TOK_INK', this.scheme));
        Text(`匹配 ${this.count} 个书源`).width('100%').fontFamily(TYPE_SOURCE_FILTER_GROUP_COUNT.fontFamily)
          .fontSize(TYPE_SOURCE_FILTER_GROUP_COUNT.fontSizeFp).lineHeight(TYPE_SOURCE_FILTER_GROUP_COUNT.lineHeightFp as number)
          .fontWeight(TYPE_SOURCE_FILTER_GROUP_COUNT.fontWeight).fontColor(readerAppColor('TOK_MUTED', this.scheme));
      }.width('100%').alignItems(HorizontalAlign.Start).padding({ top: 11, bottom: 11, left: 14, right: 14 });
    }.width('100%').constraintSize({ minHeight: 60 })
      .drawModifier(new ReaderFilterSelectionMarker(this.selected, this.scheme, this.getUIContext().vp2px(1)))
      .attributeModifier(new ReaderPressFeedback(this.selected ? readerAppColor('TOK_PRIMARY_SOFT', this.scheme) :
        Color.Transparent, this.scheme, 8, 8, this.actionEnabled))
      .enabled(this.actionEnabled).focusable(this.actionEnabled).accessibilityGroup(true)
      .accessibilityRole(AccessibilityRoleType.RADIO).accessibilitySelected(this.selected)
      .accessibilityText(`${this.label}，匹配${this.count}个书源${this.selected ? '，已选' : ''}`)
      .onClick((): void => { if (this.mounted && this.actionEnabled) this.onAction(); });
  }
}

/** Sheet content supplies the sole 20vp bottom inset; this footer adds none. */
@Component
export struct ReaderFilterFooter {
  @Prop scheme: string = 'day';
  @Prop hint: string = '';
  @Prop hintTone: 'muted' | 'danger' = 'muted';
  @Prop resetEnabled: boolean = true;
  @Prop applyEnabled: boolean = true;
  onReset: () => void = (): void => {};
  onApply: () => void = (): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  build() {
    Column({ space: 8 }) {
      if (this.hint.length > 0) {
        Text(this.hint).fontFamily(TYPE_FORM_HINT.fontFamily).fontSize(TYPE_FORM_HINT.fontSizeFp)
          .fontColor(readerAppColor(this.hintTone === 'danger' ? 'TOK_MESSAGE_DANGER' : 'TOK_MUTED', this.scheme));
      }
      Row({ space: 8 }) {
        ReaderButton({ scheme: this.scheme, specId: 'filter-action', label: '重置', layout: 'equal',
          actionEnabled: this.resetEnabled, onAction: (): void => { if (this.mounted && this.resetEnabled) this.onReset(); } });
        ReaderButton({ scheme: this.scheme, specId: 'filter-action', label: '应用筛选', layout: 'equal', primary: true,
          actionEnabled: this.applyEnabled, onAction: (): void => { if (this.mounted && this.applyEnabled) this.onApply(); } });
      }.width('100%');
    }.width('100%').padding({ left: 12, right: 12, top: 12, bottom: 0 })
      .border({ width: { top: 1 }, color: readerAppColor('TOK_ROW_DIVIDER', this.scheme) });
  }
}
