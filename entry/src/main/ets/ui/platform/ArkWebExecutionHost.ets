import { readerKeyboardHostBottom } from '../layout/ReaderKeyboardGeometry';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeTop } from '../foundation/ReaderWindowMetrics';
import { readerPageAreaLength } from '../layout/ReaderPageShell';
import { readerReadableFontScale } from '../foundation/ReaderSurfaceResolvers';
import inputMethod from '@ohos.inputMethod';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { ReaderActionAccessibility } from '../controls/ReaderActionAccessibility';
import { consumeReaderControlKeyboardBack } from '../foundation/ReaderKeyboardBack';
import { ReaderTransientFeedback } from '../feedback/ReaderTransientFeedback';
import { ReaderTransientToast } from '../feedback/ReaderTransientToast';
import { ArkWebExecutor, type ArkWebInteractiveNavigation, type ArkWebLoginClearOutcome,
  type ArkWebPresentation, type ArkWebSurface } from '../../platform/network/ArkWebExecutor';
import { httpUrlHostname, redactedHttpUrl } from '../../platform/network/HttpTransportPolicy';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../foundation/ReaderFontFamilies';

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
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @State private hostWidth: number = 0;
  @State private hostHeight: number = 0;
  @State private hostX: number = 0;
  @State private hostY: number = 0;
  @State private measuredToolbarHeight: number = 0;
  @State private measuredControlsHeight: number = 0;
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
    this.clearOutcome = undefined;
    this.measuredToolbarHeight = 0;
    this.measuredControlsHeight = 0;
    this.surfaceId = surface?.id ?? 0;
  };
  private readonly presentationListener = (presentation: ArkWebPresentation): void => {
    if (this.currentSurface?.id !== presentation.surfaceId) return;
    this.interactive = presentation.visible;
    this.title = presentation.title;
    const surface = this.currentSurface;
    if (presentation.visible && surface !== undefined) {
      this.interactiveBackSurface = surface;
      this.onInputCaptureChange(true);
      this.updateAddress(presentation.currentUrl ?? '');
      this.canClear = presentation.canClear === true;
      this.clearOutcome = presentation.clearOutcome;
      this.updateHistory(surface);
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
    this.onBackBridge(undefined);
    this.interactiveBackSurface = undefined;
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
    ArkWebExecutor.instance.navigateInteractive(surface, direction);
    this.updateHistory(surface);
  }

  private clearSession(surface: ArkWebSurface): void {
    if (!this.interactive || this.clearing || this.currentSurface !== surface) return;
    this.clearing = ArkWebExecutor.instance.requestInteractiveSessionClear(surface);
  }

  private showClearFeedback(surface: ArkWebSurface): void {
    const outcome = this.clearOutcome;
    if (outcome === undefined || this.currentSurface !== surface || !this.interactive) return;
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
      this.hostHeight > 0 ? this.hostHeight : metrics.windowRect.height, this.hostX,
      this.hostWidth > 0 ? this.hostWidth : metrics.windowRect.width);
    const bounds = this.interactiveBounds;
    const paneBottom = bounds === undefined ? bottom : Math.min(bottom, bounds.top + bounds.height - this.hostY);
    return Math.max(0, paneBottom - this.safeTop());
  }
  private toolbarHeight(): number {
    const lines = 14.5 * 1.5 + (this.currentUrl.length > 0 ? 10.5 * 1.5 + 2 : 0);
    return Math.min(this.safeHeight(), Math.max(this.measuredToolbarHeight, 48, lines * this.fontScale() + 4));
  }

  private controlsHeight(): number {
    return Math.min(Math.max(0, this.safeHeight() - this.toolbarHeight()),
      Math.max(44, this.measuredControlsHeight, 12 * 1.5 * this.fontScale() + 12));
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

  @Builder
  private browserAction(text: string, enabled: boolean, danger: boolean, action: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Text(text)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(12).fontWeight(FontWeight.Medium)
        .fontColor(readerAppColor(danger ? 'app.sourceUi.danger' : 'app.web.ink', this.appThemeScheme))
        .opacity(enabled ? 1 : 0.45).textAlign(TextAlign.Center).accessibilityLevel('no');
    }
    .layoutWeight(1).constraintSize({ minWidth: 44, minHeight: 44 }).padding({ left: 2, right: 2, top: 4, bottom: 4 })
    .backgroundColor(Color.Transparent).borderRadius(999).enabled(enabled)
    .attributeModifier(new ReaderActionAccessibility(text, enabled, false, true, undefined, 'nativeButton'))
    .onClick(action);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.interactive) {
        Row() {}
          .width(this.safeWidth()).height(this.safeHeight())
          .position({ x: this.safeLeft(), y: this.safeTop() })
          .backgroundColor(readerAppColor('app.web.surface', this.appThemeScheme))
          .hitTestBehavior(HitTestMode.None);
      }
      ForEach(this.surfacesForRender(this.surfaceId), (surface: ArkWebSurface) => {
        Web({
          src: 'about:blank',
          controller: surface.controller,
          incognitoMode: true,
        })
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .fileAccess(false)
          .onlineImageAccess(this.interactive)
          .width(this.interactive ? this.safeWidth() : '100%')
          .height(this.interactive ? Math.max(0, this.safeHeight() - this.toolbarHeight() - this.controlsHeight()) : '100%')
          .position({ x: this.interactive ? this.safeLeft() : 0,
            y: this.interactive ? this.safeTop() + this.toolbarHeight() : 0 })
          .opacity(this.interactive ? 1 : 0.001)
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
            if (!this.interactive || !ArkWebExecutor.instance.isSurfaceCurrent(surface)) return;
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
            ArkWebExecutor.instance.onPageEnd(event.url, surface);
            if (!ArkWebExecutor.instance.isSurfaceCurrent(surface) || httpUrlHostname(event.url) === undefined) return;
            this.updateAddress(event.url);
            this.pageLoading = false;
            if (this.interactive) this.updateHistory(surface);
          })

        if (this.interactive) {
          Scroll() {
          Row({ space: 8 }) {
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Text('取消')
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
                .fontSize(13)
                .fontWeight(FontWeight.Medium)
                .fontColor(readerAppColor('app.web.muted', this.appThemeScheme))
                .accessibilityLevel('no');
            }
              .width(this.toolbarActionWidth()).constraintSize({ minWidth: 44, minHeight: 44 })
              .padding(0).backgroundColor(Color.Transparent).borderRadius(999).enabled(!this.clearing)
              .attributeModifier(new ReaderActionAccessibility('取消登录', !this.clearing, false, true, undefined, 'nativeButton'))
              .defaultFocus(true)
              .onClick((): void => ArkWebExecutor.instance.cancelInteractive(surface));
            Column({ space: 2 }) {
              Text(this.title)
                .width('100%')
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD)
                .fontSize(14.5).textAlign(TextAlign.Center)
                .fontWeight(FontWeight.Bold)
                .fontColor(readerAppColor('app.web.ink', this.appThemeScheme))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
              if (this.currentHost.length > 0) {
                Row({ space: 4 }) {
                  if (this.currentUrl.startsWith('https://')) {
                    SymbolGlyph($r('sys.symbol.lock'))
                      .fontSize(11).fontColor([readerAppColor('app.web.muted', this.appThemeScheme)])
                      .accessibilityLevel('no');
                  }
                  Text(this.currentHost)
                    .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(10.5)
                    .fontColor(readerAppColor('app.web.muted', this.appThemeScheme))
                    .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
                }.justifyContent(FlexAlign.Center).width('100%');
              }
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Center);
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Text('完成')
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(13).fontWeight(FontWeight.Bold)
                .fontColor(readerAppColor('app.sourceUi.onPrimary', this.appThemeScheme))
                .backgroundColor(readerAppColor('app.sourceUi.primary', this.appThemeScheme))
                .constraintSize({ minWidth: 52, minHeight: 32 }).borderRadius(999).textAlign(TextAlign.Center)
                .opacity(this.clearing || this.pageLoading ? 0.45 : 1)
                .accessibilityLevel('no');
            }
              .width(this.toolbarActionWidth()).constraintSize({ minWidth: 44, minHeight: 44 })
              .padding(0).backgroundColor(Color.Transparent).borderRadius(999).enabled(!this.clearing && !this.pageLoading)
              .attributeModifier(new ReaderActionAccessibility('完成登录', !this.clearing && !this.pageLoading, false, true, undefined, 'nativeButton'))
              .onClick((): void => ArkWebExecutor.instance.finishInteractive(surface));
          }
          .width(this.safeWidth())
          .constraintSize({ minHeight: 44 })
          .padding({ left: 12, right: 12, top: 2, bottom: 2 })
          .onAreaChange(this.toolbarAreaHandler(surface))
          .alignItems(VerticalAlign.Center)
          .backgroundColor(readerAppColor('app.web.surface', this.appThemeScheme))
          .border({ width: { bottom: 0.5 }, color: readerAppColor('TOK_BORDER', this.appThemeScheme) });
          }.width(this.safeWidth()).height(this.toolbarHeight())
            .position({ x: this.safeLeft(), y: this.safeTop() }).scrollBar(BarState.Auto).clip(true);

          if (this.pageLoading && this.pageProgress > 0) {
            Row() {}
              .width(this.safeWidth() * this.pageProgress / 100).height(2)
              .position({ x: this.safeLeft(), y: this.safeTop() + this.toolbarHeight() })
              .backgroundColor(readerAppColor('app.sourceUi.primary', this.appThemeScheme))
              .hitTestBehavior(HitTestMode.None);
          }

          Scroll() {
            Row() {
              this.browserAction('后退', this.canGoBack && !this.clearing && !this.pageLoading, false,
                (): void => this.navigate(surface, 'back'));
              this.browserAction('前进', this.canGoForward && !this.clearing && !this.pageLoading, false,
                (): void => this.navigate(surface, 'forward'));
              this.browserAction('刷新', !this.clearing && !this.pageLoading, false,
                (): void => this.navigate(surface, 'refresh'));
              this.browserAction('清除登录态', this.canClear && !this.clearing, true,
                (): void => this.clearSession(surface));
            }
            .width(this.safeWidth()).constraintSize({ minHeight: 44 }).padding({ left: 8, right: 8 })
            .onAreaChange(this.controlsAreaHandler(surface)).alignItems(VerticalAlign.Center)
            .backgroundColor(readerAppColor('app.web.surface', this.appThemeScheme))
            .border({ width: { top: 0.5 }, color: readerAppColor('TOK_BORDER', this.appThemeScheme) });
          }
          .width(this.safeWidth()).height(this.controlsHeight())
          .position({ x: this.safeLeft(), y: this.safeTop() + this.safeHeight() - this.controlsHeight() })
          .scrollBar(BarState.Auto).clip(true);

          ReaderTransientToast({ priority: 10, bounded: true })
            .width(this.safeWidth()).height(this.safeHeight())
            .position({ x: this.safeLeft(), y: this.safeTop() })
            .onAppear((): void => this.showClearFeedback(surface));
        }
      }, (surface: ArkWebSurface): string => `${surface.id}`)
    }
    .width(this.interactive ? '100%' : 1)
    .height(this.interactive ? '100%' : 1)
    .onAreaChange((_old: Area, next: Area): void => {
      if (!this.mounted || !this.interactive) return;
      this.hostWidth = readerPageAreaLength(next.width); this.hostHeight = readerPageAreaLength(next.height);
      this.hostX = readerPageAreaLength(next.globalPosition.x); this.hostY = readerPageAreaLength(next.globalPosition.y);
    })
    .accessibilityLevel(this.interactive ? 'auto' : 'no-hide-descendants')
    .zIndex(this.interactive ? 10000 : -1)
  }
}
