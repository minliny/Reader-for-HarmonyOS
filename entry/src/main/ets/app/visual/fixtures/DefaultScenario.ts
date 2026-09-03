import {
  NOVEL_CHAPTERS,
} from './FixtureNovelText';
import type { VisualFixtureRule, VisualScenarioEntry } from '../VisualTestConfig';

export const LOCAL_TXT_BOOK_ID = 'local-txt-001';
export const LOCAL_EPUB_BOOK_ID = 'local-epub-002';
const LOCAL_BOOK_IDS = [LOCAL_TXT_BOOK_ID, LOCAL_EPUB_BOOK_ID];

/**
 * Strict-JSON literal rules (gate test JSON.parses every value below).
 * No identifier references allowed: every string is inlined so the value is
 * plain JSON (double-quoted keys, no trailing commas). Consistency with
 * FixtureNovelText (title/author/bookIds/chapter titles) is enforced by the
 * gate test instead of by imports.
 */
export const DEFAULT_LITERALS: Record<string, VisualFixtureRule | VisualFixtureRule[]> = {
  'source.switch.pending.list': {
    "pending": []
  },
  'bookshelf.list': [
    {
      "match": { "hasReadingProgress": true },
      "data": {
        "books": [
          {
            "sourceId": "local",
            "bookId": "local-txt-001",
            "title": "云港巡灯录",
            "author": "视觉验收编写组",
            "kind": "TXT",
            "intro": "云港巡灯员用十六次值班记录，完成一轮从清晨到黎明的航标巡检。",
            "addedAt": 1756390000,
            "sortIndex": 0,
            "lastReadAt": 1787980000,
            "readProgress": 823,
            "currentChapterIndex": 1,
            "currentChapterTitle": "风向记录",
            "chapterCount": 16,
            "unreadCount": 14
          }
        ],
        "total": 1
      }
    },
    {
      "data": {
        "books": [
          {
            "sourceId": "local",
            "bookId": "local-txt-001",
            "title": "云港巡灯录",
            "author": "视觉验收编写组",
            "kind": "TXT",
            "intro": "云港巡灯员用十六次值班记录，完成一轮从清晨到黎明的航标巡检。",
            "addedAt": 1756390000,
            "sortIndex": 0,
            "lastReadAt": 1787980000,
            "readProgress": 823,
            "currentChapterIndex": 1,
            "currentChapterTitle": "风向记录",
            "chapterCount": 16,
            "unreadCount": 14
          },
          {
            "sourceId": "local",
            "bookId": "local-epub-002",
            "title": "云港巡灯录",
            "author": "视觉验收编写组",
            "kind": "EPUB",
            "addedAt": 1756300000,
            "sortIndex": 1,
            "chapterCount": 16,
            "unreadCount": 16
          },
          {
            "sourceId": "src_youshu",
            "bookId": "remote-10086",
            "title": "星陨大陆",
            "author": "观星者",
            "lastChapter": "第九百章 观星台之约",
            "addedAt": 1756200000,
            "sortIndex": 2,
            "lastCheckAt": 4102444800,
            "chapterCount": 1024,
            "unreadCount": 1024
          }
        ],
        "total": 3
      }
    }
  ],
  'bookshelf.get': [
    {
      "match": { "sourceId": "local", "bookId": "local-txt-001" },
      "data": {
        "book": {
          "sourceId": "local",
          "bookId": "local-txt-001",
          "title": "云港巡灯录",
          "author": "视觉验收编写组",
          "kind": "TXT",
          "intro": "云港巡灯员用十六次值班记录，完成一轮从清晨到黎明的航标巡检。每条记录都来自确定性合成模板。",
          "addedAt": 1756390000,
          "sortIndex": 0,
          "lastReadAt": 1787980000,
          "readProgress": 823,
          "currentChapterIndex": 1,
          "currentChapterTitle": "风向记录",
          "chapterCount": 16,
          "unreadCount": 14
        }
      }
    },
    {
      "match": { "sourceId": "local", "bookId": "local-epub-002" },
      "data": {
        "book": {
          "sourceId": "local",
          "bookId": "local-epub-002",
          "title": "云港巡灯录",
          "author": "视觉验收编写组",
          "kind": "EPUB",
          "intro": "云港巡灯员用十六次值班记录，完成一轮从清晨到黎明的航标巡检。每条记录都来自确定性合成模板。",
          "addedAt": 1756300000,
          "sortIndex": 1,
          "chapterCount": 16,
          "unreadCount": 16
        }
      }
    }
  ],
  'bookmark.list': {
    "bookmarks": [
      {
        "bookName": "云港巡灯录",
        "bookAuthor": "视觉验收编写组",
        "time": 1787900100,
        "chapterIndex": 0,
        "chapterPos": 0,
        "chapterName": "清晨校准",
        "content": "巡灯员在东堤核对第一盏航标，并把稳定的灯号写进蓝色表格。"
      },
      {
        "bookName": "云港巡灯录",
        "bookAuthor": "视觉验收编写组",
        "time": 1787900200,
        "chapterIndex": 2,
        "chapterPos": 0,
        "chapterName": "旧桥巡检",
        "content": "旧桥下的回声按固定间隔返回，巡检记录因此多了一枚蓝色确认签。"
      }
    ]
  },
  'reading.progress.get': [
    {
      "match": { "sourceId": "local", "bookId": "local-epub-002" },
      "data": {
        "found": false,
        "progress": null
      }
    }
  ],
  'search.history.list': {
    "keywords": ["云港巡灯录", "灯塔 值班", "潮位记录"],
    "count": 3
  },
  'search.history.add': {},
  'search.history.clear': {},
  'source.list': {
    "sources": [
      {
        "sourceId": "src_youshu",
        "name": "优书网",
        "baseUrl": "https://fixture.local/youshu",
        "enabled": true,
        "enabledExplore": true,
        "bookSource": {
          "bookSourceGroup": "综合"
        }
      },
      {
        "sourceId": "src_lingyue",
        "name": "凌越书苑",
        "baseUrl": "https://fixture.local/lingyue",
        "enabled": false,
        "enabledExplore": false,
        "bookSource": {
          "bookSourceGroup": "网文"
        }
      }
    ]
  },
  'book-group.list': {
    "groups": []
  },
  'read-record.list': {
    "records": [
      {
        "deviceId": "visual-device-01",
        "bookName": "云港巡灯录",
        "readTime": 452300,
        "lastRead": 1787980000
      }
    ]
  },
  'source.exploreKinds': {
    "kinds": [
      { "title": "排行榜", "url": "fixture://explore/rank" },
      { "title": "收藏榜", "url": "fixture://explore/favorite" },
      { "title": "新书榜", "url": "fixture://explore/new" },
      { "title": "完本精选", "url": "fixture://explore/finished" }
    ]
  },
  'source.explore': {
    "books": [
      { "bookId": "explore-01", "title": "灰烬中的王座", "author": "烛龙", "intro": "废土之上，最后一个骑士举起了断裂的军旗。" },
      { "bookId": "explore-02", "title": "雾港旧事", "author": "白帆", "intro": "雾锁的港口，灯塔看守人收到了三十年前寄出的信。" },
      { "bookId": "explore-03", "title": "第七次量潮", "author": "盐粒", "intro": "潮水每次上涨，都会带走一段被遗忘的记忆。" },
      { "bookId": "explore-04", "title": "铁与稻", "author": "南疆客", "intro": "农夫的儿子拿起铁剑，只为守住一垄秋天的稻子。" },
      { "bookId": "explore-05", "title": "静默之钟", "author": "守夜人", "intro": "当钟楼停止报时，整座城市开始遗忘它的名字。" },
      { "bookId": "explore-06", "title": "长夜灯师", "author": "青焰", "intro": "点灯人的职守，是让长夜里的每一盏灯都有人等待。" }
    ]
  },
  'rss-source.list': {
    "sources": [
      {
        "subscription": {
          "subscriptionId": "rss-001",
          "feedUrl": "https://fixture.local/rss/tech.xml",
          "siteUrl": "https://fixture.local/tech",
          "title": "泛泛科技谈",
          "enabled": true,
          "unreadCount": 2,
          "lastFetchAt": 1787980000
        },
        "source": {}
      },
      {
        "subscription": {
          "subscriptionId": "rss-002",
          "feedUrl": "https://fixture.local/rss/books.xml",
          "siteUrl": "https://fixture.local/books",
          "title": "隔壁书房",
          "enabled": true,
          "unreadCount": 1,
          "lastFetchAt": 1787980000
        },
        "source": {}
      }
    ]
  },
  'rss.subscription.items': [
    {
      "match": { "subscriptionId": "rss-001" },
      "data": {
        "subscription": {
          "subscriptionId": "rss-001",
          "feedUrl": "https://fixture.local/rss/tech.xml",
          "siteUrl": "https://fixture.local/tech",
          "title": "泛泛科技谈",
          "enabled": true,
          "unreadCount": 2,
          "lastFetchAt": 1787980000
        },
        "items": [
          {
            "subscriptionId": "rss-001",
            "title": "超节点网络架构的下一步",
            "guid": "rss-001-a",
            "read": false,
            "firstSeenAt": 1787976400,
            "link": "https://fixture.local/tech/a",
            "description": "从集群互联到光交换：一次面向未来的梳理。",
            "author": "泛泛",
            "pubDate": "2026-08-28 08:00"
          },
          {
            "subscriptionId": "rss-001",
            "title": "端云协同的三个误区",
            "guid": "rss-001-b",
            "read": false,
            "firstSeenAt": 1787972800,
            "link": "https://fixture.local/tech/b",
            "description": "误区不在技术，而在边界条件的假设。",
            "author": "泛泛",
            "pubDate": "2026-08-27 21:30"
          },
          {
            "subscriptionId": "rss-001",
            "title": "编译器优化随笔",
            "guid": "rss-001-c",
            "read": true,
            "firstSeenAt": 1787807200,
            "link": "https://fixture.local/tech/c",
            "description": "内联是一把双刃剑，用得好是加速，用不好是膨胀。",
            "author": "泛泛",
            "pubDate": "2026-08-20 09:00"
          }
        ],
        "count": 3,
        "unreadCount": 2
      }
    },
    {
      "match": { "subscriptionId": "rss-002" },
      "data": {
        "subscription": {
          "subscriptionId": "rss-002",
          "feedUrl": "https://fixture.local/rss/books.xml",
          "siteUrl": "https://fixture.local/books",
          "title": "隔壁书房",
          "enabled": true,
          "unreadCount": 1,
          "lastFetchAt": 1787980000
        },
        "items": [
          {
            "subscriptionId": "rss-002",
            "title": "重读《云港巡灯录》：记录与交接",
            "guid": "rss-002-a",
            "read": false,
            "firstSeenAt": 1787893600,
            "link": "https://fixture.local/books/a",
            "description": "苍青律法崩塌之后，秩序靠什么重建？",
            "author": "书房主人",
            "pubDate": "2026-08-25 12:00"
          }
        ],
        "count": 1,
        "unreadCount": 1
      }
    }
  ],
  'rss.favorite.list': [
    {
      "match": { "subscriptionId": "rss-001" },
      "data": {
        "favorites": [
          {
            "subscriptionId": "rss-001",
            "guid": "rss-001-c",
            "feedUrl": "https://fixture.local/rss/tech.xml",
            "subscriptionTitle": "泛泛科技谈",
            "title": "编译器优化随笔",
            "firstSeenAt": 1787807200,
            "addedAt": 1787880000,
            "siteUrl": "https://fixture.local/tech",
            "link": "https://fixture.local/tech/c",
            "summary": "内联是一把双刃剑，用得好是加速，用不好是膨胀。",
            "publishedAt": "2026-08-20 09:00"
          }
        ],
        "count": 1
      }
    },
    {
      "match": { "subscriptionId": "rss-002" },
      "data": {
        "favorites": [],
        "count": 0
      }
    }
  ]
};

export const FIXTURE_SEARCH_BOOKS: VisualFixtureRule[] = [
  {
    "bookId": "fixture-search-01",
    "title": "云港巡灯录",
    "author": "视觉验收编写组",
    "intro": "云港巡灯员用十六次值班记录，完成一轮从清晨到黎明的航标巡检。",
    "kind": "TXT",
    "lastChapter": "第16章 黎明交接"
  },
  {
    "bookId": "search-02",
    "title": "云港巡灯录·附记",
    "author": "视觉验收编写组",
    "intro": "交接完成后，下一班巡灯员补记了三处容易遗漏的航标刻度。",
    "kind": "TXT",
    "lastChapter": "第4章 归途"
  },
  {
    "bookId": "search-03",
    "title": "灯塔工作簿",
    "author": "蓝表格",
    "intro": "一本记录灯号、潮位与备用电池状态的合成工作日志。",
    "kind": "TXT",
    "lastChapter": "第9章 灰港夜谈"
  }
];

/**
 * Novel-derived rules: toc / chapter content / metrics / progress / cache
 * states follow FixtureNovelText at runtime, so editing the novel text never
 * desyncs chapter lengths, cumulative metrics, or titles.
 */
export function buildNovelScenario(): VisualScenarioEntry[] {
  const entries: VisualScenarioEntry[] = [];

  const cacheStates: VisualFixtureRule[] = [];
  for (let i = 0; i < NOVEL_CHAPTERS.length; i++) {
    cacheStates.push({ "chapterIndex": i, "state": "completed" });
  }

  for (const bookId of LOCAL_BOOK_IDS) {
    const toc: VisualFixtureRule[] = [];
    for (let i = 0; i < NOVEL_CHAPTERS.length; i++) {
      toc.push({
        "index": i,
        "url": `reader-fixture://chapter/${i}`,
        "title": NOVEL_CHAPTERS[i].title
      });
    }
    entries.push({
      method: 'local_book.toc',
      rule: {
        "match": { "bookId": bookId },
        "data": {
          "sourceId": "local",
          "bookId": bookId,
          "toc": toc
        }
      }
    });

    let cumulativeStart = 0;
    const metricChapters: VisualFixtureRule[] = [];
    for (let i = 0; i < NOVEL_CHAPTERS.length; i++) {
      const scalarLength = NOVEL_CHAPTERS[i].content.length;
      metricChapters.push({
        "chapterIndex": i,
        "scalarLength": scalarLength,
        "cumulativeStart": cumulativeStart,
        "cumulativeEnd": cumulativeStart + scalarLength
      });
      cumulativeStart += scalarLength;
    }
    entries.push({
      method: 'local_book.content.metrics',
      rule: {
        "match": { "bookId": bookId },
        "data": {
          "sourceId": "local",
          "bookId": bookId,
          "totalScalarLength": cumulativeStart,
          "chapters": metricChapters
        }
      }
    });

    for (let i = 0; i < NOVEL_CHAPTERS.length; i++) {
      entries.push({
        method: 'local_book.chapter.content',
        rule: {
          "match": { "bookId": bookId, "chapterIndex": i },
          "data": {
            "sourceId": "local",
            "bookId": bookId,
            "chapterIndex": i,
            "chapterTitle": NOVEL_CHAPTERS[i].title,
            "content": NOVEL_CHAPTERS[i].content
          }
        }
      });
    }

    entries.push({
      method: 'cache.book.status',
      rule: {
        "match": { "sourceId": "local", "bookId": bookId },
        "data": {
          "sourceId": "local",
          "bookId": bookId,
          "chapters": cacheStates
        }
      }
    });

    if (bookId === LOCAL_TXT_BOOK_ID) {
      entries.push({
        method: 'reading.progress.get',
        rule: {
          "match": { "sourceId": "local", "bookId": bookId },
          "data": {
            "found": true,
            "progress": {
              "sourceId": "local",
              "bookId": bookId,
              "chapterIndex": 1,
              "chapterOffset": 1200,
              "chapterProgress": 0.18,
              "updatedAt": 1787980000,
              "locationRevision": "fixture-rev-1"
            }
          }
        }
      });
    }
  }

  return entries;
}
