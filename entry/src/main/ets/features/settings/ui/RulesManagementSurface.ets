import type { DictRuleDraft, ManagedRuleSubscription, ReplaceRuleDraft, RuleSubscriptionDraft, TxtTocRuleDraft } from '../application/RulesManagementGateway';
import { RulesManagementPage } from './RulesManagementPage';
import { RulesManagementPresentation } from '../presentation/RulesManagementPresentation';

@Component
export struct RulesManagementSurface {
  @ObjectLink presentation: RulesManagementPresentation;
  identity: string = '';
  onBack: () => void = (): void => {};
  onImport: () => void = (): void => {};

  build() {
    RulesManagementPage({
      snapshot: this.presentation.snapshot,
      onReconcile: (expected: number): void => this.presentation.operations(this.identity)?.reconcile(expected, this.identity),
      onBack: (): void => { if (this.presentation.operations(this.identity) !== undefined) this.onBack(); },
      onSaveReplace: (draft: ReplaceRuleDraft): void => this.presentation.operations(this.identity)?.saveReplaceRule(draft, this.identity),
      onDeleteReplace: (id: number): void => this.presentation.operations(this.identity)?.deleteReplaceRule(id, this.identity),
      onSaveTxtToc: (draft: TxtTocRuleDraft): void => this.presentation.operations(this.identity)?.saveTxtTocRule(draft, this.identity),
      onDeleteTxtToc: (id: number): void => this.presentation.operations(this.identity)?.deleteTxtTocRule(id, this.identity),
      onSaveDict: (draft: DictRuleDraft): void => this.presentation.operations(this.identity)?.saveDictRule(draft, this.identity),
      onDeleteDict: (name: string): void => this.presentation.operations(this.identity)?.deleteDictRule(name, this.identity),
      onSaveSubscription: (draft: RuleSubscriptionDraft): void => this.presentation.operations(this.identity)?.saveRuleSubscription(draft, this.identity),
      onDeleteSubscription: (id: number): void => this.presentation.operations(this.identity)?.deleteRuleSubscription(id, this.identity),
      onRefreshSubscription: (subscription: ManagedRuleSubscription): void =>
        this.presentation.operations(this.identity)?.refreshRuleSubscription(subscription, this.identity),
      onExportBundle: (): void => this.presentation.operations(this.identity)?.exportBundle(this.identity),
      onImportBundle: (): void => { if (this.presentation.operations(this.identity) !== undefined) this.onImport(); },
    });
  }
}
