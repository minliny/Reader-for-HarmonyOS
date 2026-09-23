// Explicit debug cold-start route only. Uses an original frozen Core export;
// never imports a user book, persists a position, or replaces the native reader.
import webview from '@ohos.web.webview';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { router } from '@kit.ArkUI';
import { ArkWebExecutionHost } from '../app/ArkWebExecutionHost';
import { ArkWebResourceDiagnostic } from '../app/ArkWebResourceDiagnostic';
import { ReaderParagraphDiagnostic } from './ReaderParagraphDiagnostic';
import { ReaderTextNodeDiagnostic } from './ReaderTextNodeDiagnostic';

@Entry
@Component
struct ReaderRendererPilot {
  @State private result: string = '隔离正文试点载入中';
  @State private resourceMode: boolean = false;
  @State private paragraphMode: boolean = false;
  @State private textNodeMode: boolean = false;
  @State private resourceBusy: boolean = false;
  private resourceDiagnostic: ArkWebResourceDiagnostic = new ArkWebResourceDiagnostic();
  private readonly controller: webview.WebviewController = new webview.WebviewController('reader-oss-pilot');

  aboutToDisappear(): void {
    this.resourceDiagnostic.dispose();
  }

  private async runResourceDiagnostic(scenario: 'early' | 'cancel'): Promise<void> {
    if (this.resourceBusy) return;
    this.resourceBusy = true;
    this.result = 'PH76 受控资源验证中（不访问外网）';
    try {
      this.result = await this.resourceDiagnostic.run(scenario);
    } catch (error) {
      this.result = `PH76 无法完成：${(error as Error).message}`;
    } finally {
      this.resourceBusy = false;
    }
  }

  build() {
    Column() {
      Row({ space: 12 }) {
        Button('返回书架').onClick((): void => { router.replaceUrl({ url: 'pages/Index' }); });
        Text(this.result).fontSize(12).layoutWeight(1).id('reader-oss-pilot-status');
      }.width('100%').padding(12)
      if (this.textNodeMode) {
        Button('返回正文试点').onClick((): void => { this.textNodeMode = false; });
        ReaderTextNodeDiagnostic();
      } else if (this.paragraphMode) {
        Button('返回正文试点').onClick((): void => { this.paragraphMode = false; });
        ReaderParagraphDiagnostic();
      } else if (this.resourceMode) {
        Column({ space: 12 }) {
          Text('PH76 · 真实 WebView 回调，内存响应样本；不读写用户书籍').fontSize(14);
          Button('验证早期资源回调').enabled(!this.resourceBusy).id('reader-ph76-early')
            .onClick((): void => { void this.runResourceDiagnostic('early'); });
          Button('验证取消后资源归属').enabled(!this.resourceBusy).id('reader-ph76-cancel')
            .onClick((): void => { void this.runResourceDiagnostic('cancel'); });
          Button('返回正文试点').enabled(!this.resourceBusy).onClick((): void => {
            this.resourceDiagnostic.dispose();
            this.resourceMode = false;
          });
          ArkWebExecutionHost({ diagnosticResourceProvider: this.resourceDiagnostic.provide });
        }.width('100%').layoutWeight(1);
      } else {
      Button('原生 Text 同节点诊断').id('reader-textnode-open').onClick((): void => {
        this.textNodeMode = true;
      });
      Button('系统 Paragraph 诊断').id('reader-paragraph-open').onClick((): void => {
        this.paragraphMode = true;
      });
      Button('PH76 资源验证').id('reader-ph76-open').onClick((): void => {
        this.resourceDiagnostic = new ArkWebResourceDiagnostic();
        this.result = '选择一项 PH76 受控验证';
        this.resourceMode = true;
      });
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
      }
    }.width('100%').height('100%').backgroundColor('#F7F4ED')
  }
}
