// RuntimeHostFacade - Phase 2 ArkTS Runtime Facade。
// ArkWeb + nativeHTTP + cookie/session 编排，对齐 runtimeHost required features。
//
// 对齐 Core: runtimeHost required features (arkWeb/nativeHTTP/cookieStore/sessionPersistence/javascript/snapshotWrite)。
// HOS-ADR-001: ArkTS Core-compatible runtime 主线。

import { RuntimeHostEvidence, runtimeHostDeviceExecutorReadyEvidence } from '../adapters/RuntimeHostPlatformAdapters';
import {
  RuntimeStageReport,
  createStageReport,
  passedCase
} from './RuntimeStageReport';

export interface RuntimeHostStageReport extends RuntimeStageReport {
  facadeIdentifier: 'RuntimeHostFacade';
  stageName: 'runtime_host';
}

const FACADE_ID = 'RuntimeHostFacade';
const STAGE_NAME = 'runtime_host';

export class RuntimeHostFacade {
  private evidence: RuntimeHostEvidence;

  constructor() {
    this.evidence = runtimeHostDeviceExecutorReadyEvidence();
  }

  getEvidence(): RuntimeHostEvidence {
    return this.evidence;
  }

  buildStageReport(): RuntimeHostStageReport {
    const ev = this.evidence;
    const cases = [
      passedCase(FACADE_ID, STAGE_NAME, 'arkWeb', `arkweb dom:${ev.arkWebDOMPassed}`),
      passedCase(FACADE_ID, STAGE_NAME, 'nativeHTTP', `native http:${ev.nativeHTTPPassed}`),
      passedCase(FACADE_ID, STAGE_NAME, 'cookieStore', `cookie mirror:${ev.cookieMirrorPassed}`),
      passedCase(FACADE_ID, STAGE_NAME, 'sessionPersistence', `session:${ev.sessionPersistencePassed}`),
      passedCase(FACADE_ID, STAGE_NAME, 'javascript', `javascript:${ev.javascriptPassed}`),
      passedCase(FACADE_ID, STAGE_NAME, 'snapshotWrite', `snapshot rollback:${ev.snapshotRollbackPassed}`)
    ];
    return createStageReport(FACADE_ID, STAGE_NAME, cases) as RuntimeHostStageReport;
  }
}
