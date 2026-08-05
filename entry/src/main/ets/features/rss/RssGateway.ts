import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

export type RssSubscription = {
  subscriptionId: string;
  feedUrl: string;
  title: string;
  siteUrl?: string;
  enabled: boolean;
  lastFetchAt?: number;
  unreadCount: number;
};

export type RssItem = {
  subscriptionId: string;
  title: string;
  link?: string;
  description?: string;
  author?: string;
  pubDate?: string;
  guid: string;
  read: boolean;
};

const MAX_RECENT_UNREAD_SUBSCRIPTIONS = 4;

/**
 * Feature-local gateway for the RSS page. Owns the Core protocol boundary for
 * `rss.subscription.*` and validates every JSON envelope before the page sees
 * it. It never creates a runtime.
 */
export class RssGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async loadSubscriptions(): Promise<RssSubscription[]> {
    const result = await this.runtimeOwner.request('rss.subscription.list', {});
    const rawSubs = result.data['subscriptions'];
    if (!Array.isArray(rawSubs)) {
      throw new Error('rss.subscription.list returned invalid data');
    }
    const subs: RssSubscription[] = [];
    for (const raw of rawSubs) {
      subs.push(this.decodeSubscription(raw));
    }
    return subs;
  }

  /**
   * `rss.subscription.refresh` is a real Core call that resolves the
   * subscription, emits `http.execute`, then parses the response on
   * continuation. The current Host only registers `persistence.*`, so
   * the call returns an error and we fall back to cached state.
   */
  async refreshSubscription(subscriptionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await this.runtimeOwner.request('rss.subscription.refresh', { subscriptionId: subscriptionId });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      return { ok: false, error: message };
    }
  }

  async loadRecentUnread(subscriptions: RssSubscription[]): Promise<RssItem[]> {
    const sampled = subscriptions.slice(0, MAX_RECENT_UNREAD_SUBSCRIPTIONS);
    const grouped = await Promise.all(sampled.map((sub) => this.loadItems(sub.subscriptionId)));
    const items: RssItem[] = [];
    for (const group of grouped) {
      for (const item of group) {
        if (!item.read) {
          items.push(item);
        }
      }
    }
    return items;
  }

  private async loadItems(subscriptionId: string): Promise<RssItem[]> {
    const result = await this.runtimeOwner.request('rss.subscription.items', {
      subscriptionId,
      unreadOnly: false,
    });
    const rawItems = result.data['items'];
    if (!Array.isArray(rawItems)) {
      throw new Error('rss.subscription.items returned invalid data');
    }
    const items: RssItem[] = [];
    for (const raw of rawItems) {
      items.push(this.decodeItem(raw));
    }
    return items;
  }

  private decodeSubscription(value: unknown): RssSubscription {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('rss.subscription.list returned a non-object subscription');
    }
    const sub = value as JsonObject;
    const decoded: RssSubscription = {
      subscriptionId: this.requiredString(sub, 'subscriptionId'),
      feedUrl: this.requiredString(sub, 'feedUrl'),
      title: this.requiredString(sub, 'title'),
      enabled: sub['enabled'] === true,
      unreadCount: this.nonNegativeNumber(sub, 'unreadCount'),
    };
    const siteUrl = this.optionalString(sub, 'siteUrl');
    const lastFetchAt = this.optionalNumber(sub, 'lastFetchAt');
    if (siteUrl !== undefined) {
      decoded.siteUrl = siteUrl;
    }
    if (lastFetchAt !== undefined) {
      decoded.lastFetchAt = lastFetchAt;
    }
    return decoded;
  }

  private decodeItem(value: unknown): RssItem {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('rss.subscription.items returned a non-object item');
    }
    const item = value as JsonObject;
    const decoded: RssItem = {
      subscriptionId: this.requiredString(item, 'subscriptionId'),
      title: this.requiredString(item, 'title'),
      guid: this.requiredString(item, 'guid'),
      read: item['read'] === true,
    };
    const link = this.optionalString(item, 'link');
    const description = this.optionalString(item, 'description');
    const author = this.optionalString(item, 'author');
    const pubDate = this.optionalString(item, 'pubDate');
    if (link !== undefined) {
      decoded.link = link;
    }
    if (description !== undefined) {
      decoded.description = description;
    }
    if (author !== undefined) {
      decoded.author = author;
    }
    if (pubDate !== undefined) {
      decoded.pubDate = pubDate;
    }
    return decoded;
  }

  private requiredString(value: JsonObject, key: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string') {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalString(value: JsonObject, key: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private nonNegativeNumber(value: JsonObject, key: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0) {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalNumber(value: JsonObject, key: string): number | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }
}