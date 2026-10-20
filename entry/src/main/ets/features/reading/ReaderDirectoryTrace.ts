import { ReaderStartupTrace } from '../../app/ReaderStartupTrace.ts';

/** Reuse the debug-only monotonic trace. No books, queries, nodes or samples
 * are retained. Frame callbacks are application milestones, not display FPS. */
export class ReaderDirectoryTrace {
  private static sequence: number = 0;
  private readonly trace: ReaderStartupTrace | undefined;
  private readonly operation: string;
  private readonly id: number;
  private readonly startedAt: number;

  constructor(operation: string) {
    this.trace = ReaderStartupTrace.current();
    this.operation = operation;
    this.id = this.trace === undefined ? 0 : ++ReaderDirectoryTrace.sequence;
    this.startedAt = this.trace?.begin(`directory.${operation}`, this.id) ?? -1;
  }

  isEnabled(): boolean { return this.trace !== undefined; }

  step(stage: string, status: string = 'ready'): void {
    this.trace?.end(`directory.${this.operation}.${stage}`, this.startedAt, status, this.id);
  }
}
