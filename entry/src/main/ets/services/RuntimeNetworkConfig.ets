// RuntimeNetworkConfig - redacted runtime network launch options for device smoke.

import { connection } from '@kit.NetworkKit';
import { boundedChecksum } from '../adapters/FeedParserAdapter';
import { HTTPProxyConfig } from '../adapters/HTTPAdapter';

export interface RuntimeNetworkConfigSnapshot {
  proxyConfigured: boolean;
  proxyHostHash: string;
  proxyPort: number;
  proxyAuditLabel: string;
  proxyAppLevelApplied: boolean;
  proxyAppLevelFailureClass: string;
}

export interface RuntimeLocalHTTPProbeConfig {
  host: string;
  port: number;
  auditLabel: string;
}

export class RuntimeNetworkConfigStore {
  private proxyConfig?: HTTPProxyConfig;
  private localHTTPProbeConfig?: RuntimeLocalHTTPProbeConfig;
  private appLevelProxyApplied: boolean = false;
  private appLevelProxyFailureClass: string = 'none';

  applyLaunchParameters(parameters?: Record<string, Object>): void {
    this.applyLocalHTTPProbeParameters(parameters);

    const compact = this.stringParameter(parameters, 'readerRuntimeProxy');
    if (compact.length > 0 && this.applyCompactProxy(compact)) {
      this.applyAppLevelProxy();
      return;
    }

    const enabled = this.booleanParameter(parameters, 'reader.runtime.proxy.enabled');
    const host = this.stringParameter(parameters, 'reader.runtime.proxy.host');
    const port = this.integerParameter(parameters, 'reader.runtime.proxy.port');
    const label = this.stringParameter(parameters, 'reader.runtime.proxy.label');

    if (enabled && host.length > 0 && port > 0 && port <= 65535) {
      this.proxyConfig = {
        host,
        port,
        exclusionList: ['localhost', '127.0.0.1', '::1', '10.0.2.2'],
        auditLabel: label.length > 0 ? label : 'launch-parameter'
      };
      this.applyAppLevelProxy();
      return;
    }
    this.proxyConfig = undefined;
    this.appLevelProxyApplied = false;
    this.appLevelProxyFailureClass = 'none';
  }

  currentHTTPProxy(): HTTPProxyConfig | undefined {
    return this.proxyConfig;
  }

  currentLocalHTTPProbe(): RuntimeLocalHTTPProbeConfig | undefined {
    return this.localHTTPProbeConfig;
  }

  snapshot(): RuntimeNetworkConfigSnapshot {
    if (!this.proxyConfig) {
      return {
        proxyConfigured: false,
        proxyHostHash: 'none',
        proxyPort: 0,
        proxyAuditLabel: 'none',
        proxyAppLevelApplied: false,
        proxyAppLevelFailureClass: 'none'
      };
    }
    return {
      proxyConfigured: true,
      proxyHostHash: boundedChecksum(`proxy-host:${this.proxyConfig.host}`),
      proxyPort: this.proxyConfig.port,
      proxyAuditLabel: this.proxyConfig.auditLabel,
      proxyAppLevelApplied: this.appLevelProxyApplied,
      proxyAppLevelFailureClass: this.appLevelProxyFailureClass
    };
  }

  redactedDiagnostic(): string {
    const snapshot = this.snapshot();
    if (!snapshot.proxyConfigured) {
      return 'proxy:none';
    }
    const appProxy = snapshot.proxyAppLevelApplied ? 'app:on' : `app:${snapshot.proxyAppLevelFailureClass}`;
    return `proxy:${snapshot.proxyAuditLabel}:${snapshot.proxyHostHash}:${snapshot.proxyPort}:${appProxy}`;
  }

  private stringParameter(parameters: Record<string, Object> | undefined, key: string): string {
    if (!parameters) {
      return '';
    }
    const value = parameters[key];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  }

  private integerParameter(parameters: Record<string, Object> | undefined, key: string): number {
    const text = this.stringParameter(parameters, key);
    if (text.length === 0) {
      return 0;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.trunc(parsed);
  }

  private booleanParameter(parameters: Record<string, Object> | undefined, key: string): boolean {
    const text = this.stringParameter(parameters, key).toLowerCase();
    return text === 'true' || text === '1' || text === 'yes';
  }

  private applyCompactProxy(value: string): boolean {
    const parts = value.split(':');
    if (parts.length < 2) {
      return false;
    }
    const host = parts[0];
    const port = Number(parts[1]);
    const label = parts.length > 2 ? parts[2] : 'launch-parameter';
    if (host.length === 0 || !Number.isFinite(port) || port <= 0 || port > 65535) {
      return false;
    }
    this.proxyConfig = {
      host,
      port: Math.trunc(port),
      exclusionList: ['localhost', '127.0.0.1', '::1', '10.0.2.2'],
      auditLabel: label.length > 0 ? label : 'launch-parameter'
    };
    return true;
  }

  private applyLocalHTTPProbeParameters(parameters?: Record<string, Object>): void {
    const compact = this.stringParameter(parameters, 'readerRuntimeLocalHTTP');
    if (compact.length === 0) {
      this.localHTTPProbeConfig = undefined;
      return;
    }
    const parts = compact.split(':');
    if (parts.length < 2) {
      this.localHTTPProbeConfig = undefined;
      return;
    }
    const host = parts[0];
    const port = Number(parts[1]);
    const label = parts.length > 2 ? parts[2] : 'device-local-http';
    if (host.length === 0 || !Number.isFinite(port) || port <= 0 || port > 65535) {
      this.localHTTPProbeConfig = undefined;
      return;
    }
    this.localHTTPProbeConfig = {
      host,
      port: Math.trunc(port),
      auditLabel: label.length > 0 ? label : 'device-local-http'
    };
  }

  private applyAppLevelProxy(): void {
    this.appLevelProxyApplied = false;
    this.appLevelProxyFailureClass = 'none';
    if (!this.proxyConfig) {
      return;
    }
    try {
      connection.setAppHttpProxy({
        host: this.proxyConfig.host,
        port: this.proxyConfig.port,
        exclusionList: this.proxyConfig.exclusionList
      });
      this.appLevelProxyApplied = true;
      this.proxyConfig.appLevelProxyApplied = true;
    } catch (e) {
      this.appLevelProxyFailureClass = this.classifyProxyApplyFailure(e);
      this.proxyConfig.appLevelProxyApplied = false;
    }
  }

  private classifyProxyApplyFailure(e: Object): string {
    const text = JSON.stringify(e);
    if (text.indexOf('401') !== -1 || text.indexOf('Parameter') !== -1) {
      return 'parameter_error';
    }
    if (text.indexOf('2100001') !== -1 || text.indexOf('Invalid') !== -1) {
      return 'invalid_proxy';
    }
    if (text.length === 0) {
      return 'unknown';
    }
    return 'app_proxy_error';
  }
}

export const readerRuntimeNetworkConfig = new RuntimeNetworkConfigStore();
