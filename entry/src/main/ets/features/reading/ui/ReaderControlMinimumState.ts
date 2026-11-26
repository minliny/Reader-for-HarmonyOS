import type { ReaderWindowMetricsSnapshot } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerControlIsDirectSheet } from './ReaderControlHostSession';
import type { ReaderControlLocation } from './ReaderControlSessionState';
import { readerControlCandidateWidths, resolveReaderControlLayout,
  type ReaderControlCandidateMinimum, type ReaderControlContentMeasurer,
  type ReaderControlLayoutSnapshot } from './ReaderLayoutGeometry';
import { measureReaderControlMinimumCandidates } from './ReaderControlMinimumReceipt';

interface ReaderControlMinimumLayoutReads {
  sourceId: () => string;
  bookId: () => string;
  lifecycleToken: () => number;
  openRevision: () => number;
  visitRevision: () => number;
  expandedLayout: () => boolean;
  minimumRevision: () => number;
}

interface ReaderControlMinimumCandidateScope {
  sourceId: string;
  bookId: string;
  lifecycleToken: number;
  openRevision: number;
  visitRevision: number;
  width: number;
  height: number;
  metricsRevision: number;
}

interface ReaderControlMinimumCachedLayout {
  layout: ReaderControlLayoutSnapshot;
  width: number;
  height: number;
  metricsRevision: number;
  expanded: boolean;
  minimumRevision: number;
}

export interface ReaderControlMinimumWindow {
  width: number;
  height: number;
  expanded: boolean;
  metrics: ReaderWindowMetricsSnapshot;
}

interface ReaderControlMinimumFrameHost<Facts> {
  current: (identity: string) => boolean;
  environment: () => string;
  navigationGeneration: () => number | undefined;
  location: () => ReaderControlLocation;
  window: () => ReaderControlMinimumWindow;
  postFrame: (run: () => void) => void;
  onPending: () => void;
  onUnavailable: (identity: string) => void;
  canAdoptFacts: (facts: Facts, identity: string, environment: string) => boolean;
  adoptFacts: (facts: Facts) => void;
  admit: (candidates: ReaderControlCandidateMinimum[], identity: string) => void;
}

export interface ReaderDeferredControlMinimum {
  candidates: ReaderControlCandidateMinimum[];
  identity: string;
}

export function readerControlMinimumUsesDirectSheet(location: ReaderControlLocation | undefined): boolean {
  return location?.level === 'secondary' && location.form === 'full' && readerControlIsDirectSheet(location.module);
}

/** Owns nonreactive measurements. The reader publishes their accepted state
 * and schedules frames so ArkUI watchers and navigation stay with their host. */
export class ReaderControlMinimumState<Profile, Facts> {
  private requestGeneration: number = 0;
  private identity: string = '';
  private readProfile: ((key: string) => Profile | undefined) | undefined = undefined;
  private facts: Facts | undefined = undefined;
  private deferredReceipt: ReaderDeferredControlMinimum | undefined = undefined;

  private measurer: ReaderControlContentMeasurer | undefined = undefined;
  private providerEnvironment: string = '';
  private providerFactsKey: string = '';
  private committedFactsKey: string = '';
  private candidates: ReaderControlCandidateMinimum[] = [];
  private candidateScope: ReaderControlMinimumCandidateScope = {
    sourceId: '', bookId: '', lifecycleToken: -1, openRevision: -1, visitRevision: -1,
    width: -1, height: -1, metricsRevision: -1,
  };
  private retainedLayout: ReaderControlLayoutSnapshot | undefined = undefined;
  private cache: ReaderControlMinimumCachedLayout | undefined = undefined;

  private readonly read: ReaderControlMinimumLayoutReads;

  constructor(read: ReaderControlMinimumLayoutReads) { this.read = read; }

  get generation(): number { return this.requestGeneration; }
  get providerIdentity(): string { return this.identity; }
  get profileReader(): ((key: string) => Profile | undefined) | undefined { return this.readProfile; }
  get providerFacts(): Facts | undefined { return this.facts; }
  get deferred(): ReaderDeferredControlMinimum | undefined { return this.deferredReceipt; }

  defer(candidates: ReaderControlCandidateMinimum[], identity: string): void {
    this.deferredReceipt = { candidates: candidates, identity: identity };
  }

  clearDeferred(): void {
    this.deferredReceipt = undefined;
  }

  invalidateRequest(): void {
    this.requestGeneration += 1;
  }

  bind(identity: string, measurer: ReaderControlContentMeasurer | undefined,
    profileReader: ((key: string) => Profile | undefined) | undefined, environment: () => string,
    facts: Facts | undefined, factsKey: string): void {
    this.invalidateRequest();
    this.measurer = measurer;
    this.readProfile = profileReader;
    this.identity = identity;
    this.providerEnvironment = environment();
    this.facts = facts;
    this.providerFactsKey = factsKey;
    this.clearDeferred();
  }

  retireProvider(): void {
    this.invalidateRequest();
    this.measurer = undefined;
    this.readProfile = undefined;
    this.facts = undefined;
    this.providerFactsKey = '';
    this.committedFactsKey = '';
  }

  clearCandidates(): void {
    this.candidates = [];
    this.retainedLayout = undefined;
  }

  invalidateLayout(): void {
    this.cache = undefined;
  }

  revalidateEnvironment(environment: string): void {
    this.invalidateRequest();
    this.providerEnvironment = environment;
  }

  revalidateCandidateMetrics(metricsRevision: number): void {
    this.candidateScope.metricsRevision = metricsRevision;
    // Leave the cached receipt intact and retire only its metrics revision.
    if (this.cache !== undefined) this.cache.metricsRevision = -1;
  }

  factsMatchCommitted(): boolean {
    return this.providerFactsKey === this.committedFactsKey;
  }

  commitFacts(): void {
    this.committedFactsKey = this.providerFactsKey;
  }

  commitCandidates(candidates: ReaderControlCandidateMinimum[], width: () => number, height: () => number,
    metricsRevision: () => number): void {
    this.candidates = candidates;
    this.candidateScope = {
      sourceId: this.read.sourceId(), bookId: this.read.bookId(), lifecycleToken: this.read.lifecycleToken(),
      openRevision: this.read.openRevision(), visitRevision: this.read.visitRevision(),
      width: width(), height: height(), metricsRevision: metricsRevision(),
    };
  }

  matchesOpen(): boolean {
    return this.matchesOwner() && this.candidateScope.openRevision === this.read.openRevision();
  }

  private matchesOwner(): boolean {
    return this.candidateScope.sourceId === this.read.sourceId() && this.candidateScope.bookId === this.read.bookId() &&
      this.candidateScope.lifecycleToken === this.read.lifecycleToken();
  }

  private matchesGeometry(width: number, height: number, metricsRevision: number): boolean {
    return this.candidateScope.width === width && this.candidateScope.height === height &&
      this.candidateScope.metricsRevision === metricsRevision;
  }

  layout(width: number, height: number, metrics: ReaderWindowMetricsSnapshot): ReaderControlLayoutSnapshot {
    const cache = this.cache;
    if (cache !== undefined && cache.width === width && cache.height === height && cache.metricsRevision === metrics.revision &&
      cache.expanded === this.read.expandedLayout() && cache.minimumRevision === this.read.minimumRevision()) return cache.layout;
    const measured = this.matchesOpen() && this.candidateScope.visitRevision === this.read.visitRevision() &&
      this.matchesGeometry(width, height, metrics.revision) ? this.candidates : undefined;
    const retained = this.retainedLayout;
    const retaining = measured === undefined && retained !== undefined && this.matchesOwner() &&
      this.matchesGeometry(width, height, metrics.revision);
    const layout = retaining && retained !== undefined ? retained :
      resolveReaderControlLayout(width, height, this.read.expandedLayout(), metrics, 0, measured);
    if (layout.minimumStatus !== 'legacy') this.retainedLayout = layout;
    this.cache = { layout: layout, width: width, height: height, metricsRevision: metrics.revision,
      expanded: this.read.expandedLayout(), minimumRevision: this.read.minimumRevision() };
    return layout;
  }

  private prefix(identity: string, generation: number): string {
    return `${identity}|${generation}|`;
  }

  unprofiledReceiptCurrent(key: string, requestIdentity: () => string): boolean {
    if (this.profileReader !== undefined) return false;
    const identity = this.providerIdentity;
    const prefix = this.prefix(identity, this.generation);
    return this.measurer !== undefined && identity === requestIdentity() && key.startsWith(prefix) &&
      this.candidates.some((candidate: ReaderControlCandidateMinimum): boolean => candidate.key === key);
  }

  acceptsProfiledCandidates(candidates: ReaderControlCandidateMinimum[], identity: string, environment: () => string): boolean {
    const prefix = this.prefix(identity, this.generation);
    return !candidates.some((candidate: ReaderControlCandidateMinimum): boolean => !candidate.key.startsWith(prefix)) &&
      this.providerEnvironment === environment();
  }

  schedule(host: ReaderControlMinimumFrameHost<Facts>): void {
    const identity = this.providerIdentity;
    const measure = this.measurer;
    if (!host.current(identity)) return;
    const generation = this.generation;
    const environment = host.environment();
    const profileReader = this.profileReader;
    const facts = this.providerFacts;
    const factsKey = this.providerFactsKey;
    const navigationGeneration = host.navigationGeneration();
    host.postFrame((): void => {
      if (generation !== this.generation || measure !== this.measurer ||
        facts !== this.providerFacts || factsKey !== this.providerFactsKey ||
        navigationGeneration !== host.navigationGeneration() || environment !== host.environment() ||
        !host.current(identity)) return;
      host.onPending();
      if (measure === undefined) {
        host.onUnavailable(identity);
        return;
      }
      if (profileReader !== undefined && facts !== undefined && factsKey.length > 0 &&
        host.canAdoptFacts(facts, identity, environment) && factsKey === this.committedFactsKey) {
        host.adoptFacts(facts);
        return;
      }
      const location = profileReader === undefined ? undefined : host.location();
      const directSheet = readerControlMinimumUsesDirectSheet(location);
      const window = host.window();
      const widths = readerControlCandidateWidths(window.width, window.height, window.expanded, window.metrics, directSheet);
      const measured = measureReaderControlMinimumCandidates(widths, identity, generation, measure,
        (candidate: ReaderControlCandidateMinimum): boolean => {
          const current = host.window();
          return resolveReaderControlLayout(current.width, current.height, current.expanded, current.metrics,
            0, [candidate], directSheet).minimumStatus === 'preferred';
        });
      if (generation !== this.generation || measure !== this.measurer || navigationGeneration !== host.navigationGeneration() ||
        profileReader !== this.profileReader || environment !== host.environment() || !host.current(identity)) return;
      host.admit(measured, identity);
    });
  }
}
