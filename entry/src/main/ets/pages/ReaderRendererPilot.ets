// Explicit debug cold-start route only. Uses an original frozen Core export;
// never imports a user book, persists a position, or replaces the native reader.
import webview from '@ohos.web.webview';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { router } from '@kit.ArkUI';

@Entry
@Component
struct ReaderRendererPilot {
  @State private result: string = '隔离正文试点载入中';
  private readonly controller: webview.WebviewController = new webview.WebviewController('reader-oss-pilot');

  build() {
    Column() {
      Row({ space: 12 }) {
        Button('返回书架').onClick((): void => { router.replaceUrl({ url: 'pages/Index' }); });
        Text(this.result).fontSize(12).layoutWeight(1).id('reader-oss-pilot-status');
      }.width('100%').padding(12)
      Web({ src: $rawfile('reader-oss-pilot/index.html'), controller: this.controller, incognitoMode: true })
        .javaScriptAccess(true)
        .domStorageAccess(false)
        .fileAccess(false)
        .onlineImageAccess(false)
        .width('100%')
        .layoutWeight(1)
        .onInterceptRequest((event): WebResourceResponse => {
          const url = event.request.getRequestUrl();
          if (!/^https?:/i.test(url)) return null!;
          const denied = new WebResourceResponse();
          denied.setResponseCode(403);
          denied.setReasonMessage('Pilot has no network resources');
          denied.setResponseMimeType('text/plain');
          denied.setResponseData('');
          return denied;
        })
        .onOverrideUrlLoading((request): boolean => /^https?:/i.test(request.getRequestUrl()))
        .onPageBegin((event): void => {
          hilog.info(0x5244, 'ReaderOssPilot', 'page-begin %{public}s', event.url);
        })
        .onPageEnd((event): void => {
          hilog.info(0x5244, 'ReaderOssPilot', 'page-end %{public}s', event.url);
        })
        .onErrorReceive((event): void => {
          hilog.error(0x5244, 'ReaderOssPilot', 'resource-error url=%{public}s code=%{public}d',
            event.request.getRequestUrl(), event.error.getErrorCode());
          this.result = '试点资源加载失败，见诊断记录';
        })
        .onConsole((event): boolean => {
          const message = event.message.getMessage();
          if (message.startsWith('READER_OSS_PILOT_RESULT ')) {
            hilog.info(0x5244, 'ReaderOssPilot', '%{public}s', message);
            this.result = message.includes('"pass":false') ? '投影检查有失败，见诊断记录' : '投影检查通过；待设备交互对照';
          } else if (message.startsWith('READER_OSS_PILOT_ERROR ')) {
            hilog.error(0x5244, 'ReaderOssPilot', '%{public}s', message);
            this.result = '试点载入失败，见诊断记录';
          }
          return false;
        })
    }.width('100%').height('100%').backgroundColor('#F7F4ED')
  }
}
