// ReleaseGateValidator - Phase 4 Release Gate 分档校验器测试。
// 验证三档 gate 的 satisfied/missing 判定正确。

import {
  ReleaseGateReport,
  ReleaseGateTier,
  evaluateReleaseGate,
  isAdapterMvpAccepted,
  isProductRuntimeAccepted,
  isReleaseCandidateAccepted
} from '../coreAdapter/HarmonyOSReleaseGate';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = [];
  passed: number = 0;
  failed: number = 0;
  assert(c: boolean, n: string, e?: string): void {
    this.results.push({ name: n, passed: c, error: c ? undefined : e });
    if (c) { this.passed++; } else { this.failed++; }
  }
  summary(): string { return `${this.passed}P ${this.failed}F / ${this.results.length}`; }
}

export function runReleaseGateValidatorTests(): TestRunner {
  const r = new TestRunner();

  const report = evaluateReleaseGate();

  // ---------- adapter_mvp 档 ----------
  r.assert(report.adapterMvp.tier === ReleaseGateTier.adapterMvp, 'adapterMvp tier');
  r.assert(report.adapterMvp.requirements.length === 8, `adapterMvp has 8 requirements (got ${report.adapterMvp.requirements.length})`);
  r.assert(report.adapterMvp.accepted === true, `adapterMvp accepted (missing: ${report.adapterMvp.missing.join(',')})`);
  r.assert(report.adapterMvp.satisfied.length === 8, `adapterMvp 8 satisfied (got ${report.adapterMvp.satisfied.length})`);
  r.assert(report.adapterMvp.missing.length === 0, `adapterMvp 0 missing`);
  r.assert(report.adapterMvp.satisfied.indexOf('archive') !== -1, 'adapterMvp satisfied archive');
  r.assert(report.adapterMvp.satisfied.indexOf('runtimeHost') !== -1, 'adapterMvp satisfied runtimeHost');
  r.assert(report.adapterMvp.satisfied.indexOf('contractRunReportAccepted') !== -1, 'adapterMvp satisfied contractRunReportAccepted');
  r.assert(report.adapterMvp.satisfied.indexOf('cleanRoomMaintained') !== -1, 'adapterMvp satisfied cleanRoomMaintained');

  // ---------- product_runtime 档 ----------
  r.assert(report.productRuntime.tier === ReleaseGateTier.productRuntime, 'productRuntime tier');
  r.assert(report.productRuntime.requirements.length === 15, `productRuntime has 15 requirements (got ${report.productRuntime.requirements.length})`);
  // product_runtime 当前不 accepted（device evidence missing）
  r.assert(report.productRuntime.accepted === false, `productRuntime not accepted (expected device evidence missing)`);
  r.assert(report.productRuntime.missing.indexOf('nativeHTTP.evidence') !== -1, 'productRuntime missing nativeHTTP.evidence');
  r.assert(report.productRuntime.missing.indexOf('arkWeb.evidence') !== -1, 'productRuntime missing arkWeb.evidence');
  r.assert(report.productRuntime.missing.indexOf('huks.evidence') !== -1, 'productRuntime missing huks.evidence');
  r.assert(report.productRuntime.missing.indexOf('webdav.evidence') !== -1, 'productRuntime missing webdav.evidence');
  r.assert(report.productRuntime.missing.indexOf('tts.evidence') !== -1, 'productRuntime missing tts.evidence');
  r.assert(report.productRuntime.satisfied.indexOf('runtimeKit.allStagesPassed') !== -1, 'productRuntime satisfied runtimeKit.allStagesPassed');

  // ---------- release_candidate 档 ----------
  r.assert(report.releaseCandidate.tier === ReleaseGateTier.releaseCandidate, 'releaseCandidate tier');
  r.assert(report.releaseCandidate.requirements.length === 20, `releaseCandidate has 20 requirements (got ${report.releaseCandidate.requirements.length})`);
  r.assert(report.releaseCandidate.accepted === false, `releaseCandidate not accepted`);
  r.assert(report.releaseCandidate.missing.indexOf('rollback') !== -1, 'releaseCandidate missing rollback');
  r.assert(report.releaseCandidate.missing.indexOf('credential.revocation') !== -1, 'releaseCandidate missing credential.revocation');
  r.assert(report.releaseCandidate.missing.indexOf('network.hardening') !== -1, 'releaseCandidate missing network.hardening');
  r.assert(report.releaseCandidate.missing.indexOf('real.corpus.benchmark') !== -1, 'releaseCandidate missing real.corpus.benchmark');
  r.assert(report.releaseCandidate.missing.indexOf('product.gated.js.bridge') !== -1, 'releaseCandidate missing product.gated.js.bridge');

  // ---------- 整体 ----------
  r.assert(report.overallAccepted === true, `overallAccepted true (adapterMvp passed)`);
  r.assert(report.canMutateProductionReleaseGate === false, 'canMutateProductionReleaseGate false');
  r.assert(report.readerCoreRootArtifactsMutated === false, 'readerCoreRootArtifactsMutated false');
  r.assert(report.cleanRoomMaintained === true, 'cleanRoomMaintained true');
  r.assert(report.externalGPLCodeCopied === false, 'externalGPLCodeCopied false');
  r.assert(report.legadoSourceCopied === false, 'legadoSourceCopied false');

  // ---------- 便捷 API ----------
  r.assert(isAdapterMvpAccepted() === true, 'isAdapterMvpAccepted true');
  r.assert(isProductRuntimeAccepted() === false, 'isProductRuntimeAccepted false');
  r.assert(isReleaseCandidateAccepted() === false, 'isReleaseCandidateAccepted false');

  // ---------- 分档递进关系 ----------
  // releaseCandidate 要求 ⊇ productRuntime 要求 ⊇ adapterMvp 要求
  r.assert(report.adapterMvp.requirements.length < report.productRuntime.requirements.length, 'productRuntime requirements > adapterMvp');
  r.assert(report.productRuntime.requirements.length < report.releaseCandidate.requirements.length, 'releaseCandidate requirements > productRuntime');

  return r;
}
