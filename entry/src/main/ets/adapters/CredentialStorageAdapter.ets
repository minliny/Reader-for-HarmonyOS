// CredentialStorageAdapter — credential storage for WebDAV/source auth
// CONTRACT_ONLY for production — uses preferences for MVP
import { IStorageAdapter } from '../repository/BookshelfRepository';

export interface Credential {
  identifier: string;
  value: string;
  label?: string;
  accessGroup?: string;
}

const CRED_PREFIX = 'cred_';

export class CredentialStorageAdapter {
  private storage: IStorageAdapter;

  constructor(storage: IStorageAdapter) {
    this.storage = storage;
  }

  save(credential: Credential): void {
    const key = CRED_PREFIX + credential.identifier;
    this.storage.write(key, JSON.stringify(credential));
  }

  get(identifier: string): Credential | null {
    const key = CRED_PREFIX + identifier;
    const json = this.storage.read(key);
    if (!json) { return null; }
    try {
      return JSON.parse(json) as Credential;
    } catch (_e) {
      return null;
    }
  }

  delete(identifier: string): void {
    const key = CRED_PREFIX + identifier;
    this.storage.remove(key);
  }

  list(): Credential[] {
    return [];
  }
}
