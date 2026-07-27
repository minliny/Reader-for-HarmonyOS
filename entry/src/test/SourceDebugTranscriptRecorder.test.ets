// Focused tests for the private source.debug recorder boundary. These tests
// prove the transcript remains trace/source isolated and that only the
// single-page replay DTO is exposed before every raw body is scrubbed.
import { describe, it, expect } from '@ohos/hypium';
import {
  SourceDebugTranscriptRecorder,
  type SourceDebugDiagnosticAnnotation,
} from '../main/ets/bridge/SourceDebugTranscriptRecorder';
import type { HostHttpRequest } from '../main/ets/host/types/HostRequest';
import type { HostHttpResponse } from '../main/ets/host/types/HostResult';

function request(url: string): HostHttpRequest {
  return { url, method: 'GET', headers: {} };
}

function response(body: string, status: number = 200): HostHttpResponse {
  return { body, status, finalUrl: 'https://final.example/path' };
}

function annotation(stage: 'L2' | 'L3' | 'L4' | 'L5'): SourceDebugDiagnosticAnnotation {
  return {
    traceId: 'source.check.run:77:1',
    requestId: 77,
    sourceId: 'source-a',
    stage,
  };
}

export default function SourceDebugTranscriptRecorderTests(): void {
  describe('SourceDebugTranscriptRecorder', () => {
    it('keepsResponsesIsolatedByCommandTraceAndSourceAndFlagsPaginationReplay', 0, () => {
      const recorder = new SourceDebugTranscriptRecorder(77, 'source-a', Date.now() + 5000);
      const foreign: SourceDebugDiagnosticAnnotation = {
        traceId: 'source.check.run:77:1', requestId: 77, sourceId: 'source-b', stage: 'L2',
      };
      recorder.recordResponse(foreign, request('https://foreign.example'), response('foreign'));
      recorder.recordResponse(annotation('L2'), request('https://search.example'), response('search-body'));
      recorder.recordResponse(annotation('L3'), request('https://detail.example'), response('detail-body'));
      recorder.recordResponse(annotation('L4'), request('https://toc-1.example'), response('toc-page-1'));
      recorder.recordResponse(annotation('L4'), request('https://toc-2.example'), response('toc-page-2'));
      recorder.recordFailure(annotation('L5'), request('https://content.example'), 'HTTP_TRANSPORT_TIMEOUT');

      const replay = recorder.replayInput();
      expect(replay !== null).assertTrue();
      if (replay !== null) {
        expect(replay.sourceId).assertEqual('source-a');
        expect(replay.searchResponse).assertEqual('search-body');
        expect(replay.detailResponse).assertEqual('detail-body');
        expect(replay.tocResponse).assertEqual('toc-page-1');
        expect(replay.contentResponse).assertEqual('');
      }

      const safe = recorder.projection();
      expect(safe.sourceId).assertEqual('source-a');
      expect(safe.traceId).assertEqual('source.check.run:77:1');
      expect(safe.replayLimited).assertTrue();
      expect(safe.stages[0].responseCount).assertEqual(1);
      expect(safe.stages[2].responseCount).assertEqual(2);
      expect(safe.stages[2].replayLimited).assertTrue();
      expect(safe.stages[3].failed).assertTrue();
      expect(safe.stages[3].failureMessage).assertEqual('HTTP_TRANSPORT_TIMEOUT');
      // Projection does not declare a raw response-body field.
      const fields = safe as Object as Record<string, Object>;
      expect(fields['body'] === undefined).assertTrue();
      recorder.dispose();
    });

    it('expiresAndScrubsBodiesAfterReplayLifecycle', 0, () => {
      const recorder = new SourceDebugTranscriptRecorder(88, 'source-a', Date.now() + 5000);
      const l2: SourceDebugDiagnosticAnnotation = {
        traceId: 'source.check.run:88:1', requestId: 88, sourceId: 'source-a', stage: 'L2',
      };
      recorder.recordResponse(l2, request('https://search.example'), response('private-body'));
      expect(recorder.replayInput() !== null).assertTrue();
      recorder.dispose();
      expect(recorder.replayInput()).assertEqual(null);
      const projection = recorder.projection();
      expect(projection.traceId).assertEqual('');
      expect(projection.stages[0].responseCount).assertEqual(0);

      const expired = new SourceDebugTranscriptRecorder(99, 'source-a', Date.now() - 1);
      expect(expired.isExpired()).assertTrue();
      expect(expired.replayInput()).assertEqual(null);
    });
  });
}
