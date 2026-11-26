import assert from 'node:assert/strict';
import { projectOperationFacts } from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import { projectRssFeedItems } from '../entry/src/main/ets/features/rss/presentation/RssPresentationContract.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';

const cases = {
  'archived-favorite': {
    description: 'Core saved-favorite DTO survives missing feed rows and opens the saved summary and validated original through the RSS Detail journey.',
    resources: [],
  },
};

async function archivedFavorite() {
  const source = path => new URL(`../entry/src/main/ets/features/rss/${path}`, import.meta.url);
  const item = { subscriptionId: 'current', guid: 'same', title: 'Live title', read: false, firstSeenAt: 1 };
  const archived = { subscriptionId: 'removed', guid: 'same', title: 'Saved title', subscriptionTitle: 'Saved source',
    feedUrl: 'https://example.test/feed', link: 'https://example.test/article', summary: 'Saved summary\n\nSecond paragraph',
    publishedAt: '2026-11-24', firstSeenAt: 1, addedAt: 2 };
  const liveFavorite = { ...archived, subscriptionId: 'current' };

  const projected = projectRssFeedItems([item], [liveFavorite, archived]);
  assert.deepEqual(projected.all, [item]);
  assert.deepEqual(projected.favorites, [item]);
  assert.deepEqual(projected.archivedFavorites, [archived]);
  assert.equal('read' in projected.archivedFavorites[0], false);
  assert.deepEqual(projectRssFeedItems([], [archived]).archivedFavorites, [archived]);

  const Page = productionMotionMethods(source('ui/RssPage.ets'), ['matchesQuery', 'visibleArchivedFavorites']);
  const page = Object.assign(new Page(), { feedItems: projected, query: 'saved source' });
  assert.deepEqual(page.visibleArchivedFavorites(), [archived]);
  page.query = 'other source';
  assert.deepEqual(page.visibleArchivedFavorites(), []);

  const Journey = productionMotionMethods(source('presentation/RssJourneyPresentation.ets'),
    ['onRssItemSelected', 'clearSelection', 'isCurrentRssPresentation', 'onRssEntryFavoriteRequested', 'returnFromRssEntryDetail', 'returnToRss'],
    { isReaderProductSurfaceEnabled: surface => surface === 'rss', projectOperationFacts });
  const owner = {};
  let route = 'rss';
  let generation = 0;
  let attached = 0;
  const navigation = {
    advance: () => ++generation, show: next => { route = next; }, generation: () => generation,
    route: () => route, retired: () => false, isCurrentOwner: value => value === owner,
  };
  const journey = Object.assign(new Journey(), {
    navigation, rssFeedItems: projected, loadRss: value => assert.equal(value, generation),
    getRssOrchestrator: () => { attached++; return { openEntry: assert.fail, setEntryFavorite: assert.fail }; },
    openRssEntryDetail: value => assert.equal(value, item),
  });
  journey.onRssItemSelected(item.subscriptionId, item.guid);
  assert.equal(attached, 0, 'a live row delegates to the existing live-detail admission');
  journey.onRssItemSelected(archived.subscriptionId, archived.guid);
  assert.equal(route, 'rssEntryDetail');
  assert.equal(attached, 1);
  assert.equal(journey.selectedRssArchive, archived);
  assert.equal(journey.selectedRssItem, undefined);
  assert.equal(journey.selectedRssSubscription, undefined);
  assert.equal(journey.isCurrentRssPresentation(generation, owner, route, archived.subscriptionId, archived.guid), true);
  assert.equal(journey.isCurrentRssPresentation(generation - 1, owner, route, archived.subscriptionId, archived.guid), false);
  journey.onRssEntryFavoriteRequested(false);
  assert.equal(attached, 1, 'archive detail performs no favorite mutation or entry read');

  const Detail = productionMotionMethods(source('ui/RssEntryDetailPage.ets'),
    ['summaryParagraphs', 'sourceTitle', 'itemMeta', 'originalUrl', 'openOriginal'], {
      url: { URL: { parseURL: value => new URL(value) } }, AppStorage: { get: () => true },
    });
  const links = [];
  const feedback = [];
  let openFails = false;
  const detail = Object.assign(new Detail(), {
    archivedFavorite: archived, pillMounted: true, pillAppearanceRevision: 1, presentationIdentity: 'current',
    originalInputCurrent: () => journey.isCurrentRssPresentation(generation, owner, 'rssEntryDetail', archived.subscriptionId, archived.guid),
    originalFeedback: { show(_context, value, current) { if (current()) feedback.push(value.message); } },
    getUIContext: () => ({ getHostContext: () => ({ async openLink(link, options) {
      links.push({ link, options });
      if (openFails) throw Error('browser unavailable');
    } }) }),
  });
  assert.deepEqual(detail.summaryParagraphs(), ['Saved summary', 'Second paragraph']);
  assert.equal(detail.sourceTitle(), archived.subscriptionTitle);
  assert.equal(detail.itemMeta(), archived.publishedAt);
  detail.archivedFavorite = { ...archived, link: 'https://user@example.test/' };
  await detail.openOriginal();
  assert.deepEqual(links, []);
  detail.archivedFavorite = archived;
  await detail.openOriginal();
  assert.deepEqual(links, [{ link: archived.link, options: { appLinkingOnly: false, hideFailureTipDialog: true } }]);
  openFails = true;
  await detail.openOriginal();
  assert.deepEqual(feedback, ['无法打开原文链接']);
  journey.returnFromRssEntryDetail();
  assert.equal(route, 'rss');
  assert.equal(journey.selectedRssArchive, undefined);
  await detail.openOriginal();
  assert.equal(links.length, 2, 'the old detail callback cannot open a browser after return');
}

for (const id of selectContractCases(cases)) {
  await archivedFavorite();
  recordContractCasePass(id);
}
