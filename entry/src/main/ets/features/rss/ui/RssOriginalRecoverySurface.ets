import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { RssOriginalMutationIdentity, RssOriginalMutationProjection } from '../application/RssMutationRecoveryContract';
import { rssOriginalMatchesScope } from '../application/RssMutationRecoveryContract';

interface RssRecoveryActionIdentity {
  presentationIdentity: string;
  scope: 'management' | 'editor' | 'entry' | 'feed';
  original: RssOriginalMutationIdentity;
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
    return { visible: this.matchesScope(), message: this.original?.message ?? '',
      canRetry: this.matchesScope(), generation: this.original?.generation ?? 0 };
  }
  private matchesScope(): boolean { return rssOriginalMatchesScope(this.original, this.scope, this.subscriptionId, this.guid); }
  private identities(): string[] {
    const original = this.original;
    if (!this.matchesScope() || original === undefined) return [];
    const identity: RssRecoveryActionIdentity = { presentationIdentity: this.presentationIdentity, scope: this.scope,
      original: { generation: original.generation, operationId: original.operationId, method: original.method,
        scope: original.scope, subscriptionId: original.subscriptionId, guid: original.guid },
      subscriptionId: this.subscriptionId, guid: this.guid };
    return [JSON.stringify(identity)];
  }
  private actionIdentity(identity: string): RssRecoveryActionIdentity {
    return JSON.parse(identity) as RssRecoveryActionIdentity;
  }
  private expected(identity: string): RssOriginalMutationIdentity {
    return this.actionIdentity(identity).original;
  }
  private qualified(identity: string): boolean {
    const captured = this.actionIdentity(identity);
    const original = this.original;
    const entityMatches = captured.scope === 'management' || (captured.original.subscriptionId === captured.subscriptionId &&
      (captured.scope !== 'entry' || captured.original.guid === captured.guid));
    return this.identities().indexOf(identity) >= 0 && original !== undefined && entityMatches &&
      captured.scope !== 'feed' && original.scope === captured.scope &&
      original.canRetryOriginal && original.operationId.length > 0;
  }
  private continuationLabel(): string {
    return this.original?.confirmation === 'confirmed' && this.original.writeStage === 'cleanup' ? '继续原清理' : '继续原操作';
  }
  private current(identity: string): boolean {
    return this.mounted && this.original?.busy !== true && this.identities().indexOf(identity) >= 0;
  }
  private canContinue(identity: string): boolean {
    return this.current(identity) && this.qualified(identity) && this.original?.canRetryOriginal === true;
  }
  build() {
    if (this.matchesScope()) {
      ForEach(this.identities(), (identity: string) => {
        ReaderRecoveryNotice({ view: this.view(), actionLabel: '核对原操作回执',
          actionEnabled: this.current(identity), secondaryActionEnabled: this.canContinue(identity),
          secondaryActionLabel: this.qualified(identity) ? this.continuationLabel() : '',
          onReconcile: (): void => { if (this.current(identity)) this.onReconcileOriginal(this.expected(identity)); },
          onSecondaryAction: (): void => { if (this.canContinue(identity)) this.onContinueOriginal(this.expected(identity)); } });
      }, (identity: string): string => identity);
    }
  }
}
