import { ReaderTransientFeedback } from '../common/ReaderTransientFeedback';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { MESSAGE_BODY } from '../common/ReaderMessageStyle';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery, type ReadingDirectoryMessageKind } from './ReadingDirectoryRecovery';
import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';

/** The two finite directory recovery families use the existing notice/action
 * surfaces. Only the temporary action actors are keyed; the Reader tree stays. */
@Component
export struct ReaderDirectoryRecoverySurface {
  private feedbackMounted: boolean = false;
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('notifyReadbackFailures') recovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  @State private dismissedResults: string[] = [];
  private notifiedReadbacks: Set<string> = new Set<string>();
  onReconcileBookmarks: (generation: number, presentationId: string) => void = (): void => {};
  onContinueBookmarks: (generation: number, presentationId: string) => void = (): void => {};
  onReconcileOffline: (generation: number, presentationId: string) => void = (): void => {};
  onContinueOffline: (generation: number, presentationId: string) => void = (): void => {};

  aboutToDisappear(): void { this.feedbackMounted = false; this.transientFeedback.reset(); }

  aboutToAppear(): void { this.feedbackMounted = true; this.notifyReadbackFailures(); }

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
  private kind(identity: string): ReadingDirectoryMessageKind {
    return (this.isBookmarks(identity) ? this.recovery.bookmarksKind : this.recovery.offlineKind) ?? 'pending';
  }
  private readbackFailed(identity: string): boolean {
    return (this.isBookmarks(identity) ? this.recovery.bookmarksReadbackFailed : this.recovery.offlineReadbackFailed) === true;
  }
  private busy(identity: string): boolean {
    return (this.isBookmarks(identity) ? this.recovery.bookmarksBusy : this.recovery.offlineBusy) === true;
  }
  private notifyReadbackFailures(): void {
    if (!this.feedbackMounted) return;
    const active = this.identities().filter((identity: string): boolean => this.readbackFailed(identity));
    for (const identity of this.notifiedReadbacks) if (!active.includes(identity)) this.notifiedReadbacks.delete(identity);
    for (const identity of active) {
      if (this.notifiedReadbacks.has(identity)) continue;
      if (this.transientFeedback.show(() => this.getUIContext(), { message: this.isBookmarks(identity) ?
        '书签更新已确认，列表读取失败。' : '缓存操作已确认，离线状态读取失败。', key: identity },
        (): boolean => this.feedbackMounted && this.isCurrent(identity))) this.notifiedReadbacks.add(identity);
    }
  }
  private isCurrent(identity: string): boolean {
    return this.capturedPresentation(identity) === this.recovery.presentationId && this.view(identity).visible &&
      this.capturedGeneration(identity) === this.view(identity).generation;
  }
  private canContinue(identity: string): boolean {
    return this.isCurrent(identity) && (this.isBookmarks(identity) ? this.recovery.canContinueBookmarks : this.recovery.canContinueOffline);
  }
  private reconcile(identity: string, continuing: boolean): void {
    if (!this.isCurrent(identity) || this.busy(identity) || (continuing ? !this.canContinue(identity) : !this.view(identity).canRetry)) return;
    const generation = this.capturedGeneration(identity), presentation = this.capturedPresentation(identity);
    if (this.isBookmarks(identity)) {
      if (continuing) this.onContinueBookmarks(generation, presentation); else this.onReconcileBookmarks(generation, presentation);
    } else {
      if (continuing) this.onContinueOffline(generation, presentation); else this.onReconcileOffline(generation, presentation);
    }
  }
  build() {
    Column({ space: 8 }) {
      ForEach(this.identities(), (identity: string) => {
        if (this.kind(identity) === 'pending') {
        ReaderRecoveryNotice({ view: this.view(identity), tag: this.isBookmarks(identity) ? '书签' : '离线', busy: this.busy(identity),
          actionLabel: this.isBookmarks(identity) ? '重新载入核对书签' : '核对离线结果',
          onReconcile: (): void => this.reconcile(identity, false),
          secondaryActionLabel: this.canContinue(identity) ? '继续原操作' : '',
          onSecondaryAction: (): void => this.reconcile(identity, true) });
        } else {
          // Offline terminal counts/failures already use the original task's
          // finished feedback. Do not repeat that known result as a notice.
          if (this.kind(identity) === 'result' && this.isBookmarks(identity) && !this.dismissedResults.includes(identity)) {
            Row({ space: 8 }) {
              Text(this.view(identity).message).layoutWeight(1)
                .fontFamily(MESSAGE_BODY.fontFamily).fontSize(MESSAGE_BODY.fontSizeFp)
                .fontWeight(MESSAGE_BODY.fontWeight).lineHeight(MESSAGE_BODY.lineHeightFp as number)
                .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
              ReaderRecoveryAction({ variant: 'text', label: '知道了', onReconcile: (): void => {
                this.dismissedResults = this.dismissedResults.concat([identity]);
              } });
            }.width('100%');
          }
          if (this.readbackFailed(identity) && this.view(identity).canRetry) {
            Row() {
              ReaderRecoveryAction({ variant: 'text', label: this.isBookmarks(identity) ? '重新读取书签' : '重新读取离线状态',
                generation: this.capturedGeneration(identity), onReconcile: (): void => this.reconcile(identity, false) });
            }.width('100%').justifyContent(FlexAlign.End);
          }
        }
      }, (identity: string): string => identity);
    }.width('100%');
  }
}
