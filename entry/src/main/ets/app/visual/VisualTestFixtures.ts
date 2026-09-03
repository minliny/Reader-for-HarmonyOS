import { hilog } from '@kit.PerformanceAnalysisKit';
import {
  type JsonObject,
  type ReaderCoreResultEvent,
} from '@reader/core-harmony';
import {
  visualScenarioName,
  type VisualFixtureRule,
  type VisualScenarioEntry,
} from './VisualTestConfig';
export { visualModeActive } from './VisualTestConfig';
import {
  buildNovelScenario,
  DEFAULT_LITERALS,
  FIXTURE_SEARCH_BOOKS,
} from './fixtures/DefaultScenario';
import { EMPTY_LITERALS } from './fixtures/EmptyScenario';

const LOG_DOMAIN = 0x5244;
let nextRequestId = 1;

interface ScenarioBundle {
  literals: Record<string, VisualFixtureRule | VisualFixtureRule[]>;
  novelEntries: VisualScenarioEntry[];
}

const SCENARIOS: Record<string, ScenarioBundle> = {
  'default': { literals: DEFAULT_LITERALS, novelEntries: buildNovelScenario() },
  'empty': { literals: EMPTY_LITERALS, novelEntries: [] },
};

type EchoHandler = (params: JsonObject) => JsonObject;

/**
 * Mutation-confirmation commands answer by echoing the request back in the
 * exact response shape each gateway decoder validates.
 */
const ECHO_HANDLERS: Record<string, EchoHandler> = {
  'reader.location.resolve': (params: JsonObject): JsonObject => {
    const anchor = asObject(params['anchor']);
    const data: JsonObject = {
      "resolved": true,
      "canonicalLocation": {
        "bookId": params['bookId'],
        "chapterIndex": anchor !== undefined && anchor['chapterIndex'] !== undefined
          ? anchor['chapterIndex']
          : params['chapterIndex'],
        "chapterOffset": anchor !== undefined ? anchor['chapterOffset'] : 0,
        "chapterProgress": anchor !== undefined ? anchor['chapterProgress'] : 0,
        "locationRevision": "fixture-canonical"
      },
      "resolverVersion": "fixture-resolver-1",
      "reflow": {
        "strategy": "offsetAnchor",
        "primaryAnchor": "chapterOffset",
        "fallbackAnchor": "chapterProgress",
        "layoutIndependent": true
      }
    };
    return data;
  },
  'reading.progress.update': (params: JsonObject): JsonObject => {
    const data: JsonObject = {
      "stored": true,
      "sourceId": params['sourceId'],
      "bookId": params['bookId'],
      "chapterIndex": params['chapterIndex'],
      "chapterOffset": params['chapterOffset'],
      "chapterProgress": params['chapterProgress'],
      "updatedAt": Date.now(),
      "locationRevision": "fixture-rev-1"
    };
    if (typeof params['locationRevision'] === 'string') {
      data['locationRevision'] = params['locationRevision'];
    }
    return data;
  },
  'bookmark.create': (params: JsonObject): JsonObject => {
    return {
      "bookmark": {
        "time": Date.now(),
        "bookName": params['bookName'],
        "bookAuthor": params['bookAuthor'],
        "chapterIndex": params['chapterIndex'],
        "chapterPos": params['chapterPos'],
        "chapterName": params['chapterName'],
        "bookText": typeof params['bookText'] === 'string' ? params['bookText'] : '',
        "content": typeof params['content'] === 'string' ? params['content'] : ''
      }
    };
  },
  'bookmark.delete': (params: JsonObject): JsonObject => {
    return { "time": params['time'], "deleted": true };
  },
  'bookshelf.add': (params: JsonObject): JsonObject => {
    return {
      "sourceId": params['sourceId'],
      "bookId": params['bookId'],
      "created": true,
      "addedAt": Date.now()
    };
  },
  'bookshelf.remove': (_params: JsonObject): JsonObject => {
    return { "removed": true };
  },
  'bookshelf.removeBatch': (params: JsonObject): JsonObject => {
    const targets = Array.isArray(params['targets']) ? params['targets'] as JsonObject[] : [];
    return {
      "requestedCount": targets.length,
      "uniqueCount": targets.length,
      "removedTargets": targets,
      "missingTargets": [],
      "duplicateTargets": []
    };
  },
  'read-record.accumulate': (params: JsonObject): JsonObject => {
    return {
      "record": {
        "deviceId": params['deviceId'],
        "bookName": params['bookName'],
        "readTime": params['elapsedMillis'],
        "lastRead": params['readAt']
      }
    };
  },
  'book.search': (params: JsonObject): JsonObject => {
    return { "sourceId": params['sourceId'], "books": FIXTURE_SEARCH_BOOKS };
  },
  'rss.entry.read': (params: JsonObject): JsonObject => {
    return {
      "marked": true,
      "subscriptionId": params['subscriptionId'],
      "guid": params['guid'],
      "read": params['read'],
      "unreadCount": fixtureUnreadCount(visualScenarioName(), params['subscriptionId'])
    };
  }
};

function asObject(value: unknown): JsonObject | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return undefined;
}

function ruleMatches(rule: JsonObject, params: JsonObject): boolean {
  const match = asObject(rule['match']);
  if (match === undefined) {
    return true;
  }
  const keys = Object.keys(match);
  for (const key of keys) {
    const expected = match[key];
    const actual = params[key];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) {
        return false;
      }
    } else if (expected !== actual) {
      return false;
    }
  }
  return true;
}

/** Returns the response data for one rule, or undefined when the match misses. */
function resolveRule(rule: VisualFixtureRule | VisualFixtureRule[], params: JsonObject): JsonObject | undefined {
  if (Array.isArray(rule)) {
    for (const entry of rule) {
      const object = asObject(entry);
      if (object !== undefined && ruleMatches(object, params)) {
        return ruleData(object);
      }
    }
    return undefined;
  }
  const object = asObject(rule);
  if (object === undefined || !ruleMatches(object, params)) {
    return undefined;
  }
  return ruleData(object);
}

function ruleData(rule: JsonObject): JsonObject {
  const error = asObject(rule['__error__']);
  if (error !== undefined) {
    const code = typeof error['code'] === 'string' ? error['code'] : 'VISUAL_FIXTURE_ERROR';
    const message = typeof error['message'] === 'string' ? error['message'] : 'fixture error';
    throw new Error(`${code}: ${message}`);
  }
  const data = asObject(rule['data']);
  if (data !== undefined) {
    return data;
  }
  // Plain data form: the rule itself is the response payload.
  const plain: JsonObject = {};
  const keys = Object.keys(rule);
  for (const key of keys) {
    if (key !== 'match' && key !== '__error__') {
      plain[key] = rule[key];
    }
  }
  return plain;
}

function fixtureUnreadCount(scenarioName: string, subscriptionId: unknown): number {
  const bundle = SCENARIOS[scenarioName] ?? SCENARIOS['default'];
  const rule = bundle.literals['rss-source.list'];
  const object = Array.isArray(rule) ? undefined : asObject(rule);
  const sources = object !== undefined && Array.isArray(object['sources'])
    ? object['sources'] as JsonObject[]
    : [];
  for (const source of sources) {
    const subscription = asObject(source['subscription']);
    if (subscription !== undefined && subscription['subscriptionId'] === subscriptionId) {
      return typeof subscription['unreadCount'] === 'number' ? subscription['unreadCount'] as number : 0;
    }
  }
  return 0;
}

/**
 * The single visual-acceptance command funnel. Answers every Core command
 * from fixtures; unknown or unmatched commands fail loud so missing fixture
 * coverage surfaces in hilog during walkthrough instead of silently
 * rendering a wrong state.
 */
export async function visualFixtureRespond(method: string, params: JsonObject): Promise<ReaderCoreResultEvent> {
  const echoHandler = ECHO_HANDLERS[method];
  if (echoHandler !== undefined) {
    return envelope(echoHandler(params));
  }
  const bundle = SCENARIOS[visualScenarioName()] ?? SCENARIOS['default'];
  for (const entry of bundle.novelEntries) {
    if (entry.method === method) {
      const data = resolveRule(entry.rule, params);
      if (data !== undefined) {
        return envelope(data);
      }
    }
  }
  const literalRule = bundle.literals[method];
  if (literalRule !== undefined) {
    const data = resolveRule(literalRule, params);
    if (data !== undefined) {
      return envelope(data);
    }
    hilog.error(LOG_DOMAIN, 'Reader', 'VISUAL_FIXTURE_MATCH_MISS: %{public}s', method);
    throw new Error(`VISUAL_FIXTURE_MATCH_MISS: ${method}`);
  }
  hilog.error(LOG_DOMAIN, 'Reader', 'VISUAL_FIXTURE_MISSING: %{public}s', method);
  throw new Error(`VISUAL_FIXTURE_MISSING: ${method}`);
}

function envelope(data: JsonObject): ReaderCoreResultEvent {
  return {
    protocolVersion: 1,
    requestId: nextRequestId++,
    type: 'result',
    data
  };
}
