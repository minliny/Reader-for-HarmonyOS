import type { DictRuleDraft, ManagedRuleSubscription, ReplaceRuleDraft, RuleSubscriptionDraft, TxtTocRuleDraft } from '../application/RulesManagementGateway';
import { RulesManagementPage } from './RulesManagementPage';
import { RulesManagementPresentation } from '../presentation/RulesManagementPresentation';
import type { JsonImportFocusTargets } from '../../../app/composition/JsonImportPresentation';

export function rulesManagementImportFocus(identity: string): JsonImportFocusTargets {
  return { preferred: `reader-rules-import:${identity}`, fallback: `reader-rules-back:${identity}` };
}

@Component
export struct RulesManagementSurface {
  @ObjectLink presentation: RulesManagementPresentation;
  @Prop inputEnabled: boolean = true;
  identity: string = '';
  onBack: () => void = (): void => {};
  onImport: () => void = (): void => {};

  build() {
    RulesManagementPage({
      snapshot: this.presentation.snapshot,
      importFocusId: rulesManagementImportFocus(this.identity).preferred,
      backFocusId: rulesManagementImportFocus(this.identity).fallback,
      inputEnabled: this.inputEnabled,
      inputCurrent: (): boolean => this.presentation.inputAllowed(this.identity),
      onReconcile: (expected: number): void => this.presentation.inputOperations(this.identity)?.reconcile(expected, this.identity),
      onBack: (): void => { if (this.presentation.inputOperations(this.identity) !== undefined) this.onBack(); },
      onSaveReplace: (draft: ReplaceRuleDraft): void => this.presentation.inputOperations(this.identity)?.saveReplaceRule(draft, this.identity),
      onDeleteReplace: (id: number): void => this.presentation.inputOperations(this.identity)?.deleteReplaceRule(id, this.identity),
      onSaveTxtToc: (draft: TxtTocRuleDraft): void => this.presentation.inputOperations(this.identity)?.saveTxtTocRule(draft, this.identity),
      onDeleteTxtToc: (id: number): void => this.presentation.inputOperations(this.identity)?.deleteTxtTocRule(id, this.identity),
      onSaveDict: (draft: DictRuleDraft): void => this.presentation.inputOperations(this.identity)?.saveDictRule(draft, this.identity),
      onDeleteDict: (name: string): void => this.presentation.inputOperations(this.identity)?.deleteDictRule(name, this.identity),
      onSaveSubscription: (draft: RuleSubscriptionDraft): void => this.presentation.inputOperations(this.identity)?.saveRuleSubscription(draft, this.identity),
      onDeleteSubscription: (id: number): void => this.presentation.inputOperations(this.identity)?.deleteRuleSubscription(id, this.identity),
      onRefreshSubscription: (subscription: ManagedRuleSubscription): void =>
        this.presentation.inputOperations(this.identity)?.refreshRuleSubscription(subscription, this.identity),
      onExportBundle: (): void => this.presentation.inputOperations(this.identity)?.exportBundle(this.identity),
      onImportBundle: (): void => { if (this.presentation.inputOperations(this.identity) !== undefined) this.onImport(); },
    });
  }
}
