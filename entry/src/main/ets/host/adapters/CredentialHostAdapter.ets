// CredentialHostAdapter — HarmonyOS @ohos.data.preferences backed Host adapter
// for credential.get / credential.set / credential.delete.
//
// Source of truth: UI Contract host-request.schema.json — `credential.*` are
// UI-Contract-only capabilities (NOT in the Core HostCapability closed set).
// Reducer dispatches these directly.
//
// HarmonyOS API mapping:
//   - credential.get    → preferences.getPreferences(context, 'reader_credentials')
//                          + pref.get(key, '')
//   - credential.set    → pref.put(key, value) + pref.flush()
//   - credential.delete → pref.delete(key) + pref.flush()
//
// SECURITY: This implementation stores credentials as PLAINTEXT in preferences.
// This is acceptable for non-sensitive configuration (login state, user prefs).
// For sensitive credentials (passwords, API keys, tokens), callers SHOULD
// encrypt the value before calling set(), using a Host-side encryption utility
// backed by @ohos.security.huks (HUKS Universal Keystore). Full HUKS-backed
// encryption is a TODO for a future phase — the seam is here, the crypto is not.
//
// Permission: none required for preferences.
import dataPreferences from '@ohos.data.preferences';
import common from '@ohos.app.ability.common';
import {
  HostCredentialGetRequest,
  HostCredentialGetResponse,
  HostCredentialSetRequest,
  HostCredentialSetResponse,
  HostCredentialDeleteRequest,
  HostCredentialDeleteResponse,
} from '../types';
import type { WebDavCredentialReader } from './WebDavHostAdapter';

const PREFERENCES_NAME: string = 'reader_credentials';

export class CredentialHostAdapter implements WebDavCredentialReader {
  private context: common.Context;
  private preferences: dataPreferences.Preferences | null = null;

  constructor(context: common.Context) {
    this.context = context;
  }

  /**
   * credential.get — read a credential value by key.
   * Returns exists: false if the key is not present.
   */
  async get(request: HostCredentialGetRequest): Promise<HostCredentialGetResponse> {
    try {
      const pref = await this.ensurePreferences();
      const has = await pref.has(request.key);
      if (!has) {
        return { exists: false };
      }
      const value = await pref.get(request.key, '') as string;
      return { exists: true, value: value };
    } catch (e) {
      console.error(`[CredentialHostAdapter] get key=${request.key} failed: ${e}`);
      throw new Error(`CredentialHostAdapter.get key=${request.key} failed: ${e}`);
    }
  }

  /**
   * credential.set — store a credential value by key.
   * SECURITY: value is stored as plaintext. Callers MUST encrypt sensitive
   * values before passing them here.
   */
  async set(request: HostCredentialSetRequest): Promise<HostCredentialSetResponse> {
    try {
      const pref = await this.ensurePreferences();
      await pref.put(request.key, request.value);
      await pref.flush();
      return { stored: true };
    } catch (e) {
      console.error(`[CredentialHostAdapter] set key=${request.key} failed: ${e}`);
      throw new Error(`CredentialHostAdapter.set key=${request.key} failed: ${e}`);
    }
  }

  /**
   * credential.delete — delete a credential by key.
   */
  async delete(request: HostCredentialDeleteRequest): Promise<HostCredentialDeleteResponse> {
    try {
      const pref = await this.ensurePreferences();
      const has = await pref.has(request.key);
      if (!has) {
        return { deleted: false };
      }
      await pref.delete(request.key);
      await pref.flush();
      return { deleted: true };
    } catch (e) {
      console.error(`[CredentialHostAdapter] delete key=${request.key} failed: ${e}`);
      throw new Error(`CredentialHostAdapter.delete key=${request.key} failed: ${e}`);
    }
  }

  // ── internal ──

  private async ensurePreferences(): Promise<dataPreferences.Preferences> {
    try {
      if (this.preferences !== null) {
        return this.preferences;
      }
      this.preferences = await dataPreferences.getPreferences(this.context, PREFERENCES_NAME);
      return this.preferences;
    } catch (e) {
      console.error(`[CredentialHostAdapter] ensurePreferences failed: ${e}`);
      throw new Error(`CredentialHostAdapter.ensurePreferences failed: ${e}`);
    }
  }
}
