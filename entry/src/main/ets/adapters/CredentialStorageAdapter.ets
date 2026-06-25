// CredentialStorageAdapter — credential storage for WebDAV/source auth.
// Stores credential values as sealed (encrypted) envelopes via an injectable
// ICredentialCrypto. In production a HuksCredentialCrypto is injected so
// plaintext values never reach preferences; in tests a PlaintextCredentialCrypto
// preserves the previous behavior. CONTRACT_ONLY marks remain for any path
// that has not yet been bound to a device HUKS session.
import { IStorageAdapter } from '../repository/BookshelfRepository';
import { ICredentialCrypto, PlaintextCredentialCrypto, SealedCredential } from '../platform/HuksCredentialCrypto';

export interface Credential {
  identifier: string;
  value: string;
  label?: string;
  accessGroup?: string;
}

export interface StoredCredentialRecord {
  identifier: string;
  sealed: SealedCredential;
  label?: string;
  accessGroup?: string;
}

const CRED_PREFIX = 'cred_';

export class CredentialStorageAdapter {
  private storage: IStorageAdapter;
  private crypto: ICredentialCrypto;

  constructor(storage: IStorageAdapter, crypto?: ICredentialCrypto) {
    this.storage = storage;
    this.crypto = crypto ?? new PlaintextCredentialCrypto();
  }

  save(credential: Credential): void {
    const plain = this.encodeUtf8(credential.value);
    const sealed = this.crypto.encrypt(plain);
    const record: StoredCredentialRecord = {
      identifier: credential.identifier,
      sealed,
      label: credential.label,
      accessGroup: credential.accessGroup
    };
    const key = CRED_PREFIX + credential.identifier;
    this.storage.write(key, JSON.stringify(record));
  }

  get(identifier: string): Credential | null {
    const key = CRED_PREFIX + identifier;
    const json = this.storage.read(key);
    if (!json) { return null; }
    try {
      const record = JSON.parse(json) as StoredCredentialRecord;
      const plain = this.crypto.decrypt(record.sealed);
      if (plain === null) { return null; }
      return {
        identifier: record.identifier,
        value: this.decodeUtf8(plain),
        label: record.label,
        accessGroup: record.accessGroup
      };
    } catch (_e) {
      return null;
    }
  }

  delete(identifier: string): void {
    const key = CRED_PREFIX + identifier;
    this.storage.remove(key);
  }

  list(): Credential[] {
    // preferences does not support key enumeration; identifiers must be known.
    return [];
  }

  backend(): string {
    return this.crypto.backend();
  }

  private encodeUtf8(value: string): Uint8Array {
    const out: number[] = [];
    for (let i = 0; i < value.length; i++) {
      let c = value.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xC0 | (c >> 6));
        out.push(0x80 | (c & 0x3F));
      } else {
        out.push(0xE0 | (c >> 12));
        out.push(0x80 | ((c >> 6) & 0x3F));
        out.push(0x80 | (c & 0x3F));
      }
    }
    return new Uint8Array(out);
  }

  private decodeUtf8(bytes: Uint8Array): string {
    let out = '';
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i];
      if (b < 0x80) {
        out += String.fromCharCode(b);
        i++;
      } else if (b < 0xE0) {
        out += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i + 1] & 0x3F));
        i += 2;
      } else {
        out += String.fromCharCode(((b & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F));
        i += 3;
      }
    }
    return out;
  }
}
