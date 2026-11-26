import type { ReaderTtsConfig } from './ReaderTtsGateway';
import { readerTtsMultiplierForConfig } from './ReaderTtsState';

interface ReaderTtsInitialProbe {
  probeAvailability(): Promise<boolean>;
  getProbedConfig(): ReaderTtsConfig | undefined;
  setRate(rate: number): Promise<void>;
}

export interface ReaderTtsInitialAdmission {
  isCurrent(): boolean;
  isConfigCurrent(): boolean;
  admitConfig(config: ReaderTtsConfig | undefined): void;
  resolveAvailability(): void;
  reportFailure(stage: 'initial-rate' | 'initialization', error: Error): void;
}

/** Publish the probe to the mounted owner in order. A newer config intent can
 * retire the initial rate without retiring speech availability itself. */
export function admitInitialReaderTts(probe: ReaderTtsInitialProbe, owner: ReaderTtsInitialAdmission): Promise<boolean> {
  return probe.probeAvailability()
    .then(async (available: boolean): Promise<boolean> => {
      if (!owner.isCurrent()) return false;
      const config = probe.getProbedConfig();
      if (owner.isConfigCurrent()) owner.admitConfig(config);
      if (available && config !== undefined && owner.isConfigCurrent()) {
        try {
          await probe.setRate(readerTtsMultiplierForConfig(config.rate, config.ratePercent));
        } catch (error) {
          if (owner.isCurrent()) owner.reportFailure('initial-rate', error as Error);
        }
      }
      if (!owner.isCurrent()) return false;
      owner.resolveAvailability();
      return available;
    })
    .catch((error: Error): boolean => {
      if (owner.isCurrent()) {
        owner.resolveAvailability();
        owner.reportFailure('initialization', error);
      }
      return false;
    });
}

export interface ReaderTtsRateAdmission {
  isCurrent(): boolean;
  persistRate(rate: number): Promise<void>;
  presentPendingReconciliation(): boolean;
  declineRate(): void;
  reportFailure(error: Error): void;
}

/** Persist an accepted live rate while the original config intent still owns
 * it. An unconfirmed durable write must be reconciled before any rollback. */
export function admitReaderTtsRate(setRate: (rate: number) => Promise<void>, rate: number, previousRate: number,
  owner: ReaderTtsRateAdmission): Promise<void> {
  return setRate(rate)
    .then(async (): Promise<void> => {
      if (owner.isCurrent()) await owner.persistRate(rate);
    })
    .catch(async (error: Error): Promise<void> => {
      if (!owner.isCurrent() || owner.presentPendingReconciliation()) return;
      if (previousRate !== rate) {
        try {
          await setRate(previousRate);
        } catch (_) {
          // The speech coordinator publishes its own retryable error state.
        }
      }
      if (owner.isCurrent()) owner.declineRate();
      owner.reportFailure(error);
    });
}

export interface ReaderTtsPreparationIntent {
  readonly probe: ReaderTtsInitialProbe;
  isCurrent(): boolean;
  loadMetadata(): Promise<void>;
  admitConfig(config: ReaderTtsConfig | undefined): void;
  reportFailure(stage: 'initial-rate' | 'initialization', error: Error): void;
}

export interface ReaderTtsWarmupOwner {
  postFrame(callback: () => void): void;
  isMounted(): boolean;
  isReady(): boolean;
  initialize(): Promise<boolean>;
}

/** One reader's optional preparation and configuration intent generations.
 * The caller creates the native speech owner and supplies a frame scheduler. */
export class ReaderTtsPreparation {
  private initialization: Promise<boolean> | undefined = undefined;
  private metadata: Promise<void> | undefined = undefined;
  private availabilityResolved: boolean = false;
  private warmupScheduled: boolean = false;
  private configGeneration: number = 0;

  reset(): void {
    this.initialization = undefined;
    this.metadata = undefined;
    this.availabilityResolved = false;
    this.warmupScheduled = false;
  }

  resolved(): boolean { return this.availabilityResolved; }

  scheduleWarmup(hasCoordinator: boolean, capture: () => ReaderTtsWarmupOwner): void {
    if (this.warmupScheduled || this.initialization !== undefined || hasCoordinator) return;
    const owner = capture();
    this.warmupScheduled = true;
    // The first page's observers complete before optional speech discovery.
    owner.postFrame((): void => {
      if (!owner.isMounted()) return;
      this.warmupScheduled = false;
      if (owner.isReady()) void owner.initialize();
    });
  }

  initialize(retry: boolean, isActive: () => boolean, bind: () => ReaderTtsPreparationIntent): Promise<boolean> {
    if (this.initialization !== undefined && (!retry || !this.availabilityResolved)) return this.initialization;
    if (!isActive()) return Promise.resolve(false);
    const generation = this.configGeneration;
    const intent = bind();
    this.availabilityResolved = false;
    // Foreground speech does not wait for optional voice and HTTP metadata.
    if (this.metadata === undefined) {
      const metadata = intent.loadMetadata();
      this.metadata = metadata;
      void metadata.then((): void => {
        if (this.metadata === metadata) this.metadata = undefined;
      });
    }
    const initialization = admitInitialReaderTts(intent.probe, {
      isCurrent: (): boolean => intent.isCurrent(),
      isConfigCurrent: (): boolean => generation === this.configGeneration,
      admitConfig: (config: ReaderTtsConfig | undefined): void => intent.admitConfig(config),
      resolveAvailability: (): void => { this.availabilityResolved = true; },
      reportFailure: (stage: 'initial-rate' | 'initialization', error: Error): void => intent.reportFailure(stage, error),
    });
    this.initialization = initialization;
    return initialization;
  }

  beginConfiguration(): () => boolean {
    const generation = ++this.configGeneration;
    return (): boolean => generation === this.configGeneration;
  }

  async configure<T>(value: T, run: (value: T) => Promise<void>, ownerCurrent: () => boolean,
    failed: () => void): Promise<void> {
    const current = this.beginConfiguration();
    try { await run(value); }
    catch (error) {
      if (current() && ownerCurrent()) failed();
      throw error as Error;
    }
  }
}
