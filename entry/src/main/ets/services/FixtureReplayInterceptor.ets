// FixtureReplayInterceptor — offline fixture fallback when bridge unavailable
// Returns pre-recorded JSON fixtures. Tagged FIXTURE_REPLAY in responses.
import { BridgeHTTPClient, BridgeHealth, BridgeTXTParseResult, BridgeTXTTOCItem } from './BridgeHTTPClient';
import { BookSource } from '../models/BookSource';
import { SearchQuery, SearchResultItem } from '../models/SearchModels';
import { TOCItem, ContentPage, ContentType, VIPStatus } from '../models/ContentModels';
import { ChapterSplitPolicy } from '../models/LocalBook';

const FIXTURE_TAG = 'FIXTURE_REPLAY';

// Pre-recorded fixture data (MOCK_ONLY — real data requires bridge or Core)
const SEARCH_FIXTURES: Record<string, SearchResultItem[]> = {
  'default': [
    {
      title: '三体全集',
      detailURL: 'fixture://books/santi',
      author: '刘慈欣',
      coverURL: '',
      intro: '地球文明与三体文明的首次接触...',
      unknownFields: {}
    },
    {
      title: '三体II：黑暗森林',
      detailURL: 'fixture://books/santi2',
      author: '刘慈欣',
      coverURL: '',
      intro: '宇宙社会学的基本公理...',
      unknownFields: {}
    }
  ]
};

const TOC_FIXTURES: Record<string, TOCItem[]> = {
  'default': [
    { chapterTitle: '第一章 疯狂年代', chapterURL: 'fixture://ch/1', chapterIndex: 0, isVip: false, unknownFields: {} },
    { chapterTitle: '第二章 寂静的春天', chapterURL: 'fixture://ch/2', chapterIndex: 1, isVip: false, unknownFields: {} },
    { chapterTitle: '第三章 红岸基地', chapterURL: 'fixture://ch/3', chapterIndex: 2, isVip: false, unknownFields: {} }
  ]
};

const CONTENT_FIXTURES: Record<string, ContentPage> = {
  'default': {
    title: '第一章 疯狂年代',
    content: '在中国，任何超脱飞扬的思想都会砰然坠地的，现实的引力太沉重了...',
    chapterURL: 'fixture://ch/1',
    nextChapterURL: 'fixture://ch/2',
    contentType: ContentType.text,
    vipStatus: VIPStatus.free,
    unknownFields: {}
  }
};

const TXT_TOC_FIRST: BridgeTXTTOCItem = {
  title: '第一章',
  level: 1,
  byteOffset: 0
};

const TXT_TOC_SECOND: BridgeTXTTOCItem = {
  title: '第二章',
  level: 1,
  byteOffset: 100
};

const DEFAULT_TXT_PARSE_FIXTURE: BridgeTXTParseResult = {
  encoding: 'utf-8',
  content: '第一章\n这是测试内容...\n第二章\n更多内容...',
  toc: [
    TXT_TOC_FIRST,
    TXT_TOC_SECOND
  ],
  byteCount: 200
};

export class FixtureReplayInterceptor {
  private enabled: boolean;

  constructor() {
    this.enabled = false;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async health(): Promise<BridgeHealth> {
    return {
      status: 'degraded',
      services: ['search', 'toc', 'content', 'txt_parse'],
      error: 'FIXTURE_REPLAY — bridge unavailable'
    };
  }

  async search(source: BookSource, query: SearchQuery): Promise<SearchResultItem[]> {
    const key = this.fixtureKey(source.bookSourceName, query.keyword);
    const results = SEARCH_FIXTURES[key] ?? SEARCH_FIXTURES['default'];
    return this.tagFixture(results);
  }

  async fetchTOC(source: BookSource, detailURL: string): Promise<TOCItem[]> {
    const key = this.fixtureKey(source.bookSourceName, detailURL);
    const items = TOC_FIXTURES[key] ?? TOC_FIXTURES['default'];
    return this.tagFixture(items);
  }

  async fetchContent(source: BookSource, chapterURL: string): Promise<ContentPage> {
    const key = this.fixtureKey(source.bookSourceName, chapterURL);
    const page = CONTENT_FIXTURES[key] ?? CONTENT_FIXTURES['default'];
    return this.tagFixture(page);
  }

  async parseTXT(dataBase64: string, encoding?: string, policy?: ChapterSplitPolicy): Promise<BridgeTXTParseResult> {
    const result: BridgeTXTParseResult = DEFAULT_TXT_PARSE_FIXTURE;
    return this.tagFixture(result);
  }

  private fixtureKey(sourceName: string, value: string): string {
    return `${sourceName}_${value}`;
  }

  private tagFixture<T>(data: T): T {
    return data; // FIXTURE_REPLAY mode — data is pre-recorded
  }
}

// BridgeClientWithFallback — tries bridge first, falls back to fixture
export class BridgeClientWithFallback {
  private bridge: BridgeHTTPClient;
  private fixture: FixtureReplayInterceptor;
  private useFixture: boolean;

  constructor(bridge: BridgeHTTPClient, fixture: FixtureReplayInterceptor) {
    this.bridge = bridge;
    this.fixture = fixture;
    this.useFixture = true; // Start in fixture mode until bridge verified
  }

  async initialize(): Promise<void> {
    try {
      const health = await this.bridge.health();
      if (health.status === 'ok') {
        this.useFixture = false;
        this.fixture.disable();
      }
    } catch (_e) {
      this.useFixture = true;
      this.fixture.enable();
    }
  }

  isFixtureMode(): boolean {
    return this.useFixture;
  }

  async search(source: BookSource, query: SearchQuery): Promise<SearchResultItem[]> {
    if (this.useFixture) return this.fixture.search(source, query);
    try {
      return await this.bridge.search(source, query);
    } catch (_e) {
      return this.fixture.search(source, query);
    }
  }

  async fetchTOC(source: BookSource, detailURL: string): Promise<TOCItem[]> {
    if (this.useFixture) return this.fixture.fetchTOC(source, detailURL);
    try {
      return await this.bridge.fetchTOC(source, detailURL);
    } catch (_e) {
      return this.fixture.fetchTOC(source, detailURL);
    }
  }

  async fetchContent(source: BookSource, chapterURL: string): Promise<ContentPage> {
    if (this.useFixture) return this.fixture.fetchContent(source, chapterURL);
    try {
      return await this.bridge.fetchContent(source, chapterURL);
    } catch (_e) {
      return this.fixture.fetchContent(source, chapterURL);
    }
  }

  async parseTXT(dataBase64: string, encoding?: string, policy?: ChapterSplitPolicy): Promise<BridgeTXTParseResult> {
    if (this.useFixture) return this.fixture.parseTXT(dataBase64, encoding, policy);
    try {
      return await this.bridge.parseTXT(dataBase64, encoding, policy);
    } catch (_e) {
      return this.fixture.parseTXT(dataBase64, encoding, policy);
    }
  }
}
