// SecureStorageEntitlementEvidenceService - device-side HUKS key entitlement evidence.
// It records only status/checksums and never persists raw key material or credential values.

import { huks } from '@kit.UniversalKeystoreKit';
import { boundedChecksum } from '../adapters/FeedParserAdapter';

export interface SecureStorageEntitlementEvidenceSnapshot {
  huksAvailable: boolean;
  keyGenerated: boolean;
  existsAfterGenerate: boolean;
  exportDenied: boolean;
  keyDeleted: boolean;
  existsAfterDelete: boolean;
  rawCredentialValueExported: boolean;
  rawKeyMaterialExported: boolean;
  aliasChecksum: string;
  redactedAuditEntry: string;
  errorClass: string;
}

interface SecureStorageExportProbe {
  denied: boolean;
  rawKeyMaterialExported: boolean;
}

const SECURE_STORAGE_ALIAS = 'reader_harmonyos_secure_storage_evidence';

export class SecureStorageEntitlementEvidenceService {
  async runEntitlementEvidence(): Promise<SecureStorageEntitlementEvidenceSnapshot> {
    const alias = SECURE_STORAGE_ALIAS;
    let keyGenerated = false;
    let existsAfterGenerate = false;
    let exportDenied = true;
    let rawKeyMaterialExported = false;
    let keyDeleted = false;
    let existsAfterDelete = false;
    let errorClass = 'none';

    try {
      await this.deleteIfPresent(alias);
      await huks.generateKeyItem(alias, this.generateOptions());
      keyGenerated = true;
      existsAfterGenerate = await huks.isKeyItemExist(alias, this.storageOptions());

      const exportResult = await this.tryExport(alias);
      exportDenied = exportResult.denied;
      rawKeyMaterialExported = exportResult.rawKeyMaterialExported;

      await huks.deleteKeyItem(alias, this.storageOptions());
      keyDeleted = true;
      existsAfterDelete = await huks.isKeyItemExist(alias, this.storageOptions());
    } catch (e) {
      errorClass = this.errorClass(e);
      try {
        await huks.deleteKeyItem(alias, this.storageOptions());
        keyDeleted = true;
      } catch (_cleanupError) {
        // Best effort cleanup; the errorClass above preserves the primary failure.
      }
    }

    return {
      huksAvailable: keyGenerated || keyDeleted,
      keyGenerated,
      existsAfterGenerate,
      exportDenied,
      keyDeleted,
      existsAfterDelete,
      rawCredentialValueExported: false,
      rawKeyMaterialExported,
      aliasChecksum: boundedChecksum(alias),
      redactedAuditEntry: `secure_storage alias:${boundedChecksum(alias)} generated:${keyGenerated} exportDenied:${exportDenied} deleted:${keyDeleted} values:REDACTED`,
      errorClass
    };
  }

  private generateOptions(): huks.HuksOptions {
    return {
      properties: [
        { tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
        { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: huks.HuksKeySize.HUKS_AES_KEY_SIZE_256 },
        {
          tag: huks.HuksTag.HUKS_TAG_PURPOSE,
          value: huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_ENCRYPT | huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_DECRYPT
        },
        { tag: huks.HuksTag.HUKS_TAG_BLOCK_MODE, value: huks.HuksCipherMode.HUKS_MODE_CBC },
        { tag: huks.HuksTag.HUKS_TAG_PADDING, value: huks.HuksKeyPadding.HUKS_PADDING_PKCS7 },
        { tag: huks.HuksTag.HUKS_TAG_AUTH_STORAGE_LEVEL, value: huks.HuksAuthStorageLevel.HUKS_AUTH_STORAGE_LEVEL_CE },
        { tag: huks.HuksTag.HUKS_TAG_KEY_STORAGE_FLAG, value: huks.HuksKeyStorageType.HUKS_STORAGE_ONLY_USED_IN_HUKS }
      ]
    };
  }

  private storageOptions(): huks.HuksOptions {
    return {
      properties: [
        { tag: huks.HuksTag.HUKS_TAG_AUTH_STORAGE_LEVEL, value: huks.HuksAuthStorageLevel.HUKS_AUTH_STORAGE_LEVEL_CE }
      ]
    };
  }

  private async deleteIfPresent(alias: string): Promise<void> {
    try {
      const exists = await huks.isKeyItemExist(alias, this.storageOptions());
      if (exists) {
        await huks.deleteKeyItem(alias, this.storageOptions());
      }
    } catch (_e) {
      // A missing key or unsupported pre-delete query should not hide generate/delete evidence.
    }
  }

  private async tryExport(alias: string): Promise<SecureStorageExportProbe> {
    try {
      const result: huks.HuksReturnResult = await huks.exportKeyItem(alias, this.storageOptions());
      const raw = result.outData !== undefined && result.outData.length > 0;
      return { denied: !raw, rawKeyMaterialExported: raw };
    } catch (_e) {
      return { denied: true, rawKeyMaterialExported: false };
    }
  }

  private errorClass(e: Object): string {
    const text = JSON.stringify(e);
    if (text.indexOf('permission') !== -1 || text.indexOf('Permission') !== -1) {
      return 'permission';
    }
    if (text.indexOf('unsupported') !== -1 || text.indexOf('Support') !== -1) {
      return 'unsupported';
    }
    if (text.length === 0) {
      return 'unknown';
    }
    return 'huks_error';
  }
}

export const readerSecureStorageEntitlementEvidence = new SecureStorageEntitlementEvidenceService();
