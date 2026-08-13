// SourceDebugTranscriptRecorder — short-lived, in-memory recorder for a
// single Core `source.check.run` transaction.
//
// `source.debug` is a replay command: it needs one real response body per
// stage, while `source.check.run` is the command that asks the Host to fetch
// those responses.  This recorder is deliberately private to the bridge.  It
// never writes bodies to AppStorage, preferences, files, or logs.  After the
// replay attempt it scrubs every captured body before being discarded.
import type { HostHttpRequest } from '../host/types/HostRequest';
import type { HostHttpResponse } from '../host/types/HostResult';

export type SourceDebugDiagnosticStage = 'L2' | 'L3' | 'L4' | 'L5';

export interface SourceDebugDiagnosticAnnotation {
  traceId: string;
  requestId: number;
  sourceId: string;
  stage: SourceDebugDiagnosticStage;
}

/** Safe stage-level projection.  It intentionally contains no response body,
 * request headers, or final URL. */
export interface SourceDebugStageProjection {
  stage: SourceDebugDiagnosticStage;
  requestCount: number;
  responseCount: number;
  selectedResponseIndex: number;
  statusCode: number;
  failed: boolean;
  failureMessage: string;
  replayLimited: boolean;
}

export interface SourceDebugReplayInput {
  sourceId: string;
  searchResponse: string;
  detailResponse: string;
  tocResponse: string;
  contentResponse: string;
}

export interface SourceDebugTranscriptProjection {
  sourceId: string;
  traceId: string;
  stages: SourceDebugStageProjection[];
  replayAvailable: boolean;
  replayLimited: boolean;
  replayNotice: string;
}

interface SourceDebugTranscriptEntry {
  stage: SourceDebugDiagnosticStage;
  // Stored only while the Core replay command is running.  Never project this
  // field into UI state or console output.
  body: string;
  statusCode: number;
  finalUrl: string;
  requestUrl: string;
  requestMethod: string;
  failureMessage: string;
}

const STAGES: SourceDebugDiagnosticStage[] = ['L2', 'L3', 'L4', 'L5'];

/**
 * Holds the annotated Host HTTP completions for exactly one source check.
 *
 * An instance is first registered by the Core command request id.  Core's
 * first annotated descriptor binds the opaque trace id; CoreRuntime then keys
 * the instance by `traceId + sourceId`, preventing an overlapping check from
 * contributing a response to the wrong replay.
 */
export class SourceDebugTranscriptRecorder {
  readonly commandRequestId: number;
  readonly sourceId: string;
  private readonly expiresAtMs: number;
  private traceId: string = '';
  private entries: SourceDebugTranscriptEntry[] = [];
  private disposed: boolean = false;

  constructor(commandRequestId: number, sourceId: string, expiresAtMs: number) {
    this.commandRequestId = commandRequestId;
    this.sourceId = sourceId;
    this.expiresAtMs = expiresAtMs;
  }

  trace(): string {
    return this.traceId;
  }

  isExpired(nowMs: number = Date.now()): boolean {
    return this.disposed || nowMs > this.expiresAtMs;
  }

  /** Validate both identities before binding any annotated descriptor. */
  accepts(annotation: SourceDebugDiagnosticAnnotation): boolean {
    if (this.disposed || this.isExpired()) return false;
    if (annotation.requestId !== this.commandRequestId || annotation.sourceId !== this.sourceId) return false;
    if (annotation.traceId.trim().length === 0) return false;
    if (this.traceId.length > 0 && this.traceId !== annotation.traceId) return false;
    return true;
  }

  bind(annotation: SourceDebugDiagnosticAnnotation): boolean {
    if (!this.accepts(annotation)) return false;
    if (this.traceId.length === 0) this.traceId = annotation.traceId;
    return true;
  }

  recordResponse(
    annotation: SourceDebugDiagnosticAnnotation,
    request: HostHttpRequest,
    response: HostHttpResponse,
  ): void {
    if (!this.bind(annotation)) return;
    const entry: SourceDebugTranscriptEntry = {
      stage: annotation.stage,
      body: response.body,
      statusCode: response.status,
      finalUrl: response.finalUrl ?? request.url,
      requestUrl: request.url,
      requestMethod: request.method,
      failureMessage: '',
    };
    this.entries.push(entry);
  }

  recordFailure(
    annotation: SourceDebugDiagnosticAnnotation,
    request: HostHttpRequest,
    message: string,
  ): void {
    if (!this.bind(annotation)) return;
    const entry: SourceDebugTranscriptEntry = {
      stage: annotation.stage,
      body: '',
      statusCode: 0,
      finalUrl: '',
      requestUrl: request.url,
      requestMethod: request.method,
      failureMessage: message,
    };
    this.entries.push(entry);
  }

  /**
   * The current Core DTO permits one body per stage.  For paginated L4/L5
   * chains, select the first non-empty completion without overwriting later
   * pages; `projection()` makes the resulting limited replay explicit.
   */
  replayInput(): SourceDebugReplayInput | null {
    if (this.disposed || this.isExpired()) return null;
    const search = this.selectedBody('L2');
    if (search.length === 0) return null;
    const input: SourceDebugReplayInput = {
      sourceId: this.sourceId,
      searchResponse: search,
      detailResponse: this.selectedBody('L3'),
      tocResponse: this.selectedBody('L4'),
      contentResponse: this.selectedBody('L5'),
    };
    return input;
  }

  projection(): SourceDebugTranscriptProjection {
    const stages: SourceDebugStageProjection[] = [];
    let replayLimited = false;
    const limitedStages: string[] = [];
    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i];
      const stageEntries = this.entriesFor(stage);
      let responseCount = 0;
      let selectedResponseIndex = -1;
      let statusCode = 0;
      let failureMessage = '';
      for (let j = 0; j < stageEntries.length; j++) {
        const entry = stageEntries[j];
        if (entry.failureMessage.length > 0) {
          failureMessage = entry.failureMessage;
          continue;
        }
        responseCount += 1;
        if (statusCode === 0) statusCode = entry.statusCode;
        if (selectedResponseIndex < 0 && entry.body.length > 0) {
          selectedResponseIndex = responseCount - 1;
        }
      }
      const stageLimited = (stage === 'L4' || stage === 'L5') && responseCount > 1;
      if (stageLimited) {
        replayLimited = true;
        limitedStages.push(`${stage} 收集到 ${responseCount} 份响应，仅重放第 ${selectedResponseIndex >= 0 ? selectedResponseIndex + 1 : 1} 份`);
      }
      const projection: SourceDebugStageProjection = {
        stage,
        requestCount: stageEntries.length,
        responseCount,
        selectedResponseIndex,
        statusCode,
        failed: failureMessage.length > 0,
        failureMessage,
        replayLimited: stageLimited,
      };
      stages.push(projection);
    }
    const replayAvailable = this.replayInput() !== null;
    const replayNotice = !replayAvailable
      ? '未收集到可供 source.debug 重放的 L2 真实响应。'
      : (replayLimited
        ? `当前 source.debug DTO 只支持每阶段一份响应；${limitedStages.join('；')}。`
        : '已按 Core 注解阶段收集真实响应；当前 DTO 每阶段重放一份响应。');
    const projection: SourceDebugTranscriptProjection = {
      sourceId: this.sourceId,
      traceId: this.traceId,
      stages,
      replayAvailable,
      replayLimited,
      replayNotice,
    };
    return projection;
  }

  /** Scrub response bodies and all transport references immediately after use. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      entry.body = '';
      entry.finalUrl = '';
      entry.requestUrl = '';
      entry.requestMethod = '';
      entry.failureMessage = '';
    }
    this.entries.length = 0;
    this.traceId = '';
  }

  private entriesFor(stage: SourceDebugDiagnosticStage): SourceDebugTranscriptEntry[] {
    const selected: SourceDebugTranscriptEntry[] = [];
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].stage === stage) selected.push(this.entries[i]);
    }
    return selected;
  }

  private selectedBody(stage: SourceDebugDiagnosticStage): string {
    const stageEntries = this.entriesFor(stage);
    for (let i = 0; i < stageEntries.length; i++) {
      if (stageEntries[i].body.length > 0) return stageEntries[i].body;
    }
    return '';
  }
}
