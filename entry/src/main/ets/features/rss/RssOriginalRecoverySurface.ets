import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import type { RssOriginalMutationIdentity, RssOriginalMutationProjection } from './RssMutationRecoveryContract';

interface RssRecoveryActionIdentity {
  presentationIdentity: string;
  scope: 'management' | 'editor' | 'entry' | 'feed';
  original: RssOriginalMutationProjection;
  subscriptionId: string;
  guid: string;
}

/** One finite RSS recovery presentation. Only the original domain owner may
 * qualify or continue a write. The small action captures its immutable tuple;
 * retained V1 Props can never lend a newer identity to an old physical click. */
@Component
export struct RssOriginalRecoverySurface {
  @Prop original: RssOriginalMutationProjection | undefined = undefined;
  @Prop presentationIdentity: string = '';
  @Prop subscriptionId: string = '';
  @Prop guid: string = '';
  @Prop scope: 'management' | 'editor' | 'entry' | 'feed' = 'management';
  onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  onContinueOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  private view(): ReaderRecoveryView {
    return { visible: this.original?.blocked === true, message: this.original?.message ?? '',
      canRetry: false, generation: this.original?.generation ?? 0 };
  }
  private identities(): string[] {
    if (this.original?.blocked !== true) return [];
    const identity: RssRecoveryActionIdentity = { presentationIdentity: this.presentationIdentity, scope: this.scope, original: this.original,
      subscriptionId: this.subscriptionId, guid: this.guid };
    return [JSON.stringify(identity)];
  }
  private actionIdentity(identity: string): RssRecoveryActionIdentity {
    return JSON.parse(identity) as RssRecoveryActionIdentity;
  }
  private expected(identity: string): RssOriginalMutationProjection {
    return this.actionIdentity(identity).original;
  }
  private qualified(identity: string): boolean {
    const captured = this.actionIdentity(identity);
    const entityMatches = captured.scope === 'management' || (captured.original.subscriptionId === captured.subscriptionId &&
      (captured.scope !== 'entry' || captured.original.guid === captured.guid));
    return entityMatches && captured.scope !== 'feed' && captured.original.scope === captured.scope &&
      captured.original.canRetryOriginal && captured.original.operationId.length > 0;
  }
  private continuationLabel(identity: string): string {
    const captured = this.expected(identity);
    return captured.confirmation === 'confirmed' && captured.writeStage === 'cleanup' ? '继续原清理' : '继续原操作';
  }
  private current(identity: string): boolean {
    return this.mounted && this.original?.busy !== true && this.identities().indexOf(identity) >= 0;
  }
  private canContinue(identity: string): boolean {
    return this.current(identity) && this.qualified(identity) && this.original?.canRetryOriginal === true;
  }
  build() {
    if (this.original?.blocked === true) {
      ReaderRecoveryNotice({ view: this.view() });
      ForEach(this.identities(), (identity: string) => {
        ReaderRecoveryAction({ label: '核对原操作回执', generation: this.expected(identity).generation,
          actionEnabled: this.current(identity),
          onReconcile: (): void => { if (this.current(identity)) this.onReconcileOriginal(this.expected(identity)); } });
        if (this.qualified(identity)) {
          ReaderRecoveryAction({ label: this.continuationLabel(identity),
            generation: this.expected(identity).generation, actionEnabled: this.current(identity),
            onReconcile: (): void => { if (this.canContinue(identity)) this.onContinueOriginal(this.expected(identity)); } });
        }
      }, (identity: string): string => identity);
    }
  }
}
