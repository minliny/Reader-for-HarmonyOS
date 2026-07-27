// Correlation-scoped executor for the opt-in Reader-UI `book.open` Pilot.
//
// ReaderUIRuntime owns only the transaction state machine. This file owns the
// one-to-one execution of its single next Core effect and retains raw Core
// variables/selected TOC context until that correlation has completed or been
// cancelled. It deliberately does not call ReaderEffects: the Pilot must not
// execute the legacy book/detail/toc/content chain a second time.
import {
  type ReaderUIAsyncTransition,
  type ReaderUIBookOpenLayout,
  type ReaderUIEffect,
  type ReaderUIJSONPayload,
  type ReaderUIJSONResult,
  type ReaderUIState,
} from 'reader_ui_runtime';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import {
  ReaderBookOpenDomainContext,
  ReaderBookOpenDomainMapper,
} from './ReaderBookOpenDomainMapper';
import {
  CoreBookshelfBook,
  CoreSourceEntry,
  ReaderUiState,
  UiEvent,
} from './ReaderUiState';

/** Narrow structural view of the real CoreCommandHandle. */
export interface ReaderBookOpenCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancel(): boolean;
}

/** Testable seam for exactly the Core commands used by a book.open sequence. */
export interface ReaderBookOpenCoreGateway {
  beginBookDetailFromSource(sourceId: string, bookUrl: string, book: JsonObject): ReaderBookOpenCommandHandle;
  beginBookTocFromSource(sourceId: string, bookId: string, tocUrl: string,
    variables?: JsonObject): ReaderBookOpenCommandHandle;
  beginChapterContentFromSource(sourceId: string, bookId: string, chapterUrl: string,
    chapterTitle?: string, chapterIndex?: number, variables?: JsonObject): ReaderBookOpenCommandHandle;
  beginLocalBookToc(bookId: string): ReaderBookOpenCommandHandle;
  beginLocalBookChapterContent(bookId: string, chapterIndex: number): ReaderBookOpenCommandHandle;
  beginReaderLocationResolve(bookId: string, chapterIndex: number, chapterOffset: number,
    chapterProgress: number, viewportWidth: number, viewportHeight: number,
    fontScale: number): ReaderBookOpenCommandHandle;
}

/** Production gateway. It is created lazily so Shadow mode never needs Core. */
export class CoreRuntimeBookOpenGateway implements ReaderBookOpenCoreGateway {
  beginBookDetailFromSource(sourceId: string, bookUrl: string, book: JsonObject): ReaderBookOpenCommandHandle {
    return CoreRuntime.get().beginBookDetailFromSource(sourceId, bookUrl, book);
  }

  beginBookTocFromSource(sourceId: string, bookId: string, tocUrl: string,
    variables?: JsonObject): ReaderBookOpenCommandHandle {
    return CoreRuntime.get().beginBookTocFromSource(sourceId, bookId, tocUrl, variables);
  }

  beginChapterContentFromSource(sourceId: string, bookId: string, chapterUrl: string,
    chapterTitle: string = '', chapterIndex?: number, variables?: JsonObject): ReaderBookOpenCommandHandle {
    return CoreRuntime.get().beginChapterContentFromSource(
      sourceId, bookId, chapterUrl, chapterTitle, chapterIndex, variables,
    );
  }

  beginLocalBookToc(bookId: string): ReaderBookOpenCommandHandle {
    return CoreRuntime.get().beginLocalBookToc(bookId);
  }

  beginLocalBookChapterContent(bookId: string, chapterIndex: number): ReaderBookOpenCommandHandle {
    return CoreRuntime.get().beginLocalBookChapterContent(bookId, chapterIndex);
  }

  beginReaderLocationResolve(bookId: string, chapterIndex: number, chapterOffset: number,
    chapterProgress: number, viewportWidth: number, viewportHeight: number,
    fontScale: number): ReaderBookOpenCommandHandle {
    return CoreRuntime.get().beginReaderLocationResolve(
      bookId, chapterIndex, chapterOffset, chapterProgress, viewportWidth, viewportHeight, fontScale,
    );
  }
}

/** Adapter over ReaderUIRuntime's serial transaction APIs. */
export interface ReaderBookOpenRuntimeGateway {
  currentState(): ReaderUIState;
  acceptBookOpenResult(coreType: string, correlationId: string, chapterCount?: number,
    error?: string): ReaderUIAsyncTransition;
  acceptBookOpenJSONResult(coreType: string, correlationId: string,
    result: ReaderUIJSONResult): ReaderUIAsyncTransition;
  provideBookOpenLayout(correlationId: string, layout: ReaderUIBookOpenLayout): ReaderUIAsyncTransition;
  cancelBookOpen(correlationId: string): ReaderUIAsyncTransition;
}

/** Store-owned projection seam. Domain events bypass ReaderEffects by design. */
export interface ReaderBookOpenPilotHost {
  nativeState(): ReaderUiState;
  applyRuntimeState(runtimeState: ReaderUIState): void;
  applyDomainEvent(event: UiEvent): void;
}

export interface ReaderBookOpenPilotContext extends ReaderBookOpenDomainContext {
  source?: CoreSourceEntry;
  localBook?: CoreBookshelfBook;
  inFlight?: ReaderBookOpenCommandHandle;
  currentEffect?: string;
  contentGeneration: number;
}

export interface ReaderBookOpenPilotSnapshot {
  activeCorrelationId: string;
  activeRequestId: number;
  executedEffects: number;
  ignoredLateResults: number;
  cancelledCommands: number;
  contentGeneration: number;
}

/**
 * One executor instance is created by the Store-owned rollout coordinator.
 * It accepts at most one active correlation because ReaderUIRuntime itself
 * serializes book.open and returns superseded correlation ids explicitly.
 */
export class ReaderBookOpenEffectExecutor {
  private readonly core: ReaderBookOpenCoreGateway;
  private readonly runtime: ReaderBookOpenRuntimeGateway;
  private readonly host: ReaderBookOpenPilotHost;
  private active: ReaderBookOpenPilotContext | null = null;
  private executedEffects: number = 0;
  private ignoredLateResults: number = 0;
  private cancelledCommands: number = 0;
  private nextContentGeneration: number = 0;

  constructor(runtime: ReaderBookOpenRuntimeGateway, host: ReaderBookOpenPilotHost,
    core: ReaderBookOpenCoreGateway = new CoreRuntimeBookOpenGateway()) {
    this.runtime = runtime;
    this.host = host;
    this.core = core;
  }

  start(correlationId: string, payload: ReaderUIJSONPayload, effect: ReaderUIEffect): void {
    if (effect.correlationId !== correlationId) {
      throw new Error('book.open effect correlation does not match the runtime transaction');
    }
    if (this.active !== null) {
      throw new Error(`book.open executor already owns ${this.active.correlationId}`);
    }
    const context = this.createContext(correlationId, payload);
    this.active = context;
    this.host.applyRuntimeState(this.runtime.currentState());
    this.execute(context, effect);
  }

  cancel(correlationId: string): boolean {
    const context = this.active;
    if (context === null || context.correlationId !== correlationId) return false;
    const handle = context.inFlight;
    if (handle !== undefined && handle.cancel()) {
      this.cancelledCommands += 1;
    }
    context.inFlight = undefined;
    context.currentEffect = undefined;
    this.active = null;
    return true;
  }

  hasActiveCorrelation(): boolean {
    return this.active !== null;
  }

  activeCorrelationId(): string {
    return this.active?.correlationId ?? '';
  }

  provideMeasuredLayout(correlationId: string, contentGeneration: number,
    layout: ReaderUIBookOpenLayout): boolean {
    const context = this.active;
    if (context === null || context.correlationId !== correlationId || context.content === undefined ||
      context.contentGeneration !== contentGeneration || context.inFlight !== undefined) return false;
    let transition: ReaderUIAsyncTransition;
    try {
      transition = this.runtime.provideBookOpenLayout(context.correlationId, layout);
    } catch (error) {
      return false;
    }
    if (!transition.accepted || !this.isActive(context)) return false;
    this.consumeTransition(context, transition);
    return true;
  }

  snapshot(): ReaderBookOpenPilotSnapshot {
    return {
      activeCorrelationId: this.active?.correlationId ?? '',
      activeRequestId: this.active?.inFlight?.requestId ?? 0,
      executedEffects: this.executedEffects,
      ignoredLateResults: this.ignoredLateResults,
      cancelledCommands: this.cancelledCommands,
      contentGeneration: this.active?.contentGeneration ?? 0,
    };
  }

  private createContext(correlationId: string, payload: ReaderUIJSONPayload): ReaderBookOpenPilotContext {
    const sourceKindValue = payload['sourceKind'];
    const sourceIdValue = payload['sourceId'];
    const bookIdValue = payload['bookId'];
    const sourceKind = typeof sourceKindValue === 'string' ? sourceKindValue : '';
    const sourceId = typeof sourceIdValue === 'string' ? sourceIdValue : '';
    const bookId = typeof bookIdValue === 'string' ? bookIdValue : '';
    if ((sourceKind !== 'remote' && sourceKind !== 'local') || sourceId === undefined || sourceId.length === 0 ||
      bookId === undefined || bookId.length === 0) {
      throw new Error('book.open Pilot requires non-empty bookId/sourceId and sourceKind=remote|local');
    }
    const context: ReaderBookOpenPilotContext = {
      correlationId: correlationId,
      sourceKind: sourceKind,
      sourceId: sourceId,
      bookId: bookId,
      contentGeneration: 0,
    };
    if (sourceKind === 'local') {
      const shelf = this.host.nativeState().bookshelfBooks;
      let localBook: CoreBookshelfBook | null = null;
      for (let index = 0; index < shelf.length; index += 1) {
        if (shelf[index].sourceId === 'local' && shelf[index].bookId === bookId) {
          localBook = shelf[index];
          break;
        }
      }
      if (localBook === null) {
        throw new Error('book.open local Pilot requires the selected durable local bookshelf entry');
      }
      context.localBook = localBook;
      context.detail = ReaderBookOpenDomainMapper.mapLocalDetail(localBook);
    } else {
      // Do not issue a second, uncorrelated source.list request from a
      // `source.detail` runtime effect. The direct reader CTA is allowed only
      // when Store already holds the Core-projected, enabled source entry.
      const sources = this.host.nativeState().availableSources;
      let source: CoreSourceEntry | null = null;
      for (let index = 0; index < sources.length; index += 1) {
        if (sources[index].sourceId === sourceId && sources[index].enabled) {
          source = sources[index];
          break;
        }
      }
      if (source === null) {
        throw new Error('book.open remote Pilot requires its enabled Core source entry in Store DomainState');
      }
      context.source = source;
    }
    return context;
  }

  private execute(context: ReaderBookOpenPilotContext, effect: ReaderUIEffect): void {
    if (!this.isActive(context) || effect.correlationId !== context.correlationId) {
      this.ignoredLateResults += 1;
      return;
    }
    if (context.inFlight !== undefined) {
      throw new Error(`book.open ${context.correlationId} attempted concurrent Core effect execution`);
    }
    context.currentEffect = effect.type;
    switch (effect.type) {
      case 'source.detail':
        this.executeRemoteDetail(context);
        return;
      case 'chapter.list':
        this.executeToc(context);
        return;
      case 'content.load':
        this.executeContent(context);
        return;
      case 'reader.location.resolve':
        if (effect.jsonPayload === undefined) {
          this.fail(context, effect.type, new Error('book.open location effect is missing lossless jsonPayload'));
          return;
        }
        this.executeLocation(context, effect.jsonPayload);
        return;
      default:
        this.fail(context, effect.type, new Error(`unsupported book.open Core effect ${effect.type}`));
    }
  }

  private executeRemoteDetail(context: ReaderBookOpenPilotContext): void {
    if (context.sourceKind !== 'remote') {
      this.fail(context, 'source.detail', new Error('local book.open cannot execute source.detail'));
      return;
    }
    try {
      const source = context.source;
      if (source === undefined || !source.enabled || source.sourceId !== context.sourceId) {
        throw new Error('book.open remote detail requires the bound enabled Core source entry');
      }
      const baseBook: JsonObject = {};
      baseBook['bookId'] = context.bookId;
      const handle = this.core.beginBookDetailFromSource(source.sourceId, context.bookId, baseBook);
      this.attachHandle(context, 'source.detail', handle);
    } catch (error) {
      this.fail(context, 'source.detail', error as Error);
    }
  }

  private executeToc(context: ReaderBookOpenPilotContext): void {
    try {
      if (context.sourceKind === 'local') {
        this.attachHandle(context, 'chapter.list', this.core.beginLocalBookToc(context.bookId));
        return;
      }
      const detail = context.detail;
      if (detail === undefined || context.source === undefined) {
        throw new Error('remote book.open TOC requires accepted source.detail context');
      }
      this.attachHandle(context, 'chapter.list', this.core.beginBookTocFromSource(
        context.source.sourceId,
        detail.book.bookId,
        detail.tocUrl,
        detail.variables,
      ));
    } catch (error) {
      this.fail(context, 'chapter.list', error as Error);
    }
  }

  private executeContent(context: ReaderBookOpenPilotContext): void {
    try {
      const selected = context.selectedChapter;
      const detail = context.detail;
      if (selected === undefined || detail === undefined) {
        throw new Error('book.open content requires the runtime-selected TOC entry');
      }
      if (context.sourceKind === 'local') {
        this.attachHandle(context, 'content.load', this.core.beginLocalBookChapterContent(
          detail.book.bookId, selected.index,
        ));
        return;
      }
      this.attachHandle(context, 'content.load', this.core.beginChapterContentFromSource(
        context.sourceId,
        detail.book.bookId,
        selected.chapterId,
        selected.title,
        selected.index,
        selected.variables,
      ));
    } catch (error) {
      this.fail(context, 'content.load', error as Error);
    }
  }

  private executeLocation(context: ReaderBookOpenPilotContext, payload: ReaderUIJSONPayload): void {
    try {
      const selected = context.selectedChapter;
      const detail = context.detail;
      if (selected === undefined || detail === undefined) {
        throw new Error('book.open location requires accepted content and selected chapter context');
      }
      const chapterOffset = this.requiredNonNegativeNumber(payload, 'chapterOffset');
      const chapterProgress = this.requiredNonNegativeNumber(payload, 'chapterProgress');
      const viewportWidth = this.requiredPositiveNumber(payload, 'viewportWidth');
      const viewportHeight = this.requiredPositiveNumber(payload, 'viewportHeight');
      const fontScale = this.requiredPositiveNumber(payload, 'fontScale');
      if (chapterProgress > 1) throw new Error('book.open measured chapterProgress must be in [0, 1]');
      this.attachHandle(context, 'reader.location.resolve', this.core.beginReaderLocationResolve(
        detail.book.bookId,
        selected.index,
        chapterOffset,
        chapterProgress,
        viewportWidth,
        viewportHeight,
        fontScale,
      ));
    } catch (error) {
      this.fail(context, 'reader.location.resolve', error as Error);
    }
  }

  private attachHandle(context: ReaderBookOpenPilotContext, stage: string,
    handle: ReaderBookOpenCommandHandle): void {
    if (!this.isActive(context)) {
      handle.cancel();
      this.ignoredLateResults += 1;
      return;
    }
    context.currentEffect = stage;
    context.inFlight = handle;
    this.executedEffects += 1;
    handle.result.then((data: JsonObject): void => {
      if (!this.isActive(context) || context.inFlight !== handle) {
        this.ignoredLateResults += 1;
        return;
      }
      context.inFlight = undefined;
      this.acceptCoreData(context, stage, data);
    }).catch((error: Error): void => {
      if (!this.isActive(context) || context.inFlight !== handle) {
        this.ignoredLateResults += 1;
        return;
      }
      context.inFlight = undefined;
      this.fail(context, stage, error);
    });
  }

  private acceptCoreData(context: ReaderBookOpenPilotContext, stage: string, data: JsonObject): void {
    try {
      switch (stage) {
        case 'source.detail': {
          if (context.source === undefined) throw new Error('book.open missing persisted source after source.detail');
          context.detail = ReaderBookOpenDomainMapper.mapRemoteDetail(data, context.bookId, context.source);
          this.host.applyDomainEvent({ type: 'book-detail-success', book: context.detail.book });
          this.acceptStage(context, stage);
          return;
        }
        case 'chapter.list': {
          const toc = ReaderBookOpenDomainMapper.mapToc(data);
          if (toc.chapterCount <= 0) {
            this.acceptStage(context, stage, { 'chapterCount': 0 });
            return;
          }
          const requestedIndex = this.runtimeRequestedChapterIndex();
          const selectedPosition = Math.min(requestedIndex, toc.chapterCount - 1);
          const detailVariables = context.detail?.variables;
          context.toc = toc;
          context.selectedChapter = ReaderBookOpenDomainMapper.selectChapter(toc, selectedPosition, detailVariables);
          if (context.detail === undefined && context.localBook !== undefined) {
            context.detail = ReaderBookOpenDomainMapper.mapLocalDetail(context.localBook);
          }
          if (context.detail === undefined) throw new Error('book.open TOC has no accepted detail context');
          this.host.applyDomainEvent({ type: 'book-detail-success', book: context.detail.book });
          this.host.applyDomainEvent({ type: 'chapter-toc-loaded', chapterToc: toc.visibleEntries });
          this.acceptStage(context, stage, { 'chapterCount': toc.chapterCount });
          return;
        }
        case 'content.load': {
          if (context.selectedChapter === undefined) throw new Error('book.open content arrived without a selected chapter');
          context.content = ReaderBookOpenDomainMapper.mapContent(data, context.selectedChapter);
          context.contentGeneration = this.nextContentGeneration + 1;
          this.nextContentGeneration = context.contentGeneration;
          this.host.applyDomainEvent({
            type: 'chapter-success',
            chapterParagraphs: context.content.paragraphs,
            chapterTitle: context.selectedChapter.title,
            bookId: context.bookId,
            sourceId: context.sourceId,
            chapterIndex: context.selectedChapter.index,
          });
          this.acceptStage(context, stage);
          return;
        }
        case 'reader.location.resolve': {
          const detail = context.detail;
          const selected = context.selectedChapter;
          if (detail === undefined || selected === undefined) {
            throw new Error('reader.location.resolve arrived without selected book/chapter context');
          }
          context.location = ReaderBookOpenDomainMapper.mapLocation(
            data, detail.book.bookId, selected.index,
          );
          // Persist only the typed Core canonical result. The runtime still
          // owns transaction completion; ReaderEffects is never involved.
          this.host.applyDomainEvent({
            type: 'reader-location-resolved',
            canonicalReaderLocation: context.location.canonicalLocation,
          });
          this.acceptStage(context, stage, {
            'canonicalLocation': context.location.canonicalLocation.locationRevision,
            'pageIndex': this.runtime.currentState().readerPageIndex,
          });
          return;
        }
        default:
          this.fail(context, stage, new Error(`unsupported accepted book.open stage ${stage}`));
      }
    } catch (error) {
      this.fail(context, stage, error as Error);
    }
  }

  private acceptStage(context: ReaderBookOpenPilotContext, stage: string,
    explicitResult?: ReaderUIJSONResult): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    let result: ReaderUIJSONResult = explicitResult ?? {};
    if (stage === 'chapter.list' && explicitResult === undefined) {
      const count = context.toc?.chapterCount ?? 0;
      result = { 'chapterCount': count };
    }
    const transition = this.runtime.acceptBookOpenJSONResult(stage, context.correlationId, result);
    this.consumeTransition(context, transition);
  }

  private fail(context: ReaderBookOpenPilotContext, stage: string, error: Error): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    const message = error.message.length > 0 ? error.message : `book.open ${stage} failed`;
    const transition = this.runtime.acceptBookOpenJSONResult(
      stage, context.correlationId, { 'error': message },
    );
    this.consumeTransition(context, transition);
  }

  private consumeTransition(context: ReaderBookOpenPilotContext, transition: ReaderUIAsyncTransition): void {
    if (!this.isActive(context) || !transition.accepted) {
      this.ignoredLateResults += 1;
      return;
    }
    this.host.applyRuntimeState(transition.state);
    if (transition.state.bookOpenTransaction === undefined) {
      this.active = null;
      return;
    }
    for (let index = 0; index < transition.effects.length; index += 1) {
      this.execute(context, transition.effects[index]);
    }
  }

  private runtimeRequestedChapterIndex(): number {
    const transaction = this.runtime.currentState().bookOpenTransaction;
    if (transaction === undefined) return 0;
    return transaction.requestedChapterIndex;
  }

  private isActive(context: ReaderBookOpenPilotContext): boolean {
    return this.active !== null && this.active.correlationId === context.correlationId && this.active === context;
  }

  private requiredPositiveNumber(payload: ReaderUIJSONPayload, key: string): number {
    const raw = payload[key];
    const value = typeof raw === 'number' ? raw : Number.NaN;
    if (!Number.isFinite(value) || value <= 0) throw new Error(`book.open requires measured ${key} > 0`);
    return value;
  }

  private requiredNonNegativeNumber(payload: ReaderUIJSONPayload, key: string): number {
    const raw = payload[key];
    const value = typeof raw === 'number' ? raw : Number.NaN;
    if (!Number.isFinite(value) || value < 0) throw new Error(`book.open requires ${key} >= 0`);
    return value;
  }

}
