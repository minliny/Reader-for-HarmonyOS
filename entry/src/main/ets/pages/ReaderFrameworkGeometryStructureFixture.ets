import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { LengthMetrics } from '@kit.ArkUI';
import inputMethod from '@ohos.inputMethod';
import { ReaderStandardPage } from '../ui/layout/ReaderStandardPage';
import { readerPageAreaLength } from '../ui/layout/ReaderPageShell';
import { readerWindowMetrics } from '../ui/foundation/ReaderWindowEnvironment';
import { PageBackBar } from '../ui/chrome/PageBackBar';
import { ReaderSearchField } from '../ui/controls/ReaderSearchField';
import { ReaderPageState } from '../ui/feedback/ReaderPageState';
import { BookRemovalDialogHost } from '../features/bookshelf/ui/BookRemovalDialogHost';
import { BookRemovalDialogPresentation } from '../features/bookshelf/presentation/BookRemovalDialogPresentation';

/** Actual native geometry and confirmation hosts with memory-only actions. */
@Component
export struct ReaderFrameworkGeometryStructureFixture {
  @Prop fontsReady: boolean = false;
  @StorageLink('readerWindowMetricsRevision') @Watch('metricsChanged') private metricsRevision: number = 0;
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  @State private hostHeight: number = 260;
  @State private query: string = '';
  @State private confirmations: number = 0;
  private mounted: boolean = false;
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;
  private headerHeight: number = 0;
  private headerGlobalY: number = 0;
  private contentGlobalY: number = 0;
  private headerAreas: number = 0;
  private readonly removal: BookRemovalDialogPresentation = new BookRemovalDialogPresentation();

  aboutToAppear(): void {
    this.mounted = true;
    if (this.current()) this.onTemporaryBackBridge((): boolean => this.back(), 'framework-geometry-fixture');
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.removal.dismiss();
    this.onTemporaryBackBridge(undefined, 'framework-geometry-fixture');
  }

  private current(): boolean {
    return this.mounted && this.fontsReady && DEBUG === true && BUILD_MODE_NAME === 'debug';
  }

  private back(): boolean {
    if (!this.current()) return false;
    if (this.removal.isOpen()) return this.removal.dismiss();
    if (readerWindowMetrics().keyboardInsets.bottom <= 0) return false;
    try {
      void inputMethod.getController().hideTextInput().catch((_error: Error): void => this.record('keyboard-hide-rejected'));
    } catch (_error) { this.record('keyboard-hide-rejected'); }
    return true;
  }

  private metricsChanged(): void { if (this.current()) this.record('metrics'); }

  private record(kind: string): void {
    if (!this.current()) return;
    const metrics = readerWindowMetrics();
    hilog.info(0x5244, 'ReaderPageStructure', 'READER_GEOMETRY_FIXTURE %{public}s', JSON.stringify({
      kind, viewportWidth: this.viewportWidth, viewportHeight: this.viewportHeight,
      headerHeight: this.headerHeight, headerGlobalY: this.headerGlobalY, headerAreas: this.headerAreas,
      contentGlobalY: this.contentGlobalY, metricsRevision: this.metricsRevision,
      windowWidth: metrics.windowRect.width, windowHeight: metrics.windowRect.height,
      keyboardBottom: metrics.keyboardInsets.bottom, fontScale: metrics.systemFontScale,
      confirmations: this.confirmations }));
  }

  private openRemoval(): void {
    if (!this.current()) return;
    const message = '内存移除确认样本。长书名与本地资源说明用于验证原生滚动容量。'.repeat(32) + '移除说明末尾。';
    this.removal.open(message, (): boolean => this.current(), (): void => {
      if (this.current()) { this.confirmations += 1; this.record('memory-confirm'); }
    }, (_phase: 'open' | 'close', _error: Object): void => this.record('dialog-platform-error'));
  }

  @Builder
  private pageHeader() {
    Column() {
      PageBackBar({ title: '页头测量样本', onBack: (): void => this.record('header-back') });
      ReaderSearchField({ variant: 'bookPanel', text: this.query, placeholder: '原生键盘与页头测量',
        accessibilityLabel: '框架测量样本输入', onTextChange: (value: string): void => {
          if (this.current()) this.query = value;
        }, onFocusChanged: (_focused: boolean): void => this.record('input-focus') });
    }.width('100%').onAreaChange((_old: Area, area: Area): void => {
      if (!this.current()) return;
      this.headerHeight = readerPageAreaLength(area.height);
      this.headerGlobalY = readerPageAreaLength(area.globalPosition.y);
      this.headerAreas += 1;
      this.record('header-area');
    }).id('reader-framework-geometry-header');
  }

  @Builder
  private pageContent() {
    Text('正文原点样本').id('reader-framework-geometry-content').onAreaChange((_old: Area, area: Area): void => {
      if (!this.current()) return;
      this.contentGlobalY = readerPageAreaLength(area.globalPosition.y);
      this.record('content-area');
    });
  }

  build() {
    if (DEBUG === true && BUILD_MODE_NAME === 'debug' && this.fontsReady) {
      Column({ space: 8 }) {
        Text('框架几何 · 原生组件样本').fontSize(18);
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center,
          space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(8) } }) {
          Button('260vp').id('reader-framework-height-260').onClick((): void => { this.hostHeight = 260; });
          Button('420vp').id('reader-framework-height-420').onClick((): void => { this.hostHeight = 420; });
          Button('移除确认样本').id('reader-framework-removal-open').onClick((): void => this.openRemoval());
        }.width('100%');
        Text(`内存确认 ${this.confirmations}`).fontSize(14).id('reader-framework-confirmations');
        Stack() {
          ReaderStandardPage({ variant: 'tools', header: (): void => { this.pageHeader(); },
            content: (): void => { this.pageContent(); }, onViewportChange: (width: number, height: number): void => {
              if (!this.current()) return;
              this.viewportWidth = width; this.viewportHeight = height; this.record('viewport');
            } });
        }.width('100%').height(this.hostHeight).clip(true).id('reader-framework-geometry-viewport');
        BookRemovalDialogHost({ presentation: this.removal });
      }.width('100%').height('100%');
    } else {
      ReaderPageState({ title: '框架几何样本尚未就绪' });
    }
  }
}
