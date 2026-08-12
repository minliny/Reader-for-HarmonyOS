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
  sourceGroup?: string;
  customOrder?: number;
  updateIntervalMinutes?: number;
  header?: string;
  enabledCookieJar?: boolean;
  ruleArticles?: string;
  ruleNextPage?: string;
  ruleTitle?: string;
  rulePubDate?: string;
  ruleDescription?: string;
  ruleImage?: string;
  ruleLink?: string;
  ruleContent?: string;
};

export type RssSourceDraft = {
  feedUrl: string;
  title: string;
  enabled: boolean;
  sourceGroup: string;
  customOrder?: number;
  updateIntervalMinutes?: number;
  header: string;
  enabledCookieJar: boolean;
  ruleArticles: string;
  ruleNextPage: string;
  ruleTitle: string;
  rulePubDate: string;
  ruleDescription: string;
  ruleImage: string;
  ruleLink: string;
  ruleContent: string;
};

export type RssSourceImportResult = {
  imported: number;
  replaceExisting: boolean;
};

export type RssSourceExportResult = {
  count: number;
  destination?: string;
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
  firstSeenAt: number;
};

export type RssFavorite = {
  subscriptionId: string;
  guid: string;
  feedUrl: string;
  subscriptionTitle: string;
  siteUrl?: string;
  title: string;
  link?: string;
  summary?: string;
  publishedAt?: string;
  firstSeenAt: number;
  addedAt: number;
};

export type RssEntryReadResult = {
  subscriptionId: string;
  guid: string;
  read: boolean;
  unreadCount: number;
};

export type RssSubscriptionItemsResult = {
  subscription: RssSubscription;
  items: RssItem[];
  count: number;
  unreadCount: number;
};

export type RssRefreshResult = {
  subscription: RssSubscription;
  items: RssItem[];
  count: number;
  unreadCount: number;
  newCount: number;
  fetched: boolean;
  notModified: boolean;
  evaluatedAt: number;
};

export type RssSubscriptionSaveResult = {
  created: boolean;
  subscription: RssSubscription;
};

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
    const result = await this.runtimeOwner.request('rss-source.list', {});
    const rawSources = result.data['sources'];
    if (!Array.isArray(rawSources)) {
      throw new Error('rss-source.list returned invalid data');
    }
    const subs: RssSubscription[] = [];
    const seenIds: string[] = [];
    for (const raw of rawSources) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('rss-source.list returned a non-object source');
      }
      const sourceData = raw as JsonObject;
      const subscription = this.decodeSubscription(
        this.requiredObject(sourceData, 'subscription'),
        this.requiredObject(sourceData, 'source'),
      );
      if (seenIds.includes(subscription.subscriptionId)) {
        throw new Error('rss-source.list returned a duplicate subscriptionId');
      }
      seenIds.push(subscription.subscriptionId);
      subs.push(subscription);
    }
    return subs;
  }

  /** Create one complete source with Core-owned opaque identity. */
  async createSubscription(draft: RssSourceDraft): Promise<RssSubscriptionSaveResult> {
    const result = await this.runtimeOwner.request('rss-source.put', {
      source: this.encodeSource(draft),
    });
    const created = this.requiredBoolean(result.data, 'created');
    const sourceData = this.requiredObject(result.data, 'source');
    const subscription = this.decodeSubscription(
      this.requiredObject(sourceData, 'subscription'),
      this.requiredObject(sourceData, 'source'),
    );
    return { created, subscription };
  }

  /** Replace caller-owned source configuration; fetch/read metadata remains Core-owned. */
  async updateSubscription(
    subscriptionId: string,
    draft: RssSourceDraft,
  ): Promise<RssSubscription> {
    this.requireSubscriptionId(subscriptionId);
    const result = await this.runtimeOwner.request('rss-source.put', {
      subscriptionId,
      source: this.encodeSource(draft),
    });
    const sourceData = this.requiredObject(result.data, 'source');
    const subscription = this.decodeSubscription(
      this.requiredObject(sourceData, 'subscription'),
      this.requiredObject(sourceData, 'source'),
    );
    if (subscription.subscriptionId !== subscriptionId || subscription.enabled !== draft.enabled) {
      throw new Error('rss-source.put returned a mismatched subscription');
    }
    return subscription;
  }

  async importSources(
    replaceExisting: boolean,
    onlineUrl?: string,
  ): Promise<RssSourceImportResult | undefined> {
    const selection = onlineUrl === undefined ?
      await this.runtimeOwner.selectRssSourceJson() :
      await this.runtimeOwner.loadOnlineJsonDocument(onlineUrl);
    if (selection === undefined) {
      return undefined;
    }
    return this.importSourcesDocument(selection.text, replaceExisting);
  }

  /** Apply already-acquired RSS JSON; Core owns schema and atomic merge/replace. */
  async importSourcesDocument(
    json: string,
    replaceExisting: boolean,
  ): Promise<RssSourceImportResult> {
    const result = await this.runtimeOwner.request('rss-source.import', {
      json,
      replaceExisting,
    });
    const imported = this.nonNegativeInteger(result.data, 'imported');
    const echoedReplace = this.requiredBoolean(result.data, 'replaceExisting');
    if (echoedReplace !== replaceExisting) {
      throw new Error('rss-source.import returned a mismatched replaceExisting');
    }
    return { imported, replaceExisting: echoedReplace };
  }

  async exportSources(): Promise<RssSourceExportResult> {
    const result = await this.runtimeOwner.request('rss-source.export', {
      exportedAt: Date.now(),
    });
    const json = this.requiredNonEmptyString(result.data, 'json');
    const count = this.nonNegativeInteger(result.data, 'count');
    const destination = await this.runtimeOwner.saveRssSourceJson(json, 'reader-rss-sources.json');
    const exported: RssSourceExportResult = { count };
    if (destination !== undefined) {
      exported.destination = destination;
    }
    return exported;
  }

  /**
   * Reads the Core-owned cached items for one admitted SourceFeed route.
   * This is deliberately not a refresh: callers must not describe this
   * command as a completed network update or a write transaction.
   */
  async loadItems(subscriptionId: string): Promise<RssSubscriptionItemsResult> {
    this.requireSubscriptionId(subscriptionId);
    const result = await this.runtimeOwner.request('rss.subscription.items', {
      subscriptionId,
      unreadOnly: false,
    });
    const rawItems = result.data['items'];
    if (!Array.isArray(rawItems)) {
      throw new Error('rss.subscription.items returned invalid data');
    }
    const items: RssItem[] = [];
    const seenGuids: string[] = [];
    for (const raw of rawItems) {
      const item = this.decodeItem(raw);
      if (item.subscriptionId !== subscriptionId) {
        throw new Error('rss.subscription.items returned an item for another subscription');
      }
      if (seenGuids.includes(item.guid)) {
        throw new Error('rss.subscription.items returned a duplicate scoped identity');
      }
      seenGuids.push(item.guid);
      items.push(item);
    }
    const subscription = this.decodeSubscription(
      this.requiredObject(result.data, 'subscription'),
    );
    if (subscription.subscriptionId !== subscriptionId) {
      throw new Error('rss.subscription.items returned a mismatched subscription');
    }
    const count = this.nonNegativeInteger(result.data, 'count');
    const unreadCount = this.nonNegativeInteger(result.data, 'unreadCount');
    if (count !== items.length || unreadCount !== subscription.unreadCount || unreadCount > count) {
      throw new Error('rss.subscription.items returned inconsistent counts');
    }
    return { subscription, items, count, unreadCount };
  }

  /** Mark one subscription-scoped entry read/unread and validate the echo. */
  async setEntryRead(
    subscriptionId: string,
    guid: string,
    read: boolean,
  ): Promise<RssEntryReadResult> {
    this.requireEntryIdentity(subscriptionId, guid);
    const result = await this.runtimeOwner.request('rss.entry.read', {
      subscriptionId,
      guid,
      read,
    });
    if (!this.requiredBoolean(result.data, 'marked')) {
      throw new Error('rss.entry.read did not confirm the mutation');
    }
    const echoedSubscriptionId = this.requiredNonEmptyString(result.data, 'subscriptionId');
    const echoedGuid = this.requiredNonEmptyString(result.data, 'guid');
    const echoedRead = this.requiredBoolean(result.data, 'read');
    if (echoedSubscriptionId !== subscriptionId || echoedGuid !== guid || echoedRead !== read) {
      throw new Error('rss.entry.read returned a mismatched scoped identity');
    }
    return {
      subscriptionId: echoedSubscriptionId,
      guid: echoedGuid,
      read: echoedRead,
      unreadCount: this.nonNegativeInteger(result.data, 'unreadCount'),
    };
  }

  /** Read favorite membership from Core truth; no local membership cache. */
  async isFavorite(subscriptionId: string, guid: string): Promise<boolean> {
    this.requireEntryIdentity(subscriptionId, guid);
    const result = await this.runtimeOwner.request('rss.favorite.list', {
      subscriptionId,
    });
    const rawFavorites = result.data['favorites'];
    if (!Array.isArray(rawFavorites)) {
      throw new Error('rss.favorite.list returned invalid favorites');
    }
    const count = this.nonNegativeInteger(result.data, 'count');
    if (count !== rawFavorites.length) {
      throw new Error('rss.favorite.list returned an inconsistent count');
    }
    let found = false;
    const seenGuids: string[] = [];
    for (const raw of rawFavorites) {
      const favorite = this.decodeFavorite(raw);
      if (favorite.subscriptionId !== subscriptionId) {
        throw new Error('rss.favorite.list returned a favorite for another subscription');
      }
      if (seenGuids.includes(favorite.guid)) {
        throw new Error('rss.favorite.list returned a duplicate scoped identity');
      }
      seenGuids.push(favorite.guid);
      if (favorite.guid === guid) {
        found = true;
      }
    }
    return found;
  }

  /** Persist a favorite using stable identity only; Core owns display data. */
  async persistFavorite(
    subscriptionId: string,
    guid: string,
    addedAt: number,
  ): Promise<RssFavorite> {
    this.requireEntryIdentity(subscriptionId, guid);
    if (!Number.isSafeInteger(addedAt) || addedAt < 0) {
      throw new Error('rss.favorite.persist requires a non-negative addedAt');
    }
    const result = await this.runtimeOwner.request('rss.favorite.persist', {
      subscriptionId,
      guid,
      addedAt,
    });
    const created = this.requiredBoolean(result.data, 'created');
    const favorite = this.decodeFavorite(this.requiredObject(result.data, 'favorite'));
    if (favorite.subscriptionId !== subscriptionId || favorite.guid !== guid) {
      throw new Error('rss.favorite.persist returned a mismatched scoped identity');
    }
    if (created && favorite.addedAt !== addedAt) {
      throw new Error('rss.favorite.persist returned a mismatched creation time');
    }
    return favorite;
  }

  /** Remove a favorite through Core's idempotent scoped identity path. */
  async removeFavorite(subscriptionId: string, guid: string): Promise<boolean> {
    this.requireEntryIdentity(subscriptionId, guid);
    const result = await this.runtimeOwner.request('rss.favorite.remove', {
      subscriptionId,
      guid,
    });
    const echoedSubscriptionId = this.requiredNonEmptyString(result.data, 'subscriptionId');
    const echoedGuid = this.requiredNonEmptyString(result.data, 'guid');
    const removed = this.requiredBoolean(result.data, 'removed');
    if (echoedSubscriptionId !== subscriptionId || echoedGuid !== guid) {
      throw new Error('rss.favorite.remove returned a mismatched scoped identity');
    }
    return removed;
  }

  /** Persist one enabled-state change through Core's canonical update path. */
  async updateSubscriptionEnabled(
    subscriptionId: string,
    enabled: boolean,
  ): Promise<RssSubscription> {
    this.requireSubscriptionId(subscriptionId);
    const result = await this.runtimeOwner.request('rss.subscription.persist', {
      operation: 'update',
      params: {
        subscriptionId,
        enabled,
      },
    });
    if (this.requiredString(result.data, 'operation') !== 'update') {
      throw new Error('rss.subscription.persist returned the wrong operation');
    }
    const data = this.requiredObject(result.data, 'data');
    const subscription = this.decodeSubscription(this.requiredObject(data, 'subscription'));
    if (subscription.subscriptionId !== subscriptionId || subscription.enabled !== enabled) {
      throw new Error('rss.subscription.persist returned a mismatched updated subscription');
    }
    return subscription;
  }

  /** Remove one subscription through Core's idempotent canonical delete path. */
  async removeSubscription(subscriptionId: string): Promise<boolean> {
    this.requireSubscriptionId(subscriptionId);
    const result = await this.runtimeOwner.request('rss.subscription.remove', {
      subscriptionId,
    });
    const echoedId = this.requiredString(result.data, 'subscriptionId');
    const deleted = this.requiredBoolean(result.data, 'deleted');
    if (echoedId !== subscriptionId) {
      throw new Error('rss.subscription.remove returned a mismatched subscriptionId');
    }
    return deleted;
  }

  /**
   * Refresh one feed through the Core-owned Host continuation. Every canonical
   * result field is decoded before the orchestrator is allowed to reload.
   */
  async refreshSubscription(subscriptionId: string): Promise<RssRefreshResult> {
    this.requireSubscriptionId(subscriptionId);
    const result = await this.runtimeOwner.request('rss.feed.refresh', {
      subscriptionId,
      evaluatedAt: 0,
    });
    const subscription = this.decodeSubscription(
      this.requiredObject(result.data, 'subscription'),
    );
    if (subscription.subscriptionId !== subscriptionId) {
      throw new Error('rss.feed.refresh returned a mismatched subscription');
    }
    const rawItems = result.data['items'];
    if (!Array.isArray(rawItems)) {
      throw new Error('rss.feed.refresh returned invalid items');
    }
    const items: RssItem[] = [];
    const seenGuids: string[] = [];
    for (const raw of rawItems) {
      const item = this.decodeItem(raw);
      if (item.subscriptionId !== subscriptionId) {
        throw new Error('rss.feed.refresh returned an item for another subscription');
      }
      if (seenGuids.includes(item.guid)) {
        throw new Error('rss.feed.refresh returned a duplicate scoped identity');
      }
      seenGuids.push(item.guid);
      items.push(item);
    }
    const count = this.nonNegativeInteger(result.data, 'count');
    const unreadCount = this.nonNegativeInteger(result.data, 'unreadCount');
    const newCount = this.nonNegativeInteger(result.data, 'newCount');
    if (count !== items.length) {
      throw new Error('rss.feed.refresh returned an inconsistent item count');
    }
    if (unreadCount !== subscription.unreadCount || unreadCount > count || newCount > count) {
      throw new Error('rss.feed.refresh returned inconsistent unread counts');
    }
    const fetched = this.requiredBoolean(result.data, 'fetched');
    const notModified = this.requiredBoolean(result.data, 'notModified');
    if ((notModified && (!fetched || newCount !== 0)) ||
      (!fetched && (notModified || newCount !== 0))) {
      throw new Error('rss.feed.refresh returned inconsistent fetch flags');
    }
    return {
      subscription,
      items,
      count,
      unreadCount,
      newCount,
      fetched,
      notModified,
      evaluatedAt: this.requiredInteger(result.data, 'evaluatedAt'),
    };
  }

  private decodeSubscription(value: unknown, source?: JsonObject): RssSubscription {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('rss.subscription.list returned a non-object subscription');
    }
    const sub = value as JsonObject;
    const decoded: RssSubscription = {
      subscriptionId: this.requiredNonEmptyString(sub, 'subscriptionId'),
      feedUrl: this.requiredNonEmptyString(sub, 'feedUrl'),
      title: this.requiredString(sub, 'title'),
      enabled: this.requiredBoolean(sub, 'enabled'),
      unreadCount: this.nonNegativeInteger(sub, 'unreadCount'),
    };
    const siteUrl = this.optionalString(sub, 'siteUrl');
    const lastFetchAt = this.optionalNumber(sub, 'lastFetchAt');
    if (siteUrl !== undefined) {
      decoded.siteUrl = siteUrl;
    }
    if (lastFetchAt !== undefined) {
      decoded.lastFetchAt = lastFetchAt;
    }
    if (source !== undefined) {
      const sourceGroup = this.optionalString(source, 'sourceGroup');
      const customOrder = this.optionalNumber(source, 'customOrder');
      const updateIntervalMinutes = this.optionalNumber(source, 'updateIntervalMinutes');
      const header = this.optionalString(source, 'header');
      const enabledCookieJar = this.optionalBoolean(source, 'enabledCookieJar');
      const ruleArticles = this.optionalString(source, 'ruleArticles');
      const ruleNextPage = this.optionalString(source, 'ruleNextPage');
      const ruleTitle = this.optionalString(source, 'ruleTitle');
      const rulePubDate = this.optionalString(source, 'rulePubDate');
      const ruleDescription = this.optionalString(source, 'ruleDescription');
      const ruleImage = this.optionalString(source, 'ruleImage');
      const ruleLink = this.optionalString(source, 'ruleLink');
      const ruleContent = this.optionalString(source, 'ruleContent');
      if (sourceGroup !== undefined) decoded.sourceGroup = sourceGroup;
      if (customOrder !== undefined) decoded.customOrder = customOrder;
      if (updateIntervalMinutes !== undefined) decoded.updateIntervalMinutes = updateIntervalMinutes;
      if (header !== undefined) decoded.header = header;
      if (enabledCookieJar !== undefined) decoded.enabledCookieJar = enabledCookieJar;
      if (ruleArticles !== undefined) decoded.ruleArticles = ruleArticles;
      if (ruleNextPage !== undefined) decoded.ruleNextPage = ruleNextPage;
      if (ruleTitle !== undefined) decoded.ruleTitle = ruleTitle;
      if (rulePubDate !== undefined) decoded.rulePubDate = rulePubDate;
      if (ruleDescription !== undefined) decoded.ruleDescription = ruleDescription;
      if (ruleImage !== undefined) decoded.ruleImage = ruleImage;
      if (ruleLink !== undefined) decoded.ruleLink = ruleLink;
      if (ruleContent !== undefined) decoded.ruleContent = ruleContent;
    }
    return decoded;
  }

  private encodeSource(draft: RssSourceDraft): JsonObject {
    const source: JsonObject = {
      sourceUrl: this.requireFeedUrl(draft.feedUrl),
      sourceName: draft.title.trim(),
      enabled: draft.enabled,
      enabledCookieJar: draft.enabledCookieJar,
    };
    this.putNonEmptyString(source, 'sourceGroup', draft.sourceGroup);
    this.putOptionalNonNegativeInteger(source, 'customOrder', draft.customOrder);
    this.putOptionalPositiveInteger(source, 'updateIntervalMinutes', draft.updateIntervalMinutes);
    this.putNonEmptyString(source, 'header', draft.header);
    this.putNonEmptyString(source, 'ruleArticles', draft.ruleArticles);
    this.putNonEmptyString(source, 'ruleNextPage', draft.ruleNextPage);
    this.putNonEmptyString(source, 'ruleTitle', draft.ruleTitle);
    this.putNonEmptyString(source, 'rulePubDate', draft.rulePubDate);
    this.putNonEmptyString(source, 'ruleDescription', draft.ruleDescription);
    this.putNonEmptyString(source, 'ruleImage', draft.ruleImage);
    this.putNonEmptyString(source, 'ruleLink', draft.ruleLink);
    this.putNonEmptyString(source, 'ruleContent', draft.ruleContent);
    return source;
  }

  private putNonEmptyString(target: JsonObject, key: string, value: string): void {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      target[key] = trimmed;
    }
  }

  private putOptionalNonNegativeInteger(target: JsonObject, key: string, value: number | undefined): void {
    if (value === undefined) {
      return;
    }
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${key} 必须是非负整数`);
    }
    target[key] = value;
  }

  private putOptionalPositiveInteger(target: JsonObject, key: string, value: number | undefined): void {
    if (value === undefined) {
      return;
    }
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${key} 必须是正整数`);
    }
    target[key] = value;
  }

  private requireFeedUrl(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > 8192) {
      throw new Error('RSS Feed URL 不能为空且不得超过 8192 字符');
    }
    const scheme = trimmed.toLowerCase();
    if (!scheme.startsWith('https://') && !scheme.startsWith('http://')) {
      throw new Error('RSS Feed URL 仅支持 HTTP/HTTPS');
    }
    return trimmed;
  }

  private decodeItem(value: unknown): RssItem {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('rss.subscription.items returned a non-object item');
    }
    const item = value as JsonObject;
    const decoded: RssItem = {
      subscriptionId: this.requiredNonEmptyString(item, 'subscriptionId'),
      title: this.requiredString(item, 'title'),
      guid: this.requiredNonEmptyString(item, 'guid'),
      read: this.requiredBoolean(item, 'read'),
      firstSeenAt: this.requiredInteger(item, 'firstSeenAt'),
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

  private decodeFavorite(value: unknown): RssFavorite {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('rss.favorite protocol returned a non-object favorite');
    }
    const raw = value as JsonObject;
    const decoded: RssFavorite = {
      subscriptionId: this.requiredNonEmptyString(raw, 'subscriptionId'),
      guid: this.requiredNonEmptyString(raw, 'guid'),
      feedUrl: this.requiredNonEmptyString(raw, 'feedUrl'),
      subscriptionTitle: this.requiredNonEmptyString(raw, 'subscriptionTitle'),
      title: this.requiredNonEmptyString(raw, 'title'),
      firstSeenAt: this.nonNegativeInteger(raw, 'firstSeenAt'),
      addedAt: this.nonNegativeInteger(raw, 'addedAt'),
    };
    const siteUrl = this.optionalNonEmptyString(raw, 'siteUrl');
    const link = this.optionalNonEmptyString(raw, 'link');
    const summary = this.optionalNonEmptyString(raw, 'summary');
    const publishedAt = this.optionalNonEmptyString(raw, 'publishedAt');
    if (siteUrl !== undefined) {
      decoded.siteUrl = siteUrl;
    }
    if (link !== undefined) {
      decoded.link = link;
    }
    if (summary !== undefined) {
      decoded.summary = summary;
    }
    if (publishedAt !== undefined) {
      decoded.publishedAt = publishedAt;
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

  private requiredNonEmptyString(value: JsonObject, key: string): string {
    const candidate = this.requiredString(value, key);
    if (candidate.length === 0) {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requiredBoolean(value: JsonObject, key: string): boolean {
    const candidate = value[key];
    if (typeof candidate !== 'boolean') {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requiredObject(value: JsonObject, key: string): JsonObject {
    const candidate = value[key];
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate as JsonObject;
  }

  private optionalString(value: JsonObject, key: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalNonEmptyString(value: JsonObject, key: string): string | undefined {
    const candidate = this.optionalString(value, key);
    if (candidate !== undefined && candidate.length === 0) {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private nonNegativeInteger(value: JsonObject, key: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0) {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requiredInteger(value: JsonObject, key: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate)) {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalNumber(value: JsonObject, key: string): number | undefined {
    const candidate = value[key];
    if (candidate === undefined) {
      return undefined;
    }
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate)) {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalBoolean(value: JsonObject, key: string): boolean | undefined {
    const candidate = value[key];
    if (candidate === undefined) {
      return undefined;
    }
    if (typeof candidate !== 'boolean') {
      throw new Error(`rss protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requireSubscriptionId(subscriptionId: string): void {
    if (subscriptionId.trim().length === 0) {
      throw new Error('rss command requires a non-blank subscriptionId');
    }
  }

  private requireEntryIdentity(subscriptionId: string, guid: string): void {
    this.requireSubscriptionId(subscriptionId);
    if (guid.trim().length === 0) {
      throw new Error('rss command requires a non-blank guid');
    }
  }
}
