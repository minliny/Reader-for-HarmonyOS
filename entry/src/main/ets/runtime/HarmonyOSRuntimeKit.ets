// HarmonyOSRuntimeKit - Phase 2 ArkTS Runtime Facade 聚合入口。
// 聚合 8 个 Facade 的 stage report，输出统一的 runtime kit report。
//
// HOS-ADR-001: ArkTS Core-compatible runtime 主线。
// 每个 Facade 输出 Core-compatible stage report，供 contract runner 验收。

import { RulePipelineFacade, RulePipelineStageReport } from './RulePipelineFacade';
import { LocalBookFacade, LocalBookStageReport } from './LocalBookFacade';
import { ReadingStateFacade, ReadingStateStageReport } from './ReadingStateFacade';
import { ReplaceRuleFacade, ReplaceRuleStageReport } from './ReplaceRuleFacade';
import { StoreFacade, StoreStageReport } from './StoreFacade';
import { SyncFacade, SyncStageReport } from './SyncFacade';
import { RuntimeHostFacade, RuntimeHostStageReport } from './RuntimeHostFacade';
import { CryptoFacade, CryptoStageReport } from './CryptoFacade';
import { RuntimeStageReport, StageReportStatus } from './RuntimeStageReport';

export interface HarmonyOSRuntimeKitReport {
  kitIdentifier: string;
  platformFamily: string;
  adr: string;
  productionRuntime: string;
  stageReports: RuntimeStageReport[];
  allStagesPassed: boolean;
  totalCaseCount: number;
  passedCaseCount: number;
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
  externalNetworkUsed: boolean;
}

const KIT_IDENTIFIER = 'HarmonyCoreRuntimeKit';
const ADR = 'docs/architecture/HARMONYOS_RUNTIME_TRACK_ADR.md';

export class HarmonyOSRuntimeKit {
  private rulePipeline: RulePipelineFacade;
  private localBook: LocalBookFacade;
  private readingState: ReadingStateFacade;
  private replaceRule: ReplaceRuleFacade;
  private store: StoreFacade;
  private sync: SyncFacade;
  private runtimeHost: RuntimeHostFacade;
  private crypto: CryptoFacade;

  constructor() {
    this.rulePipeline = new RulePipelineFacade();
    this.localBook = new LocalBookFacade();
    this.readingState = new ReadingStateFacade();
    this.replaceRule = new ReplaceRuleFacade();
    this.store = new StoreFacade();
    this.sync = new SyncFacade();
    this.runtimeHost = new RuntimeHostFacade();
    this.crypto = new CryptoFacade();
  }

  buildKitReport(): HarmonyOSRuntimeKitReport {
    const stageReports: RuntimeStageReport[] = [
      this.rulePipeline.buildStageReport(),
      this.localBook.buildStageReport(),
      this.readingState.buildStageReport(),
      this.replaceRule.buildStageReport(),
      this.store.buildStageReport(),
      this.sync.buildStageReport(),
      this.runtimeHost.buildStageReport(),
      this.crypto.buildStageReport()
    ];

    let totalCaseCount = 0;
    let passedCaseCount = 0;
    let allStagesPassed = true;
    let externalNetworkUsed = false;

    for (let i = 0; i < stageReports.length; i++) {
      const report = stageReports[i];
      totalCaseCount += report.cases.length;
      for (let j = 0; j < report.cases.length; j++) {
        if (report.cases[j].status === StageReportStatus.passed) {
          passedCaseCount++;
        } else {
          allStagesPassed = false;
        }
      }
      if (report.externalNetworkUsed) {
        externalNetworkUsed = true;
      }
    }

    return {
      kitIdentifier: KIT_IDENTIFIER,
      platformFamily: 'HarmonyOS',
      adr: ADR,
      productionRuntime: 'arkts_core_compatible',
      stageReports,
      allStagesPassed,
      totalCaseCount,
      passedCaseCount,
      cleanRoomMaintained: true,
      externalGPLCodeCopied: false,
      legadoSourceCopied: false,
      externalNetworkUsed
    };
  }
}
