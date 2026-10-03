import type { RssItem, RssSubscription } from './RssGateway';
import type { RssPresentation } from './RssPage';
import type { RssSubscriptionManagementItem } from './RssSubscriptionManagementPage';

/** Pure current-UI projection of authoritative RSS DTOs. No independent
 * subscription store, request, inferred health or hidden product mode. */
export class RssPresentationProjection {
  static feed(subscriptions: RssSubscription[], recentUnread: RssItem[]): RssPresentation {
    return { kind: 'feed', subscriptions, recentUnread };
  }

  static subscriptions(presentation: RssPresentation): RssSubscription[] {
    return presentation.kind === 'fatalError' ? [] : presentation.subscriptions;
  }

  static recentUnread(presentation: RssPresentation): RssItem[] {
    return presentation.kind === 'feed' || presentation.kind === 'refreshing' ? presentation.recentUnread : [];
  }

  static managementItems(presentation: RssPresentation): RssSubscriptionManagementItem[] {
    return RssPresentationProjection.subscriptions(presentation).map((subscription: RssSubscription): RssSubscriptionManagementItem => ({
      subscriptionId: subscription.subscriptionId, title: subscription.title,
      meta: RssPresentationProjection.managementMeta(subscription), enabled: subscription.enabled,
    }));
  }

  static managementMeta(subscription: RssSubscription): string {
    const parts: string[] = [];
    if (subscription.sourceGroup !== undefined && subscription.sourceGroup.trim().length > 0) parts.push(subscription.sourceGroup);
    if (subscription.customOrder !== undefined) parts.push(`排序 ${subscription.customOrder}`);
    if (subscription.ruleArticles !== undefined && subscription.ruleArticles.trim().length > 0) parts.push('规则型');
    const siteUrl = subscription.siteUrl;
    parts.push(siteUrl !== undefined && siteUrl.trim().length > 0 ? siteUrl : subscription.feedUrl);
    if (subscription.lastFetchAt !== undefined && subscription.lastFetchAt > 0)
      parts.push(`上次刷新 ${RssPresentationProjection.managementTime(subscription.lastFetchAt)}`);
    if (!subscription.enabled) parts.push('已停用');
    return parts.join(' · ');
  }

  private static managementTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${RssPresentationProjection.twoDigit(date.getMonth() + 1)}-${RssPresentationProjection.twoDigit(date.getDate())} ` +
      `${RssPresentationProjection.twoDigit(date.getHours())}:${RssPresentationProjection.twoDigit(date.getMinutes())}`;
  }
  private static twoDigit(value: number): string { return value < 10 ? `0${value}` : `${value}`; }
}
