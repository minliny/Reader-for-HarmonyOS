// AuthorizedCorpusLiveExecutionService - live public-domain corpus execution evidence.
// The runner keeps raw URLs and response bodies out of exported evidence.

import { boundedChecksum } from '../adapters/FeedParserAdapter';
import { HTTPAdapter, HTTPResponse } from '../adapters/HTTPAdapter';
import { readerRuntimeNetworkConfig } from './RuntimeNetworkConfig';

export interface AuthorizedCorpusStepEvidence {
  step: string;
  statusCode: number;
  statusClass: string;
  passed: boolean;
  lengthBucket: string;
}

export interface AuthorizedCorpusLiveExecutionSnapshot {
  executedTargetCount: number;
  fullChainPassed: boolean;
  searchResultCount: number;
  externalNetworkUsed: boolean;
  rawURLExported: boolean;
  rawResponseBodyExported: boolean;
  rawCredentialValueExported: boolean;
  proxyConfigured: boolean;
  proxyHostHash: string;
  proxyPort: number;
  targetHostHashes: string[];
  steps: AuthorizedCorpusStepEvidence[];
  checksum: string;
  redactedAuditEntry: string;
  errorClass: string;
}

interface GutendexAuthor {
  name: string;
}

interface GutendexBook {
  title: string;
  authors?: GutendexAuthor[];
  formats: Record<string, string>;
}

interface GutendexSearchResponse {
  count: number;
  results: GutendexBook[];
}

export class AuthorizedCorpusLiveExecutionService {
  private readonly searchURL: string = 'https://gutendex.com/books/?search=alice';
  private readonly requestTimeoutMs: number = 60000;

  async runPublicDomainBookChain(): Promise<AuthorizedCorpusLiveExecutionSnapshot> {
    const client = new HTTPAdapter(this.requestTimeoutMs, readerRuntimeNetworkConfig.currentHTTPProxy());
    const steps: AuthorizedCorpusStepEvidence[] = [];
    let searchResultCount = 0;
    const targetHostHashes: string[] = [this.hostHash(this.searchURL)];
    let errorClass = 'none';

    try {
      const headers: Record<string, string> = {};
      headers['accept'] = 'application/json';
      const searchResponse = await client.get(this.searchURL, headers);
      const searchStep = this.step('search', searchResponse, searchResponse.data.length > 0);
      steps.push(searchStep);

      const parsed = JSON.parse(searchResponse.data) as GutendexSearchResponse;
      searchResultCount = parsed.results.length;
      const first = parsed.results.length > 0 ? parsed.results[0] : null;
      const contentURL = first ? this.selectContentURL(first.formats) : '';
      if (contentURL.length === 0) {
        errorClass = 'content_url_missing';
        return this.snapshot(steps, searchResultCount, targetHostHashes, errorClass);
      }

      targetHostHashes.push(this.hostHash(contentURL));
      const contentHeaders: Record<string, string> = {};
      contentHeaders['accept'] = 'text/plain,text/html';
      const contentResponse = await client.get(contentURL, contentHeaders);
      steps.push(this.step('content', contentResponse, contentResponse.data.length > 1024));
      return this.snapshot(steps, searchResultCount, targetHostHashes, errorClass);
    } catch (e) {
      errorClass = this.errorClass(e);
      return this.snapshot(steps, searchResultCount, targetHostHashes, errorClass);
    } finally {
      client.destroy();
    }
  }

  private selectContentURL(formats: Record<string, string>): string {
    const preferred = [
      'text/plain; charset=utf-8',
      'text/plain; charset=us-ascii',
      'text/html'
    ];
    for (let i = 0; i < preferred.length; i++) {
      const url = formats[preferred[i]];
      if (url !== undefined && url.length > 0) {
        return url;
      }
    }
    const keys = Object.keys(formats);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key.indexOf('text/plain') !== -1 || key.indexOf('text/html') !== -1) {
        return formats[key];
      }
    }
    return '';
  }

  private step(step: string, response: HTTPResponse, bodyPredicate: boolean): AuthorizedCorpusStepEvidence {
    const statusClass = this.statusClass(response.statusCode);
    return {
      step,
      statusCode: response.statusCode,
      statusClass,
      passed: response.statusCode >= 200 && response.statusCode < 300 && bodyPredicate,
      lengthBucket: this.lengthBucket(response.data.length)
    };
  }

  private snapshot(
    steps: AuthorizedCorpusStepEvidence[],
    searchResultCount: number,
    targetHostHashes: string[],
    errorClass: string
  ): AuthorizedCorpusLiveExecutionSnapshot {
    const passed = steps.length === 2 && steps.every((item: AuthorizedCorpusStepEvidence) => item.passed);
    const stepSummary = steps.map((item: AuthorizedCorpusStepEvidence) => `${item.step}:${item.statusClass}:${item.lengthBucket}`).join('|');
    const networkSnapshot = readerRuntimeNetworkConfig.snapshot();
    return {
      executedTargetCount: steps.length,
      fullChainPassed: passed,
      searchResultCount,
      externalNetworkUsed: steps.length > 0,
      rawURLExported: false,
      rawResponseBodyExported: false,
      rawCredentialValueExported: false,
      proxyConfigured: networkSnapshot.proxyConfigured,
      proxyHostHash: networkSnapshot.proxyHostHash,
      proxyPort: networkSnapshot.proxyPort,
      targetHostHashes,
      steps,
      checksum: boundedChecksum(`${stepSummary}|results:${searchResultCount}|hosts:${targetHostHashes.join(',')}|proxy:${networkSnapshot.proxyHostHash}:${networkSnapshot.proxyPort}|${errorClass}`),
      redactedAuditEntry: `authorized_corpus chain:${passed} steps:${steps.length} results:${searchResultCount} values:REDACTED`,
      errorClass
    };
  }

  private statusClass(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) {
      return '2xx';
    }
    if (statusCode >= 300 && statusCode < 400) {
      return '3xx';
    }
    if (statusCode >= 400 && statusCode < 500) {
      return '4xx';
    }
    if (statusCode >= 500 && statusCode < 600) {
      return '5xx';
    }
    return 'network_error';
  }

  private lengthBucket(length: number): string {
    if (length <= 0) {
      return 'empty';
    }
    if (length < 1024) {
      return 'lt_1k';
    }
    if (length < 65536) {
      return 'lt_64k';
    }
    return 'gte_64k';
  }

  private hostHash(url: string): string {
    let rest = url;
    const schemeIndex = rest.indexOf('://');
    if (schemeIndex !== -1) {
      rest = rest.substring(schemeIndex + 3);
    }
    const slashIndex = rest.indexOf('/');
    const host = slashIndex === -1 ? rest : rest.substring(0, slashIndex);
    return boundedChecksum(`host:${host}`);
  }

  private errorClass(e: Object): string {
    const text = JSON.stringify(e);
    if (text.indexOf('NETWORK_ERROR') !== -1) {
      return 'network_error';
    }
    if (text.indexOf('JSON') !== -1 || text.indexOf('parse') !== -1) {
      return 'parse_error';
    }
    if (text.length === 0) {
      return 'unknown';
    }
    return 'corpus_error';
  }
}

export const readerAuthorizedCorpusLiveExecution = new AuthorizedCorpusLiveExecutionService();
