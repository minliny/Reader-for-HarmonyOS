import type { JsonObject } from '@reader/core-harmony';
import { errorMessageOf } from '../../app/ErrorMessage';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import {
  createHiddenReaderReplaceQuickState,
  createReaderReplaceQuickState,
  type ReaderReplaceQuickState,
  type ReaderReplaceRule,
} from './ReaderReplaceQuickState';

export type ReaderReplaceQuickGatewayErrorCode =
  | 'invalidInput'
  | 'invalidResponse'
  | 'identityMismatch'
  | 'commandFailed';

export class ReaderReplaceQuickGatewayError extends Error {
  readonly code: ReaderReplaceQuickGatewayErrorCode;

  constructor(code: ReaderReplaceQuickGatewayErrorCode, message: string) {
    super(message);
    this.name = 'ReaderReplaceQuickGatewayError';
    this.code = code;
  }
}

export class ReaderReplacePreview {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle: string;
  before: string;
  after: string;
  changed: boolean;
  truncated: boolean;
  storedRuleCount: number;
  enabledRuleCount: number;

  constructor(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    chapterTitle: string,
    before: string,
    after: string,
    changed: boolean,
    truncated: boolean,
    storedRuleCount: number,
    enabledRuleCount: number,
  ) {
    this.sourceId = sourceId;
    this.bookId = bookId;
    this.chapterIndex = chapterIndex;
    this.chapterTitle = chapterTitle;
    this.before = before;
    this.after = after;
    this.changed = changed;
    this.truncated = truncated;
    this.storedRuleCount = storedRuleCount;
    this.enabledRuleCount = enabledRuleCount;
  }
}

/**
 * Typed Core boundary for the independent Quick Replace panel.
 *
 * List data comes only from canonical `replace-rule.list`. A switch persists
 * only after `replace.persist` confirms the canonical update DTO. Preview asks
 * Core to read its canonical raw chapter cache, so processed ArkUI text never
 * crosses back into the replacement pipeline a second time.
 */
export class ReaderReplaceQuickGateway {
  private readonly runtimeOwner: ReadingGatewayRuntime;

  constructor(runtimeOwner: ReadingGatewayRuntime) {
    this.runtimeOwner = runtimeOwner;
  }

  /** No Figma empty/loading/error state exists, so any non-ready result hides. */
  async load(): Promise<ReaderReplaceQuickState> {
    try {
      return createReaderReplaceQuickState(await this.loadAll());
    } catch (error) {
      if (error instanceof ReaderReplaceQuickGatewayError) {
        return createHiddenReaderReplaceQuickState('invalidResponse');
      }
      return createHiddenReaderReplaceQuickState('loadFailed');
    }
  }

  /** Shared canonical source. Only the legacy load() facade applies the three-row projection. */
  async loadAll(isCurrent: () => boolean = (): boolean => true): Promise<ReaderReplaceRule[]> {
    const result = await this.runtimeOwner.request('replace-rule.list', {},
      { shouldCancel: (): boolean => !isCurrent() });
    const rawRules = result.data['rules'];
    if (!Array.isArray(rawRules)) {
      throw new ReaderReplaceQuickGatewayError('invalidResponse', 'replace-rule.list returned invalid rules');
    }
    const rules: ReaderReplaceRule[] = [];
    for (const rawRule of rawRules) rules.push(this.decodeRule(rawRule, 'replace-rule.list'));
    return rules;
  }

  /**
   * Persists a real switch transition. The caller keeps its previous visible
   * state on failure and applies only this confirmed returned rule.
   */
  async setRuleEnabled(ruleId: number, isEnabled: boolean): Promise<ReaderReplaceRule> {
    this.assertSafeInteger(ruleId, 'ruleId');
    try {
      const result = await this.runtimeOwner.request('replace.persist', {
        operation: 'update',
        params: {
          id: ruleId,
          isEnabled,
        },
      });
      if (result.data['operation'] !== 'update') {
        throw new ReaderReplaceQuickGatewayError(
          'invalidResponse',
          'replace.persist returned an unexpected operation',
        );
      }
      const data = this.requireObject(result.data['data'], 'replace.persist data');
      const rule = this.decodeRule(data['rule'], 'replace.persist');
      if (rule.id !== ruleId || rule.isEnabled !== isEnabled) {
        throw new ReaderReplaceQuickGatewayError(
          'identityMismatch',
          'replace.persist returned a mismatched rule update',
        );
      }
      return rule;
    } catch (error) {
      if (error instanceof ReaderReplaceQuickGatewayError) {
        throw error;
      }
      const message = errorMessageOf(error);
      throw new ReaderReplaceQuickGatewayError('commandFailed', `replace.persist failed: ${message}`);
    }
  }

  async preview(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    maxScalars: number = 160,
  ): Promise<ReaderReplacePreview> {
    if (sourceId.trim().length === 0 || bookId.trim().length === 0) {
      throw new ReaderReplaceQuickGatewayError('invalidInput', 'preview identity must not be blank');
    }
    this.assertSafeInteger(chapterIndex, 'chapterIndex');
    this.assertSafeInteger(maxScalars, 'maxScalars');
    if (chapterIndex < 0 || maxScalars < 1 || maxScalars > 2048) {
      throw new ReaderReplaceQuickGatewayError('invalidInput', 'preview bounds are invalid');
    }
    try {
      const result = await this.runtimeOwner.request('replace.preview', {
        sourceId,
        bookId,
        chapterIndex,
        maxScalars,
      });
      const data = result.data;
      const returnedSourceId = this.requireString(data, 'sourceId', 'replace.preview');
      const returnedBookId = this.requireString(data, 'bookId', 'replace.preview');
      const returnedChapterIndex = this.requireSafeInteger(data, 'chapterIndex', 'replace.preview');
      if (returnedSourceId !== sourceId || returnedBookId !== bookId || returnedChapterIndex !== chapterIndex) {
        throw new ReaderReplaceQuickGatewayError('identityMismatch', 'replace.preview returned another chapter');
      }
      const storedRuleCount = this.requireSafeInteger(data, 'storedRuleCount', 'replace.preview');
      const enabledRuleCount = this.requireSafeInteger(data, 'enabledRuleCount', 'replace.preview');
      if (storedRuleCount < 0 || enabledRuleCount < 0 || enabledRuleCount > storedRuleCount) {
        throw new ReaderReplaceQuickGatewayError('invalidResponse', 'replace.preview returned invalid rule counts');
      }
      return new ReaderReplacePreview(
        returnedSourceId,
        returnedBookId,
        returnedChapterIndex,
        this.requireString(data, 'chapterTitle', 'replace.preview'),
        this.requireString(data, 'before', 'replace.preview'),
        this.requireString(data, 'after', 'replace.preview'),
        this.requireBoolean(data, 'changed', 'replace.preview'),
        this.requireBoolean(data, 'truncated', 'replace.preview'),
        storedRuleCount,
        enabledRuleCount,
      );
    } catch (error) {
      if (error instanceof ReaderReplaceQuickGatewayError) {
        throw error;
      }
      const message = errorMessageOf(error);
      throw new ReaderReplaceQuickGatewayError('commandFailed', `replace.preview failed: ${message}`);
    }
  }

  /** One decoder shared by Quick compatibility and in-reader Full CRUD. */
  decodeRule(value: unknown, context: string): ReaderReplaceRule {
    const raw = this.requireObject(value, `${context} rule`);
    const rule: ReaderReplaceRule = {
      id: this.requireSafeInteger(raw, 'id', context),
      name: this.requireString(raw, 'name', context),
      pattern: this.requireString(raw, 'pattern', context),
      replacement: this.requireString(raw, 'replacement', context),
      scopeTitle: this.requireBoolean(raw, 'scopeTitle', context),
      scopeContent: this.requireBoolean(raw, 'scopeContent', context),
      isEnabled: this.requireBoolean(raw, 'isEnabled', context),
      isRegex: this.requireBoolean(raw, 'isRegex', context),
      timeoutMillisecond: this.requireSafeInteger(raw, 'timeoutMillisecond', context),
      order: this.requireSafeInteger(raw, 'order', context),
    };
    const group = this.optionalString(raw, 'group', context);
    const scope = this.optionalString(raw, 'scope', context);
    const excludeScope = this.optionalString(raw, 'excludeScope', context);
    if (raw['scopeSource'] !== undefined) {
      rule.scopeSource = this.requireBoolean(raw, 'scopeSource', context);
    }
    if (group !== undefined) {
      rule.group = group;
    }
    if (scope !== undefined) {
      rule.scope = scope;
    }
    if (excludeScope !== undefined) {
      rule.excludeScope = excludeScope;
    }
    return rule;
  }

  private requireObject(value: unknown, context: string): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ReaderReplaceQuickGatewayError('invalidResponse', `${context} is not an object`);
    }
    return value as JsonObject;
  }

  private requireString(value: JsonObject, key: string, context: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string') {
      throw new ReaderReplaceQuickGatewayError('invalidResponse', `${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalString(value: JsonObject, key: string, context: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new ReaderReplaceQuickGatewayError('invalidResponse', `${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireBoolean(value: JsonObject, key: string, context: string): boolean {
    const candidate = value[key];
    if (typeof candidate !== 'boolean') {
      throw new ReaderReplaceQuickGatewayError('invalidResponse', `${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireSafeInteger(value: JsonObject, key: string, context: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate)) {
      throw new ReaderReplaceQuickGatewayError('invalidResponse', `${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private assertSafeInteger(value: number, key: string): void {
    if (!Number.isSafeInteger(value)) {
      throw new ReaderReplaceQuickGatewayError('invalidInput', `${key} must be a safe integer`);
    }
  }
}
