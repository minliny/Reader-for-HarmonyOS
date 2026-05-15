# HarmonyOS Core Bridge API Specification

**Version**: 1.0.0
**Date**: 2026-05-15
**Transport**: HTTP/1.1 over TCP (localhost)
**Content-Type**: application/json

## Overview

The Core Bridge exposes Reader-Core Swift services via a local HTTP REST API. An ArkTS HTTP client (`BridgeHTTPClient`) calls these endpoints. When the bridge is unavailable, a `FixtureReplayInterceptor` serves pre-recorded JSON fixtures.

### Base URL

```
http://localhost:8899
```

### Common Error Response

All endpoints return this on failure:

```json
{
  "error": {
    "code": "SEARCH_PARSE_FAILED",
    "message": "Failed to parse search results",
    "stage": "search_parse",
    "context": {
      "sampleId": "case_022",
      "sourceURL": "https://example.com/search?key=test",
      "statusCode": "200"
    }
  }
}
```

Error codes (from Core `MappedReaderError`):

| Code | Meaning |
|------|---------|
| `NETWORK_TIMEOUT` | Request timed out |
| `NETWORK_UNREACHABLE` | Cannot reach target host |
| `HTTP_STATUS_INVALID` | Non-2xx response |
| `REDIRECT_NOT_HANDLED` | Redirect not followed |
| `HEADER_REQUIRED` | Required header missing |
| `COOKIE_REQUIRED` | Cookie jar needed |
| `RESPONSE_EMPTY` | Empty response body |
| `RESPONSE_DECODING_FAILED` | Charset decode failed |
| `SEARCH_PARSE_FAILED` | HTML parse for search failed |
| `TOC_PARSE_FAILED` | HTML parse for TOC failed |
| `CONTENT_PARSE_FAILED` | HTML parse for content failed |
| `RULE_UNSUPPORTED` | Rule type not supported |
| `POLICY_REJECTED` | Network policy blocked |
| `UNKNOWN` | Unknown error |

---

## Endpoints

### 1. GET /health

Health check. Returns bridge status and Core version.

**Request**: (none)

**Response** `200`:
```json
{
  "status": "ok",
  "coreVersion": "8b0e8bf",
  "services": ["search", "toc", "content", "txt_parse"],
  "uptime": 3600
}
```

**Response** `503` (bridge not ready):
```json
{
  "status": "degraded",
  "services": [],
  "error": "Core modules not loaded"
}
```

---

### 2. POST /search

Execute a search query against a book source.

**Request**:
```json
{
  "source": {
    "bookSourceName": "Example Source",
    "bookSourceUrl": "https://www.example.com",
    "searchUrl": "https://www.example.com/search?key={{key}}&page={{page}}",
    "searchRule": {
      "bookList": "div.result-list li",
      "bookName": "a.title",
      "bookAuthor": "span.author",
      "bookCover": "img.cover@src",
      "bookIntro": "p.intro",
      "bookDetail": "a.title@href"
    },
    "header": "User-Agent: Reader/1.0",
    "enabled": true,
    "weight": 100
  },
  "query": {
    "keyword": "三体",
    "page": 1,
    "pageSize": 20
  }
}
```

**Response** `200`:
```json
{
  "results": [
    {
      "title": "三体全集",
      "detailURL": "https://www.example.com/book/123",
      "author": "刘慈欣",
      "coverURL": "https://img.example.com/cover/123.jpg",
      "intro": "地球文明与三体文明的首次接触...",
      "nextPageUrl": "https://www.example.com/search?key=三体&page=2",
      "unknownFields": {}
    }
  ],
  "totalResults": 42,
  "page": 1
}
```

**Response** `200` (empty):
```json
{
  "results": [],
  "totalResults": 0,
  "page": 1
}
```

**Notes**:
- `source.searchRule` fields map to Core `SearchRule` struct.
- Non-JS sources only. JS-based search rules return `RULE_UNSUPPORTED`.
- Login-gated sources return `COOKIE_REQUIRED`.

---

### 3. POST /toc

Fetch table of contents for a book.

**Request**:
```json
{
  "source": {
    "bookSourceName": "Example Source",
    "bookSourceUrl": "https://www.example.com",
    "tocRule": {
      "chapterList": "div.chapter-list li",
      "chapterName": "a",
      "chapterUrl": "a@href",
      "isVolume": false
    },
    "header": "User-Agent: Reader/1.0",
    "enabled": true,
    "weight": 100
  },
  "detailURL": "https://www.example.com/book/123"
}
```

**Response** `200`:
```json
{
  "items": [
    {
      "chapterTitle": "第一章 科学边界",
      "chapterURL": "https://www.example.com/book/123/ch1",
      "chapterIndex": 0,
      "isVip": false,
      "unknownFields": {}
    }
  ]
}
```

---

### 4. POST /content

Fetch chapter content.

**Request**:
```json
{
  "source": {
    "bookSourceName": "Example Source",
    "bookSourceUrl": "https://www.example.com",
    "contentRule": {
      "content": "div#content",
      "nextContentUrl": "a.next@href",
      "title": "h1.chapter-title"
    },
    "header": "User-Agent: Reader/1.0",
    "enabled": true,
    "weight": 100
  },
  "chapterURL": "https://www.example.com/book/123/ch1"
}
```

**Response** `200`:
```json
{
  "title": "第一章 科学边界",
  "content": "汪淼觉得，今天发生的一切都像一场梦...",
  "chapterURL": "https://www.example.com/book/123/ch1",
  "nextChapterURL": "https://www.example.com/book/123/ch2",
  "contentType": "text",
  "vipStatus": "free",
  "unknownFields": {}
}
```

---

### 5. POST /parse/txt

Parse TXT file data into structured content + TOC.

**Request**:
```json
{
  "dataBase64": "5LuK5aSp5Y+R55Sf55qE5LiA5YiH...",
  "encoding": "utf-8",
  "policy": {
    "pattern": "regex",
    "regex": "^第[0-9零一二三四五六七八九十百千]+章"
  }
}
```

**Response** `200`:
```json
{
  "encoding": "utf-8",
  "content": "今天发生的一切都像一场梦...",
  "toc": [
    {
      "title": "第一章",
      "level": 1,
      "byteOffset": 0
    }
  ],
  "byteCount": 2048000
}
```

**Encoding options**: `utf-8`, `gbk`, `gb2312`, `gb18030`, `latin-1`, `ascii`

**Policy patterns**: `regex`, `marker`, `size`, `auto`

**Response** `400` (unsupported encoding):
```json
{
  "error": {
    "code": "encodingNotSupported",
    "message": "Encoding 'shift_jis' is not supported"
  }
}
```

---

## Fixture Replay Mode

When the bridge is unavailable (health check fails or connection refused), the `FixtureReplayInterceptor` serves pre-recorded responses from `samples/fixtures/`.

### Fixture Resolution

```
bridge request POST /search { "source": { "bookSourceName": "Example" }, ... }
  → samples/fixtures/search/example_search_三体.json

bridge request POST /toc { "source": { "bookSourceName": "Example" }, ... }
  → samples/fixtures/toc/example_toc_123.json

bridge request POST /content { "source": { "bookSourceName": "Example" }, ... }
  → samples/fixtures/content/example_ch1.json
```

### Fixture File Format

Each fixture JSON file contains the same response shape as the live endpoint.

```json
{
  "_fixture": {
    "mode": "FIXTURE_REPLAY",
    "endpoint": "/search",
    "matchedAt": "2026-05-15T00:00:00Z"
  },
  "results": [...]
}
```

The `_fixture` wrapper is added by the interceptor to distinguish live vs fixture responses.

---

## API Versioning

The bridge uses header-based versioning:

```
X-Bridge-Version: 1.0.0
```

Future versions may add endpoints or fields. Breaking changes increment the major version. The ArkTS client checks the version on `/health` and warns on mismatch.

---

## Endpoint Summary

| Method | Path | Request | Response | Core Service |
|--------|------|---------|----------|-------------|
| GET | /health | — | `{ status, coreVersion }` | — |
| POST | /search | `{ source, query }` | `{ results[], totalResults }` | DefaultSearchService |
| POST | /toc | `{ source, detailURL }` | `{ items[] }` | DefaultTOCService |
| POST | /content | `{ source, chapterURL }` | ContentPage JSON | DefaultContentService |
| POST | /parse/txt | `{ dataBase64, encoding?, policy }` | TXTParseResult JSON | TXTParser |
