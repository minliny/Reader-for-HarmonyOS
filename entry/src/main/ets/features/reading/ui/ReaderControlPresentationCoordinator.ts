import { normalizeReaderAppearanceFontOrder,
  type ReaderAppearanceFontSlot, type ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState.ts';
import { readerControlHostClosing } from './ReaderControlHostSession.ts';
import {
  readerControlContentLocation, resumeReaderControlSessionTarget, type ReaderControlLocation, type ReaderControlSessionState,
} from './ReaderControlSessionState.ts';
import type { ReaderControlVerificationOrigin } from './ReaderControlVerificationSession';

export interface ReaderControlNavigationIntent {
  verificationOrigin: ReaderControlVerificationOrigin;
  generation: number;
  ownerKey: string;
  sourceIdentity: string;
  identity: string;
  target: ReaderControlLocation;
  durationMs: number;
  moduleVisitRevision: number;
}

export interface ReaderControlNavigationScope {
  sourceId: string;
  bookId: string;
  lifecycleToken: number;
  openRevision: number;
  visitRevision: number;
}

export interface ReaderControlNavigationHost {
  scope(): ReaderControlNavigationScope;
  session(): ReaderControlSessionState;
  visualSession(): ReaderControlSessionState;
  readIntent(): ReaderControlNavigationIntent | undefined;
  publishIntent(intent: ReaderControlNavigationIntent | undefined): void;
  publishSession(session: ReaderControlSessionState): void;
  hasCommittedReceipt(): boolean;
  invalidateMinimumRequest(): void;
  accept(origin: ReaderControlVerificationOrigin, source: ReaderControlSessionState, next: ReaderControlSessionState): void;
}

interface ReaderControlNavigationCommit {
  intent: ReaderControlNavigationIntent;
  source: ReaderControlSessionState;
  session: ReaderControlSessionState;
}

/** Module changes wait for their target's committed minimum. The reader still
 * publishes its reactive navigation intent and committed control session. */
export class ReaderControlNavigation {
  private generation: number = 0;
  private readonly host: ReaderControlNavigationHost;

  constructor(host: ReaderControlNavigationHost) { this.host = host; }

  ownerKey(): string {
    const scope = this.host.scope();
    return JSON.stringify([scope.sourceId, scope.bookId, scope.lifecycleToken, scope.openRevision]);
  }

  committedIdentity(): string {
    const location = readerControlContentLocation(this.host.session());
    const scope = this.host.scope();
    return this.identity(scope, scope.visitRevision, location);
  }

  active(): ReaderControlNavigationIntent | undefined {
    const intent = this.host.readIntent();
    return intent !== undefined && intent.generation === this.generation && intent.ownerKey === this.ownerKey() &&
      intent.sourceIdentity === this.committedIdentity() && !readerControlHostClosing(this.host.session()) &&
      readerControlContentLocation(this.host.session()).level !== 'hidden' ? intent : undefined;
  }

  cancel(): boolean {
    if (this.host.readIntent() === undefined) return false;
    const consumed = this.active() !== undefined;
    this.generation += 1;
    this.host.invalidateMinimumRequest();
    this.host.publishIntent(undefined);
    return consumed;
  }

  retire(): void {
    this.host.publishIntent(undefined);
    this.generation += 1;
  }

  request(next: ReaderControlSessionState, origin: ReaderControlVerificationOrigin): boolean {
    const current = readerControlContentLocation(this.host.session());
    const target = readerControlContentLocation(next);
    const changedModule = current.level !== target.level || current.module !== target.module ||
      current.directoryTab !== target.directoryTab;
    this.cancel();
    if (!changedModule || target.level === 'hidden' || !this.host.hasCommittedReceipt()) {
      this.host.accept(origin, this.host.visualSession(), next);
      this.host.publishSession(next);
      return false;
    }
    const previousModule = current.level === 'secondary' ? current.module : 'home';
    const nextModule = target.level === 'secondary' ? target.module : 'home';
    const scope = this.host.scope();
    const visit = scope.visitRevision + (previousModule === nextModule ? 0 : 1);
    const identity = this.identity(scope, visit, target);
    const intent: ReaderControlNavigationIntent = { verificationOrigin: origin, generation: ++this.generation,
      ownerKey: this.ownerKey(), sourceIdentity: this.committedIdentity(), identity, target,
      moduleVisitRevision: visit, durationMs: next.transition?.kind === 'open' &&
        this.host.session().transition?.kind === 'open' && target.form === 'quick' ? 0 : next.transition?.durationMs ?? 0 };
    this.host.publishIntent(intent);
    return true;
  }

  prepareCommit(): ReaderControlNavigationCommit | undefined {
    const intent = this.active();
    if (intent === undefined) return undefined;
    const visual = this.host.visualSession();
    const current = this.host.session();
    const currentLocation = readerControlContentLocation(current);
    const visualLocation = readerControlContentLocation(visual);
    const source = visual.epoch === current.epoch && visual.closeRevision === current.closeRevision &&
      visualLocation.level === currentLocation.level && visualLocation.module === currentLocation.module &&
      visualLocation.directoryTab === currentLocation.directoryTab && !readerControlHostClosing(visual) ? visual : current;
    return { intent, source, session: resumeReaderControlSessionTarget(source, intent.target, intent.durationMs) };
  }

  private identity(scope: ReaderControlNavigationScope, visit: number, location: ReaderControlLocation): string {
    return JSON.stringify([scope.sourceId, scope.bookId, scope.lifecycleToken, scope.openRevision,
      visit, location.level, location.module, location.directoryTab]);
  }
}

export interface ReaderControlFontOrderFacts {
  requested: ReaderAppearanceFontSlot[];
  order: ReaderAppearanceFontSlot[];
  openRevision: number;
}

interface ReaderControlFontOrderRequest {
  requested: ReaderAppearanceFontSlot[];
  identity: string;
  revision: number;
  openRevision: number;
  admitted: boolean;
  displayed: boolean;
  unavailableGeneration: number;
  unavailableEnvironment: string;
  resolve: (displayed: boolean) => void;
}

export interface ReaderControlFontOrderPresentation {
  displayed: Promise<boolean>;
  current: () => boolean;
  retire: () => void;
}

export interface ReaderControlFontOrderReadback {
  readViewSnapshot: () => ReaderAppearanceSnapshot;
  readViewFontOrder: () => ReaderAppearanceFontSlot[];
}

export interface ReaderControlFontOrderHost {
  committedIdentity(): string;
  openRevision(): number;
  current(identity: string): boolean;
  order(): ReaderAppearanceFontSlot[];
  providerReadback(): ReaderControlFontOrderReadback | undefined;
  preparedReadback(identity: string): ReaderControlFontOrderReadback | undefined;
  generation(): number;
  environment(): string;
  commit(order: ReaderAppearanceFontSlot[]): Promise<ReaderAppearanceSnapshot | undefined>;
  displayed(facts: ReaderControlFontOrderFacts): void;
}

/** An accepted appearance write is only displayed after the exact prepared
 * provider readback and presentation receipt agree on the new order. */
export class ReaderControlFontOrder {
  private revision: number = 0;
  private pending: ReaderControlFontOrderRequest | undefined = undefined;
  private readonly host: ReaderControlFontOrderHost;

  constructor(host: ReaderControlFontOrderHost) { this.host = host; }

  request(order: ReaderAppearanceFontSlot[]): ReaderControlFontOrderPresentation {
    this.retire();
    let resolve: (displayed: boolean) => void = (_displayed: boolean): void => {};
    const displayed = new Promise<boolean>((accept: (value: boolean) => void): void => { resolve = accept; });
    const request: ReaderControlFontOrderRequest = {
      requested: normalizeReaderAppearanceFontOrder(order), identity: this.host.committedIdentity(),
      revision: ++this.revision, openRevision: this.host.openRevision(), admitted: false, displayed: false,
      unavailableGeneration: -1, unavailableEnvironment: '', resolve,
    };
    this.pending = request;
    const retire = (): void => {
      request.displayed = false;
      this.finish(request, false);
    };
    const current = (): boolean => request.displayed && this.isCurrent(request) && this.prepared(request);
    if (!this.isCurrent(request)) {
      retire();
      return { displayed, retire, current };
    }
    void this.host.commit(request.requested).then((snapshot: ReaderAppearanceSnapshot | undefined): void => {
      if (this.pending !== request) return;
      if (snapshot === undefined || snapshot.fontOrder.join('|') !== request.requested.join('|')) {
        retire();
        return;
      }
      request.admitted = true;
      this.reconcile();
    });
    return { displayed, retire, current };
  }

  retire(): void {
    const request = this.pending;
    if (request !== undefined) this.finish(request, false);
  }

  unavailable(identity: string): void {
    const request = this.pending;
    if (request === undefined || identity !== request.identity ||
      !this.factsMatch(this.host.providerReadback(), request.requested.join('|'))) return;
    request.unavailableGeneration = this.host.generation();
    request.unavailableEnvironment = this.host.environment();
    this.reconcile();
  }

  reconcile(): void {
    const request = this.pending;
    if (request === undefined) return;
    if (!this.isCurrent(request)) {
      this.finish(request, false);
      return;
    }
    if (!request.admitted) return;
    if (this.host.order().join('|') !== request.requested.join('|')) {
      this.finish(request, false);
      return;
    }
    if (this.prepared(request)) {
      const facts: ReaderControlFontOrderFacts = { requested: request.requested.slice(), order: request.requested.slice(),
        openRevision: request.openRevision };
      this.finish(request, true);
      this.host.displayed(facts);
      return;
    }
    if (request.unavailableGeneration === this.host.generation() &&
      request.unavailableEnvironment === this.host.environment()) this.finish(request, false);
  }

  private isCurrent(request: ReaderControlFontOrderRequest): boolean {
    return request.revision === this.revision && this.host.current(request.identity);
  }

  private finish(request: ReaderControlFontOrderRequest, displayed: boolean): void {
    if (this.pending !== request) return;
    this.pending = undefined;
    request.displayed = displayed;
    request.resolve(displayed);
  }

  private factsMatch(appearance: ReaderControlFontOrderReadback | undefined, requested: string): boolean {
    return appearance !== undefined && appearance.readViewSnapshot().fontOrder.join('|') === requested &&
      appearance.readViewFontOrder().join('|') === requested;
  }

  private prepared(request: ReaderControlFontOrderRequest): boolean {
    return this.factsMatch(this.host.preparedReadback(request.identity), request.requested.join('|'));
  }
}
