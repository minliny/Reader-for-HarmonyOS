import { TYPE_APP_BODY, TYPE_APP_PRIMARY_ACTION, TYPE_SHELF_STATE_TITLE } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { SearchSpinner } from '../search/SearchSpinner';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerContentSafeTop } from '../common/ReaderWindowMetrics';
import {
  READER_FLOATING_TOP_BAR_HEIGHT,
  readerFloatingTabContentInset,
} from '../common/ReaderFloatingBarMetrics';

@Component
export struct BookshelfStatusContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @State private viewportHeight: number = 0;
  @Prop failed: boolean = false;
  @Prop reduceMotion: boolean = false;
  onRetry: () => void = (): void => {};

  build() {
    Scroll() {
      Column({ space: 16 }) {
        if (this.failed) {
          Text('书架加载失败')
            .fontFamily(TYPE_SHELF_STATE_TITLE.fontFamily)
            .fontWeight(TYPE_SHELF_STATE_TITLE.fontWeight)
            .fontSize(TYPE_SHELF_STATE_TITLE.fontSizeFp)
            .lineHeight(TYPE_SHELF_STATE_TITLE.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .textAlign(TextAlign.Center);
          Text('无法读取书架内容，请重试。')
            .fontFamily(TYPE_APP_BODY.fontFamily)
            .fontWeight(TYPE_APP_BODY.fontWeight)
            .fontSize(TYPE_APP_BODY.fontSizeFp)
            .lineHeight(TYPE_APP_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .textAlign(TextAlign.Center);
          Text('重试')
            .fontFamily(TYPE_APP_PRIMARY_ACTION.fontFamily)
            .fontWeight(TYPE_APP_PRIMARY_ACTION.fontWeight)
            .fontSize(TYPE_APP_PRIMARY_ACTION.fontSizeFp)
            .lineHeight(TYPE_APP_PRIMARY_ACTION.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
            .padding({ left: 18, right: 18, top: 11.5, bottom: 11.5 })
            .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
            .borderRadius(999)
            .responseRegion({ x: 0, y: -4, width: '100%', height: 44 })
            .onClick((): void => this.onRetry());
        } else {
          SearchSpinner({ active: true, reduceMotion: this.reduceMotion, diameter: 24 });
          Text('正在加载书架…')
            .fontFamily(TYPE_APP_BODY.fontFamily)
            .fontWeight(TYPE_APP_BODY.fontWeight)
            .fontSize(TYPE_APP_BODY.fontSizeFp)
            .lineHeight(TYPE_APP_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
      }
      .width('100%')
      .constraintSize({ minHeight: this.minimumContentHeight() })
      .padding({ top: READER_FLOATING_TOP_BAR_HEIGHT, bottom: this.bottomContentInset() })
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center);
    }
    .width('100%')
    .height('100%')
    .align(Alignment.Top)
    .scrollBar(BarState.Off)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const height = this.numericAreaLength(newValue.height);
      if (height > 0 && Math.abs(height - this.viewportHeight) >= 0.01) this.viewportHeight = height;
    });
  }

  private minimumContentHeight(): number {
    if (this.viewportHeight > 0) return this.viewportHeight;
    if (this.readerWindowMetricsRevision < 0) return 0;
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(0, metrics.windowRect.height - readerContentSafeTop(metrics));
  }

  private bottomContentInset(): number {
    if (this.readerWindowMetricsRevision < 0) return 99;
    return readerFloatingTabContentInset(ReaderWindowCoordinator.metrics());
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
