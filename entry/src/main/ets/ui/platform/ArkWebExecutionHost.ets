import { readerKeyboardHostBottom } from '../layout/ReaderKeyboardGeometry';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeTop } from '../foundation/ReaderWindowMetrics';
import { readerPageAreaLength } from '../layout/ReaderPageShell';
import { readerReadableFontScale } from '../foundation/ReaderSurfaceResolvers';
import inputMethod from '@ohos.inputMethod';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerAppColor, type ReaderAppColorRole } from '../foundation/ReaderThemeRegistry';
import { readerPaperActionIcon } from '../foundation/ReaderActionIconResources';
import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerMotionAnimateParam } from '../foundation/ReaderMotionPolicy';
import { ReaderActionAccessibility } from '../controls/ReaderActionAccessibility';
import { consumeReaderControlKeyboardBack } from '../foundation/ReaderKeyboardBack';
import { ReaderTransientFeedback } from '../feedback/ReaderTransientFeedback';
import { ReaderTransientToast } from '../feedback/ReaderTransientToast';
import { ArkWebExecutor, type ArkWebInteractiveNavigation, type ArkWebLoginClearOutcome,
  type ArkWebPresentation, type ArkWebSurface } from '../../platform/network/ArkWebExecutor';
import { httpUrlHostname, redactedHttpUrl } from '../../platform/network/HttpTransportPolicy';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../foundation/ReaderFontFamilies';

/** Window-relative vp rectangle of the visible wide settings detail pane. */
export interface ArkWebInteractiveBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Serialized per-job Web surfaces. Only the numeric key is observed; native
 * controllers never pass through an ArkUI State/Prop copy or proxy boundary.
 */
@Component
export struct ArkWebExecutionHost {
  // Supplied only by the DEBUG/cold-start pilot; undefined on the app shell.
  diagnosticResourceProvider: ((url: string) => WebResourceResponse) | undefined = undefined;
  onBackBridge: (handler: (() => boolean) | undefined) => void = (): void => {};
  onInputCaptureChange: (captured: boolean) => void = (): void => {};
  @Prop interactiveBounds?: ArkWebInteractiveBounds = undefined;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @State private hostWidth: number = 0;
  @State private hostHeight: number = 0;
  @State private hostX: number = 0;
  @State private hostY: number = 0;
  @State private measuredToolbarHeight: number = 0;
  @State private measuredControlsHeight: number = 0;
  private hostArea: ArkWebInteractiveBounds | undefined = undefined;
  private mounted: boolean = false;

  @State private interactive: boolean = false;
  @State private title: string = '';
  @State private currentUrl: string = '';
  @State private currentHost: string = '';
  @State private canGoBack: boolean = false;
  @State private canGoForward: boolean = false;
  @State private pageLoading: boolean = false;
  @State private pageProgress: number = 0;
  @State private canClear: boolean = false;
  @State private clearing: boolean = false;
  @State private surfaceId: number = 0;
  private currentSurface: ArkWebSurface | undefined = undefined;
  private interactiveBackSurface: ArkWebSurface | undefined = undefined;
  private feedbackHostSurface: ArkWebSurface | undefined = undefined;
  private lastClearOutcome: ArkWebLoginClearOutcome | undefined = undefined;
  private clearOutcome: ArkWebLoginClearOutcome | undefined = undefined;
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private readonly surfaceListener = (surface: ArkWebSurface | undefined): void => {
    this.transientFeedback.reset();
    this.currentSurface = surface;
    this.interactive = false;
    this.title = '';
    this.currentUrl = '';
    this.currentHost = '';
    this.canGoBack = false;
    this.canGoForward = false;
    this.pageLoading = false;
    this.pageProgress = 0;
    this.canClear = false;
    this.clearing = false;
    this.feedbackHostSurface = undefined;
    this.lastClearOutcome = undefined;
    this.clearOutcome = undefined;
    this.measuredToolbarHeight = 0;
    this.measuredControlsHeight = 0;
    this.surfaceId = surface?.id ?? 0;
  };
  private readonly presentationListener = (presentation: ArkWebPresentation): void => {
    if (this.currentSurface?.id !== presentation.surfaceId) return;
    if (this.interactive !== presentation.visible) {
      if (presentation.visible) this.publishHostArea();
      const updateVisibility = (): void => { this.interactive = presentation.visible; };
      try {
        this.getUIContext().animateTo(readerMotionAnimateParam(presentation.visible ? 'app.navigation.push' :
          'app.navigation.pop', this.reduceMotion), updateVisibility);
      } catch (_) {
        updateVisibility();
      }
    }
    this.title = presentation.title;
    const surface = this.currentSurface;
    if (presentation.visible && surface !== undefined) {
      this.interactiveBackSurface = surface;
      this.onInputCaptureChange(true);
      this.updateAddress(presentation.currentUrl ?? '');
      this.canClear = presentation.canClear === true;
      this.updateHistory(surface);
      if (presentation.clearOutcome !== undefined && presentation.clearOutcome !== this.lastClearOutcome) {
        this.lastClearOutcome = presentation.clearOutcome;
        this.clearOutcome = presentation.clearOutcome;
        this.showClearFeedback(surface);
      }
    }
  };

  aboutToAppear(): void {
    this.mounted = true;
    ArkWebExecutor.instance.attachSurfaceHost(this.surfaceListener);
    ArkWebExecutor.instance.attachPresentation(this.presentationListener);
    this.onBackBridge((): boolean => this.consumeBack());
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.hostArea = undefined;
    this.onBackBridge(undefined);
    this.interactiveBackSurface = undefined;
    this.feedbackHostSurface = undefined;
    this.transientFeedback.reset();
    this.onInputCaptureChange(false);
    this.diagnosticResourceProvider = undefined;
    ArkWebExecutor.instance.detachPresentation(this.presentationListener);
    ArkWebExecutor.instance.detachSurfaceHost(this.surfaceListener);
  }

  private consumeBack(): boolean {
    const surface = this.interactiveBackSurface;
    if (surface === undefined) return false;
    // Keep Back in the closing window until the native Web detaches.
    if (!this.interactive || this.clearing || !ArkWebExecutor.instance.isSurfaceCurrent(surface)) return true;
    if (!consumeReaderControlKeyboardBack(readerWindowMetrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Source login keyboard dismissal failed: %{private}s', error.message);
      },
    })) ArkWebExecutor.instance.cancelInteractive(surface);
    return true;
  }

  private updateAddress(value: string): void {
    const host = httpUrlHostname(value);
    if (host === undefined) return;
    this.currentUrl = redactedHttpUrl(value);
    this.currentHost = host;
  }

  private updateHistory(surface: ArkWebSurface): void {
    const history = ArkWebExecutor.instance.interactiveHistory(surface);
    this.canGoBack = history.canGoBack;
    this.canGoForward = history.canGoForward;
  }

  private navigate(surface: ArkWebSurface, direction: ArkWebInteractiveNavigation): void {
    if (!this.interactive || this.clearing || this.currentSurface !== surface) return;
    if (direction === 'refresh' && this.pageLoading) return;
    if (direction === 'stop' && !this.pageLoading) return;
    if (ArkWebExecutor.instance.navigateInteractive(surface, direction) && direction === 'stop') {
      this.pageLoading = false;
      this.pageProgress = 0;
    }
    this.updateHistory(surface);
  }

  private clearSession(surface: ArkWebSurface): void {
    if (!this.interactive || this.clearing || this.currentSurface !== surface) return;
    this.clearing = ArkWebExecutor.instance.requestInteractiveSessionClear(surface);
  }

  private showClearFeedback(surface: ArkWebSurface): void {
    const outcome = this.clearOutcome;
    // Register the priority toast host before publishing. A host switch would
    // retire a toast published to the old host while the Web was mounting.
    if (outcome === undefined || this.feedbackHostSurface !== surface ||
      this.currentSurface !== surface || !this.interactive) return;
    this.clearOutcome = undefined;
    const message = outcome.report === 'cleared' ? '已清除登录态和旧检测报告' :
      outcome.report === 'unsupported' ? '已清除登录态，当前 Core 无法清除已保存的检测报告' :
      '已清除登录态，未能确认旧检测报告已清除';
    this.transientFeedback.show(() => this.getUIContext(), {
      message, tone: outcome.report === 'cleared' ? 'success' : 'info', key: `source-login-clear:${surface.id}`,
    }, () => this.mounted && this.interactive && this.currentSurface === surface &&
      ArkWebExecutor.instance.isSurfaceCurrent(surface));
  }

  private surfacesForRender(id: number): ArkWebSurface[] {
    return this.currentSurface?.id === id ? [this.currentSurface] : [];
  }

  private fontScale(): number {
    return readerReadableFontScale(this.readerWindowMetricsRevision < 0 ? 1 : readerWindowMetrics().systemFontScale);
  }

  private recordHostArea(area: Area): void {
    if (!this.mounted) return;
    this.hostArea = {
      width: readerPageAreaLength(area.width), height: readerPageAreaLength(area.height),
      left: readerPageAreaLength(area.globalPosition.x), top: readerPageAreaLength(area.globalPosition.y),
    };
    if (this.interactive) this.publishHostArea();
  }

  private publishHostArea(): void {
    const area = this.hostArea;
    if (area === undefined) return;
    if (this.hostWidth !== area.width) this.hostWidth = area.width;
    if (this.hostHeight !== area.height) this.hostHeight = area.height;
    if (this.hostX !== area.left) this.hostX = area.left;
    if (this.hostY !== area.top) this.hostY = area.top;
  }

  private safeLeft(): number {
    const windowLeft = readerInteractiveSafeLeft(readerWindowMetrics(), true);
    return Math.max(0, Math.max(windowLeft, this.interactiveBounds?.left ?? windowLeft) - this.hostX);
  }
  private safeTop(): number {
    const windowTop = readerInteractiveSafeTop(readerWindowMetrics(), true);
    return Math.max(0, Math.max(windowTop, this.interactiveBounds?.top ?? windowTop) - this.hostY);
  }
  private safeWidth(): number {
    const metrics = readerWindowMetrics();
    const windowRight = metrics.windowRect.width - readerInteractiveSafeRight(metrics, true);
    const bounds = this.interactiveBounds;
    const right = bounds === undefined ? windowRight : Math.min(windowRight, bounds.left + bounds.width);
    return Math.max(0, Math.min(this.hostWidth > 0 ? this.hostWidth : metrics.windowRect.width,
      right - this.hostX) - this.safeLeft());
  }
  private safeHeight(): number {
    const metrics = readerWindowMetrics();
    const bottom = readerKeyboardHostBottom(metrics, this.hostY,
      this.hostHeight > 0 ? this.hostHeight : metrics.windowRect.height,
      this.hostX + this.safeLeft(), this.safeWidth());
    const bounds = this.interactiveBounds;
    const paneBottom = bounds === undefined ? bottom : Math.min(bottom, bounds.top + bounds.height - this.hostY);
    return Math.max(0, paneBottom - this.safeTop());
  }
  private toolbarHeight(): number {
    const lines = 14.5 * 1.5 + (this.currentHost.length > 0 ? 10.5 * 1.5 + 2 : 0);
    return Math.min(this.safeHeight(), Math.max(this.measuredToolbarHeight, 48, lines * this.fontScale() + 4));
  }

  private controlsHeight(): number {
    return Math.min(Math.max(0, this.safeHeight() - this.toolbarHeight()),
      Math.max(this.measuredControlsHeight, (4 / this.controlsColumns()) * this.controlsActionHeight()));
  }

  private controlsColumns(): number {
    const available = Math.max(0, this.safeWidth() - 16);
    const longest = 5 * 12 * this.fontScale() + 4;
    return available >= 4 * Math.max(44, longest) ? 4 : 2;
  }

  private controlsActionHeight(): number {
    const scale = this.fontScale();
    const width = Math.max(0, this.safeWidth() - 16) / this.controlsColumns();
    const charsPerLine = Math.max(1, Math.floor((width - 4) / (12 * scale)));
    const lines = Math.ceil(5 / charsPerLine);
    return Math.max(44, Math.ceil(lines * 18 * scale + 24));
  }

  private toolbarActionWidth(): number {
    return Math.max(60, Math.ceil(2 * 13 * this.fontScale()) + 8);
  }
  private toolbarAreaHandler(surface: ArkWebSurface): (_old: Area, next: Area) => void {
    const revision = this.readerWindowMetricsRevision;
    return (_old: Area, next: Area): void => {
      if (!this.mounted || !this.interactive || this.currentSurface !== surface ||
        revision !== this.readerWindowMetricsRevision) return;
      this.measuredToolbarHeight = readerPageAreaLength(next.height);
    };
  }

  private controlsAreaHandler(surface: ArkWebSurface): (_old: Area, next: Area) => void {
    const revision = this.readerWindowMetricsRevision;
    return (_old: Area, next: Area): void => {
      if (!this.mounted || !this.interactive || this.currentSurface !== surface ||
        revision !== this.readerWindowMetricsRevision) return;
      this.measuredControlsHeight = readerPageAreaLength(next.height);
    };
  }

  private color(role: ReaderAppColorRole): string {
    return readerAppColor(role, this.appThemeScheme);
  }

  private browserTransition(): TransitionEffect {
    if (this.reduceMotion) return TransitionEffect.OPACITY.animation(readerMotionAnimateParam('app.navigation.push', true));
    return TransitionEffect.asymmetric(
      TransitionEffect.OPACITY.combine(TransitionEffect.translate({ y: 6 }))
        .animation(readerMotionAnimateParam('app.navigation.push', false)),
      TransitionEffect.OPACITY.animation(readerMotionAnimateParam('app.navigation.pop', false)));
  }

  @Builder
  private browserAction(text: string, enabled: boolean, icon: Resource, danger: boolean, action: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Column({ space: 2 }) {
        Image(icon).width(16).height(16).objectFit(ImageFit.Contain)
          .fillColor(this.color(danger ? 'app.sourceUi.danger' : 'app.sourceUi.primary'))
          .accessibilityLevel('no');
        Text(text)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(12)
          .fontColor(this.color(danger ? 'app.sourceUi.danger' : 'app.sourceUi.primary'))
          .textAlign(TextAlign.Center).accessibilityLevel('no');
      }.opacity(enabled ? 1 : 0.45);
    }
    .width(this.controlsColumns() === 4 ? '25%' : '50%')
    .constraintSize({ minWidth: 44, minHeight: this.controlsActionHeight() }).padding({ left: 2, right: 2, top: 3, bottom: 3 })
    .enabled(enabled)
    .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 999, 999, enabled))
    .attributeModifier(new ReaderActionAccessibility(text, enabled, false, true, undefined, 'nativeButton'))
    .onClick(action);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.interactive) {
        Row() {}
          .width(this.safeWidth()).height(this.safeHeight())
          .position({ x: this.safeLeft(), y: this.safeTop() })
          .backgroundColor(this.color('TOK_PAPER'))
          .transition(this.browserTransition())
          .hitTestBehavior(HitTestMode.None);
      }
      ForEach(this.surfacesForRender(this.surfaceId), (surface: ArkWebSurface) => {
        Web({
          src: 'about:blank',
          controller: surface.controller,
          incognitoMode: true,
        })
          .opacity(this.interactive ? 1 : 0.001)
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .fileAccess(false)
          .onlineImageAccess(this.interactive)
          .width(this.interactive ? this.safeWidth() : 1)
          .height(this.interactive ? Math.max(0, this.safeHeight() - this.toolbarHeight() - this.controlsHeight()) : 1)
          .position({ x: this.interactive ? this.safeLeft() : 0,
            y: this.interactive ? this.safeTop() + this.toolbarHeight() : 0 })
          .animation({ duration: 0 })
          // Background source execution must not acquire keyboard/navigation
          // focus. Hit-test exclusion alone only excludes pointer events.
          .focusable(this.interactive && !this.clearing)
          .focusOnTouch(this.interactive && !this.clearing)
          .hitTestBehavior(this.interactive && !this.clearing ? HitTestMode.Default : HitTestMode.None)
          .onControllerAttached((): void => {
            ArkWebExecutor.instance.attachController(surface);
          })
          .onDisAppear((): void => {
            if (this.interactiveBackSurface === surface) {
              this.interactiveBackSurface = undefined;
              this.onInputCaptureChange(false);
            }
            ArkWebExecutor.instance.detachController(surface);
          })
          .onOverrideUrlLoading((request): boolean =>
            ArkWebExecutor.instance.blockNetworkUrl(request.getRequestUrl(), surface))
          .onInterceptRequest((event): WebResourceResponse => {
            // API 23 documents null as "continue loading", but its callback
            // declaration omits null from the return type.
            if (!ArkWebExecutor.instance.blockNetworkUrl(event.request.getRequestUrl(), surface)) {
              if (this.diagnosticResourceProvider !== undefined) {
                return this.diagnosticResourceProvider(event.request.getRequestUrl());
              }
              return null!;
            }
            const denied = new WebResourceResponse();
            denied.setResponseCode(403);
            denied.setReasonMessage('Blocked by network policy');
            denied.setResponseMimeType('text/plain');
            denied.setResponseData('Network target blocked');
            return denied;
          })
          .onPageBegin((event): void => {
            ArkWebExecutor.instance.observeDiagnosticPageBegin(event.url, surface);
            if (!ArkWebExecutor.instance.isSurfaceCurrent(surface)) return;
            if (httpUrlHostname(event.url) !== undefined) {
              this.updateAddress(event.url);
              this.pageLoading = true;
              this.pageProgress = 0;
            }
          })
          .onNavigationEntryCommitted((event): void => {
            if (!event.isMainFrame || !this.interactive || !ArkWebExecutor.instance.isSurfaceCurrent(surface)) return;
            if (event.isSameDocument) {
              ArkWebExecutor.instance.onSameDocumentNavigation(event.url, surface);
              this.updateAddress(event.url);
              this.pageLoading = false;
            }
            this.updateHistory(surface);
          })
          .onProgressChange((event): void => {
            if (!this.interactive || !this.pageLoading || !ArkWebExecutor.instance.isSurfaceCurrent(surface)) return;
            this.pageProgress = Math.min(100, Math.max(0, event.newProgress));
          })
          .onResourceLoad((event): void => {
            ArkWebExecutor.instance.onResourceLoad(event.url, surface);
          })
          .onErrorReceive((event): void => {
            ArkWebExecutor.instance.onNativeError(event.request.getRequestUrl(), event.request.isMainFrame(),
              event.error.getErrorCode(), event.error.getErrorInfo(), surface);
          })
          .onHttpErrorReceive((event): void => {
            ArkWebExecutor.instance.onNativeHttpError(event.request.getRequestUrl(), event.request.isMainFrame(),
              event.response.getResponseCode(), surface);
          })
          .onPageEnd((event): void => {
            if (!ArkWebExecutor.instance.onPageEnd(event.url, surface) || httpUrlHostname(event.url) === undefined) return;
            this.updateAddress(event.url);
            this.pageLoading = false;
            if (this.interactive) this.updateHistory(surface);
          })

        if (this.interactive) {
          Scroll() {
          Row({ space: 8 }) {
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Text('取消')
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
                .fontSize(13)
                .fontColor(this.color('app.sourceUi.primary'))
                .opacity(this.clearing ? 0.45 : 1)
                .accessibilityLevel('no');
            }
              .width(this.toolbarActionWidth()).constraintSize({ minWidth: 44, minHeight: 44 })
              .padding(0).enabled(!this.clearing)
              .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 999, 999, !this.clearing))
              .attributeModifier(new ReaderActionAccessibility('取消登录', !this.clearing, false, true, undefined, 'nativeButton'))
              .defaultFocus(true)
              .onClick((): void => ArkWebExecutor.instance.cancelInteractive(surface));
            Column({ space: 2 }) {
              Text(this.title)
                .width('100%')
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD)
                .fontSize(14.5).textAlign(TextAlign.Center)
                .fontColor(this.color('TOK_INK'))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
              if (this.currentHost.length > 0) {
                Row({ space: 4 }) {
                  if (this.currentUrl.startsWith('https://')) {
                    Image(this.appThemeScheme === 'night' ? $r('app.media.source_login_lock_theme_night') :
                      $r('app.media.source_login_lock')).width(11).height(11)
                      .objectFit(ImageFit.Contain)
                      .accessibilityLevel('no');
                  }
                  Text(this.currentHost)
                    .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(10.5)
                    .fontColor(this.color('app.sourceUi.muted'))
                    .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
                }.justifyContent(FlexAlign.Center).width('100%');
              }
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Center);
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Text('完成')
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(13)
                .fontColor(this.color('app.sourceUi.onPrimary')).textAlign(TextAlign.Center)
                .accessibilityLevel('no');
            }
              .width(this.toolbarActionWidth()).constraintSize({ minWidth: 44, minHeight: 32 })
              .padding({ top: 4, bottom: 4 }).responseRegion([
                { x: 0, y: 0, width: '100%', height: '100%' }, { x: 0, y: -6, width: '100%', height: 44 },
              ])
              .enabled(!this.clearing).opacity(this.clearing ? 0.45 : 1)
              .attributeModifier(new ReaderPressFeedback(this.color('app.sourceUi.primary'), this.appThemeScheme, 999, 999, !this.clearing))
              .attributeModifier(new ReaderActionAccessibility('完成登录', !this.clearing, false, true, undefined, 'nativeButton'))
              .onClick((): void => ArkWebExecutor.instance.finishInteractive(surface));
          }
          .width(this.safeWidth())
          .constraintSize({ minHeight: 44 })
          .padding({ left: 12, right: 12, top: 2, bottom: 2 })
          .onAreaChange(this.toolbarAreaHandler(surface))
          .alignItems(VerticalAlign.Center)
          .backgroundColor(this.color('TOK_CARD_BG'))
          .border({ width: { bottom: 1 }, color: this.color('TOK_LINE') });
          }.width(this.safeWidth()).height(this.toolbarHeight())
            .position({ x: this.safeLeft(), y: this.safeTop() }).scrollBar(BarState.Auto).clip(true)
            .transition(this.browserTransition());

          if (this.pageLoading && this.pageProgress > 0) {
            Row() {}
              .width(this.safeWidth() * this.pageProgress / 100).height(2)
              .position({ x: this.safeLeft(), y: this.safeTop() + this.toolbarHeight() })
              .backgroundColor(readerAppColor('app.sourceUi.primary', this.appThemeScheme))
              .hitTestBehavior(HitTestMode.None);
          }

          Scroll() {
            Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center }) {
              this.browserAction('后退', this.canGoBack && !this.clearing && !this.pageLoading,
                this.appThemeScheme === 'night' ? $r('app.media.rc_chevron_left_theme_night') : $r('app.media.rc_chevron_left'), false,
                (): void => this.navigate(surface, 'back'));
              this.browserAction('前进', this.canGoForward && !this.clearing && !this.pageLoading,
                this.appThemeScheme === 'night' ? $r('app.media.rc_chevron_right_theme_night') : $r('app.media.rc_chevron_right'), false,
                (): void => this.navigate(surface, 'forward'));
              if (this.pageLoading) {
                this.browserAction('停止加载', !this.clearing, this.appThemeScheme === 'night' ?
                  $r('app.media.reader_auto_full_stop_theme_night') : $r('app.media.reader_auto_full_stop'), false,
                  (): void => this.navigate(surface, 'stop'));
              } else {
                this.browserAction('刷新', !this.clearing, this.appThemeScheme === 'night' ?
                  $r('app.media.settings_gen_refresh_theme_night') : $r('app.media.settings_gen_refresh'), false,
                  (): void => this.navigate(surface, 'refresh'));
              }
              this.browserAction('清除登录态', this.canClear && !this.clearing, readerPaperActionIcon('trash', this.appThemeScheme), true,
                (): void => this.clearSession(surface));
            }
            .width(this.safeWidth()).constraintSize({ minHeight: 44 }).padding({ left: 8, right: 8 })
            .onAreaChange(this.controlsAreaHandler(surface))
            .backgroundColor(this.color('TOK_CARD_BG'))
            .border({ width: { top: 1 }, color: this.color('TOK_LINE') });
          }
          .width(this.safeWidth()).height(this.controlsHeight())
          .position({ x: this.safeLeft(), y: this.safeTop() + this.safeHeight() - this.controlsHeight() })
          .scrollBar(BarState.Auto).clip(true).transition(this.browserTransition());

          ReaderTransientToast({ priority: 10, bounded: true })
            .width(this.safeWidth()).height(this.safeHeight())
            .position({ x: this.safeLeft(), y: this.safeTop() })
            .onAppear((): void => {
              this.feedbackHostSurface = surface;
              this.showClearFeedback(surface);
            })
            .onDisAppear((): void => {
              if (this.feedbackHostSurface === surface) this.feedbackHostSurface = undefined;
            });
        }
      }, (surface: ArkWebSurface): string => `${surface.id}`)
    }
    .width('100%').height('100%')
    .onAreaChange((_old: Area, next: Area): void => this.recordHostArea(next))
    .accessibilityLevel(this.interactive ? 'auto' : 'no-hide-descendants')
    .hitTestBehavior(this.interactive ? HitTestMode.Default : HitTestMode.Transparent)
    .zIndex(10000)
  }
}
