// RssSelectionProjection — ephemeral, UI-owned selection data for one Core RSS
// item.  It deliberately mirrors only display fields; Core remains the owner
// of subscriptions, unread state, and item persistence.
import { CoreRssItem } from '../store/ReaderUiState';

export class RssSelectionProjection {
  static readonly K_TITLE: string = 'ui.rss.selectedItem.title';
  static readonly K_DESCRIPTION: string = 'ui.rss.selectedItem.description';
  static readonly K_AUTHOR: string = 'ui.rss.selectedItem.author';
  static readonly K_DATE: string = 'ui.rss.selectedItem.date';
  static readonly K_LINK: string = 'ui.rss.selectedItem.link';
  static readonly K_SUBSCRIPTION_ID: string = 'ui.rss.selectedItem.subscriptionId';

  static write(item: CoreRssItem): void {
    AppStorage.setOrCreate<string>(RssSelectionProjection.K_TITLE, item.title);
    AppStorage.setOrCreate<string>(RssSelectionProjection.K_DESCRIPTION, item.description);
    AppStorage.setOrCreate<string>(RssSelectionProjection.K_AUTHOR, item.author);
    AppStorage.setOrCreate<string>(RssSelectionProjection.K_DATE, item.pubDate);
    AppStorage.setOrCreate<string>(RssSelectionProjection.K_LINK, item.link);
    AppStorage.setOrCreate<string>(RssSelectionProjection.K_SUBSCRIPTION_ID, item.subscriptionId);
  }
}
