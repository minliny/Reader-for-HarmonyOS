import type { RssSubscription, RssItem } from './RssGateway';

/** Neutral RSS DTOs shared by Host projection and ArkUI consumers. */
export interface RssFeedPresentation {
  kind: 'feed';
  subscriptions: RssSubscription[];
  recentUnread: RssItem[];
}

export interface RssRefreshingPresentation {
  kind: 'refreshing';
  subscriptions: RssSubscription[];
  recentUnread: RssItem[];
}

export interface RssEmptyUnreadPresentation {
  kind: 'emptyUnread';
  subscriptions: RssSubscription[];
}

export interface RssFailedSource {
  name: string;
  reason?: string;
}

export interface RssFatalErrorPresentation {
  kind: 'fatalError';
  failedSources: RssFailedSource[];
}

/** Main-page content modes. These are component/content changes, never routes. */
export type RssMode = 'sources' | 'all' | 'favorites' | 'rules';

export type RssPresentation =
  | RssFeedPresentation
  | RssRefreshingPresentation
  | RssEmptyUnreadPresentation
  | RssFatalErrorPresentation;


export interface RssSubscriptionManagementItem {
  subscriptionId: string;
  title: string;
  meta: string;
  enabled: boolean;
}

export interface RssSourceSnapshot {
  subscriptions: RssSubscription[];
  subscription: RssSubscription;
  items: RssItem[];
}

export interface RssEntrySnapshot {
  subscriptions: RssSubscription[];
  subscription: RssSubscription;
  items: RssItem[];
  item: RssItem;
  favorite: boolean;
}

