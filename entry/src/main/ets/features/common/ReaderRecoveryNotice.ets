import { TYPE_APP_INHERITED_BODY } from './ReaderTypography';
import { readerAppColor } from './ReaderThemeRegistry';
import { ReaderRecoveryAction } from './ReaderRecoveryAction';
import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';

/** Compact honest operation feedback for pages without an existing status
 * surface. Owners supply the projection and read-only reconcile callback. */
@Component
export struct ReaderRecoveryNotice {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop view: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop actionLabel: string = '刷新列表';
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  build() {
    if (this.view.visible) {
      Column() {
        Text(this.view.message)
          .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .width('100%').padding(12).hitTestBehavior(HitTestMode.None);
        if (this.view.canRetry) {
          ReaderRecoveryAction({ label: this.actionLabel, generation: this.view.generation, onReconcile: this.onReconcile });
        }
      }.width('100%').hitTestBehavior(HitTestMode.Transparent);
    }
  }
}
