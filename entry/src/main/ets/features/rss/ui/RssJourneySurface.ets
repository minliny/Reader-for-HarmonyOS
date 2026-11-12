import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { OperationFacts } from '../../../app/ReaderOperationFacts';
import type { RssItem, RssSubscription } from '../application/RssGateway';
import type { RssOriginalMutationIdentity } from '../application/RssMutationRecoveryContract';
import type { RssRouteOperationProjection } from '../application/RssRouteOperationHost';
import type { RssOrchestrator, RssManagementOperationProjection } from '../application/RssOrchestrator';
import type { RssSourceTextField, RssSubscriptionEditorOrchestrator } from '../application/RssSubscriptionEditorOrchestrator';
import type { RssMode, RssEntrySnapshot, RssSourceSnapshot } from '../presentation/RssPresentationContract';
import { RssPage } from './RssPage';
import { RssEntryDetailPage } from './RssEntryDetailPage';
import { RssSourceFeedPage } from './RssSourceFeedPage';
import { RssSubscriptionEditorPage } from './RssSubscriptionEditorPage';
import { RssSubscriptionManagementPage } from './RssSubscriptionManagementPage';
import { RssJourneyPresentation, type RssRoute } from '../presentation/RssJourneyPresentation';

@Component
export struct RssJourneySurface {
  @ObjectLink presentation: RssJourneyPresentation;
  @Prop expandedLayout: boolean = false;
  route: RssRoute = 'rss';
  generation: number = 0;
  owner: ReaderRuntimeOwner | undefined;
  mounting: number = 0;
  identity: string = '';
  onBookshelf: () => void = (): void => {};
  onSettings: () => void = (): void => {};
  onDiscover: () => void = (): void => {};

  build() {
    if (this.route === 'rss') {
      this.rssPageSurface(this.generation, this.owner, this.mounting, this.presentation.rssOrchestrator, this.identity);
    } else if (this.route === 'rssSubscriptionManagement') {
      this.rssSubscriptionManagementSurface(this.generation, this.owner, this.mounting, this.presentation.rssOrchestrator, this.identity);
    } else if (this.route === 'rssSubscriptionEditor') {
      this.rssEditorSurface(this.generation, this.owner, this.mounting, this.identity, this.presentation.rssEditorOrchestrator);
    } else if (this.route === 'rssSourceFeed' && this.presentation.selectedRssSubscription !== undefined) {
      this.rssSourceFeedSurface(this.generation, this.owner, this.presentation.selectedRssSubscription.subscriptionId,
        this.mounting, this.presentation.rssOrchestrator, this.identity);
    } else if (this.route === 'rssEntryDetail' && this.presentation.selectedRssSubscription !== undefined &&
      this.presentation.selectedRssItem !== undefined) {
      this.rssEntryDetailSurface(this.generation, this.owner, this.presentation.selectedRssSubscription.subscriptionId,
        this.presentation.selectedRssItem.guid, this.mounting, this.presentation.rssOrchestrator, this.identity);
    }
  }

  @Builder
  private rssPageSurface(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number,
    host: RssOrchestrator | undefined, identity: string) {
    RssPage({
      presentation: this.presentation.rssPresentation,
      original: this.presentation.rssFeedOriginal,
      presentationIdentity: identity,
      onReconcileOriginal: (expected: RssOriginalMutationIdentity): void => {
        if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss'))
          this.presentation.reconcileRssFeedOriginal(expected, generation, owner, mounting, host, identity);
      },
      readFacts: this.presentation.rssFeedRead,
      onRetryRead: (facts: OperationFacts<RssSubscription[]>): void => {
        if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss')) this.presentation.loadRss(generation, facts.generation);
      },
      expandedLayout: this.expandedLayout,
      activeMode: 'sources',
      onBack: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss')) this.onBookshelf(); },
      onRefresh: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss')) this.presentation.refreshRss(); },
      onManage: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss')) this.presentation.onRssManage(); },
      onSelectSubscription: (id: string): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss')) this.presentation.onRssSubscriptionSelected(id); },
      onSelectItem: (subscriptionId: string, guid: string): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss')) this.presentation.onRssItemSelected(subscriptionId, guid); },
      onModeRequested: (mode: RssMode): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss')) this.presentation.onRssModeRequested(mode); },
      onSettingsRequested: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss')) this.onSettings(); },
      onDiscoverRequested: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss')) this.onDiscover(); },
    });
  }

  @Builder
  private rssEditorSurface(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number,
    identity: string, host: RssSubscriptionEditorOrchestrator | undefined) {
    RssSubscriptionEditorPage({
      presentationIdentity: identity,
      onReconcileOriginal: (expected: RssOriginalMutationIdentity): void => { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.reconcileOriginal(expected, identity); },
      onContinueOriginal: (expected: RssOriginalMutationIdentity): void => { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.continueOriginal(expected, identity); },
      snapshot: this.presentation.rssEditorSnapshot,
      onReconcile: (expectedGeneration: number): void => { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.reconcile(expectedGeneration); },
      onRetryRead: (expectedGeneration: number): void => { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.retryLoad(expectedGeneration); },
      onBack: (): void => { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) this.presentation.returnToRssSubscriptionManagement(); },
      onFeedUrlChanged: (value: string): void => { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateFeedUrl(value); },
      onTitleChanged: (value: string): void => { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateTitle(value); },
      onEnabledChanged: (value: boolean): void => { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateEnabled(value); },
      onEnabledCookieJarChanged: (value: boolean): void =>
        { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateEnabledCookieJar(value); },
      onSourceFieldChanged: (field: RssSourceTextField, value: string): void =>
        { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateSourceField(field, value); },
      onSave: (): void => { if (this.presentation.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.save(); },
    });
  }

  @Builder
  private rssSourceFeedSurface(generation: number, owner: ReaderRuntimeOwner | undefined, subscriptionId: string,
    mounting: number, host: RssOrchestrator | undefined, identity: string) {
    RssSourceFeedPage({
      subscription: this.presentation.selectedRssSubscription,
      items: this.presentation.selectedRssItems,
      presentationIdentity: identity,
      original: this.presentation.rssSourceOriginal,
      onReconcileOriginal: (expected: RssOriginalMutationIdentity): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSourceFeed', subscriptionId)) host?.reconcileSourceOriginal(expected, this.presentation.rssSourceBinding(generation, subscriptionId, owner, host, identity, mounting), subscriptionId); },
      operation: this.presentation.rssSourceOperation,
      readFacts: this.presentation.rssSourceRead,
      onReconcile: (operation: RssRouteOperationProjection<RssSourceSnapshot>): void => {
        if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSourceFeed', subscriptionId) && operation.subscriptionId === subscriptionId) host?.reconcileSourceOperation(operation, this.presentation.rssSourceBinding(generation, subscriptionId, owner, host, identity, mounting));
      },
      onRetryRead: (facts: OperationFacts<RssSourceSnapshot>): void => {
        if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSourceFeed', subscriptionId)) host?.retrySourceRead(subscriptionId, facts, this.presentation.rssSourceBinding(generation, subscriptionId, owner, host, identity, mounting));
      },
      expandedLayout: this.expandedLayout,
      onBack: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSourceFeed', subscriptionId)) this.presentation.returnFromRssSourceFeed(); },
      onSelectItem: (item: RssItem): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSourceFeed', subscriptionId)) this.presentation.onRssSourceItemSelected(item); },
      onRefresh: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSourceFeed', subscriptionId)) this.presentation.refreshRssSourceFeed(); },
      onEditSource: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSourceFeed', subscriptionId)) this.presentation.openRssManagementForSubscription(subscriptionId); },
      onSourceOperations: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSourceFeed', subscriptionId)) this.presentation.openRssManagementForSubscription(subscriptionId); },
    });
  }

  @Builder
  private rssEntryDetailSurface(generation: number, owner: ReaderRuntimeOwner | undefined, subscriptionId: string, guid: string,
    mounting: number, host: RssOrchestrator | undefined, identity: string) {
    RssEntryDetailPage({
      subscription: this.presentation.selectedRssSubscription,
      item: this.presentation.selectedRssItem,
      presentationIdentity: identity,
      original: this.presentation.rssEntryOriginal,
      onReconcileOriginal: (expected: RssOriginalMutationIdentity): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid)) host?.reconcileEntryOriginal(expected, this.presentation.rssEntryBinding(generation, subscriptionId, guid, owner, host, identity, mounting), subscriptionId, guid); },
      onContinueOriginal: (expected: RssOriginalMutationIdentity): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid)) host?.continueEntryOriginal(expected, this.presentation.rssEntryBinding(generation, subscriptionId, guid, owner, host, identity, mounting)); },
      operation: this.presentation.rssEntryOperation,
      readFacts: this.presentation.rssEntryRead,
      onReconcile: (operation: RssRouteOperationProjection<RssEntrySnapshot>): void => {
        if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid) && operation.subscriptionId === subscriptionId && operation.guid === guid) host?.reconcileEntryOperation(operation, this.presentation.rssEntryBinding(generation, subscriptionId, guid, owner, host, identity, mounting));
      },
      onRetryRead: (facts: OperationFacts<RssEntrySnapshot>): void => {
        if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid)) host?.retryEntryRead(subscriptionId, guid, facts, this.presentation.rssEntryBinding(generation, subscriptionId, guid, owner, host, identity, mounting));
      },
      expandedLayout: this.expandedLayout,
      favoriteState: this.presentation.selectedRssFavoriteState,
      onBack: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid)) this.presentation.returnFromRssEntryDetail(); },
      onViewSource: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid)) this.presentation.returnToRssSourceFeed(); },
      onFavoriteRequested: (favorite: boolean): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid)) this.presentation.onRssEntryFavoriteRequested(favorite); },
      onSourceSettings: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid)) this.presentation.openRssManagementForSubscription(subscriptionId); },
      onOpenOriginal: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid)) this.presentation.onRssOpenOriginalRequested(); },
    });
  }

  @Builder
  private rssSubscriptionManagementSurface(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number,
    host: RssOrchestrator | undefined, identity: string) {
    RssSubscriptionManagementPage({
      items: this.presentation.rssSubscriptionManagementItems(),
      expandedLayout: this.expandedLayout,
      focusedSubscriptionId: this.presentation.rssManagementFocusSubscriptionId,
      resultMessage: this.presentation.rssOperationResultMessage,
      presentationIdentity: identity,
      onReconcileOriginal: (expected: RssOriginalMutationIdentity): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) host?.reconcileOriginal(expected, identity); },
      onContinueOriginal: (expected: RssOriginalMutationIdentity): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) host?.continueOriginal(expected, identity); },
      operation: this.presentation.rssManagementOperation,
      readFacts: this.presentation.rssManagementRead,
      onBack: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) this.presentation.returnToRss(); },
      onAdd: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) this.presentation.onRssSubscriptionAddRequested(); },
      onImport: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) this.presentation.requestRssSourceImport(); },
      onExport: (): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) this.presentation.exportRssSources(); },
      onToggle: (id: string, enabled: boolean): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) host?.toggleSubscription(id, enabled); },
      onViewArticles: (id: string): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) this.presentation.onRssManagementViewArticles(id); },
      onEditSource: (id: string): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) this.presentation.onRssSubscriptionEditRequested(id); },
      onRefresh: (id: string): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) host?.refreshSubscription(id); },
      onDelete: (id: string): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) this.presentation.requestRssSubscriptionDelete(id); },
      onReconcile: (operation: RssManagementOperationProjection): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) host?.reconcileManagementOperation(operation); },
      onRetryRead: (facts: OperationFacts<RssSubscription[]>): void => { if (this.presentation.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement')) host?.retryManagementRead(facts); },
    });
  }

}
