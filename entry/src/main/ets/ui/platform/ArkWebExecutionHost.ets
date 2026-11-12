import inputMethod from '@ohos.inputMethod';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { ReaderActionAccessibility } from '../controls/ReaderActionAccessibility';
import { consumeReaderControlKeyboardBack } from '../foundation/ReaderKeyboardBack';
import { ArkWebExecutor, type ArkWebPresentation, type ArkWebSurface } from '../../platform/network/ArkWebExecutor';
import { redactedHttpUrl } from '../../platform/network/HttpTransportPolicy';

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
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @State private interactive: boolean = false;
  @State private title: string = '';
  @State private currentUrl: string = '';
  @State private surfaceId: number = 0;
  private currentSurface: ArkWebSurface | undefined = undefined;
  private interactiveBackSurface: ArkWebSurface | undefined = undefined;
  private readonly surfaceListener = (surface: ArkWebSurface | undefined): void => {
    this.currentSurface = surface;
    this.interactive = false;
    this.title = '';
    this.currentUrl = '';
    this.surfaceId = surface?.id ?? 0;
  };
  private readonly presentationListener = (presentation: ArkWebPresentation): void => {
    if (this.currentSurface?.id !== presentation.surfaceId) return;
    this.interactive = presentation.visible;
    this.title = presentation.title;
    if (presentation.visible) {
      this.interactiveBackSurface = this.currentSurface;
      this.onInputCaptureChange(true);
      // A new interactive job starts: drop the previous page's address until
      // its own onPageBegin reports the fresh one.
      this.currentUrl = '';
    }
  };

  aboutToAppear(): void {
    ArkWebExecutor.instance.attachSurfaceHost(this.surfaceListener);
    ArkWebExecutor.instance.attachPresentation(this.presentationListener);
    this.onBackBridge((): boolean => this.consumeBack());
  }

  aboutToDisappear(): void {
    this.onBackBridge(undefined);
    this.interactiveBackSurface = undefined;
    this.onInputCaptureChange(false);
    this.diagnosticResourceProvider = undefined;
    ArkWebExecutor.instance.detachPresentation(this.presentationListener);
    ArkWebExecutor.instance.detachSurfaceHost(this.surfaceListener);
  }

  private consumeBack(): boolean {
    const surface = this.interactiveBackSurface;
    if (surface === undefined) return false;
    // Keep Back in the closing window until the native Web detaches.
    if (!this.interactive || !ArkWebExecutor.instance.isSurfaceCurrent(surface)) return true;
    if (!consumeReaderControlKeyboardBack(readerWindowMetrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Source login keyboard dismissal failed: %{private}s', error.message);
      },
    })) ArkWebExecutor.instance.cancelInteractive(surface);
    return true;
  }

  private surfacesForRender(id: number): ArkWebSurface[] {
    return this.currentSurface?.id === id ? [this.currentSurface] : [];
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
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
          .width('100%')
          .height('100%')
          .opacity(this.interactive ? 1 : 0.001)
          // Background source execution must not acquire keyboard/navigation
          // focus. Hit-test exclusion alone only excludes pointer events.
          .focusable(this.interactive)
          .focusOnTouch(this.interactive)
          .hitTestBehavior(this.interactive ? HitTestMode.Default : HitTestMode.None)
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
            const pageUrl = event.url;
            if (pageUrl.length > 0 && pageUrl !== 'about:blank') {
              this.currentUrl = redactedHttpUrl(pageUrl);
            }
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
          })

        if (this.interactive) {
          Row({ space: 12 }) {
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Text('取消')
                .fontSize(14)
                .fontWeight(FontWeight.Bold)
                .fontColor(readerAppColor('app.web.status', this.appThemeScheme))
                .accessibilityLevel('no');
            }
              .padding(0).constraintSize({ minWidth: 0, minHeight: 0 })
              .backgroundColor(Color.Transparent).borderRadius(0)
              .attributeModifier(new ReaderActionAccessibility('取消登录', true, false, true, undefined, 'nativeButton'))
              .defaultFocus(true)
              .onClick((): void => ArkWebExecutor.instance.cancelInteractive(surface));
            Column({ space: 2 }) {
              Text(this.title)
                .width('100%')
                .fontSize(15)
                .fontWeight(FontWeight.Bold)
                .fontColor(readerAppColor('app.web.ink', this.appThemeScheme))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
              if (this.currentUrl.length > 0) {
                Text(this.currentUrl)
                  .width('100%')
                  .fontSize(11)
                  .fontColor(readerAppColor('app.web.muted', this.appThemeScheme))
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis });
              }
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start);
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Text('完成')
                .fontSize(14)
                .fontWeight(FontWeight.Bold)
                .fontColor(readerAppColor('app.web.action', this.appThemeScheme))
                .accessibilityLevel('no');
            }
              .padding(0).constraintSize({ minWidth: 0, minHeight: 0 })
              .backgroundColor(Color.Transparent).borderRadius(0)
              .attributeModifier(new ReaderActionAccessibility('完成登录', true, false, true, undefined, 'nativeButton'))
              .onClick((): void => ArkWebExecutor.instance.finishInteractive(surface));
          }
          .width('100%')
          .height(56)
          .padding({ left: 18, right: 18 })
          .alignItems(VerticalAlign.Center)
          .backgroundColor(readerAppColor('app.web.surface', this.appThemeScheme))
          .shadow({ radius: 8, color: readerAppColor('app.shadow.control', this.appThemeScheme), offsetY: 2 });
        }
      }, (surface: ArkWebSurface): string => `${surface.id}`)
    }
    .width(this.interactive ? '100%' : 1)
    .height(this.interactive ? '100%' : 1)
    .accessibilityLevel(this.interactive ? 'auto' : 'no-hide-descendants')
    .backgroundColor(this.interactive ? readerAppColor('app.web.surface', this.appThemeScheme) : readerAppColor('app.surface.transparent', this.appThemeScheme))
    .zIndex(this.interactive ? 10000 : -1)
  }
}
