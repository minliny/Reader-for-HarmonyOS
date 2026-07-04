// UnifiedEvidenceArtifact - TypeScript interfaces matching the Core
// protocol/unified-evidence.schema.json (schemaVersion "unified-evidence/1").
//
// All cross-platform evidence harnesses (iOS / Android / HarmonyOS / CLI)
// emit this single schema so reports/tooling/ can compare parity. The
// HarmonyOS UnifiedEvidenceRunner produces this artifact; the Python
// validator at tools/platform-evidence-validator/platform_evidence_validator.py
// checks it against the JSON schema.
//
// Required root fields: schemaVersion, platform, tier, generatedAt,
// coreCommit, hostCommit, capabilities, summary.
// Optional root fields: device, hostRequestLoop, notes.

export const SCHEMA_VERSION: string = 'unified-evidence/1';

// 15 canonical capabilities — every artifact MUST include all 15.
export const CANONICAL_CAPABILITIES: string[] = [
  'source.import',
  'book.search',
  'book.detail',
  'book.toc',
  'chapter.content',
  'manga.pages.extract',
  'rss.parse',
  'local_book.parse',
  'reading.progress.update',
  'bookmark.crud',
  'tts.queue',
  'http-tts',
  'sync.webdav',
  'runtime.ping',
  'host.request'
];

// Status union for a single capability result. 'blocked' is counted as
// 'skipped' by computeSummary and by the Python validator.
export type CapabilityStatus = 'pass' | 'fail' | 'skipped' | 'blocked';

export type PlatformKind = 'ios' | 'android' | 'harmony' | 'cli';
export type TierKind = 'wrapper-smoke' | 'simulator' | 'device' | 'unknown';

export interface DeviceInfo {
  model: string;
  osVersion: string;
  arch: string;
}

export interface HostRequestRecord {
  capability: string;
  operationId: number;
  completed: boolean;
}

export interface CapabilityResult {
  capability: string;
  status: CapabilityStatus;
  method?: string;
  durationMs?: number;
  redactedEvidence?: string;
  error?: string;
  hostRequests?: HostRequestRecord[];
}

export interface EvidenceSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
}

export interface HostRequestLoopEvidence {
  requestId: number;
  capability: string;
  operationId: number;
  resultBookCount: number;
  durationMs: number;
}

export interface UnifiedEvidenceArtifact {
  schemaVersion: string;
  platform: PlatformKind;
  tier: TierKind;
  generatedAt: string;
  coreCommit: string;
  hostCommit: string;
  device?: DeviceInfo;
  capabilities: CapabilityResult[];
  summary: EvidenceSummary;
  hostRequestLoop?: HostRequestLoopEvidence;
  notes: string[];
}

// Recompute summary totals from `artifact.capabilities`. Per the schema and
// the Python validator, 'blocked' counts toward `skipped` (not `failed`).
// Mutates `artifact.summary` in place; returns void.
export function computeSummary(artifact: UnifiedEvidenceArtifact): void {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const caps = artifact.capabilities;
  for (let i = 0; i < caps.length; i++) {
    const status = caps[i].status;
    if (status === 'pass') {
      passed = passed + 1;
    } else if (status === 'fail') {
      failed = failed + 1;
    } else {
      // 'skipped' and 'blocked' both count as skipped (matches validator).
      skipped = skipped + 1;
    }
  }
  const total = caps.length;
  const passRate = total > 0 ? passed / total : 0;
  const summary: EvidenceSummary = {
    total,
    passed,
    failed,
    skipped,
    passRate
  };
  artifact.summary = summary;
}

// Serialize the artifact to a JSON string. The caller (runner / panel) is
// responsible for writing the result to the app's files dir for the shell
// harness to pull via hdc.
export function serializeArtifact(artifact: UnifiedEvidenceArtifact): string {
  return JSON.stringify(artifact);
}
