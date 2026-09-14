import type {
  RemoteReadingBookSeed,
  RemoteReadingOpenOptions,
  RemoteReadingSession,
} from './RemoteReadingFlowGateway';
import type {
  RemoteReadingCommand,
} from './RemoteReadingContract';
import { RemoteReadingGatewayError } from './RemoteReadingContract';

/**
 * Stable failure taxonomy for the whole remote reading chain. Only the six
 * SOURCE_* kinds describe a book-source defect and may offer a source switch;
 * PAGINATION/LAYOUT/RENDER/STORAGE failures are client-side and must surface
 * their own error instead of offering a source change.
 */
export type RemoteReadingFailureKind =
  | 'SOURCE_HTTP_FAILED'
  | 'SOURCE_PARSE_FAILED'
  | 'SOURCE_TOC_EMPTY'
  | 'SOURCE_CONTENT_EMPTY'
  | 'SOURCE_PAYWALL'
  | 'SOURCE_AUTH_REQUIRED'
  | 'PAGINATION_FAILED'
  | 'LAYOUT_FAILED'
  | 'RENDER_FAILED'
  | 'STORAGE_FAILED'
  | 'POSITION_CONTEXT_STALE';

const SOURCE_FAILURE_KINDS: RemoteReadingFailureKind[] = [
  'SOURCE_HTTP_FAILED',
  'SOURCE_PARSE_FAILED',
  'SOURCE_TOC_EMPTY',
  'SOURCE_CONTENT_EMPTY',
  'SOURCE_PAYWALL',
  'SOURCE_AUTH_REQUIRED',
];

/** Only source defects may offer the user-confirmed source switch. */
export function isRemoteSourceFailureKind(kind: RemoteReadingFailureKind): boolean {
  return SOURCE_FAILURE_KINDS.indexOf(kind) >= 0;
}

/**
 * A typed source-chain failure carrying its stable taxonomy kind. Extends
 * RemoteReadingGatewayError so classifyRemoteReadingCommandFailure passes it
 * through untouched instead of re-labeling it as commandFailed.
 */
export class RemoteReadingSourceError extends RemoteReadingGatewayError {
  readonly kind: RemoteReadingFailureKind;

  constructor(kind: RemoteReadingFailureKind, message: string, command?: RemoteReadingCommand) {
    super('commandFailed', message, command, undefined, undefined, undefined,
      kind === 'SOURCE_CONTENT_EMPTY' ? 'SOURCE_CONTENT_EMPTY' :
      kind === 'SOURCE_TOC_EMPTY' ? 'SOURCE_TOC_EMPTY' :
      kind === 'SOURCE_PARSE_FAILED' ? 'SOURCE_RULE_FAILED' : undefined);
    this.name = 'RemoteReadingSourceError';
    this.kind = kind;
  }
}

/**
 * Detail-page readiness verdicts. `verifying` is the caller-owned state before
 * and while admission runs; the remaining verdicts are terminal outcomes.
 */
export type RemoteContentVerdict =
  | 'verifying'
  | 'readable'
  | 'contentUnavailable'
  | 'authRequired'
  | 'paywalled'
  | 'networkFailed'
  | 'parseFailed';

export type RemoteContentAdmissionOutcome = {
  verdict: RemoteContentVerdict;
  /** Human-readable reason for the verdict (Chinese product copy upstream). */
  message: string;
  /** Admitted session when detail/TOC succeeded; undefined on earlier failure. */
  session?: RemoteReadingSession;
  /** First chapter index whose body passed the readability probe. */
  readableChapterIndex?: number;
};

export interface ChapterBodyReadableVerdict {
  kind: 'readable';
}

export interface ChapterBodyRejectedVerdict {
  kind: RemoteReadingFailureKind;
  reason: string;
}

export type ChapterBodyVerdict =
  | ChapterBodyReadableVerdict
  | ChapterBodyRejectedVerdict;

const MIN_READABLE_BODY_LENGTH = 6;
/** Placeholder/paywall banners are short; a real chapter mentioning the same
 * words at length must not be misclassified. */
const BANNER_SCAN_LIMIT = 300;

const AUTH_BANNER_MARKERS: string[] = [
  '请登录', '请先登录', '登录后即可', '登录后才能', '未登录',
  'login required', 'please log in', 'please sign in',
];

const CAPTCHA_BANNER_MARKERS: string[] = [
  '验证码', '人机验证', '安全验证', '访问过于频繁', '访问频率过高',
  '请输入验证码', 'captcha', 'just a moment', 'checking your browser',
  'verify you are', 'are you a human',
];

const PAYWALL_BANNER_MARKERS: string[] = [
  '开通会员', '本章未解锁', '付费章节', 'vip章节', 'vip专享', '订阅本章节',
  '请购买', '解锁本章', '需要付费', '付费阅读', '自动订阅',
];

const PLACEHOLDER_BANNER_MARKERS: string[] = [
  '章节内容正在加载', '内容加载中', '正在加载中', '加载失败', '章节加载失败',
  '章节不存在', '内容不存在', '暂无内容', '正文加载失败', '本章内容缺失',
];

function containsAny(text: string, markers: string[]): boolean {
  for (const marker of markers) {
    if (text.indexOf(marker) >= 0) {
      return true;
    }
  }
  return false;
}

function looksLikeHtmlDocument(text: string): boolean {
  const head = text.slice(0, 200).toLowerCase();
  return head.indexOf('<!doctype html') >= 0 || head.indexOf('<html') >= 0;
}

const HTML_LOGIN_MARKERS: string[] = [
  '登录', 'login', 'log in', 'sign in', 'password', '用户名', 'username',
];

function containsHtmlLoginMarker(text: string): boolean {
  const lower = text.toLowerCase();
  return containsAny(text, HTML_LOGIN_MARKERS) || containsAny(lower, HTML_LOGIN_MARKERS);
}

/**
 * Content heuristic for a decoded chapter body. Paywall/placeholder/login
 * pages and crawler interstitials are never admitted as readable content.
 * Run against the final projected text (after image substitution).
 */
export function classifyChapterBody(content: string): ChapterBodyVerdict {
  const trimmed = content.trim();
  if (trimmed.length < MIN_READABLE_BODY_LENGTH) {
    return { kind: 'SOURCE_CONTENT_EMPTY', reason: 'chapter body is blank or too short' };
  }
  const lower = trimmed.toLowerCase();
  if (looksLikeHtmlDocument(trimmed)) {
    if (containsHtmlLoginMarker(trimmed)) {
      return { kind: 'SOURCE_AUTH_REQUIRED', reason: 'source returned a login page' };
    }
    return { kind: 'SOURCE_PARSE_FAILED', reason: 'source returned an HTML page instead of chapter text' };
  }
  if (trimmed.length > BANNER_SCAN_LIMIT) {
    return { kind: 'readable' };
  }
  if (containsAny(trimmed, AUTH_BANNER_MARKERS) || containsAny(lower, AUTH_BANNER_MARKERS)) {
    return { kind: 'SOURCE_AUTH_REQUIRED', reason: 'chapter body asks the reader to log in' };
  }
  if (containsAny(trimmed, CAPTCHA_BANNER_MARKERS) || containsAny(lower, CAPTCHA_BANNER_MARKERS)) {
    return { kind: 'SOURCE_AUTH_REQUIRED', reason: 'source returned a captcha or anti-crawler page' };
  }
  if (containsAny(lower, PAYWALL_BANNER_MARKERS)) {
    return { kind: 'SOURCE_PAYWALL', reason: 'chapter body is a purchase placeholder' };
  }
  if (containsAny(lower, PLACEHOLDER_BANNER_MARKERS)) {
    return { kind: 'SOURCE_CONTENT_EMPTY', reason: 'chapter body is a loading placeholder' };
  }
  return { kind: 'readable' };
}

/**
 * Map any error from the remote reading chain onto the stable taxonomy.
 * Unknown or client-side errors map to RENDER_FAILED (non-source), so they can
 * never trigger a source-switch prompt.
 */
export function remoteReadingFailureKindOf(error: unknown): RemoteReadingFailureKind {
  if (error instanceof RemoteReadingSourceError) {
    return error.kind;
  }
  if (error instanceof RemoteReadingGatewayError) {
    switch (error.code) {
      case 'positionContextStale':
        return 'POSITION_CONTEXT_STALE';
      case 'emptyToc':
        return 'SOURCE_TOC_EMPTY';
      case 'invalidResponse':
      case 'missingTocUrl':
      case 'nonTextChapter':
      case 'chapterNotFound':
        return 'SOURCE_PARSE_FAILED';
      case 'chapterNotDownloaded':
      case 'cachedSessionUnavailable':
      case 'cacheDerivedCorrupt':
      case 'storageFailure':
        return 'STORAGE_FAILED';
      case 'commandFailed':
        return 'SOURCE_HTTP_FAILED';
      case 'identityMismatch':
      case 'sourceVersionChanged':
      case 'cancelled':
      case 'invalidInput':
      case 'unsupportedHostCapability':
      default:
        return 'RENDER_FAILED';
    }
  }
  return 'RENDER_FAILED';
}

/** Detail-page verdict for a classified failure. */
export function verdictForFailureKind(kind: RemoteReadingFailureKind): RemoteContentVerdict {
  switch (kind) {
    case 'SOURCE_HTTP_FAILED':
      return 'networkFailed';
    case 'SOURCE_PARSE_FAILED':
      return 'parseFailed';
    case 'SOURCE_TOC_EMPTY':
    case 'SOURCE_CONTENT_EMPTY':
      return 'contentUnavailable';
    case 'SOURCE_PAYWALL':
      return 'paywalled';
    case 'SOURCE_AUTH_REQUIRED':
      return 'authRequired';
    case 'PAGINATION_FAILED':
    case 'LAYOUT_FAILED':
    case 'RENDER_FAILED':
    case 'STORAGE_FAILED':
    default:
      return 'contentUnavailable';
  }
}

/**
 * How many leading chapters the readability probe may try. A source whose
 * first chapter is an announcement/blank placeholder still gets admitted when
 * a later leading chapter has real text.
 */
const CONTENT_PROBE_CHAPTER_LIMIT = 3;

/**
 * Content admission for a search/shelf seed: detail -> TOC -> leading chapter
 * body probe. It answers one question with a typed verdict: may the reader
 * start reading this exact (sourceId, bookId) now?
 */
export class RemoteContentAdmission {
  private readonly gateway: RemoteReadingFlowGatewayLike;

  constructor(gateway: RemoteReadingFlowGatewayLike) {
    this.gateway = gateway;
  }

  async verify(
    seed: RemoteReadingBookSeed,
    options: RemoteReadingOpenOptions = {},
  ): Promise<RemoteContentAdmissionOutcome> {
    let session: RemoteReadingSession;
    try {
      session = await this.gateway.openSession(seed, options);
    } catch (error) {
      const kind = remoteReadingFailureKindOf(error);
      return { verdict: verdictForFailureKind(kind), message: errorMessageOf(error) };
    }
    const probeLimit = Math.min(CONTENT_PROBE_CHAPTER_LIMIT, session.entries.length);
    let lastVerdict: RemoteContentVerdict = 'contentUnavailable';
    let lastMessage = 'no readable chapter body was admitted';
    for (let index = 0; index < probeLimit; index += 1) {
      try {
        await this.gateway.loadChapter(session, session.entries[index].index, options.isCurrent);
        return { verdict: 'readable', message: 'chapter body verified', session, readableChapterIndex: index };
      } catch (error) {
        const kind = remoteReadingFailureKindOf(error);
        lastVerdict = verdictForFailureKind(kind);
        lastMessage = errorMessageOf(error);
        // A blank/placeholder leading chapter may be followed by real ones;
        // any other failure is book-wide and stops the probe.
        if (kind !== 'SOURCE_CONTENT_EMPTY') {
          break;
        }
      }
    }
    return { verdict: lastVerdict, message: lastMessage, session };
  }
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Structural type so this module never value-imports the gateway. */
export type RemoteReadingFlowGatewayLike = {
  openSession(
    seed: RemoteReadingBookSeed,
    options?: RemoteReadingOpenOptions,
  ): Promise<RemoteReadingSession>;
  loadChapter(
    session: RemoteReadingSession,
    chapterIndex: number,
    isCurrent?: () => boolean,
  ): Promise<unknown>;
};
