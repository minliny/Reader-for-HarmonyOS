import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { BookshelfDetailPresentation } from '../presentation/BookshelfDetailPresentation';

@Component
export struct BookshelfDetailNotice {
  @Prop grouped: boolean = false;
  @Prop follows: boolean = false;
  @Prop layoutWidthVp: number = -1;
  @ObjectLink presentation: BookshelfDetailPresentation;
  canInteract: () => boolean = (): boolean => false;

  build() {
    Column() {
      if (this.presentation.addRecovery() !== undefined) {
        ReaderRecoveryNotice({ grouped: this.grouped, follows: this.follows, layoutWidthVp: this.layoutWidthVp, tag: '书架', actionLabel: '', view: this.presentation.addRecovery()! });
      }
      if (this.presentation.removalRecovery() !== undefined) {
        ForEach([this.presentation.identity()], (identity: string): void => {
          ForEach([this.presentation.operationGeneration()], (expected: number): void => {
            ReaderRecoveryNotice({ grouped: this.grouped, follows: this.follows || this.presentation.addRecovery() !== undefined, layoutWidthVp: this.layoutWidthVp, tag: '书架', view: this.presentation.removalRecovery()!, actionLabel: '核对原操作',
              busy: this.presentation.reconciliationBusy(),
              onReconcile: (): void => {
                if (this.canInteract()) void this.presentation.reconcile(expected, identity);
              } });
          }, (generation: number): string => generation.toString());
        }, (identity: string): string => identity);
      }
    }.width('100%');
  }
}
