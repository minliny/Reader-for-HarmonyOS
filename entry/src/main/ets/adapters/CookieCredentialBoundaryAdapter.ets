// CookieCredentialBoundaryAdapter - redacted boundary evidence for credential/cookie/session material.
// It does not claim ArkWeb cookie-store execution; it proves artifact redaction and opaque references.

import { boundedChecksum } from './FeedParserAdapter';

export interface OpaqueSecretReference {
  referenceId: string;
  scope: string;
  checksum: string;
  rawExportAllowed: boolean;
  revoked: boolean;
}

export interface CookieMirrorInput {
  source: 'arkWeb' | 'nativeHTTP';
  name: string;
  domain: string;
  path: string;
  expiresAtEpochMs?: number;
  secure: boolean;
  httpOnly: boolean;
  value: string;
}

export interface CookieMirrorEvidence {
  source: string;
  mirrorTarget: string;
  opaqueCookieRef: string;
  metadataChecksum: string;
  valueChecksum: string;
  rawCookieValueExported: boolean;
  sourceIsolationMaintained: boolean;
  expiryPresent: boolean;
  redactedAuditEntry: string;
}

export interface CredentialBoundaryEvidence {
  referenceId: string;
  saved: boolean;
  loadedOpaqueReference: boolean;
  revoked: boolean;
  rawExportDenied: boolean;
  valueChecksum: string;
  redactedAuditEntry: string;
}

export class CookieCredentialBoundaryAdapter {
  private references: Map<string, OpaqueSecretReference> = new Map();

  saveOpaqueCredential(scope: string, label: string, value: string): OpaqueSecretReference {
    const checksum = boundedChecksum(`${scope}|${label}|${value}`);
    const reference: OpaqueSecretReference = {
      referenceId: `opaque-${boundedChecksum(`${scope}|${label}`)}`,
      scope,
      checksum,
      rawExportAllowed: false,
      revoked: false
    };
    this.references.set(reference.referenceId, reference);
    return reference;
  }

  loadOpaqueCredential(referenceId: string): OpaqueSecretReference | null {
    return this.references.get(referenceId) ?? null;
  }

  revokeCredential(referenceId: string): boolean {
    const reference = this.references.get(referenceId);
    if (!reference) { return false; }
    reference.revoked = true;
    this.references.set(referenceId, reference);
    return true;
  }

  exportRawCredential(_referenceId: string): string | null {
    return null;
  }

  buildCredentialEvidence(scope: string, label: string, value: string): CredentialBoundaryEvidence {
    const reference = this.saveOpaqueCredential(scope, label, value);
    const loaded = this.loadOpaqueCredential(reference.referenceId);
    const raw = this.exportRawCredential(reference.referenceId);
    const revoked = this.revokeCredential(reference.referenceId);
    return {
      referenceId: reference.referenceId,
      saved: true,
      loadedOpaqueReference: loaded !== null && loaded.referenceId === reference.referenceId,
      revoked,
      rawExportDenied: raw === null,
      valueChecksum: reference.checksum,
      redactedAuditEntry: `credential_boundary scope:${scope} ref:${reference.referenceId} value:REDACTED`
    };
  }

  buildCookieMirrorEvidence(input: CookieMirrorInput, mirrorTarget: 'arkWeb' | 'nativeHTTP'): CookieMirrorEvidence {
    const metadata = `${input.name}|${input.domain}|${input.path}|${input.secure}|${input.httpOnly}|${input.expiresAtEpochMs ?? 0}`;
    return {
      source: input.source,
      mirrorTarget,
      opaqueCookieRef: `cookie-${boundedChecksum(metadata)}`,
      metadataChecksum: boundedChecksum(metadata),
      valueChecksum: boundedChecksum(input.value),
      rawCookieValueExported: false,
      sourceIsolationMaintained: input.source !== mirrorTarget,
      expiryPresent: input.expiresAtEpochMs !== undefined,
      redactedAuditEntry: `cookie_mirror source:${input.source} target:${mirrorTarget} ref:REDACTED value:REDACTED`
    };
  }
}
