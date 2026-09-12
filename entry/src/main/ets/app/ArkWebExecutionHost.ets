import webview from '@ohos.web.webview';
import { ArkWebExecutor, type ArkWebPresentation } from './ArkWebExecutor';
import { redactedHttpUrl } from './HttpTransportPolicy';

/**
 * One process-wide ArkWeb surface for background source evaluation. It stays
 * physically mounted because WebviewController APIs require a bound Web
 * component, but occupies one transparent pixel and never renders book text.
 */
@Component
export struct ArkWebExecutionHost {
  @State private interactive: boolean = false;
  @State private title: string = '';
  @State private currentUrl: string = '';
  private readonly controller: webview.WebviewController =
    new webview.WebviewController('reader-source-executor');
  private readonly presentationListener = (presentation: ArkWebPresentation): void => {
    this.interactive = presentation.visible;
    this.title = presentation.title;
    if (presentation.visible) {
      // A new interactive job starts: drop the previous page's address until
      // its own onPageBegin reports the fresh one.
      this.currentUrl = '';
    }
  };

  aboutToAppear(): void {
    ArkWebExecutor.instance.attachPresentation(this.presentationListener);
  }

  aboutToDisappear(): void {
    ArkWebExecutor.instance.detachPresentation(this.presentationListener);
    ArkWebExecutor.instance.detachController(this.controller);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Web({
        src: 'about:blank',
        controller: this.controller,
        incognitoMode: true,
      })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(false)
        .onlineImageAccess(this.interactive)
        .width('100%')
        .height('100%')
        .opacity(this.interactive ? 1 : 0.001)
        .hitTestBehavior(this.interactive ? HitTestMode.Default : HitTestMode.None)
        .onControllerAttached((): void => {
          this.currentUrl = '';
          ArkWebExecutor.instance.attachController(this.controller);
        })
        .onOverrideUrlLoading((request): boolean =>
          ArkWebExecutor.instance.blockNetworkUrl(request.getRequestUrl()))
        .onInterceptRequest((event): WebResourceResponse => {
          // API 23 documents null as "continue loading", but its callback
          // declaration omits null from the return type.
          if (!ArkWebExecutor.instance.blockNetworkUrl(event.request.getRequestUrl())) return null!;
          const denied = new WebResourceResponse();
          denied.setResponseCode(403);
          denied.setReasonMessage('Blocked by network policy');
          denied.setResponseMimeType('text/plain');
          denied.setResponseData('Network target blocked');
          return denied;
        })
        .onPageBegin((event): void => {
          const pageUrl = event.url;
          if (pageUrl.length > 0 && pageUrl !== 'about:blank') {
            this.currentUrl = redactedHttpUrl(pageUrl);
          }
        })
        .onPageEnd((event): void => {
          ArkWebExecutor.instance.onPageEnd(event.url);
        })

      if (this.interactive) {
        Row({ space: 12 }) {
          Text('取消')
            .fontSize(14)
            .fontWeight(FontWeight.Bold)
            .fontColor('#604C3B')
            .onClick((): void => ArkWebExecutor.instance.cancelInteractive());
          Column({ space: 2 }) {
            Text(this.title)
              .width('100%')
              .fontSize(15)
              .fontWeight(FontWeight.Bold)
              .fontColor('#2C2520')
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
            if (this.currentUrl.length > 0) {
              Text(this.currentUrl)
                .width('100%')
                .fontSize(11)
                .fontColor('#8A7B6B')
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start);
          Text('完成')
            .fontSize(14)
            .fontWeight(FontWeight.Bold)
            .fontColor('#2B6F62')
            .onClick((): void => ArkWebExecutor.instance.finishInteractive());
        }
        .width('100%')
        .height(56)
        .padding({ left: 18, right: 18 })
        .alignItems(VerticalAlign.Center)
        .backgroundColor('#FFFDF9')
        .shadow({ radius: 8, color: '#26000000', offsetY: 2 });
      }
    }
    .width(this.interactive ? '100%' : 1)
    .height(this.interactive ? '100%' : 1)
    .backgroundColor(this.interactive ? '#FFFDF9' : '#00000000')
    .zIndex(this.interactive ? 10000 : -1)
  }
}
