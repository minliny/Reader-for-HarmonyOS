// SearchError model — matches Core FailureType + SearchService errors
export enum SearchErrorCode {
  CONFIG_MISSING = 'CONFIG_MISSING',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  PARSE_ERROR = 'PARSE_ERROR',
  EMPTY_RESULT = 'EMPTY_RESULT',
  BRIDGE_UNAVAILABLE = 'BRIDGE_UNAVAILABLE',
  SOURCE_DISABLED = 'SOURCE_DISABLED',
  UNKNOWN = 'UNKNOWN'
}

export class SearchError extends Error {
  code: SearchErrorCode;
  sourceName?: string;
  context?: Record<string, string>;

  constructor(code: SearchErrorCode, message: string, sourceName?: string, context?: Record<string, string>) {
    super(message);
    this.name = 'SearchError';
    this.code = code;
    this.sourceName = sourceName;
    this.context = context;
  }

  static configMissing(field: string, sourceName?: string): SearchError {
    return new SearchError(SearchErrorCode.CONFIG_MISSING, `Missing config: ${field}`, sourceName, { field });
  }

  static networkError(detail: string, sourceName?: string): SearchError {
    return new SearchError(SearchErrorCode.NETWORK_ERROR, detail, sourceName);
  }

  static timeout(sourceName?: string): SearchError {
    return new SearchError(SearchErrorCode.TIMEOUT, 'Request timed out', sourceName);
  }

  static parseError(detail: string, sourceName?: string): SearchError {
    return new SearchError(SearchErrorCode.PARSE_ERROR, detail, sourceName);
  }

  static emptyResult(sourceName?: string): SearchError {
    return new SearchError(SearchErrorCode.EMPTY_RESULT, 'Search returned no results', sourceName);
  }

  static bridgeUnavailable(): SearchError {
    return new SearchError(SearchErrorCode.BRIDGE_UNAVAILABLE, 'Core bridge unavailable, fixture mode active');
  }

  static sourceDisabled(sourceName: string): SearchError {
    return new SearchError(SearchErrorCode.SOURCE_DISABLED, `Source disabled: ${sourceName}`, sourceName);
  }

  toRecord(): Record<string, string> {
    const r: Record<string, string> = {
      code: this.code,
      message: this.message
    };
    if (this.sourceName) { r['sourceName'] = this.sourceName; }
    if (this.context) {
      const keys = Object.keys(this.context);
      for (let i = 0; i < keys.length; i++) {
        r[keys[i]] = this.context[keys[i]];
      }
    }
    return r;
  }
}
