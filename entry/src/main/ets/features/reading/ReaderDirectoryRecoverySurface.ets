import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from './ReadingDirectoryRecovery';
import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';

/** The two finite directory recovery families use the existing notice/action
 * surfaces. Only the temporary action actors are keyed; the Reader tree stays. */
@Component
export struct ReaderDirectoryRecoverySurface {
  @Prop recovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  onReconcileBookmarks: (generation: number, presentationId: string) => void = (): void => {};
  onContinueBookmarks: (generation: number, presentationId: string) => void = (): void => {};
  onReconcileOffline: (generation: number, presentationId: string) => void = (): void => {};
  onContinueOffline: (generation: number, presentationId: string) => void = (): void => {};

  private identities(): string[] {
    const identities: string[] = [];
    if (this.recovery.bookmarks.visible) identities.push(`${this.recovery.presentationId}\u0000bookmark\u0000${this.recovery.bookmarks.generation}`);
    if (this.recovery.offline.visible) identities.push(`${this.recovery.presentationId}\u0000offline\u0000${this.recovery.offline.generation}`);
    return identities;
  }
  private capturedGeneration(identity: string): number { return Number(identity.slice(identity.lastIndexOf('\u0000') + 1)); }
  private capturedPresentation(identity: string): string {
    const suffix = identity.slice(0, identity.lastIndexOf('\u0000'));
    return suffix.slice(0, suffix.lastIndexOf('\u0000'));
  }
  private isBookmarks(identity: string): boolean {
    const suffix = identity.slice(0, identity.lastIndexOf('\u0000'));
    return suffix.slice(suffix.lastIndexOf('\u0000') + 1) === 'bookmark';
  }
  private view(identity: string): ReaderRecoveryView { return this.isBookmarks(identity) ? this.recovery.bookmarks : this.recovery.offline; }
  private noticeView(identity: string): ReaderRecoveryView {
    const current: ReaderRecoveryView = this.view(identity);
    return { visible: current.visible, message: current.message, generation: current.generation, canRetry: false };
  }
  private isCurrent(identity: string): boolean {
    return this.capturedPresentation(identity) === this.recovery.presentationId && this.view(identity).visible &&
      this.capturedGeneration(identity) === this.view(identity).generation;
  }
  private canContinue(identity: string): boolean {
    return this.isCurrent(identity) && (this.isBookmarks(identity) ? this.recovery.canContinueBookmarks : this.recovery.canContinueOffline);
  }
  private reconcile(identity: string, continuing: boolean): void {
    if (!this.isCurrent(identity) || (continuing ? !this.canContinue(identity) : !this.view(identity).canRetry)) return;
    const generation = this.capturedGeneration(identity), presentation = this.capturedPresentation(identity);
    if (this.isBookmarks(identity)) {
      if (continuing) this.onContinueBookmarks(generation, presentation); else this.onReconcileBookmarks(generation, presentation);
    } else {
      if (continuing) this.onContinueOffline(generation, presentation); else this.onReconcileOffline(generation, presentation);
    }
  }
  build() {
    Column() {
      ForEach(this.identities(), (identity: string) => {
        ReaderRecoveryNotice({ view: this.noticeView(identity) });
        if (this.view(identity).canRetry) {
          ReaderRecoveryAction({ label: this.isBookmarks(identity) ? '重新载入核对书签' : '核对离线结果',
            generation: this.capturedGeneration(identity), actionEnabled: this.isCurrent(identity),
            onReconcile: (): void => this.reconcile(identity, false) });
        }
        if (this.canContinue(identity)) {
          ReaderRecoveryAction({ label: '继续原操作', generation: this.capturedGeneration(identity),
            actionEnabled: this.canContinue(identity), onReconcile: (): void => this.reconcile(identity, true) });
        }
      }, (identity: string): string => identity);
    }.width('100%');
  }
}
