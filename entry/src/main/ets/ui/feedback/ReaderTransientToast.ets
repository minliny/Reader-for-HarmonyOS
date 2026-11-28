import { readerKeyboardHostBottom } from '../layout/ReaderKeyboardGeometry';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../foundation/ReaderWindowMetrics';
import { MESSAGE_ACTION, MESSAGE_BODY, MESSAGE_TITLE } from '../foundation/ReaderMessageStyle';
import type { ReaderTextStyle } from '../foundation/ReaderTypography';
import { readerAppColor } from '../foundation/ReaderAppColors';
import { readerMotionAnimateParam, readerMotionReducedFadeParam, readerReduceMotionFromStorage }
  from '../foundation/ReaderMotionPolicy';
import { ReaderPostLayoutFrame } from '../layout/ReaderPostLayoutFrame';
import { readerSurfaceElevation } from '../surfaces/ReaderSurfaceSpecs';
import { announceReaderTransientToast } from './ReaderTransientAnnouncement';
import {
  READER_TRANSIENT_TOAST_STORAGE_KEY,
  READER_TRANSIENT_HOST_STORAGE_KEY,
  registerReaderTransientHost,
  unregisterReaderTransientHost,
  retireReaderTransientToast,
  readerTransientTextObserver,
  createReaderTransientToastState,
  type ReaderTransientTextObserver,
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
  @State private editingHostHeight: number = -1;
  @State private editingHostY: number = 0;
  private handledGeneration: number = -1;
  private textLayoutGeneration: number = -1;
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
              .fontFamily(MESSAGE_TITLE.fontFamily)
              .fontWeight(MESSAGE_TITLE.fontWeight)
              // This status mark is the glyph inside a fixed22vp icon.
              // Message title/body below retain system-scaled text units.
              .fontSize('14vp')
              .fontColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
              .textAlign(TextAlign.Center)
              .width(22)
              .height(22);
          }
          .width(22)
          .height(22)
          .borderRadius(11)
          .backgroundColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));

          Column() {
            if (this.toast.title.trim().length > 0) {
              Text(this.toast.title)
                .fontFamily(MESSAGE_ACTION.fontFamily)
                .fontWeight(MESSAGE_ACTION.fontWeight)
                .fontSize(MESSAGE_ACTION.fontSizeFp)
                .lineHeight(MESSAGE_ACTION.lineHeightFp as number)
                .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
                .wordBreak(WordBreak.BREAK_WORD);
            }
            Text(this.toast.message, this.toastMessageTextOptions())
              .id(this.toastVerificationId(true))
              .fontFamily(this.toastMessageStyle().fontFamily)
              .fontWeight(this.toastMessageStyle().fontWeight)
              .fontSize(this.toastMessageStyle().fontSizeFp)
              .lineHeight(this.toastMessageStyle().lineHeightFp as number)
              .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
              .margin({ top: this.toast.title.length > 0 ? 2 : 0 })
              .wordBreak(WordBreak.BREAK_WORD)
              .onAreaChange(this.toastTextLayout(this.toast.generation));
          }
          .layoutWeight(1)
          .margin({ left: 10 })
          .alignItems(HorizontalAlign.Start);
        }
        .width('100%')
        .id(this.toastVerificationId(false))
        .constraintSize({ maxWidth: 560 })
        .padding({ left: 14, right: 14, top: 12, bottom: 12 })
        .borderRadius(999)
        .backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
        .shadow(readerSurfaceElevation('dialog', this.appThemeScheme))
        .opacity(this.toastOpacity)
        .translate({ y: this.toastOffsetY });
      }
    }
    .width('100%')
    .height(this.bounded ? undefined : '100%')
    .onAreaChange((_old: Area, next: Area): void => {
      if (this.bounded || this.hostId < 0) return;
      const height = Number(next.height), y = Number(next.globalPosition.y);
      if (Number.isFinite(height) && height >= 0 && Math.abs(height - this.editingHostHeight) > .1) this.editingHostHeight = height;
      if (Number.isFinite(y) && Math.abs(y - this.editingHostY) > .1) this.editingHostY = y;
    })
    .padding({ left: 15 + readerInteractiveSafeLeft(readerWindowMetrics(), true),
      right: 15 + readerInteractiveSafeRight(readerWindowMetrics(), true), bottom: this.toastBottomInset() })
    .zIndex(1000)
    .visibility(this.displayed ? Visibility.Visible : Visibility.Hidden)
    .hitTestBehavior(HitTestMode.None);
  }

  private toastMessageStyle(): ReaderTextStyle {
    return this.toast.title.trim().length > 0 ? MESSAGE_BODY : MESSAGE_ACTION;
  }

  private activeTextObserver(generation: number): ReaderTransientTextObserver | undefined {
    if (!this.foreground || !this.displayed || this.activeHost !== this.hostId ||
      !this.toast.visible || generation !== this.toast.generation || generation !== this.handledGeneration) return undefined;
    return readerTransientTextObserver(generation, this.hostId);
  }

  private toastVerificationId(text: boolean): string {
    const generation = this.toast.generation;
    if (this.activeTextObserver(generation) === undefined) return '';
    return `reader-transient-feedback-${text ? 'text-' : ''}${generation}`;
  }

  private toastMessageTextOptions(): TextOptions | undefined {
    try {
      const options = this.activeTextObserver(this.toast.generation)?.textOptions(this.toast.message);
      return options === undefined ? undefined : options as TextOptions;
    } catch (_) { return undefined; }
  }

  private toastTextLayout(generation: number): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      const observer = this.activeTextObserver(generation);
      if (observer === undefined || this.textLayoutGeneration === generation ||
        !(Number(next.width) > 0 && Number(next.height) > 0)) return;
      const host = this.hostId;
      const duration = this.toast.duration;
      const context = this.getUIContext();
      let retry = true;
      const observe = (): void => {
        if (host !== this.hostId || this.activeTextObserver(generation) !== observer) return;
        try {
          if (!observer.onLayout(generation, host, duration) && retry) {
            retry = false;
            context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
          }
        } catch (_) {}
      };
      try {
        context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
        this.textLayoutGeneration = generation;
      } catch (_) {}
    };
  }

  private toastBottomInset(): number {
    if (this.metricsRevision < 0) return 52;
    const metrics = readerWindowMetrics();
    if (this.bounded) return Math.max(52, readerInteractiveSafeBottom(metrics, true) + 16);
    const height = this.editingHostHeight >= 0 ? this.editingHostHeight : metrics.windowRect.height;
    return Math.max(52, height - readerKeyboardHostBottom(metrics, this.editingHostY, height) + 16);
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
    const reduceMotion = readerReduceMotionFromStorage();
    this.toastOffsetY = reduceMotion ? 0 : 10;
    try {
      this.getUIContext().animateTo(reduceMotion ? readerMotionReducedFadeParam() :
        readerMotionAnimateParam('message.feedback.enter', false), (): void => {
        this.toastOpacity = 1;
        this.toastOffsetY = 0;
      });
    } catch (_) {
      this.toastOpacity = 1;
      this.toastOffsetY = 0;
    }
    const generation = this.toast.generation;
    announceReaderTransientToast(() => this.getUIContext(), this.hostId, generation);
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
