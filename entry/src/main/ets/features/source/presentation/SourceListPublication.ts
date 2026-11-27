import type { BookSource } from '../application/SourceGateway';

export interface SourceToggleTicket {
  readonly id: string;
  readonly enabled: boolean;
  readonly session: number;
}

export class SourceToggleAdmission {
  private readonly issued = new Map<string, SourceToggleTicket>();

  admit(id: string, enabled: boolean, session: number): SourceToggleTicket | undefined {
    const prior = this.issued.get(id);
    if (prior?.session === session && prior.enabled === enabled) return undefined;
    const ticket = { id, enabled, session };
    this.issued.set(id, ticket);
    return ticket;
  }

  current(ticket: SourceToggleTicket, session: number): boolean {
    return ticket.session === session && this.issued.get(ticket.id) === ticket;
  }

  release(ticket: SourceToggleTicket): void {
    if (this.issued.get(ticket.id) === ticket) this.issued.delete(ticket.id);
  }
}

export class SourceListIndex {
  private readonly rows = new Map<string, BookSource>();

  constructor(rows: BookSource[]) {
    for (const row of rows) {
      const id = row.sourceId;
      if (!this.rows.has(id)) this.rows.set(id, row);
    }
  }

  get(id: string): BookSource | undefined {
    return this.rows.get(id);
  }
}

export class SourceListPublication {
  private rows: BookSource[] = [];
  private timer: number | undefined = undefined;
  private pending: (() => void) | undefined = undefined;

  accept(rows: BookSource[]): BookSource[] {
    let changed = rows.length === this.rows.length ? undefined : new Array<BookSource>();
    for (let index = 0; index < rows.length; index += 1) {
      const previous = this.rows[index];
      const incoming = rows[index];
      const next = previous !== undefined && sameSourceRow(previous, incoming) ? previous : incoming;
      if (changed === undefined && previous !== next) changed = this.rows.slice(0, index);
      changed?.push(next);
    }
    if (changed !== undefined) this.rows = changed;
    return this.rows;
  }

  defer(publish: () => void): void {
    this.pending = publish;
    if (this.timer !== undefined) return;
    this.timer = setTimeout((): void => {
      const pending = this.pending;
      this.timer = undefined;
      this.pending = undefined;
      pending?.();
    }, 100);
  }

  cancelDeferred(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
  }
}

function sameValues<T>(left: T[] | undefined, right: T[] | undefined): boolean {
  return left === right || left !== undefined && right !== undefined && left.length === right.length &&
    left.every((value: T, index: number): boolean => value === right[index]);
}

function sameSourceRow(left: BookSource, right: BookSource): boolean {
  return left === right || left.sourceId === right.sourceId && left.name === right.name && left.baseUrl === right.baseUrl &&
    left.enabled === right.enabled && left.enabledExplore === right.enabledExplore && left.group === right.group &&
    left.sourceVersion === right.sourceVersion && left.category === right.category && left.loginUrl === right.loginUrl &&
    left.loginState === right.loginState && left.checkState === right.checkState && left.checkMessage === right.checkMessage &&
    left.lastCheckSummary === right.lastCheckSummary && left.offlineDetectReportVersion === right.offlineDetectReportVersion &&
    sameValues(left.checkLevels, right.checkLevels) && sameValues(left.checkReports, right.checkReports);
}
