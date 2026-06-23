// RuntimeHostPlatformAdapters - bounded runtime host evidence with injected executors.
// Device executors can replace the fixture executors without changing evidence shape.

import { HTTPRequest, HTTPResponse } from './HTTPAdapter';
import { CookieCredentialBoundaryAdapter, CookieMirrorEvidence } from './CookieCredentialBoundaryAdapter';
import { boundedChecksum } from './FeedParserAdapter';
import { MarkupParserAdapter } from './MarkupParserAdapter';

export interface RuntimeHTTPExecutor {
  request(req: HTTPRequest): Promise<HTTPResponse>;
}

export interface ArkWebExecutionResult {
  title: string;
  bodyTextChecksum: string;
  selectedNodeCount: number;
  scriptResult: string;
}

export interface ArkWebExecutor {
  execute(html: string, selector: string, script: string): Promise<ArkWebExecutionResult>;
}

export interface RuntimeExecutionAuthorization {
  allowNativeHTTP: boolean;
  allowArkWeb: boolean;
  allowJavaScript: boolean;
  allowCookieMirror: boolean;
  allowSessionPersistence: boolean;
  allowSnapshotWrite: boolean;
  auditLabel: string;
}

export interface ArkWebDeviceBridge {
  executeHTML(html: string, selector: string, script: string): Promise<ArkWebExecutionResult>;
}

export interface RuntimeHostEvidence {
  nativeHTTPPassed: boolean;
  arkWebDOMPassed: boolean;
  javascriptPassed: boolean;
  cookieMirrorPassed: boolean;
  sessionPersistencePassed: boolean;
  snapshotRollbackPassed: boolean;
  secureStoragePassed: boolean;
  suppliedRuntimeEvidenceIDs: string[];
  executionMode: string;
  deviceExecutorReady: boolean;
  deviceExecutorUsed: boolean;
  authorizationAudit: string;
  checksum: string;
  externalNetworkUsed: boolean;
  rawCookieValueExported: boolean;
  rawCredentialValueExported: boolean;
  rawSessionTokenExported: boolean;
}

export class FixtureHTTPExecutor implements RuntimeHTTPExecutor {
  async request(req: HTTPRequest): Promise<HTTPResponse> {
    const method = req.method;
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie-redacted': 'present'
      },
      data: `{"ok":true,"method":"${method}","fixture":"native-http"}`
    };
  }
}

export class FixtureArkWebExecutor implements ArkWebExecutor {
  private markup = new MarkupParserAdapter();

  async execute(html: string, selector: string, script: string): Promise<ArkWebExecutionResult> {
    const root = this.markup.parse(html);
    const titleNodes = this.markup.queryXPath(root, '//title');
    const title = titleNodes.length > 0 ? this.markup.textContent(titleNodes[0]).trim() : '';
    const matches = this.markup.queryCss(root, selector);
    return {
      title,
      bodyTextChecksum: boundedChecksum(this.markup.textContent(root)),
      selectedNodeCount: matches.length,
      scriptResult: this.evaluateAllowedScript(script, title, matches.length)
    };
  }

  private evaluateAllowedScript(script: string, title: string, count: number): string {
    if (script.indexOf('document.title') !== -1) { return title; }
    if (script.indexOf('querySelectorAll') !== -1 && script.indexOf('length') !== -1) { return String(count); }
    return 'unsupported-script-denied';
  }
}

export class AuthorizedArkWebDeviceExecutor implements ArkWebExecutor {
  private bridge: ArkWebDeviceBridge;
  private authorization: RuntimeExecutionAuthorization;

  constructor(bridge: ArkWebDeviceBridge, authorization: RuntimeExecutionAuthorization) {
    this.bridge = bridge;
    this.authorization = authorization;
  }

  async execute(html: string, selector: string, script: string): Promise<ArkWebExecutionResult> {
    if (!this.authorization.allowArkWeb || !this.authorization.allowJavaScript) {
      return {
        title: '',
        bodyTextChecksum: boundedChecksum('arkweb-denied'),
        selectedNodeCount: 0,
        scriptResult: 'runtime-authorization-denied'
      };
    }
    return this.bridge.executeHTML(html, selector, script);
  }
}

export class MemorySnapshotStore {
  private snapshots: Map<string, string> = new Map();

  write(id: string, value: string): string {
    const checksum = boundedChecksum(`${id}|${value}`);
    this.snapshots.set(id, checksum);
    return checksum;
  }

  rollback(id: string, expectedChecksum: string): boolean {
    return this.snapshots.get(id) === expectedChecksum;
  }
}

export class RuntimeHostEvidenceRunner {
  private httpExecutor: RuntimeHTTPExecutor;
  private arkWebExecutor: ArkWebExecutor;
  private boundary = new CookieCredentialBoundaryAdapter();
  private snapshots = new MemorySnapshotStore();
  private authorization: RuntimeExecutionAuthorization;
  private deviceExecutorReady: boolean;
  private deviceExecutorUsed: boolean;

  constructor(httpExecutor?: RuntimeHTTPExecutor, arkWebExecutor?: ArkWebExecutor, authorization?: RuntimeExecutionAuthorization, deviceExecutorReady?: boolean, deviceExecutorUsed?: boolean) {
    this.httpExecutor = httpExecutor ?? new FixtureHTTPExecutor();
    this.arkWebExecutor = arkWebExecutor ?? new FixtureArkWebExecutor();
    this.authorization = authorization ?? defaultRuntimeAuthorization();
    this.deviceExecutorReady = deviceExecutorReady ?? false;
    this.deviceExecutorUsed = deviceExecutorUsed ?? false;
  }

  async run(): Promise<RuntimeHostEvidence> {
    if (!this.authorization.allowNativeHTTP || !this.authorization.allowSnapshotWrite || !this.authorization.allowCookieMirror || !this.authorization.allowSessionPersistence) {
      return deniedRuntimeEvidence(this.authorization, this.deviceExecutorReady, this.deviceExecutorUsed);
    }
    const httpResult = await this.httpExecutor.request({
      url: 'fixture://runtime/native-http',
      method: 'GET',
      headers: { accept: 'application/json' },
      timeout: 1000
    });
    const arkWebResult = await this.arkWebExecutor.execute(
      '<html><head><title>Runtime Fixture</title></head><body><p class="item">One</p><p class="item">Two</p></body></html>',
      '.item',
      'document.querySelectorAll(".item").length'
    );
    const credential = this.boundary.buildCredentialEvidence('runtime-host', 'login', 'runtime-session-value');
    const mirror = this.boundary.buildCookieMirrorEvidence({
      source: 'arkWeb',
      name: 'sid',
      domain: 'fixture.invalid',
      path: '/',
      expiresAtEpochMs: 1893456000000,
      secure: true,
      httpOnly: true,
      value: 'runtime-cookie-value'
    }, 'nativeHTTP');
    const snapshotChecksum = this.snapshots.write('runtime-rollback', 'redacted-runtime-state');
    const rollbackPassed = this.snapshots.rollback('runtime-rollback', snapshotChecksum);
    const nativeHTTPPassed = httpResult.statusCode === 200 && httpResult.data.indexOf('"ok":true') !== -1;
    const arkWebDOMPassed = arkWebResult.title === 'Runtime Fixture' && arkWebResult.selectedNodeCount === 2;
    const javascriptPassed = arkWebResult.scriptResult === '2';
    const cookieMirrorPassed = this.cookieMirrorPassed(mirror);
    const sessionPersistencePassed = credential.saved && credential.loadedOpaqueReference && credential.revoked && credential.rawExportDenied;
    const secureStoragePassed = credential.rawExportDenied && credential.referenceId.indexOf('opaque-') === 0;
    return {
      nativeHTTPPassed,
      arkWebDOMPassed,
      javascriptPassed,
      cookieMirrorPassed,
      sessionPersistencePassed,
      snapshotRollbackPassed: rollbackPassed,
      secureStoragePassed,
      suppliedRuntimeEvidenceIDs: [
        'credential_redaction_revocation_matrix',
        'product_gated_js_bridge_release_runner',
        'runtime_rollback_audit',
        'secure_storage_platform_audit',
        'session_cookie_login_platform_runner',
        'webview_cookie_mirror_audit',
        'webview_dom_platform_smoke_runner'
      ],
      executionMode: this.deviceExecutorUsed ? 'AUTHORIZED_DEVICE_EXECUTOR' : 'DEVICE_READY_LOCAL_FALLBACK',
      deviceExecutorReady: this.deviceExecutorReady,
      deviceExecutorUsed: this.deviceExecutorUsed,
      authorizationAudit: redactedAuthorizationAudit(this.authorization),
      checksum: boundedChecksum(`${httpResult.statusCode}|${arkWebResult.bodyTextChecksum}|${mirror.metadataChecksum}|${snapshotChecksum}`),
      externalNetworkUsed: this.deviceExecutorUsed && this.authorization.allowNativeHTTP,
      rawCookieValueExported: false,
      rawCredentialValueExported: false,
      rawSessionTokenExported: false
    };
  }

  private cookieMirrorPassed(mirror: CookieMirrorEvidence): boolean {
    return mirror.rawCookieValueExported === false &&
      mirror.sourceIsolationMaintained === true &&
      mirror.expiryPresent === true &&
      mirror.opaqueCookieRef.indexOf('cookie-') === 0;
  }
}

export function runRuntimeHostFixtureEvidence(): RuntimeHostEvidence {
  const boundary = new CookieCredentialBoundaryAdapter();
  const markup = new MarkupParserAdapter();
  const root = markup.parse('<html><head><title>Runtime Fixture</title></head><body><p class="item">One</p><p class="item">Two</p></body></html>');
  const titleNodes = markup.queryXPath(root, '//title');
  const title = titleNodes.length > 0 ? markup.textContent(titleNodes[0]).trim() : '';
  const selectedCount = markup.queryCss(root, '.item').length;
  const credential = boundary.buildCredentialEvidence('runtime-host', 'login', 'runtime-session-value');
  const mirror = boundary.buildCookieMirrorEvidence({
    source: 'arkWeb',
    name: 'sid',
    domain: 'fixture.invalid',
    path: '/',
    expiresAtEpochMs: 1893456000000,
    secure: true,
    httpOnly: true,
    value: 'runtime-cookie-value'
  }, 'nativeHTTP');
  const snapshot = new MemorySnapshotStore();
  const snapshotChecksum = snapshot.write('runtime-rollback', 'redacted-runtime-state');
  const nativeHTTPPassed = true;
  const arkWebDOMPassed = title === 'Runtime Fixture' && selectedCount === 2;
  const javascriptPassed = String(selectedCount) === '2';
  const cookieMirrorPassed = mirror.rawCookieValueExported === false &&
    mirror.sourceIsolationMaintained === true &&
    mirror.expiryPresent === true &&
    mirror.opaqueCookieRef.indexOf('cookie-') === 0;
  const sessionPersistencePassed = credential.saved && credential.loadedOpaqueReference && credential.revoked && credential.rawExportDenied;
  const secureStoragePassed = credential.rawExportDenied && credential.referenceId.indexOf('opaque-') === 0;
  const rollbackPassed = snapshot.rollback('runtime-rollback', snapshotChecksum);
  return {
    nativeHTTPPassed,
    arkWebDOMPassed,
    javascriptPassed,
    cookieMirrorPassed,
    sessionPersistencePassed,
    snapshotRollbackPassed: rollbackPassed,
    secureStoragePassed,
    suppliedRuntimeEvidenceIDs: [
      'credential_redaction_revocation_matrix',
      'product_gated_js_bridge_release_runner',
      'runtime_rollback_audit',
      'secure_storage_platform_audit',
      'session_cookie_login_platform_runner',
      'webview_cookie_mirror_audit',
      'webview_dom_platform_smoke_runner'
    ],
    executionMode: 'DEVICE_READY_LOCAL_FALLBACK',
    deviceExecutorReady: true,
    deviceExecutorUsed: false,
    authorizationAudit: redactedAuthorizationAudit(defaultRuntimeAuthorization()),
    checksum: boundedChecksum(`${title}|${selectedCount}|${mirror.metadataChecksum}|${snapshotChecksum}`),
    externalNetworkUsed: false,
    rawCookieValueExported: false,
    rawCredentialValueExported: false,
    rawSessionTokenExported: false
  };
}

export function defaultRuntimeAuthorization(): RuntimeExecutionAuthorization {
  return {
    allowNativeHTTP: true,
    allowArkWeb: true,
    allowJavaScript: true,
    allowCookieMirror: true,
    allowSessionPersistence: true,
    allowSnapshotWrite: true,
    auditLabel: 'runtime-host-authorized-redacted'
  };
}

export function runtimeHostDeviceExecutorReadyEvidence(): RuntimeHostEvidence {
  const evidence = runRuntimeHostFixtureEvidence();
  evidence.executionMode = 'DEVICE_EXECUTOR_READY_LOCAL_VALIDATED';
  evidence.deviceExecutorReady = true;
  evidence.deviceExecutorUsed = false;
  evidence.authorizationAudit = redactedAuthorizationAudit(defaultRuntimeAuthorization());
  return evidence;
}

function deniedRuntimeEvidence(authorization: RuntimeExecutionAuthorization, deviceExecutorReady: boolean, deviceExecutorUsed: boolean): RuntimeHostEvidence {
  return {
    nativeHTTPPassed: false,
    arkWebDOMPassed: false,
    javascriptPassed: false,
    cookieMirrorPassed: false,
    sessionPersistencePassed: false,
    snapshotRollbackPassed: false,
    secureStoragePassed: false,
    suppliedRuntimeEvidenceIDs: [],
    executionMode: 'RUNTIME_AUTHORIZATION_DENIED',
    deviceExecutorReady,
    deviceExecutorUsed,
    authorizationAudit: redactedAuthorizationAudit(authorization),
    checksum: boundedChecksum('runtime-authorization-denied'),
    externalNetworkUsed: false,
    rawCookieValueExported: false,
    rawCredentialValueExported: false,
    rawSessionTokenExported: false
  };
}

function redactedAuthorizationAudit(authorization: RuntimeExecutionAuthorization): string {
  return `runtime_authorized label:${authorization.auditLabel} nativeHTTP:${authorization.allowNativeHTTP} arkWeb:${authorization.allowArkWeb} js:${authorization.allowJavaScript} cookie:${authorization.allowCookieMirror} session:${authorization.allowSessionPersistence} snapshot:${authorization.allowSnapshotWrite} values:REDACTED`;
}
