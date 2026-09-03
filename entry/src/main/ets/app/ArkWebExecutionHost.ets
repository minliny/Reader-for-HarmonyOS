import webview from '@ohos.web.webview';
import { ArkWebExecutor, type ArkWebPresentation } from './ArkWebExecutor';

/**
 * One process-wide ArkWeb surface for background source evaluation. It stays
 * physically mounted because WebviewController APIs require a bound Web
 * component, but occupies one transparent pixel and never renders book text.
 */
@Component
export struct ArkWebExecutionHost {
  @State private interactive: boolean = false;
  @State private title: string = '';
  private readonly controller: webview.WebviewController =
    new webview.WebviewController('reader-source-executor');
  private readonly presentationListener = (presentation: ArkWebPresentation): void => {
    this.interactive = presentation.visible;
    this.title = presentation.title;
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
          ArkWebExecutor.instance.attachController(this.controller);
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
          Text(this.title)
            .layoutWeight(1)
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor('#2C2520')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
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
