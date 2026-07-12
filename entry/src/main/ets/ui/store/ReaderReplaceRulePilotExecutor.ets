// Correlation-scoped executor for the opt-in Reader-UI `replace.rules` Pilot.
//
// ReaderUIRuntime owns only the effect emission boundary. This file owns the
// one-to-one execution of its single next Core effect and retains the bound
// replace-rule context until that correlation has completed or been cancelled.
// It handles the three Core commands declared by runtime-actions.json:
//   reader.replace.create  → replace.persist   (replaceRuleCreate + replaceRuleList)
//   reader.replace.apply   → replace.apply      (replaceRuleUpdate/Delete + replaceRuleList)
//   reader.replace.validate → replace.validate  (host-side validation, no Core write)
import {
  type ReaderUIEffect,
  type ReaderUIJSONPayload,
  type ReaderUIJSONResult,
  type ReaderUIState,
  validateReaderUITypedResult,
} from 'reader_ui_runtime';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import {
  ReaderUiState,
  ReplaceRule,
  UiEvent,
} from './ReaderUiState';

/** Narrow structural view of a cancellable Core command handle for replace rules. */
export interface ReaderReplaceRuleCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancel(): boolean;
}

/**
 * Simple promise-wrapping handle. The existing CoreRuntime async methods
 * (replaceRuleCreate, replaceRuleUpdate, replaceRuleDelete, replaceRuleList)
 * do not expose a cancellable CoreCommandHandle; this wrapper sets an internal
 * flag so late results are ignored by the executor after cancellation.
 */
export class ReaderReplaceRuleDeferredHandle implements ReaderReplaceRuleCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  private cancelled: boolean = false;

  constructor(requestId: number, result: Promise<JsonObject>) {
    this.requestId = requestId;
    this.result = result;
  }

  cancel(): boolean {
    if (this.cancelled) return false;
    this.cancelled = true;
    return true;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }
}

/** Testable seam for exactly the Core commands used by a replace-rule sequence. */
export interface ReaderReplaceRuleCoreGateway {
  beginReplacePersist(pattern: string, replacement: string, scope: string): ReaderReplaceRuleCommandHandle;
  beginReplaceApply(ruleId: string, action: string, pattern: string, replacement: string,
    scope: string, enabled: boolean): ReaderReplaceRuleCommandHandle;
  beginReplaceValidate(pattern: string, replacement: string, scope: string): ReaderReplaceRuleCommandHandle;
  beginReplaceRollback(): ReaderReplaceRuleCommandHandle;
}

/** Production gateway. It is created lazily so Shadow mode never needs Core. */
export class CoreRuntimeReplaceRuleGateway implements ReaderReplaceRuleCoreGateway {
  private nextRequestId: number = 1;

  beginReplacePersist(pattern: string, replacement: string, scope: string): ReaderReplaceRuleCommandHandle {
    const runtime = CoreRuntime.get();
    const rule: JsonObject = {};
    rule['pattern'] = pattern;
    rule['replacement'] = replacement;
    rule['scope'] = scope;
    rule['enabled'] = true;
    // Persist chains replace-rule.create → replace-rule.list. The executor
    // consumes the canonical list so local state never retains a pending id.
    const chained = runtime.replaceRuleCreate(rule).then((): Promise<JsonObject> => {
      return runtime.replaceRuleList();
    });
    const handle = new ReaderReplaceRuleDeferredHandle(this.nextRequestId, chained);
    this.nextRequestId += 1;
    return handle;
  }

  beginReplaceApply(ruleId: string, action: string, pattern: string, replacement: string,
    scope: string, enabled: boolean): ReaderReplaceRuleCommandHandle {
    const runtime = CoreRuntime.get();
    let writePromise: Promise<JsonObject>;
    if (action === 'delete') {
      writePromise = runtime.replaceRuleDelete(ruleId);
    } else {
      // update or toggle: both use replace-rule.update with the new field set.
      const rule: JsonObject = {};
      rule['id'] = ruleId;
      rule['pattern'] = pattern;
      rule['replacement'] = replacement;
      rule['scope'] = scope;
      rule['enabled'] = enabled;
      writePromise = runtime.replaceRuleUpdate(rule);
    }
    // Apply chains the write → replace-rule.list so the executor always
    // projects Core's canonical list after a durable mutation.
    const chained = writePromise.then((): Promise<JsonObject> => {
      return runtime.replaceRuleList();
    });
    const handle = new ReaderReplaceRuleDeferredHandle(this.nextRequestId, chained);
    this.nextRequestId += 1;
    return handle;
  }

  beginReplaceValidate(pattern: string, _replacement: string, scope: string): ReaderReplaceRuleCommandHandle {
    // Validation is host-side: no Core write is required. Return a resolved
    // handle with the validation result so the executor follows the same
    // completion path as persist/apply.
    const result: JsonObject = {};
    result['valid'] = pattern.trim().length > 0;
    result['pattern'] = pattern;
    result['scope'] = scope;
    const handle = new ReaderReplaceRuleDeferredHandle(
      this.nextRequestId,
      Promise.resolve(result),
    );
    this.nextRequestId += 1;
    return handle;
  }

  beginReplaceRollback(): ReaderReplaceRuleCommandHandle {
    // Rollback reloads Core's canonical list to restore local state after a
    // failed write. No Core undo command exists; the list refresh is the
    // authoritative restore.
    const runtime = CoreRuntime.get();
    const handle = new ReaderReplaceRuleDeferredHandle(
      this.nextRequestId,
      runtime.replaceRuleList(),
    );
    this.nextRequestId += 1;
    return handle;
  }
}

/** Adapter over ReaderUIRuntime's state observation. The replace rule Pilot
  * uses emitEffects which has no acceptResult callback, so the runtime gateway
  * only reads state for the host projection. */
export interface ReaderReplaceRuleRuntimeGateway {
  currentState(): ReaderUIState;
}

/** Store-owned projection seam. Domain events bypass ReaderEffects by design. */
export interface ReaderReplaceRulePilotHost {
  nativeState(): ReaderUiState;
  applyRuntimeState(runtimeState: ReaderUIState): void;
  applyDomainEvent(event: UiEvent): void;
}

export interface ReaderReplaceRulePilotContext {
  correlationId: string;
  ruleId: string;
  action: string;
  pattern: string;
  replacement: string;
  scope: string;
  enabled: boolean;
  inFlight?: ReaderReplaceRuleCommandHandle;
  currentEffect?: string;
}

export interface ReaderReplaceRulePilotSnapshot {
  activeCorrelationId: string;
  activeRequestId: number;
  executedEffects: number;
  ignoredLateResults: number;
  cancelledCommands: number;
}

/**
 * One executor instance is created by the Store-owned rollout coordinator.
 * It accepts at most one active correlation because ReaderUIRuntime serializes
 * reader.replace.create/apply/validate and returns superseded correlation ids
 * explicitly.
 */
export class ReaderReplaceRuleEffectExecutor {
  private readonly core: ReaderReplaceRuleCoreGateway;
  private readonly runtime: ReaderReplaceRuleRuntimeGateway;
  private readonly host: ReaderReplaceRulePilotHost;
  private active: ReaderReplaceRulePilotContext | null = null;
  private executedEffects: number = 0;
  private ignoredLateResults: number = 0;
  private cancelledCommands: number = 0;

  constructor(runtime: ReaderReplaceRuleRuntimeGateway, host: ReaderReplaceRulePilotHost,
    core: ReaderReplaceRuleCoreGateway = new CoreRuntimeReplaceRuleGateway()) {
    this.runtime = runtime;
    this.host = host;
    this.core = core;
  }

  start(correlationId: string, payload: ReaderUIJSONPayload, effect: ReaderUIEffect): void {
    if (effect.correlationId !== correlationId) {
      throw new Error('replace.rules effect correlation does not match the runtime transaction');
    }
    if (this.active !== null) {
      throw new Error(`replace.rules executor already owns ${this.active.correlationId}`);
    }
    const context = this.createContext(correlationId, payload);
    this.active = context;
    this.host.applyRuntimeState(this.runtime.currentState());
    this.execute(context, effect);
  }

  cancel(correlationId: string): boolean {
    const context = this.active;
    if (context === null || context.correlationId !== correlationId) return false;
    const handle = context.inFlight;
    if (handle !== undefined && handle.cancel()) {
      this.cancelledCommands += 1;
    }
    context.inFlight = undefined;
    context.currentEffect = undefined;
    this.active = null;
    return true;
  }

  hasActiveCorrelation(): boolean {
    return this.active !== null;
  }

  activeCorrelationId(): string {
    return this.active?.correlationId ?? '';
  }

  snapshot(): ReaderReplaceRulePilotSnapshot {
    return {
      activeCorrelationId: this.active?.correlationId ?? '',
      activeRequestId: this.active?.inFlight?.requestId ?? 0,
      executedEffects: this.executedEffects,
      ignoredLateResults: this.ignoredLateResults,
      cancelledCommands: this.cancelledCommands,
    };
  }

  private createContext(correlationId: string, payload: ReaderUIJSONPayload): ReaderReplaceRulePilotContext {
    const operation = this.payloadString(payload, 'operation');
    const params = this.payloadObject(payload, 'params');
    const action = operation === 'create' ? 'create' :
      (payload['scope'] !== undefined ? 'validate' : 'apply');
    const ruleIdValue = params?.['id'];
    const ruleId = typeof ruleIdValue === 'number' ? ruleIdValue.toString() : '';
    const pattern = action === 'validate'
      ? this.payloadString(payload, 'pattern') : this.payloadString(params ?? {}, 'pattern');
    const replacement = this.payloadString(params ?? {}, 'replacement');
    let scope = 'chapter';
    const scopeValue = payload['scope'];
    if (Array.isArray(scopeValue) && scopeValue.length > 0 && typeof scopeValue[0] === 'string') {
      scope = scopeValue[0] as string;
    } else if (params?.['scopeTitle'] === true && params?.['scopeContent'] !== true) {
      scope = 'title';
    }
    const enabledValue = params?.['isEnabled'];
    const enabled = typeof enabledValue === 'boolean' ? enabledValue : true;
    if (action === 'create' || action === 'validate') {
      if (pattern.trim().length === 0) {
        throw new Error(`replace.rules Pilot requires non-empty pattern for ${action}`);
      }
    } else {
      if (ruleId.length === 0) {
        throw new Error(`replace.rules Pilot requires non-empty ruleId for ${action}`);
      }
    }
    return {
      correlationId: correlationId,
      ruleId: ruleId,
      action: action,
      pattern: pattern,
      replacement: replacement,
      scope: scope,
      enabled: enabled,
    };
  }

  private payloadString(payload: ReaderUIJSONPayload, key: string,
    defaultValue: string = ''): string {
    const value = payload[key];
    return typeof value === 'string' ? value : defaultValue;
  }

  private payloadObject(payload: ReaderUIJSONPayload, key: string): ReaderUIJSONPayload | undefined {
    const value = payload[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Object as ReaderUIJSONPayload;
    }
    return undefined;
  }

  private execute(context: ReaderReplaceRulePilotContext, effect: ReaderUIEffect): void {
    if (!this.isActive(context) || effect.correlationId !== context.correlationId) {
      this.ignoredLateResults += 1;
      return;
    }
    if (context.inFlight !== undefined) {
      throw new Error(`replace.rules ${context.correlationId} attempted concurrent Core effect execution`);
    }
    context.currentEffect = effect.type;
    switch (effect.type) {
      case 'replace.persist':
        this.executePersist(context);
        return;
      case 'replace.apply':
        this.executeApply(context);
        return;
      case 'replace.validate':
        this.executeValidate(context);
        return;
      default:
        this.fail(context, effect.type, new Error(`unsupported replace.rules Core effect ${effect.type}`));
    }
  }

  private executePersist(context: ReaderReplaceRulePilotContext): void {
    try {
      const handle = this.core.beginReplacePersist(context.pattern, context.replacement, context.scope);
      this.attachHandle(context, 'replace.persist', handle);
    } catch (error) {
      this.fail(context, 'replace.persist', error as Error);
    }
  }

  private executeApply(context: ReaderReplaceRulePilotContext): void {
    try {
      const handle = this.core.beginReplaceApply(
        context.ruleId, context.action, context.pattern, context.replacement,
        context.scope, context.enabled,
      );
      this.attachHandle(context, 'replace.apply', handle);
    } catch (error) {
      this.fail(context, 'replace.apply', error as Error);
    }
  }

  private executeValidate(context: ReaderReplaceRulePilotContext): void {
    try {
      const handle = this.core.beginReplaceValidate(context.pattern, context.replacement, context.scope);
      this.attachHandle(context, 'replace.validate', handle);
    } catch (error) {
      this.fail(context, 'replace.validate', error as Error);
    }
  }

  private attachHandle(context: ReaderReplaceRulePilotContext, stage: string,
    handle: ReaderReplaceRuleCommandHandle): void {
    if (!this.isActive(context)) {
      handle.cancel();
      this.ignoredLateResults += 1;
      return;
    }
    context.currentEffect = stage;
    context.inFlight = handle;
    this.executedEffects += 1;
    handle.result.then((data: JsonObject): void => {
      if (!this.isActive(context) || context.inFlight !== handle) {
        this.ignoredLateResults += 1;
        return;
      }
      context.inFlight = undefined;
      this.acceptCoreData(context, stage, data);
    }).catch((error: Error): void => {
      if (!this.isActive(context) || context.inFlight !== handle) {
        this.ignoredLateResults += 1;
        return;
      }
      context.inFlight = undefined;
      this.fail(context, stage, error);
    });
  }

  private acceptCoreData(context: ReaderReplaceRulePilotContext, stage: string, data: JsonObject): void {
    try {
      validateReaderUITypedResult(
        stage === 'replace.persist' ? 'reader.replace.create' :
          (stage === 'replace.apply' ? 'reader.replace.apply' : 'reader.replace.validate'),
        stage,
        data as Object as ReaderUIJSONResult,
      );
      switch (stage) {
        case 'replace.persist': {
          const rules = this.parseRules(data);
          this.host.applyDomainEvent({
            type: 'replace-rule-list-loaded',
            replaceRules: rules,
          });
          this.complete(context);
          return;
        }
        case 'replace.apply': {
          if (context.action === 'delete') {
            // Clear the pending delete target first so the reducer removes the
            // local row, then refresh from Core's canonical list.
            this.host.applyDomainEvent({ type: 'replace-rule-delete-complete' });
          }
          const rules = this.parseRules(data);
          this.host.applyDomainEvent({
            type: 'replace-rule-list-loaded',
            replaceRules: rules,
          });
          this.complete(context);
          return;
        }
        case 'replace.validate': {
          const fields = data as Object as Record<string, boolean>;
          if (fields['valid'] !== true) {
            this.host.applyDomainEvent({
              type: 'set-error',
              error: {
                code: 'REPLACE_RULE_VALIDATE_FAILED',
                message: '规则校验未通过：匹配模式不能为空。',
                retryable: false,
              },
            });
          }
          this.complete(context);
          return;
        }
        default:
          this.fail(context, stage, new Error(`unsupported accepted replace.rules stage ${stage}`));
      }
    } catch (error) {
      this.fail(context, stage, error as Error);
    }
  }

  private complete(context: ReaderReplaceRulePilotContext): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    this.active = null;
  }

  private fail(context: ReaderReplaceRulePilotContext, stage: string, error: Error): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    const message = error.message.length > 0 ? error.message : `replace.rules ${stage} failed`;
    // Rollback: reload Core's canonical list so local state does not retain a
    // pending id or a stale optimistic mutation after a failed write.
    try {
      const rollbackHandle = this.core.beginReplaceRollback();
      rollbackHandle.result.then((data: JsonObject): void => {
        const rules = this.parseRules(data);
        this.host.applyDomainEvent({
          type: 'replace-rule-list-loaded',
          replaceRules: rules,
        });
      }).catch((_rollbackError: Error): void => {
        // Best-effort rollback; the error below is the surfaced cause.
      });
    } catch (_rollbackError) {
      // Core boundary threw on rollback; surface the original failure.
    }
    this.host.applyDomainEvent({
      type: 'set-error',
      error: {
        code: 'REPLACE_RULE_PILOT_FAILED',
        message: message,
        retryable: true,
      },
    });
    this.active = null;
  }

  private isActive(context: ReaderReplaceRulePilotContext): boolean {
    return this.active !== null && this.active.correlationId === context.correlationId && this.active === context;
  }

  private parseRules(data: JsonObject): ReplaceRule[] {
    const arrayFields = data as Object as Record<string, Object[]>;
    const rawRules: Object[] = arrayFields['rules'];
    if (!Array.isArray(rawRules)) return [];
    const rules: ReplaceRule[] = [];
    for (let i = 0; i < rawRules.length; i += 1) {
      const raw = rawRules[i] as Object as JsonObject;
      const booleanFields = raw as Object as Record<string, boolean>;
      const numberFields = raw as Object as Record<string, number>;
      const stringFields = raw as Object as Record<string, string>;
      const rawId: number = numberFields['id'];
      const id: string = typeof rawId === 'number' ? `rule-${rawId}` : '';
      const pattern: string = typeof stringFields['pattern'] === 'string' ? stringFields['pattern'] : '';
      const replacement: string = typeof stringFields['replacement'] === 'string' ? stringFields['replacement'] : '';
      const scope: string = typeof stringFields['scope'] === 'string' ? stringFields['scope'] : 'chapter';
      rules.push({
        id: id,
        pattern: pattern,
        replacement: replacement,
        scope: scope,
        enabled: booleanFields['isEnabled'] === true,
      });
    }
    return rules;
  }
}
