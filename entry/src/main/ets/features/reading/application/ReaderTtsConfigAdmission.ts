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
