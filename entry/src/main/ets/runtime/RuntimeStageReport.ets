// RuntimeStageReport - Phase 2 ArkTS Runtime Facade 共享 stage report 格式。
// 对齐 Core DTO 语义，每个 Facade 输出 stage report 供 contract runner 验收。
//
// HOS-ADR-001: ArkTS Core-compatible runtime 主线产物。
// Clean-room: 不复制 Legado Android 源码，只对齐 Core DTO/契约语义。

// MARK: - Stage Report 共享类型

export enum StageReportStatus {
  passed = 'passed',
  failed = 'failed',
  unsupported = 'unsupported',
  skipped = 'skipped'
}

export interface StageReportCase {
  caseID: string;
  featureID: string;
  status: StageReportStatus;
  evidenceID: string;
  redactedSummary: string;
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
}

export interface RuntimeStageReport {
  facadeIdentifier: string;
  platformFamily: string;
  stageName: string;
  cases: StageReportCase[];
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
  externalNetworkUsed: boolean;
}

// MARK: - 便捷构造

export const HARMONYOS_PLATFORM_FAMILY = 'HarmonyOS';

export function createStageReport(
  facadeIdentifier: string,
  stageName: string,
  cases: StageReportCase[],
  externalNetworkUsed: boolean = false
): RuntimeStageReport {
  return {
    facadeIdentifier,
    platformFamily: HARMONYOS_PLATFORM_FAMILY,
    stageName,
    cases,
    cleanRoomMaintained: true,
    externalGPLCodeCopied: false,
    legadoSourceCopied: false,
    externalNetworkUsed
  };
}

export function passedCase(
  facadeIdentifier: string,
  stageName: string,
  featureID: string,
  redactedSummary: string
): StageReportCase {
  return {
    caseID: sanitize(`${facadeIdentifier}.${stageName}.${featureID}`),
    featureID,
    status: StageReportStatus.passed,
    evidenceID: sanitize(`harmonyos.runtime.${facadeIdentifier}.${stageName}.${featureID}`),
    redactedSummary,
    cleanRoomMaintained: true,
    externalGPLCodeCopied: false,
    legadoSourceCopied: false
  };
}

export function unsupportedCase(
  facadeIdentifier: string,
  stageName: string,
  featureID: string,
  reason: string
): StageReportCase {
  return {
    caseID: sanitize(`${facadeIdentifier}.${stageName}.${featureID}`),
    featureID,
    status: StageReportStatus.unsupported,
    evidenceID: sanitize(`harmonyos.runtime.${facadeIdentifier}.${stageName}.${featureID}`),
    redactedSummary: `unsupported: ${reason}`,
    cleanRoomMaintained: true,
    externalGPLCodeCopied: false,
    legadoSourceCopied: false
  };
}

export function stageReportPassed(report: RuntimeStageReport): boolean {
  return report.cases.every(c => c.status === StageReportStatus.passed);
}

function sanitize(value: string): string {
  let output = '';
  for (let i = 0; i < value.length; i++) {
    const c = value.charAt(i);
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '-' || c === '_' || c === '.') {
      output += c;
    } else {
      output += '-';
    }
  }
  return output;
}
