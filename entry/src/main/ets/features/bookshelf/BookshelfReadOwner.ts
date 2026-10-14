import type { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts.ts';
import type { BookshelfDataState } from './BookshelfFlowGateway';

export interface BookshelfReadResult {
  facts: OperationFacts<BookshelfDataState>;
  presentationFailed: boolean;
}

/** Existing BookshelfHost owns this finite read/recovery subdomain. */
export class BookshelfReadOwner {
  private readonly owner: ReaderRuntimeOwner;
  private readonly load: (current: () => boolean) => Promise<BookshelfDataState>;
  private readonly reportFailure?: (error: Object, attempt: number) => void;
  private active: number = 0;

  constructor(owner: ReaderRuntimeOwner, load: (current: () => boolean) => Promise<BookshelfDataState>,
    reportFailure?: (error: Object, attempt: number) => void) {
    this.owner = owner; this.load = load; this.reportFailure = reportFailure;
  }

  owns(owner: ReaderRuntimeOwner): boolean { return owner === this.owner; }

  async read(generation: number, current: () => boolean, retained: BookshelfDataState | undefined,
    retryBlank: boolean, emit: (facts: OperationFacts<BookshelfDataState>) => void): Promise<BookshelfReadResult | undefined> {
    this.active = generation;
    const live = (): boolean => this.active === generation && current();
    if (!live()) return;
    let presentationFailed = false;
    const publish = (facts: OperationFacts<BookshelfDataState>): BookshelfReadResult => {
      // An ArkUI projection/diagnostic failure is not a failed Core read and
      // must never trigger a second IO attempt after a confirmed read.
      try { emit(facts); } catch (_presentation) { presentationFailed = true; }
      return { facts, presentationFailed };
    };
    publish(projectOperationFacts({ phase: retained === undefined ? 'loading' : 'refreshing', value: retained,
      generation, canRetry: false }));
    for (let attempt = 0; attempt < (retryBlank && retained === undefined ? 2 : 1); attempt += 1) {
      if (!live()) return;
      let state: BookshelfDataState;
      try {
        state = await this.load(live);
      } catch (error) {
        if (!live()) return;
        try { this.reportFailure?.(error as Object, attempt + 1); } catch (_diagnostic) { /* Diagnostics cannot change retry. */ }
        if (attempt === 0 && retryBlank && retained === undefined) continue;
        return publish(projectOperationFacts({ phase: retained === undefined ? 'failed' : 'refreshFailed', value: retained,
          generation, canRetry: true, message: retained === undefined ? '无法读取书架内容，请重试。' : '刷新失败，保留上次读取结果' }));
      }
      if (!live()) return;
      return publish(projectOperationFacts({ phase: state.kind === 'empty' ? 'empty' : 'succeeded', value: state,
        generation, canRetry: false }));
    }
    return undefined;
  }
}
