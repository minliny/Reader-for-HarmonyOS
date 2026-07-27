import { describe, it, expect } from '@ohos/hypium';
import {
  buildReadingChainUiDetailLoadEvent,
  buildReadingChainUiSearchRouteEvent,
  buildSelfCheckCacheWriteRequest,
  firstReadableReadingChainUiChapterId,
} from '../main/ets/entryability/EntryAbility';

export default function EntryAbilityReadingChainSelfCheckTests(): void {
  describe('EntryAbility reading-chain self-check', () => {
    it('entersCanonicalSearchRouteBeforeSubmittingTheProbe', 0, () => {
      const event = buildReadingChainUiSearchRouteEvent();

      expect(event.type).assertEqual('route-push');
      expect(event.id).assertEqual('book-search');
    });

    it('createsParentDirectoriesForNestedSelfCheckCachePaths', 0, () => {
      const request = buildSelfCheckCacheWriteRequest('cache://rss/feed.xml', '<rss/>');

      expect(request.path).assertEqual('cache://rss/feed.xml');
      expect(request.createDirectories).assertTrue();
    });

    it('forwardsCoreSearchResultSourceIdIntoDetailLoad', 0, () => {
      const event = buildReadingChainUiDetailLoadEvent({
        title: '真实搜索结果',
        author: '作者',
        bookId: '/book/real-result',
        sourceId: 'core-source-yodu',
        sourceName: 'Core 书源',
        sourceUrl: 'https://example.invalid',
      });

      expect(event.type).assertEqual('book-detail-load');
      expect(event.bookId).assertEqual('/book/real-result');
      expect(event.sourceId).assertEqual('core-source-yodu');
      expect(event.loadFirstChapter).assertFalse();
    });

    it('keepsMissingSourceExplicitlyEmptyInsteadOfChoosingOne', 0, () => {
      const event = buildReadingChainUiDetailLoadEvent({
        title: '无来源结果',
        author: '作者',
        bookId: '/book/no-source',
        sourceName: '',
        sourceUrl: '',
      });

      expect(event.sourceId).assertEqual('');
    });

    it('usesAReadableTocRowInsteadOfTheDetailTocEndpoint', 0, () => {
      const chapterId = firstReadableReadingChainUiChapterId([
        { index: 4, title: '目录占位', chapterId: '' },
        { index: 9, title: '第一章', chapterId: '/book/real-result/chapter/9' },
      ]);

      expect(chapterId).assertEqual('/book/real-result/chapter/9');
    });

    it('doesNotInventAChapterWhenTheCoreTocHasNoReadableRow', 0, () => {
      expect(firstReadableReadingChainUiChapterId([
        { index: 4, title: '空目录项', chapterId: '' },
      ])).assertEqual('');
    });
  });
}
