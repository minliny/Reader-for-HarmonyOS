import { SurfaceHorizontalFrame } from '../common/SurfaceHorizontalGeometry';
import { ReaderPageGeometryInput, resolveReaderPageGeometry } from '../common/ReaderPageGeometry';
import { TOK_SCREEN_INSET, TOK_CONTENT_RAIL_W_TABLET } from '../common/ReaderTokens';
import { readerMainRailContentLeft, readerMainRailContentRight } from '../shell/MainNavigationSpec';
import { readerMainViewport } from '../shell/MainNavigationSpec';
import { TYPE_APP_BODY, TYPE_APP_PRIMARY_ACTION, TYPE_SHELF_STATE_TITLE } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderPageState } from '../common/ReaderPageState';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { bookshelfHeaderSpec } from '../common/ReaderHeaderSpecs';
import { readerContentSafeTop } from '../common/ReaderWindowMetrics';
import { readerFloatingTabContentInset } from '../common/ReaderFloatingBarMetrics';
import { readerMainNavigationMode, readerMainRailBottomInset } from '../shell/MainNavigationSpec';

@Component
export struct BookshelfStatusContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerWideNavigationRail') private wideNavigationRail: boolean = false;
  @State private viewportHeight: number = 0;
  /** Presented header bottom (top + measured height), owned by the route. */
  @Prop headerBottom: number = bookshelfHeaderSpec().frameHeight;
  @Prop failed: boolean = false;
  @Prop title: string = '书架加载失败';
  @Prop message: string = '无法读取书架内容，请重试。';
  @Prop canRetry: boolean = true;
  @Prop reduceMotion: boolean = false;
  onRetry: () => void = (): void => {};

  build() {
    Scroll() {
      Column() {
        ReaderPageState({ loading: !this.failed,
          title: this.failed ? this.title : '正在加载书架…',
          message: this.failed ? this.message : '',
          actionLabel: this.failed && this.canRetry ? '重试' : '', onAction: this.onRetry });
      }
      .width('100%')
      .constraintSize({ minHeight: this.minimumContentHeight() })
      .padding({ top: this.headerBottom, bottom: this.bottomContentInset(),
        left: this.contentFrame().left, right: this.contentFrame().right })
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

  private contentFrame(): SurfaceHorizontalFrame {
    const input = new ReaderPageGeometryInput(ReaderWindowCoordinator.metrics());
    input.viewportWidth = readerMainViewport(this.mainViewportRevision).width;
    input.contentMaxWidth = TOK_CONTENT_RAIL_W_TABLET;
    const rail = readerMainNavigationMode(this.wideNavigationRail, this.mainViewportRevision, this.readerWindowMetricsRevision) === 'rail';
    input.contentLeftGap = rail ? readerMainRailContentLeft() : TOK_SCREEN_INSET;
    input.contentRightGap = rail ? readerMainRailContentRight() : TOK_SCREEN_INSET;
    return resolveReaderPageGeometry(input).content.frame;
  }

  private minimumContentHeight(): number {
    if (this.viewportHeight > 0) return this.viewportHeight;
    if (this.readerWindowMetricsRevision < 0) return 0;
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(0, metrics.windowRect.height - readerContentSafeTop(metrics));
  }

  private bottomContentInset(): number {
    if (this.readerWindowMetricsRevision < 0) return 99;
    return readerMainNavigationMode(this.wideNavigationRail, this.mainViewportRevision, this.readerWindowMetricsRevision) === 'rail' ? readerMainRailBottomInset() :
      readerFloatingTabContentInset(ReaderWindowCoordinator.metrics());
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
