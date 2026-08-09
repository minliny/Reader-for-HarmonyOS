import type { JsonObject } from '@reader/core-harmony';
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

/**
 * Typed Core boundary for the independent Quick Replace panel.
 *
 * List data comes only from canonical `replace-rule.list`. A switch persists
 * only after `replace.persist` confirms the canonical update DTO. Preview is
 * intentionally absent: the reading surface currently exposes processed text,
 * and sending that through `replace.apply` again would double-transform it.
 */
export class ReaderReplaceQuickGateway {
  private readonly runtimeOwner: ReadingGatewayRuntime;

  constructor(runtimeOwner: ReadingGatewayRuntime) {
    this.runtimeOwner = runtimeOwner;
  }

  /** No Figma empty/loading/error state exists, so any non-ready result hides. */
  async load(): Promise<ReaderReplaceQuickState> {
    try {
      const result = await this.runtimeOwner.request('replace-rule.list', {});
      const rawRules = result.data['rules'];
      if (!Array.isArray(rawRules)) {
        return createHiddenReaderReplaceQuickState('invalidResponse');
      }
      const rules: ReaderReplaceRule[] = [];
      for (const rawRule of rawRules) {
        rules.push(this.decodeRule(rawRule, 'replace-rule.list'));
      }
      return createReaderReplaceQuickState(rules);
    } catch (error) {
      if (error instanceof ReaderReplaceQuickGatewayError) {
        return createHiddenReaderReplaceQuickState('invalidResponse');
      }
      return createHiddenReaderReplaceQuickState('loadFailed');
    }
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
      const message = error instanceof Error ? error.message : String(error);
      throw new ReaderReplaceQuickGatewayError('commandFailed', `replace.persist failed: ${message}`);
    }
  }

  private decodeRule(value: unknown, context: string): ReaderReplaceRule {
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
