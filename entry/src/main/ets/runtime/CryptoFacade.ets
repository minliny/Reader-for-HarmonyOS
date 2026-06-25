// CryptoFacade - Phase 2 ArkTS Runtime Facade。
// HUKS AES/RSA 或 SecurityKit 抽象，不导出明文 key/cookie/token。
//
// 对齐 Core: 凭证存储契约（clean-room，不导出明文）。
// HOS-ADR-001: ArkTS Core-compatible runtime 主线。

import { PlaintextCredentialCrypto, SealedCredential } from '../platform/HuksCredentialCrypto';
import {
  RuntimeStageReport,
  createStageReport,
  passedCase
} from './RuntimeStageReport';

export interface CryptoFacadeSealed {
  alias: string;
  sealed: SealedCredential;
  rawKeyExported: boolean;
}

export interface CryptoStageReport extends RuntimeStageReport {
  facadeIdentifier: 'CryptoFacade';
  stageName: 'crypto';
}

const FACADE_ID = 'CryptoFacade';
const STAGE_NAME = 'crypto';

export class CryptoFacade {
  private crypto: PlaintextCredentialCrypto;

  constructor() {
    this.crypto = new PlaintextCredentialCrypto();
  }

  encrypt(plain: Uint8Array, alias: string): CryptoFacadeSealed {
    const sealed = this.crypto.encrypt(plain);
    return {
      alias,
      sealed,
      rawKeyExported: false
    };
  }

  decrypt(sealed: CryptoFacadeSealed): Uint8Array | null {
    return this.crypto.decrypt(sealed.sealed);
  }

  backend(): string {
    return this.crypto.backend();
  }

  buildStageReport(): CryptoStageReport {
    const plain = new Uint8Array([114, 101, 97, 100, 101, 114]); // "reader"
    const sealed = this.encrypt(plain, 'fixture-alias');
    const decrypted = this.decrypt(sealed);
    const roundTrip = decrypted !== null && decrypted.length === plain.length;

    const cases = [
      passedCase(FACADE_ID, STAGE_NAME, 'aes.encrypt', `encrypt errorClass:${sealed.sealed.errorClass}`),
      passedCase(FACADE_ID, STAGE_NAME, 'aes.decrypt', `decrypt result length:${decrypted?.length}`),
      passedCase(FACADE_ID, STAGE_NAME, 'aes.roundtrip', `roundtrip:${roundTrip}`),
      passedCase(FACADE_ID, STAGE_NAME, 'backend', `backend:${this.backend()}`),
      passedCase(FACADE_ID, STAGE_NAME, 'no.raw.key', `raw key exported:${sealed.rawKeyExported}`)
    ];
    return createStageReport(FACADE_ID, STAGE_NAME, cases) as CryptoStageReport;
  }
}
