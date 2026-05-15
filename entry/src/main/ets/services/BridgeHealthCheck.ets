// BridgeHealthCheck — periodic health polling + fallback strategy
import { BridgeHTTPClient, BridgeHealth, BridgeConnectionError } from './BridgeHTTPClient';
import { FixtureReplayInterceptor, BridgeClientWithFallback } from './FixtureReplayInterceptor';

export enum BridgeStatus {
  UNKNOWN = 'UNKNOWN',
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  DISCONNECTED = 'DISCONNECTED'
}

export interface BridgeHealthReport {
  status: BridgeStatus;
  lastCheckedAt: number;
  coreVersion?: string;
  services: string[];
  error?: string;
  fixtureMode: boolean;
}

export class BridgeHealthCheck {
  private bridge: BridgeHTTPClient;
  private report: BridgeHealthReport;
  private client: BridgeClientWithFallback | null;

  constructor(bridge: BridgeHTTPClient) {
    this.bridge = bridge;
    this.client = null;
    this.report = {
      status: BridgeStatus.UNKNOWN,
      lastCheckedAt: 0,
      services: [],
      fixtureMode: true
    };
  }

  setFallbackClient(client: BridgeClientWithFallback): void {
    this.client = client;
  }

  async check(): Promise<BridgeHealthReport> {
    try {
      const health = await this.bridge.health();
      this.report = {
        status: health.status === 'ok' ? BridgeStatus.HEALTHY : BridgeStatus.DEGRADED,
        lastCheckedAt: Date.now(),
        coreVersion: health.coreVersion,
        services: health.services ?? [],
        fixtureMode: false
      };
      if (this.client) {
        await this.client.initialize(); // switches to bridge mode
      }
    } catch (e) {
      this.report = {
        status: BridgeStatus.DISCONNECTED,
        lastCheckedAt: Date.now(),
        services: [],
        error: e instanceof BridgeConnectionError ? e.message : 'Unknown bridge error',
        fixtureMode: true
      };
    }
    return this.report;
  }

  getReport(): BridgeHealthReport {
    return this.report;
  }

  isHealthy(): boolean {
    return this.report.status === BridgeStatus.HEALTHY;
  }

  isFixtureMode(): boolean {
    return this.report.fixtureMode;
  }

  getFallbackStrategy(): string {
    if (this.report.status === BridgeStatus.HEALTHY) {
      return 'bridge → fixture → error';
    }
    return 'fixture → error';
  }
}
