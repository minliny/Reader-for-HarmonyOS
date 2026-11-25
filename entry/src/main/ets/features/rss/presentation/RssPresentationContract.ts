import type { RssSubscription, RssItem, RssFavorite } from '../application/RssGateway';

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
export interface RssFeedItems {
  all: RssItem[];
  favorites: RssItem[];
  archivedFavorites?: RssFavorite[];
}

export function projectRssFeedItems(items: RssItem[], favorites: RssFavorite[]): RssFeedItems {
  const key = (subscriptionId: string, guid: string): string => JSON.stringify([subscriptionId, guid]);
  const saved = new Set<string>(favorites.map((favorite: RssFavorite): string => key(favorite.subscriptionId, favorite.guid)));
  const cached = new Set<string>(items.map((item: RssItem): string => key(item.subscriptionId, item.guid)));
  const all = items.slice().sort((a: RssItem, b: RssItem): number => b.firstSeenAt - a.firstSeenAt);
  return { all,
    favorites: all.filter((item: RssItem): boolean => saved.has(key(item.subscriptionId, item.guid))),
    archivedFavorites: favorites.filter((favorite: RssFavorite): boolean => !cached.has(key(favorite.subscriptionId, favorite.guid))),
  };
}
export type RssFavoritePresentation = 'loading' | 'favorited' | 'notFavorited' | 'unavailable';

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

