import { ReaderPageState } from '../common/ReaderPageState';

/** The owner retains bookmark admission, error facts and the existing retry. */
@Component
export struct ReaderBookmarkErrorState {
  @Prop message: string = '书签载入失败，请稍后重试';
  onRetry: () => void = (): void => {};

  build() {
    Column() {
      ReaderPageState({ title: '书签载入失败',
        message: this.message === '书签载入失败，请稍后重试' || this.message.trim().length === 0 ?
          '请稍后重试。' : this.message,
        actionLabel: '重试', onAction: this.onRetry });
    }.width('100%').height('100%').justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center).constraintSize({ minHeight: 0 });
  }
}
