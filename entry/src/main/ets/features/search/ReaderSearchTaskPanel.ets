import { ReaderWindowChromeStyle, ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { ReaderButton } from '../common/ReaderButton';
import { ReaderBoundedSurface } from '../common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../common/ReaderBoundedSurfaceHeader';
import { MESSAGE_META } from '../common/ReaderMessageStyle';
import { READER_ACTION_MIN_TARGET, readerActionTouchRegion } from '../common/ReaderActionAccessibility';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { resolveSheetSpec, readerSurfaceElevation } from '../common/ReaderSurfaceSpecs';
import { SurfaceWidthSpec, resolveHorizontalFrame } from '../common/SurfaceHorizontalGeometry';
import { readerVisualSafeLeft, readerVisualSafeRight, readerVisualSafeTop, readerVisualSafeBottom } from '../common/ReaderWindowMetrics';
import { readerScrimmedOpaqueColor } from '../common/ReaderScrimColor';
import { readerPageAreaLength } from '../common/ReaderPageShell';

/** Registered search-task content. SearchPage owns all facts and retry rights;
 * this component owns only its native Sheet presentation and chrome receipt. */
@Component
export struct ReaderSearchTaskPanel {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('metricsChanged') private metricsRevision: number = 0;
  @Prop expanded: boolean = false;
  @Prop presentationIdentity: string = '';
  @Prop triggerWidth: number = 240;
  @Prop progressText: string = '';
  @Prop statusLabel: string = '';
  @Prop searching: boolean = false;
  @Prop partialText: string = '';
  @Prop failed: number = 0;
  @Prop failedText: string = '';
  @Prop skippedText: string = '';
  @Prop skipped: number = 0;
  @Prop canRetry: boolean = false;
  @Prop retryIdentity: string = '';
  onToggle: () => void = (): void => {};
  onDismiss: (identity: string) => void = (_identity: string): void => {};
  onRetry: () => void = (): void => {};
  private mounted: boolean = false;
  private chromeIdentity: string = '';
  private appearedIdentity: string = '';
  @State private measuredHeaderHeight: number = 0;
  @State private measuredBodyHeight: number = 0;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; this.releaseChrome(this.chromeIdentity); }
  private metricsChanged(): void { this.measuredHeaderHeight = 0; }
  private accepts(identity: string): boolean {
    return this.mounted && this.expanded && identity === this.presentationIdentity;
  }
  private fontScale(): number {
    const value = this.metricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(value) && value > 0 ? Math.max(1, value) : 1;
  }
  private summaryLabel(): string {
    const parts: string[] = [this.progressText];
    if (this.partialText.length > 0) parts.push('部分未完成');
    if (this.failed > 0) parts.push(`${this.failed} 失败`);
    if (this.skipped > 0) parts.push(`${this.skipped} 跳过`);
    return parts.filter((value: string): boolean => value.length > 0).join(' · ');
  }
  private triggerHeight(): number { return (MESSAGE_META.lineHeightFp ?? 18) * this.fontScale() + 8; }
  private sheetWidth(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(metrics.windowRect.width, readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(resolveSheetSpec('search-task-status').maxWidth)).width;
  }
  private bodyLimit(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const spec = resolveSheetSpec('search-task-status');
    const header = this.measuredHeaderHeight > 0 ? this.measuredHeaderHeight : spec.handleTop + spec.handleHeight +
      spec.handleBottom + Math.max(spec.titleHeight, spec.titleLineHeight * this.fontScale()) + spec.titleBottom;
    return Math.max(0, metrics.windowRect.height - readerVisualSafeTop(metrics) - readerVisualSafeBottom(metrics) -
      header - spec.contentBottom);
  }
  private claimChrome(identity: string): void {
    if (!this.accepts(identity)) return;
    const spec = resolveSheetSpec('search-task-status');
    const mask = readerAppColor(spec.hostMaskRole, this.scheme);
    const paper = readerScrimmedOpaqueColor(readerAppColor('app.window.background', this.scheme), mask);
    const ink = readerScrimmedOpaqueColor(readerAppColor('app.window.foreground', this.scheme), mask);
    const style = new ReaderWindowChromeStyle(paper, this.scheme === 'night' ? 'light' : 'dark', ink);
    style.navigationUnderlayColor = readerAppColor(spec.hostBackgroundRole, this.scheme);
    style.navigationContentColor = readerAppColor('app.window.foreground', this.scheme);
    this.chromeIdentity = identity;
    ReaderWindowCoordinator.requestOverlayChrome(style);
  }
  private releaseChrome(identity: string): void {
    if (identity.length === 0 || identity !== this.chromeIdentity) return;
    this.chromeIdentity = '';
    ReaderWindowCoordinator.requestAppChrome();
  }
  private sheetOptions(identity: string): SheetOptions {
    const spec = resolveSheetSpec('search-task-status');
    return { height: SheetSize.FIT_CONTENT, width: this.sheetWidth(), preferType: SheetType.BOTTOM,
      dragBar: false, showClose: false, backgroundColor: readerAppColor(spec.hostBackgroundRole, this.scheme),
      radius: { topLeft: spec.borderRadius, topRight: spec.borderRadius, bottomLeft: 0, bottomRight: 0 },
      maskColor: readerAppColor(spec.hostMaskRole, this.scheme),
      shadow: readerSurfaceElevation(spec.hostElevation, this.scheme),
      borderWidth: { top: spec.hostBorderWidth }, borderColor: readerAppColor(spec.hostBorderRole, this.scheme),
      enableOutsideInteractive: false,
      onWillAppear: (): void => this.claimChrome(identity),
      onAppear: (): void => { if (this.accepts(identity)) this.appearedIdentity = identity; },
      onWillDismiss: (dismissal: DismissSheetAction): void => {
        if (!this.accepts(identity)) return;
        if (dismissal.reason !== DismissReason.PRESS_BACK && this.appearedIdentity !== identity) return;
        this.releaseChrome(identity); this.onDismiss(identity); dismissal.dismiss();
      },
      onDisappear: (): void => {
        this.releaseChrome(identity);
        if (this.mounted && identity === this.presentationIdentity) this.onDismiss(identity);
        if (this.appearedIdentity === identity) this.appearedIdentity = '';
      } };
  }
  private retryAction(identity: string, retryIdentity: string, action: () => void): () => void {
    return (): void => {
      if (!this.accepts(identity) || !this.canRetry || retryIdentity !== this.retryIdentity) return;
      action();
    };
  }
  private measureHeader(identity: string): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      const height = readerPageAreaLength(next.height);
      if (this.accepts(identity) && Number.isFinite(height) && height > 0 &&
        Math.abs(height - this.measuredHeaderHeight) > .5) this.measuredHeaderHeight = height;
    };
  }
  private measureBody(identity: string): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      const height = readerPageAreaLength(next.height);
      if (this.accepts(identity) && Number.isFinite(height) && height >= 0 &&
        Math.abs(height - this.measuredBodyHeight) > .5) this.measuredBodyHeight = height;
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
            onAction: this.retryAction(identity, key, this.onRetry) })
            .constraintSize({ minHeight: READER_ACTION_MIN_TARGET });
        }, (key: string): string => key);
      }
    }.width('100%').padding({ left: resolveSheetSpec('search-task-status').horizontalInset,
      right: resolveSheetSpec('search-task-status').horizontalInset })
      .onAreaChange(this.measureBody(identity));
  }
  @Builder private sheetHeader(identity: string) {
    ReaderBoundedSurfaceHeader({ specId: 'search-task-status', title: '搜索进度',
      onClose: (): void => { if (this.accepts(identity)) this.onDismiss(identity); },
      onAreaChanged: this.measureHeader(identity) });
  }
  @Builder private sheetBody(identity: string) {
    if (this.measuredBodyHeight > this.bodyLimit()) {
      Scroll() { this.details(identity); }.width('100%').constraintSize({ maxHeight: this.bodyLimit() })
        .scrollBar(BarState.Auto);
    } else { this.details(identity); }
  }
  @Builder private sheetContent() {
    ForEach([this.presentationIdentity], (identity: string): void => {
      ReaderBoundedSurface({ specId: 'search-task-status', header: (): void => { this.sheetHeader(identity); },
        body: (): void => { this.sheetBody(identity); } });
    }, (identity: string): string => identity);
  }
  build() {
    Row({ space: 8 }) {
      Row({ space: 4 }) {
        Text(this.summaryLabel()).layoutWeight(1).fontFamily(MESSAGE_META.fontFamily).fontWeight(MESSAGE_META.fontWeight)
          .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MUTED', this.scheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Image(this.scheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
          .width(10).height(10).objectFit(ImageFit.Contain);
      }.width(this.triggerWidth).height(this.triggerHeight())
        // Expanded response stays left of the filter's reserved right lane.
        .responseRegion(readerActionTouchRegion(this.triggerWidth, this.triggerHeight()))
        .accessibilityRole(AccessibilityRoleType.BUTTON).focusable(true)
        .accessibilityText(`查看搜索进度，${this.summaryLabel()}`)
        .onClick((): void => { if (this.mounted) this.onToggle(); })
        .bindSheet(this.expanded, this.sheetContent, this.sheetOptions(this.presentationIdentity));
      Text(this.statusLabel).width(READER_ACTION_MIN_TARGET).fontFamily(MESSAGE_META.fontFamily).fontSize(10).lineHeight(15)
        .fontColor(readerAppColor('TOK_MUTED', this.scheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
    }.width('100%').alignItems(VerticalAlign.Center);
  }
}
