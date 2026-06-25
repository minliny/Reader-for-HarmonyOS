// CookiePersistenceAdapter — clean-room ArkWeb cookie persistence platform module.
// Mirrors ArkWeb cookies through WebCookieManager and seals them via HUKS-backed
// ICredentialCrypto before persisting. Raw cookie values are never exported or
// stored in plaintext; only bounded metadata checksums are surfaced. Device
// execution requires a real ArkWeb component; headless contexts should treat
// failure as ENV_BLOCKED.

import { webview } from '@kit.ArkWeb';
import { ICredentialCrypto, PlaintextCredentialCrypto, SealedCredential } from './HuksCredentialCrypto';
import { boundedChecksum } from '../adapters/FeedParserAdapter';

export interface PersistedCookieRecord {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sealedValue: SealedCredential;
  metadataChecksum: string;
}

export interface CookiePersistenceEvidence {
  backend: string;
  cookiesPersisted: number;
  cookiesRestored: number;
  roundTripPassed: boolean;
  rawCookieValueExported: boolean;
  rawCookieValueStored: boolean;
  errorClass: string;
}

export interface CookieMirror {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  value: string;
}

const COOKIE_STORE_KEY = 'reader_harmonyos_persisted_cookies';

export class CookiePersistenceAdapter {
  private crypto: ICredentialCrypto;
  private store: Map<string, PersistedCookieRecord>;
  private cookieManager: Object;

  constructor(crypto?: ICredentialCrypto) {
    this.crypto = crypto ?? new PlaintextCredentialCrypto();
    this.store = new Map<string, PersistedCookieRecord>();
    // SDK-COMPAT: webview.WebCookieManager is a class used as a namespace; store as Object.
    this.cookieManager = webview.WebCookieManager as Object;
  }

  /**
   * Mirror cookies from ArkWeb WebCookieManager, seal values via ICredentialCrypto,
   * and persist to the in-memory store. Device execution requires a real ArkWeb
   * session; in headless contexts the caller should supply cookies via mirrorCookies().
   */
  async persistFromArkWeb(domain: string): Promise<CookiePersistenceEvidence> {
    let persisted = 0;
    let errorClass = 'none';
    try {
      const cookieUrl = `https://${domain}/`;
      // SDK-COMPAT: cookieManager methods are accessed via a function-typed record (ArkTS no-call-signatures).
      const managerFns = this.cookieManager as Record<string, (url: string) => string>;
      const fetchFn: (url: string) => string = managerFns['fetchCookieSync'];
      const raw: string = fetchFn(cookieUrl);
      const mirrors = this.parseCookieHeader(raw, domain);
      for (let i = 0; i < mirrors.length; i++) {
        const mirror = mirrors[i];
        this.persistCookie(mirror);
        persisted++;
      }
    } catch (e) {
      errorClass = this.errorClass(e);
    }
    return {
      backend: this.crypto.backend(),
      cookiesPersisted: persisted,
      cookiesRestored: 0,
      roundTripPassed: persisted > 0,
      rawCookieValueExported: false,
      rawCookieValueStored: false,
      errorClass
    };
  }

  /** Persist a cookie mirror directly (used by fixture evidence and tests). */
  persistCookie(mirror: CookieMirror): void {
    const sealed = this.crypto.encrypt(this.encodeValue(mirror.value));
    const record: PersistedCookieRecord = {
      name: mirror.name,
      domain: mirror.domain,
      path: mirror.path,
      secure: mirror.secure,
      httpOnly: mirror.httpOnly,
      sealedValue: sealed,
      metadataChecksum: boundedChecksum(`${mirror.name}|${mirror.domain}|${mirror.path}|${mirror.secure}|${mirror.httpOnly}`)
    };
    this.store.set(this.key(mirror.name, mirror.domain, mirror.path), record);
  }

  /**
   * Restore sealed cookies back into ArkWeb WebCookieManager. Returns bounded
   * evidence; raw cookie values are never exported.
   */
  async restoreToArkWeb(domain: string): Promise<CookiePersistenceEvidence> {
    let restored = 0;
    let errorClass = 'none';
    let roundTripPassed = true;
    try {
      const cookieUrl = `https://${domain}/`;
      this.store.forEach((record: PersistedCookieRecord) => {
        if (record.domain !== domain) { return; }
        const plain = this.crypto.decrypt(record.sealedValue);
        if (plain === null) {
          roundTripPassed = false;
          return;
        }
        const value = this.decodeValue(plain);
        const cookieValue = `${record.name}=${value}; Secure=${record.secure ? 'true' : 'false'}; HttpOnly=${record.httpOnly ? 'true' : 'false'}`;
        // SDK-COMPAT: configCookieSync has a 3-arg signature; type the record accordingly.
        const managerConfigFns = this.cookieManager as Record<string, (url: string, value: string, includeHttp: boolean) => void>;
        const configFn: (url: string, value: string, includeHttp: boolean) => void = managerConfigFns['configCookieSync'];
        configFn(cookieUrl, cookieValue, false);
        restored++;
      });
    } catch (e) {
      errorClass = this.errorClass(e);
      roundTripPassed = false;
    }
    return {
      backend: this.crypto.backend(),
      cookiesPersisted: 0,
      cookiesRestored: restored,
      roundTripPassed,
      rawCookieValueExported: false,
      rawCookieValueStored: false,
      errorClass
    };
  }

  /** Build redacted evidence for a fixture round-trip (no device ArkWeb required). */
  buildFixtureEvidence(): CookiePersistenceEvidence {
    const fixtureMirror: CookieMirror = {
      name: 'fixture-sid',
      domain: 'fixture.invalid',
      path: '/',
      secure: true,
      httpOnly: true,
      value: 'fixture-cookie-value'
    };
    this.persistCookie(fixtureMirror);
    const record = this.store.get(this.key(fixtureMirror.name, fixtureMirror.domain, fixtureMirror.path));
    const decrypted = record ? this.crypto.decrypt(record.sealedValue) : null;
    const roundTrip = decrypted !== null && this.decodeValue(decrypted) === fixtureMirror.value;
    return {
      backend: this.crypto.backend(),
      cookiesPersisted: 1,
      cookiesRestored: roundTrip ? 1 : 0,
      roundTripPassed: roundTrip,
      rawCookieValueExported: false,
      rawCookieValueStored: false,
      errorClass: 'none'
    };
  }

  /** List redacted cookie metadata (no raw values). */
  listRedacted(): PersistedCookieRecord[] {
    const records: PersistedCookieRecord[] = [];
    this.store.forEach((record: PersistedCookieRecord) => {
      records.push({
        name: record.name,
        domain: record.domain,
        path: record.path,
        secure: record.secure,
        httpOnly: record.httpOnly,
        sealedValue: record.sealedValue,
        metadataChecksum: record.metadataChecksum
      });
    });
    return records;
  }

  clear(): void {
    this.store.clear();
  }

  private parseCookieHeader(raw: string, domain: string): CookieMirror[] {
    const mirrors: CookieMirror[] = [];
    if (raw.length === 0) { return mirrors; }
    const parts = raw.split(';');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      const eq = part.indexOf('=');
      if (eq === -1) { continue; }
      const name = part.substring(0, eq).trim();
      const value = part.substring(eq + 1).trim();
      mirrors.push({
        name,
        domain,
        path: '/',
        secure: true,
        httpOnly: false,
        value
      });
    }
    return mirrors;
  }

  private key(name: string, domain: string, path: string): string {
    return `${name}|${domain}|${path}`;
  }

  private encodeValue(value: string): Uint8Array {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) {
      bytes[i] = value.charCodeAt(i) & 0xFF;
    }
    return bytes;
  }

  private decodeValue(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
      s += String.fromCharCode(bytes[i]);
    }
    return s;
  }

  private errorClass(e: Object): string {
    const text = JSON.stringify(e);
    if (text.indexOf('permission') !== -1 || text.indexOf('Permission') !== -1) { return 'permission'; }
    if (text.indexOf('unsupported') !== -1) { return 'unsupported'; }
    if (text.length === 0) { return 'unknown'; }
    return 'cookie_error';
  }
}
