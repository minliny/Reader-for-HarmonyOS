// FeedParserAdapter - clean-room RSS/Atom/JSON Feed parser for offline adapter evidence.
// It parses bounded local fixtures only. Cookie/login/JS-rendered feeds remain runtime-gated.

export enum FeedFormat {
  rss = 'rss',
  atom = 'atom',
  jsonFeed = 'json-feed',
  unknown = 'unknown'
}

export interface FeedEntry {
  id: string;
  title: string;
  url?: string;
  summary?: string;
  content?: string;
  author?: string;
  published?: string;
  categories: string[];
  attachments: number;
}

export interface FeedParseResult {
  format: FeedFormat;
  feedTitle: string;
  entries: FeedEntry[];
  paginationLinks: string[];
  categories: string[];
  hasCookieLoginDiagnostic: boolean;
  extensionMetadataKeys: string[];
  diagnostics: string[];
}

export class FeedParserAdapter {
  parse(input: string): FeedParseResult {
    const trimmed = input.trim();
    if (trimmed.indexOf('{') === 0) {
      return this.parseJSONFeed(trimmed);
    }
    if (trimmed.indexOf('<feed') !== -1) {
      return this.parseAtom(trimmed);
    }
    if (trimmed.indexOf('<rss') !== -1 || trimmed.indexOf('<channel') !== -1) {
      return this.parseRSS(trimmed);
    }
    return this.empty(FeedFormat.unknown, ['unknown-feed-format']);
  }

  private parseRSS(input: string): FeedParseResult {
    const channel = this.first(input, '<channel', '</channel>') ?? input;
    const items = this.blocks(channel, '<item', '</item>');
    const entries: FeedEntry[] = [];
    const categories = this.values(channel, 'category');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      entries.push({
        id: this.value(item, 'guid') || this.value(item, 'link') || `rss-item-${i}`,
        title: this.value(item, 'title') || `RSS item ${i + 1}`,
        url: this.value(item, 'link'),
        summary: this.value(item, 'description'),
        content: this.value(item, 'content:encoded'),
        author: this.value(item, 'author') || this.value(item, 'dc:creator'),
        published: this.value(item, 'pubDate'),
        categories: this.values(item, 'category'),
        attachments: this.countTag(item, 'enclosure')
      });
    }
    return {
      format: FeedFormat.rss,
      feedTitle: this.value(channel, 'title') || 'Untitled RSS feed',
      entries,
      paginationLinks: this.linkRels(input, ['next', 'self']),
      categories,
      hasCookieLoginDiagnostic: this.hasCookieLoginBoundary(input),
      extensionMetadataKeys: this.extensionKeys(input),
      diagnostics: []
    };
  }

  private parseAtom(input: string): FeedParseResult {
    const entries = this.blocks(input, '<entry', '</entry>');
    const parsed: FeedEntry[] = [];
    const categories = this.atomCategoryTerms(input);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      parsed.push({
        id: this.value(entry, 'id') || this.atomLink(entry, 'alternate') || `atom-entry-${i}`,
        title: this.value(entry, 'title') || `Atom entry ${i + 1}`,
        url: this.atomLink(entry, 'alternate'),
        summary: this.value(entry, 'summary'),
        content: this.value(entry, 'content'),
        author: this.first(entry, '<name', '</name>') ?? undefined,
        published: this.value(entry, 'published') || this.value(entry, 'updated'),
        categories: this.atomCategoryTerms(entry),
        attachments: this.countAttribute(entry, 'rel="enclosure"')
      });
    }
    return {
      format: FeedFormat.atom,
      feedTitle: this.value(input, 'title') || 'Untitled Atom feed',
      entries: parsed,
      paginationLinks: this.linkRels(input, ['next', 'self']),
      categories,
      hasCookieLoginDiagnostic: this.hasCookieLoginBoundary(input),
      extensionMetadataKeys: this.extensionKeys(input),
      diagnostics: []
    };
  }

  private parseJSONFeed(input: string): FeedParseResult {
    try {
      const json = JSON.parse(input) as Record<string, Object>;
      const rawItems = Array.isArray(json['items']) ? json['items'] as Object[] : [];
      const entries: FeedEntry[] = [];
      for (let i = 0; i < rawItems.length; i++) {
        const item = rawItems[i] as Record<string, Object>;
        entries.push({
          id: this.asString(item['id']) || this.asString(item['url']) || `json-feed-item-${i}`,
          title: this.asString(item['title']) || `JSON Feed item ${i + 1}`,
          url: this.asString(item['url']) || this.asString(item['external_url']),
          summary: this.asString(item['summary']),
          content: this.asString(item['content_text']) || this.asString(item['content_html']),
          author: this.jsonAuthor(item),
          published: this.asString(item['date_published']) || this.asString(item['date_modified']),
          categories: this.stringArray(item['tags']),
          attachments: Array.isArray(item['attachments']) ? (item['attachments'] as Object[]).length : 0
        });
      }
      return {
        format: FeedFormat.jsonFeed,
        feedTitle: this.asString(json['title']) || 'Untitled JSON feed',
        entries,
        paginationLinks: this.jsonPagination(json),
        categories: this.stringArray(json['tags']),
        hasCookieLoginDiagnostic: this.hasCookieLoginBoundary(input),
        extensionMetadataKeys: this.jsonExtensionKeys(json),
        diagnostics: []
      };
    } catch (_e) {
      return this.empty(FeedFormat.jsonFeed, ['json-feed-parse-failed']);
    }
  }

  private empty(format: FeedFormat, diagnostics: string[]): FeedParseResult {
    return {
      format,
      feedTitle: '',
      entries: [],
      paginationLinks: [],
      categories: [],
      hasCookieLoginDiagnostic: false,
      extensionMetadataKeys: [],
      diagnostics
    };
  }

  private blocks(input: string, open: string, close: string): string[] {
    const results: string[] = [];
    let cursor = 0;
    while (cursor < input.length) {
      const start = input.indexOf(open, cursor);
      if (start < 0) { break; }
      const tagEnd = input.indexOf('>', start);
      if (tagEnd < 0) { break; }
      const end = input.indexOf(close, tagEnd + 1);
      if (end < 0) { break; }
      results.push(input.substring(tagEnd + 1, end));
      cursor = end + close.length;
    }
    return results;
  }

  private first(input: string, open: string, close: string): string | null {
    const start = input.indexOf(open);
    if (start < 0) { return null; }
    const tagEnd = input.indexOf('>', start);
    if (tagEnd < 0) { return null; }
    const end = input.indexOf(close, tagEnd + 1);
    if (end < 0) { return null; }
    return this.clean(input.substring(tagEnd + 1, end));
  }

  private value(input: string, tag: string): string {
    return this.first(input, `<${tag}`, `</${tag}>`) ?? '';
  }

  private values(input: string, tag: string): string[] {
    const values: string[] = [];
    const blocks = this.blocks(input, `<${tag}`, `</${tag}>`);
    for (let i = 0; i < blocks.length; i++) {
      const value = this.clean(blocks[i]);
      if (value.length > 0) {
        values.push(value);
      }
    }
    return values;
  }

  private linkRels(input: string, rels: string[]): string[] {
    const links: string[] = [];
    for (let i = 0; i < rels.length; i++) {
      const rel = rels[i];
      const marker = `rel="${rel}"`;
      let cursor = 0;
      while (cursor < input.length) {
        const relIndex = input.indexOf(marker, cursor);
        if (relIndex < 0) { break; }
        const tagStart = input.lastIndexOf('<link', relIndex);
        const tagEnd = input.indexOf('>', relIndex);
        if (tagStart >= 0 && tagEnd > tagStart) {
          const tag = input.substring(tagStart, tagEnd + 1);
          const href = this.attr(tag, 'href');
          if (href.length > 0) {
            links.push(`${rel}:REDACTED:${boundedChecksum(href)}`);
          }
        }
        cursor = relIndex + marker.length;
      }
    }
    return links;
  }

  private atomLink(input: string, rel: string): string | undefined {
    const marker = `rel="${rel}"`;
    const relIndex = input.indexOf(marker);
    if (relIndex < 0) { return undefined; }
    const tagStart = input.lastIndexOf('<link', relIndex);
    const tagEnd = input.indexOf('>', relIndex);
    if (tagStart < 0 || tagEnd <= tagStart) { return undefined; }
    const href = this.attr(input.substring(tagStart, tagEnd + 1), 'href');
    return href.length > 0 ? href : undefined;
  }

  private atomCategoryTerms(input: string): string[] {
    const terms: string[] = [];
    let cursor = 0;
    while (cursor < input.length) {
      const start = input.indexOf('<category', cursor);
      if (start < 0) { break; }
      const end = input.indexOf('>', start);
      if (end < 0) { break; }
      const term = this.attr(input.substring(start, end + 1), 'term');
      if (term.length > 0) { terms.push(term); }
      cursor = end + 1;
    }
    return terms;
  }

  private attr(tag: string, name: string): string {
    const marker = `${name}="`;
    const start = tag.indexOf(marker);
    if (start < 0) { return ''; }
    const valueStart = start + marker.length;
    const end = tag.indexOf('"', valueStart);
    if (end < 0) { return ''; }
    return tag.substring(valueStart, end);
  }

  private countTag(input: string, tag: string): number {
    return this.countAttribute(input, `<${tag}`);
  }

  private countAttribute(input: string, marker: string): number {
    let count = 0;
    let cursor = 0;
    while (cursor < input.length) {
      const index = input.indexOf(marker, cursor);
      if (index < 0) { break; }
      count++;
      cursor = index + marker.length;
    }
    return count;
  }

  private hasCookieLoginBoundary(input: string): boolean {
    const lower = input.toLowerCase();
    return lower.indexOf('cookie') !== -1 || lower.indexOf('login') !== -1 || lower.indexOf('javascript') !== -1;
  }

  private extensionKeys(input: string): string[] {
    const keys: string[] = [];
    if (input.indexOf('media:') !== -1) { keys.push('media'); }
    if (input.indexOf('dc:') !== -1) { keys.push('dc'); }
    if (input.indexOf('content:') !== -1) { keys.push('content'); }
    return keys;
  }

  private jsonExtensionKeys(json: Record<string, Object>): string[] {
    const keys = Object.keys(json);
    const extensions: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('_') === 0) {
        extensions.push(keys[i]);
      }
    }
    return extensions;
  }

  private jsonPagination(json: Record<string, Object>): string[] {
    const pagination: string[] = [];
    const next = this.asString(json['next_url']);
    if (next.length > 0) {
      pagination.push(`next:REDACTED:${boundedChecksum(next)}`);
    }
    const home = this.asString(json['home_page_url']);
    if (home.length > 0) {
      pagination.push(`home:REDACTED:${boundedChecksum(home)}`);
    }
    return pagination;
  }

  private jsonAuthor(item: Record<string, Object>): string | undefined {
    const author = item['author'];
    if (author && typeof author === 'object') {
      return this.asString((author as Record<string, Object>)['name']) || undefined;
    }
    const authors = item['authors'];
    if (Array.isArray(authors) && authors.length > 0) {
      const first = authors[0] as Record<string, Object>;
      return this.asString(first['name']) || undefined;
    }
    return undefined;
  }

  private stringArray(value: Object | undefined): string[] {
    if (!Array.isArray(value)) { return []; }
    const result: string[] = [];
    const values = value as Object[];
    for (let i = 0; i < values.length; i++) {
      const text = this.asString(values[i]);
      if (text.length > 0) {
        result.push(text);
      }
    }
    return result;
  }

  private asString(value: Object | undefined): string {
    if (value === undefined || value === null) { return ''; }
    return String(value);
  }

  private clean(value: string): string {
    return value
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

export function boundedChecksum(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
}
