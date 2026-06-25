// HttpTtsContract — CONTRACT_ONLY HTTP TTS contract.
// HttpTTS requires URL template evaluation against a book source, which in
// turn requires a JS engine to evaluate source rules. Reader-Core does not
// expose a JS runtime; therefore HttpTTS URL template evaluation is
// CONTRACT_ONLY until Core provides a JS engine bridge.
//
// This module defines the contract shape and marks the Core JS dependency
// accurately. No playback is faked; no network requests are made.

import { boundedChecksum } from '../adapters/FeedParserAdapter';

export interface HttpTtsRequest {
  templateURL: string;      // opaque template (redacted in evidence)
  chapterContent: string;   // opaque content (redacted in evidence)
  voiceName?: string;
  speechRate?: number;
}

export interface HttpTtsResult {
  audioBytes: Uint8Array;
  mimeType: string;
  durationMs: number;
  checksum: string;
}

export interface HttpTtsEvidence {
  backend: string;
  contractDefined: boolean;
  coreJsEngineAvailable: boolean;
  urlTemplateResolved: boolean;
  playbackFaked: boolean;
  errorClass: string;
  rawUrlExported: boolean;
}

export const HTTP_TTS_CONTRACT_ONLY_REASON = 'Core JS engine not available for URL template evaluation';

/**
 * HttpTtsContractAdapter — contract-only adapter. Real playback requires:
 * 1. Core JS engine bridge to evaluate book-source URL templates
 * 2. HTTP download of the resulting audio URL
 * 3. Platform media playback (AudiobookPlayerAdapter)
 *
 * Until Core JS engine is available, this adapter returns CONTRACT_ONLY
 * evidence and never fakes playback.
 */
export class HttpTtsContractAdapter {
  /**
   * Evaluate an HttpTTS request. Always returns CONTRACT_ONLY evidence because
   * Core JS engine is not available for URL template evaluation.
   */
  async synthesize(request: HttpTtsRequest): Promise<HttpTtsResult> {
    // CONTRACT_ONLY: no real synthesis is performed.
    return {
      audioBytes: new Uint8Array(0),
      mimeType: 'audio/contract-only',
      durationMs: 0,
      checksum: boundedChecksum(`http-tts:contract-only:${request.templateURL.length}`)
    };
  }

  /**
   * Build redacted evidence for the contract. Marks the Core JS dependency
   * accurately and never claims playback succeeded.
   */
  buildContractEvidence(): HttpTtsEvidence {
    return {
      backend: 'harmonyos-http-tts-contract-only',
      contractDefined: true,
      coreJsEngineAvailable: false,
      urlTemplateResolved: false,
      playbackFaked: false,
      errorClass: 'core_js_engine_missing',
      rawUrlExported: false
    };
  }

  /** Returns the reason this adapter is CONTRACT_ONLY. */
  contractOnlyReason(): string {
    return HTTP_TTS_CONTRACT_ONLY_REASON;
  }
}
