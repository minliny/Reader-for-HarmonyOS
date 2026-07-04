// Reader for HarmonyOS - M8 跨层基础设施 - ReaderErrorBoundary.ets
import { ReaderLogger } from './ReaderLogger';

// ArkUI 没有 React componentDidCatch,通过 try-catch 包裹 Builder
// 全局异常通过 ErrorManager.onException 监听
@Component
export struct ReaderErrorBoundary {
  @State hasError: boolean = false;
  @State errorMessage: string = '';
  @State errorStack: string = '';
  @Prop childBuilder: () => void;
  onRetry: () => void = () => {};

  build() {
    if (this.hasError) {
      // 错误状态:显示错误信息 + 重试按钮
      Column() {
        Text('出现错误')
          .fontSize(16)
          .fontWeight(500)
        Text(this.errorMessage)
          .fontSize(12)
          .margin({ top: 8 })
        Button('重试')
          .onClick(() => this.onRetry())
          .margin({ top: 16 })
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
    } else {
      this.childBuilder()
    }
  }

  // 供 Builder 内部 catch 调用
  catchError(error: Error): void {
    this.hasError = true;
    this.errorMessage = error.message || '未知错误';
    this.errorStack = error.stack || '';
    ReaderLogger.e('ErrorBoundary', 'Builder threw', error);
  }

  reset(): void {
    this.hasError = false;
    this.errorMessage = '';
    this.errorStack = '';
  }
}
