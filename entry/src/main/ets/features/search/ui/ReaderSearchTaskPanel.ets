import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../ui/surfaces/ReaderBoundedSurfaceHeader';
import { MESSAGE_META } from '../../../ui/foundation/ReaderMessageStyle';
import { READER_ACTION_MIN_TARGET } from '../../../ui/controls/ReaderActionAccessibility';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { resolveSheetSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerOverlayViewport } from '../../../ui/layout/ReaderOverlayGeometry';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';

/** Bounded search task content. SearchPage owns the current presentation and input. */
@Component
export struct ReaderSearchTaskPanel {
  @StorageProp('readerAppScheme') private scheme: string = 'day';
  @StorageProp('readerWindowMetricsRevision') @Watch('metricsChanged') private metricsRevision: number = 0;
  @Prop expanded: boolean = false;
  @Prop presentationIdentity: string = '';
  @Prop progressText: string = '';
  @Prop searching: boolean = false;
  @Prop partialText: string = '';
  @Prop failed: number = 0;
  @Prop failedText: string = '';
  @Prop skippedText: string = '';
  @Prop skipped: number = 0;
  @Prop canRetry: boolean = false;
  @Prop retryIdentity: string = '';
  onDismiss: (identity: string) => void = (_identity: string): void => {};
  onRetry: (identity: string, retryIdentity: string) => void = (_identity: string, _retryIdentity: string): void => {};
  private mounted: boolean = false;
  @State private measuredHeaderHeight: number = 0;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  private metricsChanged(): void { this.measuredHeaderHeight = 0; }
  private accepts(identity: string): boolean {
    return this.mounted && this.expanded && identity === this.presentationIdentity;
  }
  private fontScale(): number {
    const value = this.metricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(value) && value > 0 ? Math.max(1, value) : 1;
  }
  private bodyLimit(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const spec = resolveSheetSpec('search-task-status');
    const header = this.measuredHeaderHeight > 0 ? this.measuredHeaderHeight : spec.handleTop + spec.handleHeight +
      spec.handleBottom + Math.max(spec.titleHeight, spec.titleLineHeight * this.fontScale()) + spec.titleBottom;
    return Math.max(0, readerOverlayViewport(metrics).height - header - spec.contentBottom - spec.hostBorderWidth);
  }
  private retryAction(identity: string, retryIdentity: string): () => void {
    return (): void => {
      if (!this.accepts(identity) || !this.canRetry || retryIdentity !== this.retryIdentity) return;
      this.onRetry(identity, retryIdentity);
    };
  }
  private measureHeader(identity: string): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      const height = readerPageAreaLength(next.height);
      if (this.accepts(identity) && Number.isFinite(height) && height > 0 &&
        Math.abs(height - this.measuredHeaderHeight) > .5) this.measuredHeaderHeight = height;
    };
  }
  private messageText(kind: string): string {
    if (kind === 'progress') return this.progressText;
    if (kind === 'partial') return this.partialText;
    if (kind === 'failed') return this.failedText;
    if (kind === 'skipped') return this.skippedText;
    return '其余书源仍在搜索，可继续浏览已有结果。';
  }
  @Builder private message(kind: string) {
    Text(this.messageText(kind)).width('100%').fontFamily(MESSAGE_META.fontFamily).fontWeight(MESSAGE_META.fontWeight)
      .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MUTED', this.scheme));
  }
  @Builder private details(identity: string) {
    Column({ space: 12 }) {
      this.message('progress');
      if (this.partialText.length > 0) this.message('partial');
      if (this.failed > 0) this.message('failed');
      if (this.skipped > 0) this.message('skipped');
      if (this.searching) this.message('searching');
      if (this.canRetry) {
        ForEach([this.retryIdentity], (key: string): void => {
          ReaderButton({ scheme: this.scheme, specId: 'search-retry-progress', label: '重试未完成的书源',
            onAction: this.retryAction(identity, key) })
            .constraintSize({ minHeight: READER_ACTION_MIN_TARGET });
        }, (key: string): string => key);
      }
    }.width('100%').padding({ left: resolveSheetSpec('search-task-status').horizontalInset,
      right: resolveSheetSpec('search-task-status').horizontalInset });
  }
  @Builder private sheetHeader(identity: string) {
    ReaderBoundedSurfaceHeader({ specId: 'search-task-status', title: '搜索进度',
      onClose: (): void => { if (this.accepts(identity)) this.onDismiss(identity); },
      onAreaChanged: this.measureHeader(identity) });
  }
  @Builder private sheetBody(identity: string) {
    Scroll() { this.details(identity); }.width('100%').constraintSize({ maxHeight: this.bodyLimit() })
      .scrollBar(BarState.Auto);
  }
  build() {
    ForEach([this.presentationIdentity], (identity: string): void => {
      ReaderBoundedSurface({ specId: 'search-task-status', header: (): void => { this.sheetHeader(identity); },
        body: (): void => { this.sheetBody(identity); } });
    }, (identity: string): string => identity);
  }
}
