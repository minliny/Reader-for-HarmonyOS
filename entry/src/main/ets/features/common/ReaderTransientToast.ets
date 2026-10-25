import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight } from './ReaderWindowMetrics';
import { MESSAGE_TOAST_BODY, MESSAGE_TOAST_TITLE } from './ReaderMessageStyle';
import { readerAppColor } from './ReaderThemeRegistry';
import { readerMotionAnimateParam, readerReduceMotionFromStorage } from './ReaderMotionPolicy';
import {
  READER_TRANSIENT_TOAST_STORAGE_KEY,
  READER_TRANSIENT_HOST_STORAGE_KEY,
  registerReaderTransientHost,
  unregisterReaderTransientHost,
  retireReaderTransientToast,
  createReaderTransientToastState,
  type ReaderTransientToastState,
} from './ReaderTransientFeedback';

/**
 * App-owned short feedback surface.
 *
 * Domain code publishes a generation-scoped fact through AppStorage. This
 * host owns only presentation and timeout cleanup, so an old timer can never
 * dismiss a newer message. It is mounted once by Index above every route.
 */
@Component
export struct ReaderTransientToast {
  @StorageLink(READER_TRANSIENT_TOAST_STORAGE_KEY)
  @Watch('toastChanged') private toast: ReaderTransientToastState = createReaderTransientToastState();
  @Prop priority: number = 0;
  @Prop bounded: boolean = false;
  @StorageLink(READER_TRANSIENT_HOST_STORAGE_KEY) @Watch('toastChanged') private activeHost: number = 0;
  private hostId: number = -1;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') @Watch('foregroundChanged') private foreground: boolean = true;
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @State private displayed: boolean = false;
  @State private toastOpacity: number = 0;
  @State private toastOffsetY: number = 12;
  private handledGeneration: number = -1;
  private dismissTimer: number = -1;

  aboutToAppear(): void {
    this.hostId = registerReaderTransientHost(this.priority);
    this.syncToast();
  }

  aboutToDisappear(): void {
    this.clearDismissTimer();
    unregisterReaderTransientHost(this.hostId);
    this.hostId = -1;
  }

  toastChanged(): void {
    this.syncToast();
  }

  foregroundChanged(): void {
    if (!this.foreground) {
      this.clearDismissTimer();
      if (this.activeHost === this.hostId) this.dismiss(this.handledGeneration);
      this.displayed = false;
      this.toastOpacity = 0;
      return;
    }
    this.syncToast();
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      if (this.displayed) {
        Row() {
          Stack({ alignContent: Alignment.Center }) {
            Text(this.toast.tone === 'success' ? '✓' : this.toast.tone === 'error' ? '!' : 'i')
              .fontFamily(MESSAGE_TOAST_TITLE.fontFamily)
              .fontWeight(MESSAGE_TOAST_TITLE.fontWeight)
              .fontSize(14)
              .fontColor(readerAppColor('TOK_MESSAGE_FEEDBACK_MARK_INK', this.appThemeScheme))
              .textAlign(TextAlign.Center)
              .width(22)
              .height(22);
          }
          .width(22)
          .height(22)
          .borderRadius(11)
          .backgroundColor(readerAppColor('TOK_MESSAGE_FEEDBACK_MARK', this.appThemeScheme));

          Column() {
            if (this.toast.title.trim().length > 0) {
              Text(this.toast.title)
                .fontFamily(MESSAGE_TOAST_TITLE.fontFamily)
                .fontWeight(MESSAGE_TOAST_TITLE.fontWeight)
                .fontSize(MESSAGE_TOAST_TITLE.fontSizeFp)
                .lineHeight(MESSAGE_TOAST_TITLE.lineHeightFp)
                .fontColor(readerAppColor('TOK_MESSAGE_FEEDBACK_INK', this.appThemeScheme))
                .wordBreak(WordBreak.BREAK_WORD);
            }
            Text(this.toast.message)
              .fontFamily(MESSAGE_TOAST_BODY.fontFamily)
              .fontWeight(this.toast.title.length > 0 ? MESSAGE_TOAST_BODY.fontWeight : MESSAGE_TOAST_TITLE.fontWeight)
              .fontSize(this.toast.title.length > 0 ? MESSAGE_TOAST_BODY.fontSizeFp : MESSAGE_TOAST_TITLE.fontSizeFp)
              .lineHeight(this.toast.title.length > 0 ? MESSAGE_TOAST_BODY.lineHeightFp : MESSAGE_TOAST_TITLE.lineHeightFp)
              .fontColor(readerAppColor('TOK_MESSAGE_FEEDBACK_INK', this.appThemeScheme))
              .opacity(this.toast.title.trim().length > 0 ? 0.74 : 1)
              .margin({ top: this.toast.title.length > 0 ? 2 : 0 })
              .wordBreak(WordBreak.BREAK_WORD);
          }
          .layoutWeight(1)
          .margin({ left: 10 })
          .alignItems(HorizontalAlign.Start);
        }
        .width('100%')
        .constraintSize({ maxWidth: 560 })
        .padding({ left: 14, right: 14, top: 12, bottom: 12 })
        .borderRadius(15)
        .border({ width: 1, color: readerAppColor('TOK_MESSAGE_FEEDBACK_BORDER', this.appThemeScheme) })
        .backgroundColor(readerAppColor('TOK_MESSAGE_FEEDBACK', this.appThemeScheme))
        .shadow({ radius: 18, offsetY: 6, color: '#33000000' })
        .opacity(this.toastOpacity)
        .translate({ y: this.toastOffsetY });
      }
    }
    .width('100%')
    .height(this.bounded ? undefined : '100%')
    .padding({ left: 15 + readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics(), true),
      right: 15 + readerInteractiveSafeRight(ReaderWindowCoordinator.metrics(), true), bottom: this.toastBottomInset() })
    .zIndex(1000)
    .visibility(this.displayed ? Visibility.Visible : Visibility.Hidden)
    .hitTestBehavior(HitTestMode.None);
  }

  private toastBottomInset(): number {
    if (this.metricsRevision < 0) return 52;
    return Math.max(52, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics(), true) + 16);
  }

  private syncToast(): void {
    if (this.hostId < 0 || this.activeHost !== this.hostId || !this.foreground || !this.toast.visible || this.toast.message.trim().length === 0) {
      this.displayed = false;
      this.toastOpacity = 0;
      this.clearDismissTimer();
      return;
    }
    if (!Number.isSafeInteger(this.toast.generation) || this.toast.generation <= this.handledGeneration) return;
    this.handledGeneration = this.toast.generation;
    this.clearDismissTimer();
    this.displayed = true;
    this.toastOpacity = 0;
    this.toastOffsetY = 10;
    const reduceMotion = readerReduceMotionFromStorage();
    try {
      this.getUIContext().animateTo(readerMotionAnimateParam('message.feedback.enter', reduceMotion), (): void => {
        this.toastOpacity = 1;
        this.toastOffsetY = 0;
      });
    } catch (_) {
      this.toastOpacity = 1;
      this.toastOffsetY = 0;
    }
    const generation = this.toast.generation;
    const duration = Math.max(1, Number.isFinite(this.toast.duration) ? this.toast.duration : 2000);
    this.dismissTimer = setTimeout((): void => this.dismiss(generation), duration);
  }

  private dismiss(generation: number): void {
    const current = AppStorage.get<ReaderTransientToastState>(READER_TRANSIENT_TOAST_STORAGE_KEY);
    if (this.activeHost !== this.hostId || current === undefined || current.generation !== generation) return;
    this.clearDismissTimer();
    retireReaderTransientToast(generation);
    this.displayed = false;
    this.toastOpacity = 0;
  }

  private clearDismissTimer(): void {
    if (this.dismissTimer >= 0) clearTimeout(this.dismissTimer);
    this.dismissTimer = -1;
  }

}
