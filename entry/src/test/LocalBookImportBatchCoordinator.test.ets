// LocalBookImportBatchCoordinator.test — focused proof for the isolated
// multi-file coordinator. These tests intentionally use no route, reducer or
// ArkUI component; they cover only serial Core execution and stale guards.
import { describe, it, expect } from '@ohos/hypium';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import type { LocalBookParseOptions } from '../main/ets/bridge/CoreRuntime';
import type { ReaderSelectedFile } from '../main/ets/host/adapters/FileSelectionHostAdapter';
import {
  LocalBookImportBatchCoordinator,
  LocalBookImportBatchCoreGateway,
  LocalBookImportBatchFileReader,
} from '../main/ets/ui/store/LocalBookImportBatchCoordinator';

class DeferredValue<T> {
  readonly promise: Promise<T>;
  private resolver: ((value: T) => void) | undefined = undefined;
  private rejecter: ((error: Error) => void) | undefined = undefined;

  constructor() {
    this.promise = new Promise<T>((resolve, reject): void => {
      this.resolver = (value: T): void => resolve(value);
      this.rejecter = (error: Error): void => reject(error);
    });
  }

  resolve(value: T): void {
    if (this.resolver === undefined) throw new Error('deferred value has no resolver');
    this.resolver(value);
  }

  reject(error: Error): void {
    if (this.rejecter === undefined) throw new Error('deferred value has no rejecter');
    this.rejecter(error);
  }
}

class RecordingFileReader implements LocalBookImportBatchFileReader {
  readonly requestedNames: string[] = [];
  private readonly bytesByName: Record<string, string>;

  constructor(bytesByName: Record<string, string>) {
    this.bytesByName = bytesByName;
  }

  readBase64(file: ReaderSelectedFile): Promise<string> {
    this.requestedNames.push(file.name);
    const value = this.bytesByName[file.name];
    if (value === undefined) return Promise.reject(new Error(`missing bytes for ${file.name}`));
    return Promise.resolve(value);
  }
}

class DeferredCoreGateway implements LocalBookImportBatchCoreGateway {
  readonly materializeIds: string[] = [];
  readonly materializeOptions: LocalBookParseOptions[] = [];
  readonly addBookIds: string[] = [];
  readonly materializeDeferred: DeferredValue<JsonObject>[] = [];
  readonly addDeferred: DeferredValue<void>[] = [];

  materialize(bookId: string, options: LocalBookParseOptions): Promise<JsonObject> {
    this.materializeIds.push(bookId);
    this.materializeOptions.push(options);
    const deferred = new DeferredValue<JsonObject>();
    this.materializeDeferred.push(deferred);
    return deferred.promise;
  }

  addToBookshelf(book: JsonObject): Promise<void> {
    const fields = book as Object as Record<string, Object>;
    const bookId: Object = fields['bookId'];
    this.addBookIds.push(typeof bookId === 'string' ? bookId : '');
    const deferred = new DeferredValue<void>();
    this.addDeferred.push(deferred);
    return deferred.promise;
  }
}

function selected(name: string): ReaderSelectedFile {
  return { path: `/picked/${name}`, name: name };
}

function materialized(bookId: string): JsonObject {
  return JSON.parse(`{"book":{"bookId":"${bookId}","title":"${bookId}"}}`) as JsonObject;
}

async function flushBatch(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function coordinator(reader: LocalBookImportBatchFileReader,
  core: LocalBookImportBatchCoreGateway): LocalBookImportBatchCoordinator {
  return new LocalBookImportBatchCoordinator(reader, core,
    (epoch: number, fileIndex: number): string => `batch-${epoch}-${fileIndex}`);
}

export default function LocalBookImportBatchCoordinatorTests(): void {
  describe('LocalBookImportBatchCoordinator', () => {
    it('importsSelectedFilesSeriallyAndContinuesAfterOneFailure', 0, async () => {
      const reader = new RecordingFileReader({
        'one.txt': 'b25l',
        'two.epub': 'dHdv',
        'three.txt': 'dGhyZWU=',
      });
      const core = new DeferredCoreGateway();
      const batch = coordinator(reader, core);
      const completion = batch.start([selected('one.txt'), selected('two.epub'), selected('three.txt')]);

      await flushBatch();
      expect(reader.requestedNames.join(',')).assertEqual('one.txt');
      expect(core.materializeIds.join(',')).assertEqual('batch-1-0');
      core.materializeDeferred[0].resolve(materialized('batch-1-0'));
      await flushBatch();
      expect(core.addBookIds.join(',')).assertEqual('batch-1-0');
      core.addDeferred[0].resolve();
      await flushBatch();

      // File two starts only after file one reaches bookshelf.add completion.
      expect(reader.requestedNames.join(',')).assertEqual('one.txt,two.epub');
      expect(core.materializeIds.join(',')).assertEqual('batch-1-0,batch-1-1');
      core.materializeDeferred[1].reject(new Error('Core rejected the EPUB'));
      await flushBatch();

      // A per-file Core failure is recorded, then the serial queue continues.
      expect(reader.requestedNames.join(',')).assertEqual('one.txt,two.epub,three.txt');
      expect(core.materializeIds.join(',')).assertEqual('batch-1-0,batch-1-1,batch-1-2');
      core.materializeDeferred[2].resolve(materialized('batch-1-2'));
      await flushBatch();
      core.addDeferred[1].resolve();

      const result = await completion;
      expect(result.cancelled).assertFalse();
      expect(result.stale).assertFalse();
      expect(result.results.length).assertEqual(3);
      expect(result.results[0].fileName).assertEqual('one.txt');
      expect(result.results[0].status).assertEqual('success');
      expect(result.results[1].fileName).assertEqual('two.epub');
      expect(result.results[1].status).assertEqual('failure');
      expect(result.results[2].fileName).assertEqual('three.txt');
      expect(result.results[2].status).assertEqual('success');
      expect(core.materializeOptions[0].bytesBase64).assertEqual('b25l');
      expect(core.materializeOptions[0].format).assertEqual('txt');
      expect(core.materializeOptions[1].format).assertEqual('epub');
    });

    it('failsClosedForUnsupportedOrProtocolRequiredFormatsWithoutReadingThem', 0, async () => {
      const reader = new RecordingFileReader({ 'valid.txt': 'dmFsaWQ=' });
      const core = new DeferredCoreGateway();
      const batch = coordinator(reader, core);
      const completion = batch.start([selected('recognized.pdf'), selected('unknown.bin'), selected('valid.txt')]);

      await flushBatch();
      // PDF is recognized by the picker but requires a separate protocol;
      // neither it nor an unknown extension is reinterpreted as text.
      expect(reader.requestedNames.join(',')).assertEqual('valid.txt');
      expect(core.materializeIds.join(',')).assertEqual('batch-1-2');
      core.materializeDeferred[0].resolve(materialized('batch-1-2'));
      await flushBatch();
      core.addDeferred[0].resolve();

      const result = await completion;
      expect(result.results.length).assertEqual(3);
      expect(result.results[0].status).assertEqual('failure');
      expect(result.results[1].status).assertEqual('failure');
      expect(result.results[2].status).assertEqual('success');
    });

    it('cancellationStopsTheQueueAndDropsLateCoreResults', 0, async () => {
      const reader = new RecordingFileReader({ 'one.txt': 'b25l', 'two.txt': 'dHdv' });
      const core = new DeferredCoreGateway();
      const batch = coordinator(reader, core);
      const completion = batch.start([selected('one.txt'), selected('two.txt')]);

      await flushBatch();
      expect(core.materializeDeferred.length).assertEqual(1);
      expect(batch.cancel()).assertTrue();
      expect(batch.currentEpoch()).assertEqual(0);
      core.materializeDeferred[0].resolve(materialized('batch-1-0'));

      const result = await completion;
      expect(result.cancelled).assertTrue();
      expect(result.stale).assertFalse();
      expect(result.results.length).assertEqual(0);
      expect(reader.requestedNames.join(',')).assertEqual('one.txt');
      expect(core.addDeferred.length).assertEqual(0);
    });

    it('newEpochSupersedesOlderLateResults', 0, async () => {
      const reader = new RecordingFileReader({ 'old.txt': 'b2xk', 'new.txt': 'bmV3' });
      const core = new DeferredCoreGateway();
      const batch = coordinator(reader, core);
      const older = batch.start([selected('old.txt')]);
      await flushBatch();
      expect(core.materializeDeferred.length).assertEqual(1);

      const newer = batch.start([selected('new.txt')]);
      await flushBatch();
      expect(core.materializeDeferred.length).assertEqual(2);
      core.materializeDeferred[0].resolve(materialized('batch-1-0'));
      await flushBatch();
      expect(core.addDeferred.length).assertEqual(0);

      core.materializeDeferred[1].resolve(materialized('batch-2-0'));
      await flushBatch();
      expect(core.addDeferred.length).assertEqual(1);
      core.addDeferred[0].resolve();

      const olderResult = await older;
      const newerResult = await newer;
      expect(olderResult.stale).assertTrue();
      expect(olderResult.cancelled).assertFalse();
      expect(olderResult.results.length).assertEqual(0);
      expect(newerResult.stale).assertFalse();
      expect(newerResult.results.length).assertEqual(1);
      expect(newerResult.results[0].fileName).assertEqual('new.txt');
      expect(newerResult.results[0].status).assertEqual('success');
    });
  });
}
