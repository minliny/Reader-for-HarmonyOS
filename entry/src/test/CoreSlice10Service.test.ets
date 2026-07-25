import { describe, it, expect } from '@ohos/hypium';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import {
  CoreSlice10CommandDispatcher,
  CoreSlice10Service,
} from '../main/ets/ui/store/CoreSlice10Service';

class RecordingSlice10Dispatcher implements CoreSlice10CommandDispatcher {
  methods: string[] = [];
  params: JsonObject[] = [];
  timeouts: number[] = [];
  result: JsonObject;
  rejectMessage: string = '';

  constructor(result: JsonObject) {
    this.result = result;
  }

  execute(method: string, params: JsonObject, timeoutMs: number): Promise<JsonObject> {
    this.methods.push(method);
    this.params.push(params);
    this.timeouts.push(timeoutMs);
    if (this.rejectMessage.length > 0) return Promise.reject(new Error(this.rejectMessage));
    return Promise.resolve(this.result);
  }
}

function payload(value: string): ReaderUIJSONPayload {
  return JSON.parse(value) as Object as ReaderUIJSONPayload;
}

function result(value: string): JsonObject {
  return JSON.parse(value) as JsonObject;
}

function statusResult(): JsonObject {
  return result('{' +
    '"sourceId":"source-1","bookId":"book-1","tocAvailable":true,"chapterCount":5,' +
    '"chapters":[],"cachedCount":1,"queuedCount":2,"inProgressCount":0,' +
    '"completedCount":1,"failedCount":0,"cancelledCount":0,"missingCount":1,' +
    '"globalStats":{"entryCount":1,"totalContentBytes":128,"queueEntryCount":2,' +
    '"queuedCount":2,"inProgressCount":0,"completedCount":0,"failedCount":0,"cancelledCount":0}' +
    '}');
}

function prefetchResult(): JsonObject {
  return result('{' +
    '"sourceId":"source-1","bookId":"book-1","chapterRange":[2,5],"chapterCount":8,' +
    '"prefetchedCount":2,"queuedIndexes":[2,4],"alreadyQueuedIndexes":[3],"skippedCachedIndexes":[]' +
    '}');
}

function clearResult(scope: string): JsonObject {
  return result('{' +
    `"scope":"${scope}","cacheEntriesRemoved":2,"chapterEntriesRemoved":2,` +
    '"queueEntriesRemoved":1,"removedContentBytes":512' +
    '}');
}

function undoResult(): JsonObject {
  return result('{' +
    '"transactionId":"replace-9603","revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",' +
    '"operation":"update","ruleId":42,"changed":true,"undoneAt":1700000001' +
    '}');
}

function replacePersistPayload(): ReaderUIJSONPayload {
  return payload('{' +
    '"operation":"create","params":{' +
    '"name":"weather","pattern":"rain","replacement":"sun","scope":"chapter",' +
    '"scopeTitle":false,"scopeContent":true,"isEnabled":true,"isRegex":true}' +
    '}');
}

function replacePersistResult(): JsonObject {
  return result('{' +
    '"operation":"create","data":{"rule":{' +
    '"id":42,"name":"weather","pattern":"rain","replacement":"sun",' +
    '"scopeTitle":false,"scopeContent":true,"isEnabled":true,"isRegex":true,' +
    '"timeoutMillisecond":3000,"order":0}},' +
    '"undoToken":{' +
    '"schemaVersion":1,"transactionId":"replace-create-42",' +
    '"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",' +
    '"operation":"create","ruleId":42,"issuedAt":1700000000,"expiresAt":1700000300,' +
    '"after":{"id":42,"name":"weather","pattern":"rain","replacement":"sun",' +
    '"scopeTitle":false,"scopeContent":true,"isEnabled":true,"isRegex":true,' +
    '"timeoutMillisecond":3000,"order":0}}' +
    '}');
}

function fullUndoPayload(): ReaderUIJSONPayload {
  return payload('{' +
    '"undoToken":{' +
    '"schemaVersion":1,"transactionId":"replace-9603",' +
    '"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",' +
    '"operation":"update","ruleId":42,"issuedAt":1700000000,"expiresAt":1700000300,' +
    '"before":{"id":42,"name":"weather","pattern":"rain","replacement":"cloud",' +
    '"scopeTitle":false,"scopeContent":true,"isEnabled":true,"isRegex":false,' +
    '"timeoutMillisecond":3000,"order":0},' +
    '"after":{"id":42,"name":"weather","pattern":"rain","replacement":"sun",' +
    '"scopeTitle":false,"scopeContent":true,"isEnabled":true,"isRegex":false,' +
    '"timeoutMillisecond":3000,"order":0}' +
    '}}');
}

export default function CoreSlice10ServiceTests(): void {
  describe('CoreSlice10Service', () => {
    it('forwardsExactSourceAndBookToCacheStatus', 0, async () => {
      const dispatcher = new RecordingSlice10Dispatcher(statusResult());
      const service = new CoreSlice10Service(dispatcher);

      await service.cacheBookStatus(payload('{"sourceId":"source-1","bookId":"book-1"}'));

      expect(dispatcher.methods.join(',')).assertEqual('cache.book.status');
      expect(dispatcher.params.length).assertEqual(1);
      expect(dispatcher.params[0]['sourceId'] as string).assertEqual('source-1');
      expect(dispatcher.params[0]['bookId'] as string).assertEqual('book-1');
      expect(Object.keys(dispatcher.params[0]).sort().join(',')).assertEqual('bookId,sourceId');
    });

    it('keepsPrefetchRangeEndExclusiveAndOptionalFields', 0, async () => {
      const dispatcher = new RecordingSlice10Dispatcher(prefetchResult());
      const service = new CoreSlice10Service(dispatcher);
      const requestPayload = payload('{' +
        '"sourceId":"source-1","bookId":"book-1","chapterRange":[2,5],' +
        '"priority":10,"requestedAt":1700000000}');
      const originalRange = requestPayload['chapterRange'] as Object;

      await service.cacheBookPrefetch(requestPayload);

      expect(dispatcher.methods[0]).assertEqual('cache.book.prefetch');
      expect(dispatcher.params[0]['chapterRange'] === originalRange).assertTrue();
      const sentRange = dispatcher.params[0]['chapterRange'] as number[];
      expect(sentRange[0]).assertEqual(2);
      expect(sentRange[1]).assertEqual(5);
      expect(dispatcher.params[0]['priority'] as number).assertEqual(10);
      expect(dispatcher.params[0]['requestedAt'] as number).assertEqual(1700000000);
    });

    it('forwardsCompleteBookSelectorToCacheClear', 0, async () => {
      const dispatcher = new RecordingSlice10Dispatcher(clearResult('book'));
      const service = new CoreSlice10Service(dispatcher);

      await service.cacheClear(payload('{' +
        '"scope":"book","sourceId":"source-1","bookId":"book-1"}'));

      expect(dispatcher.methods[0]).assertEqual('cache.clear');
      expect(dispatcher.params[0]['scope'] as string).assertEqual('book');
      expect(dispatcher.params[0]['sourceId'] as string).assertEqual('source-1');
      expect(dispatcher.params[0]['bookId'] as string).assertEqual('book-1');
    });

    it('forwardsTheWholeCoreIssuedUndoTokenWithoutReconstruction', 0, async () => {
      const dispatcher = new RecordingSlice10Dispatcher(undoResult());
      const service = new CoreSlice10Service(dispatcher);
      const requestPayload = fullUndoPayload();
      const originalToken = requestPayload['undoToken'] as Object;

      await service.replaceUndo(requestPayload);

      expect(dispatcher.methods[0]).assertEqual('replace.undo');
      expect(dispatcher.params[0]['undoToken'] === originalToken).assertTrue();
      const token = dispatcher.params[0]['undoToken'] as Object as JsonObject;
      expect(token['revision'] as string).assertEqual(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(typeof token['before'] === 'object').assertTrue();
      expect(typeof token['after'] === 'object').assertTrue();
    });

    it('forwardsStrictNativeReplacePersistCreateAndKeepsTheCoreUndoToken', 0, async () => {
      const dispatcher = new RecordingSlice10Dispatcher(replacePersistResult());
      const service = new CoreSlice10Service(dispatcher);
      const requestPayload = replacePersistPayload();
      const originalParams = requestPayload['params'] as Object;

      const response = await service.replacePersistCreate(requestPayload);

      expect(dispatcher.methods[0]).assertEqual('replace.persist');
      expect(dispatcher.params[0]['operation'] as string).assertEqual('create');
      expect(dispatcher.params[0]['params'] === originalParams).assertTrue();
      expect(Object.keys(dispatcher.params[0]).sort().join(',')).assertEqual('operation,params');
      const token = response['undoToken'] as Object as JsonObject;
      expect(token['transactionId'] as string).assertEqual('replace-create-42');
      expect(token['revision'] as string).assertEqual(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
    });

    it('rejectsAnIncompleteBookSelectorBeforeDispatch', 0, async () => {
      const dispatcher = new RecordingSlice10Dispatcher(clearResult('book'));
      const service = new CoreSlice10Service(dispatcher);
      let message = '';

      try {
        await service.cacheClear(payload('{"scope":"book","sourceId":"source-1"}'));
      } catch (error) {
        message = (error as Error).message;
      }

      // The typed payload contract uses oneOf with three scope variants
      // (all/cache/book). A book scope without bookId matches none of them,
      // so rejection happens at schema validation before dispatch.
      expect(message.indexOf('payload') >= 0).assertTrue();
      expect(message.indexOf('schema variant') >= 0).assertTrue();
      expect(dispatcher.methods.length).assertEqual(0);
    });

    it('rejectsMissingCoreResultDataExplicitly', 0, async () => {
      const dispatcher = new RecordingSlice10Dispatcher(result('{}'));
      const service = new CoreSlice10Service(dispatcher);
      let message = '';

      try {
        await service.cacheClear(payload('{"scope":"cache"}'));
      } catch (error) {
        message = (error as Error).message;
      }

      // The typed result contract requires scope on every cache.clear result.
      // An empty object fails schema validation before the service-level
      // "returned no result data" guard ever runs.
      expect(message.indexOf('result.scope') >= 0).assertTrue();
      expect(message.indexOf('is required') >= 0).assertTrue();
    });

    it('propagatesCoreRejectionInsteadOfReportingSuccess', 0, async () => {
      const dispatcher = new RecordingSlice10Dispatcher(statusResult());
      dispatcher.rejectMessage = 'UNKNOWN_METHOD: cache.book.status';
      const service = new CoreSlice10Service(dispatcher);
      let message = '';

      try {
        await service.cacheBookStatus(payload('{"sourceId":"source-1","bookId":"book-1"}'));
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).assertEqual('UNKNOWN_METHOD: cache.book.status');
    });

    it('rejectsUnknownAndNestedCacheResultDrift', 0, async () => {
      const unknown = statusResult();
      unknown['fixtureOnly'] = true;
      let unknownMessage = '';
      try {
        await new CoreSlice10Service(new RecordingSlice10Dispatcher(unknown))
          .cacheBookStatus(payload('{"sourceId":"source-1","bookId":"book-1"}'));
      } catch (error) {
        unknownMessage = (error as Error).message;
      }
      expect(unknownMessage.length > 0).assertTrue();

      const nested = statusResult();
      nested['chapters'] = [JSON.parse('{' +
        '"chapterIndex":0,"title":"Chapter","url":"/0","state":"fixture-complete",' +
        '"cachedBytes":1,"attempts":0,"maxAttempts":3}') as Object];
      let nestedMessage = '';
      try {
        await new CoreSlice10Service(new RecordingSlice10Dispatcher(nested))
          .cacheBookStatus(payload('{"sourceId":"source-1","bookId":"book-1"}'));
      } catch (error) {
        nestedMessage = (error as Error).message;
      }
      expect(nestedMessage.length > 0).assertTrue();
    });

    it('rejectsInvalidIndexRevisionAndRestoredRuleResultDrift', 0, async () => {
      const invalidIndexes = prefetchResult();
      invalidIndexes['queuedIndexes'] = [-1];
      let indexMessage = '';
      try {
        await new CoreSlice10Service(new RecordingSlice10Dispatcher(invalidIndexes))
          .cacheBookPrefetch(payload('{' +
          '"sourceId":"source-1","bookId":"book-1","chapterRange":[2,5]}'));
      } catch (error) {
        indexMessage = (error as Error).message;
      }
      expect(indexMessage.length > 0).assertTrue();

      const invalidUndo = undoResult();
      invalidUndo['revision'] = 'short';
      let revisionMessage = '';
      try {
        await new CoreSlice10Service(new RecordingSlice10Dispatcher(invalidUndo))
          .replaceUndo(fullUndoPayload());
      } catch (error) {
        revisionMessage = (error as Error).message;
      }
      expect(revisionMessage.length > 0).assertTrue();

      const invalidRestored = undoResult();
      invalidRestored['restoredRule'] = JSON.parse('{' +
        '"id":42,"name":"weather","pattern":"rain","replacement":"cloud",' +
        '"scopeTitle":false,"scopeContent":true,"isEnabled":true,"isRegex":false,' +
        '"timeoutMillisecond":3000,"order":0,"fixtureOnly":true}') as Object;
      let restoredMessage = '';
      try {
        await new CoreSlice10Service(new RecordingSlice10Dispatcher(invalidRestored))
          .replaceUndo(fullUndoPayload());
      } catch (error) {
        restoredMessage = (error as Error).message;
      }
      expect(restoredMessage.length > 0).assertTrue();
    });
  });
}
