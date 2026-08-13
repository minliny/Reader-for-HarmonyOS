import { describe, it, expect } from '@ohos/hypium';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import {
  ReaderBookOpenDomainMapper,
  ReaderBookOpenTocContext,
} from '../main/ets/ui/store/ReaderBookOpenDomainMapper';
import { CoreBookshelfBook, CoreSourceEntry } from '../main/ets/ui/store/ReaderUiState';

function source(): CoreSourceEntry {
  return {
    sourceId: 'source-1',
    name: '真实书源',
    baseUrl: 'https://source.example',
    enabled: true,
  };
}

export default function ReaderBookOpenDomainMapperTests(): void {
  describe('ReaderBookOpenDomainMapper', () => {
    it('retainsTypedDetailVariablesWithoutStringSerialization', 0, () => {
      const data = JSON.parse('{' +
        '"book":{"bookId":"book-1","title":"三体","author":"刘慈欣"},' +
        '"tocUrl":"/book-1/toc","variables":{"csrf":"token","page":2}' +
        '}') as JsonObject;
      const variables = data['variables'] as Object;
      const mapped = ReaderBookOpenDomainMapper.mapRemoteDetail(data, 'book-1', source());

      expect(mapped.book.title).assertEqual('三体');
      expect(mapped.tocUrl).assertEqual('/book-1/toc');
      expect(mapped.variables as Object === variables).assertTrue();
      if (mapped.variables !== undefined) {
        expect(mapped.variables['csrf'] as string).assertEqual('token');
        expect(mapped.variables['page'] as number).assertEqual(2);
      }
    });

    it('keepsEveryCoreTocRowAndUsesOnlyRuntimeSelectedIndex', 0, () => {
      const data = JSON.parse('{' +
        '"toc":[' +
        '{"index":4,"title":"第一章","url":"/chapter/1","variables":{"token":"one"}},' +
        '{"index":8,"title":"第二章","url":"/chapter/2","variables":{"token":"two"}},' +
        '{"index":9,"title":"坏数据"}' +
        ']}') as JsonObject;
      const toc: ReaderBookOpenTocContext = ReaderBookOpenDomainMapper.mapToc(data);

      expect(toc.chapterCount).assertEqual(3);
      expect(toc.entries.length).assertEqual(3);
      expect(toc.visibleEntries.length).assertEqual(2);
      const selected = ReaderBookOpenDomainMapper.selectChapter(toc, 1);
      expect(selected.index).assertEqual(8);
      expect(selected.chapterId).assertEqual('/chapter/2');
      const secondRow = (data['toc'] as Object[])[1] as Object as JsonObject;
      const rowVariables = secondRow['variables'] as Object;
      if (selected.variables !== undefined) {
        expect(selected.variables['token'] as string).assertEqual('two');
      }
      expect(selected.variables as Object === rowVariables).assertTrue();
      const content = ReaderBookOpenDomainMapper.mapContent(
        JSON.parse('{"content":"第二章正文"}') as JsonObject,
        selected,
      );
      // Content must retain the exact selected-entry context (including the
      // typed variables), rather than reconstructing a URL-only chapter DTO.
      expect(content.chapter as Object === selected as Object).assertTrue();
      expect(content.chapter.variables as Object === rowVariables).assertTrue();

      let invalidSelected = false;
      try {
        ReaderBookOpenDomainMapper.selectChapter(toc, 2);
      } catch (e) {
        invalidSelected = true;
      }
      expect(invalidSelected).assertTrue();
    });

    it('fallsBackToTypedDetailVariablesForSelectedChapter', 0, () => {
      const data = JSON.parse('{"toc":[{"index":0,"title":"第一章","url":"/chapter/1"}]}') as JsonObject;
      const detailVariables = JSON.parse('{"cookie":"session"}') as JsonObject;
      const selected = ReaderBookOpenDomainMapper.selectChapter(
        ReaderBookOpenDomainMapper.mapToc(data), 0, detailVariables,
      );
      expect(selected.variables as Object === detailVariables as Object).assertTrue();
    });

    it('mapsLocalDetailAndRealCoreContent', 0, () => {
      const localBook: CoreBookshelfBook = {
        sourceId: 'local',
        bookId: 'local-1',
        title: '本地书',
        author: '作者',
        coverUrl: '',
        intro: '简介',
        kind: 'txt',
        lastChapter: '第二章',
        group: '',
      };
      const detail = ReaderBookOpenDomainMapper.mapLocalDetail(localBook);
      expect(detail.book.sourceId).assertEqual('local');
      expect(detail.book.chapterListUrl).assertEqual('local-1');

      const toc = ReaderBookOpenDomainMapper.mapToc(
        JSON.parse('{"toc":[{"index":0,"title":"第一章","url":"local-1#0"}]}') as JsonObject,
      );
      const selected = ReaderBookOpenDomainMapper.selectChapter(toc, 0);
      const content = ReaderBookOpenDomainMapper.mapContent(
        JSON.parse('{"content":"第一段<br><br>第二段"}') as JsonObject,
        selected,
      );
      expect(content.paragraphs.length).assertEqual(2);
      expect(content.paragraphs[1]).assertEqual('第二段');
      expect(content.chapter.chapterId).assertEqual('local-1#0');
    });
  });
}
