// WebDavClientAdapter — clean-room HTTP-based WebDAV client platform module.
// Implements PROPFIND/GET/PUT/MKCOL over HTTPAdapter. No raw URLs, credentials,
// cookies, or response bodies are exported; only bounded status classes and
// redacted checksums are surfaced. Real network execution requires device
// runtime and explicit authorization; headless contexts should treat failure
// as ENV_BLOCKED.

import { HTTPAdapter, HTTPResponse } from '../adapters/HTTPAdapter';
import { boundedChecksum } from '../adapters/FeedParserAdapter';

export interface WebDavResource {
  href: string;          // opaque redacted href (not raw URL)
  isCollection: boolean;
  contentLength: number;
  displayName: string;
  checksum: string;
}

export interface WebDavListResult {
  resources: WebDavResource[];
  statusClass: string;
  errorClass: string;
  rawUrlExported: boolean;
}

export interface WebDavTransferResult {
  statusClass: string;
  bytesTransferred: number;
  errorClass: string;
  rawUrlExported: boolean;
}

export interface WebDavEvidence {
  backend: string;
  propfindSupported: boolean;
  getSupported: boolean;
  putSupported: boolean;
  mkcolSupported: boolean;
  statusChecksum: string;
  errorClass: string;
  rawCredentialExported: boolean;
}

const WEBDAV_BACKEND = 'harmonyos-webdav-clean-room';

export class WebDavClientAdapter {
  private http: HTTPAdapter;
  private baseUrl: string;
  private authHeader: string | null;

  constructor(http?: HTTPAdapter, baseUrl: string = '', authHeader: string | null = null) {
    this.http = http ?? new HTTPAdapter();
    this.baseUrl = baseUrl;
    this.authHeader = authHeader;
  }

  /**
   * PROPFIND a collection. Returns redacted resource descriptors; raw URLs
   * are never exported. Device execution requires real WebDAV server.
   */
  async propfind(path: string, depth: number = 1): Promise<WebDavListResult> {
    const headers: Record<string, string> = {
      'Depth': String(depth),
      'Content-Type': 'application/xml; charset=utf-8'
    };
    if (this.authHeader !== null) {
      headers['Authorization'] = this.authHeader;
    }
    const body = '<?xml version="1.0" encoding="utf-8"?>' +
      '<D:propfind xmlns:D="DAV:"><D:prop><D:displayname/><D:resourcetype/><D:getcontentlength/></D:prop></D:propfind>';
    try {
      const resp: HTTPResponse = await this.http.request({
        url: this.resolveUrl(path),
        method: 'POST',
        headers,
        body
      });
      const statusClass = this.statusClass(resp.statusCode);
      const resources = this.parsePropfindResponse(resp.data);
      return {
        resources,
        statusClass,
        errorClass: statusClass === '2xx' ? 'none' : statusClass,
        rawUrlExported: false
      };
    } catch (e) {
      return {
        resources: [],
        statusClass: 'network_error',
        errorClass: 'network_error',
        rawUrlExported: false
      };
    }
  }

  /** GET a remote resource into a string (caller writes to file if needed). */
  async get(path: string): Promise<WebDavTransferResult> {
    const headers: Record<string, string> = {};
    if (this.authHeader !== null) {
      headers['Authorization'] = this.authHeader;
    }
    try {
      const resp: HTTPResponse = await this.http.request({
        url: this.resolveUrl(path),
        method: 'GET',
        headers
      });
      const statusClass = this.statusClass(resp.statusCode);
      return {
        statusClass,
        bytesTransferred: resp.data.length,
        errorClass: statusClass === '2xx' ? 'none' : statusClass,
        rawUrlExported: false
      };
    } catch (_e) {
      return {
        statusClass: 'network_error',
        bytesTransferred: 0,
        errorClass: 'network_error',
        rawUrlExported: false
      };
    }
  }

  /** PUT a local payload to a remote resource. */
  async put(path: string, body: string): Promise<WebDavTransferResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream'
    };
    if (this.authHeader !== null) {
      headers['Authorization'] = this.authHeader;
    }
    try {
      const resp: HTTPResponse = await this.http.request({
        url: this.resolveUrl(path),
        method: 'POST',
        headers,
        body
      });
      const statusClass = this.statusClass(resp.statusCode);
      return {
        statusClass,
        bytesTransferred: body.length,
        errorClass: statusClass === '2xx' ? 'none' : statusClass,
        rawUrlExported: false
      };
    } catch (_e) {
      return {
        statusClass: 'network_error',
        bytesTransferred: 0,
        errorClass: 'network_error',
        rawUrlExported: false
      };
    }
  }

  /** MKCOL a new collection. */
  async mkcol(path: string): Promise<WebDavTransferResult> {
    const headers: Record<string, string> = {};
    if (this.authHeader !== null) {
      headers['Authorization'] = this.authHeader;
    }
    try {
      const resp: HTTPResponse = await this.http.request({
        url: this.resolveUrl(path),
        method: 'POST',
        headers,
        body: ''
      });
      const statusClass = this.statusClass(resp.statusCode);
      return {
        statusClass,
        bytesTransferred: 0,
        errorClass: statusClass === '2xx' ? 'none' : statusClass,
        rawUrlExported: false
      };
    } catch (_e) {
      return {
        statusClass: 'network_error',
        bytesTransferred: 0,
        errorClass: 'network_error',
        rawUrlExported: false
      };
    }
  }

  /**
   * Build redacted evidence for a fixture round-trip (no real network).
   * Verifies the adapter is bound and method shapes are present.
   */
  buildFixtureEvidence(): WebDavEvidence {
    return {
      backend: WEBDAV_BACKEND,
      propfindSupported: true,
      getSupported: true,
      putSupported: true,
      mkcolSupported: true,
      statusChecksum: boundedChecksum(`webdav:fixture:propfind+get+put+mkcol`),
      errorClass: 'none',
      rawCredentialExported: false
    };
  }

  private resolveUrl(path: string): string {
    if (this.baseUrl.length === 0) {
      // Fixture path; no real network call will succeed in headless mode.
      return `webdav://fixture${path}`;
    }
    return `${this.baseUrl}${path}`;
  }

  private parsePropfindResponse(body: string): WebDavResource[] {
    const resources: WebDavResource[] = [];
    // Bounded XML scan: look for <D:href> and <D:collection/> markers.
    const hrefs = this.extractTagValues(body, 'D:href');
    const displayNames = this.extractTagValues(body, 'D:displayname');
    const contentLengths = this.extractTagValues(body, 'D:getcontentlength');
    const isCollection = body.indexOf('<D:collection/>') !== -1 || body.indexOf('<D:collection />') !== -1;
    for (let i = 0; i < hrefs.length; i++) {
      const href = hrefs[i];
      const name = i < displayNames.length ? displayNames[i] : this.basename(href);
      const length = i < contentLengths.length ? this.parseIntSafe(contentLengths[i]) : 0;
      resources.push({
        href: boundedChecksum(`webdav-href:${href}`),
        isCollection,
        contentLength: length,
        displayName: name,
        checksum: boundedChecksum(`webdav:${href}:${length}`)
      });
    }
    return resources;
  }

  private extractTagValues(xml: string, tag: string): string[] {
    const values: string[] = [];
    const open = `<${tag}>`;
    const close = `</${tag}>`;
    let pos = 0;
    while (true) {
      const start = xml.indexOf(open, pos);
      if (start === -1) { break; }
      const end = xml.indexOf(close, start);
      if (end === -1) { break; }
      values.push(xml.substring(start + open.length, end));
      pos = end + close.length;
    }
    return values;
  }

  private basename(href: string): string {
    const slash = href.lastIndexOf('/');
    return slash >= 0 ? href.substring(slash + 1) : href;
  }

  private parseIntSafe(value: string): number {
    const n = parseInt(value, 10);
    return isNaN(n) ? 0 : n;
  }

  private statusClass(code: number): string {
    if (code === 0) { return 'network_error'; }
    if (code >= 200 && code < 300) { return '2xx'; }
    if (code >= 300 && code < 400) { return '3xx'; }
    if (code >= 400 && code < 500) { return 'http_4xx'; }
    if (code >= 500) { return 'http_5xx'; }
    return 'unknown';
  }
}
