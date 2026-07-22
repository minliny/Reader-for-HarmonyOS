import { describe, it, expect } from '@ohos/hypium';
import { buildReadingChainUiDetailLoadEvent } from '../main/ets/entryability/EntryAbility';

export default function EntryAbilityReadingChainSelfCheckTests(): void {
  describe('EntryAbility reading-chain self-check', () => {
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
  });
}
