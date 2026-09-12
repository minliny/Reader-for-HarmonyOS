import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { errorMessageOf } from '../../app/ErrorMessage';
import { ReaderReplaceQuickGateway } from './ReaderReplaceQuickGateway';
import { copyReaderReplaceRule, type ReaderReplaceRule } from './ReaderReplaceQuickState';
import { orderedReaderControlReplaceRules, type ReaderControlReplaceDraft } from './ReaderControlReplaceState';

export class ReaderControlReplaceGatewayError extends Error {
  readonly writeUncertain: boolean;
  constructor(message: string, writeUncertain: boolean = false) {
    super(message);
    this.name = 'ReaderControlReplaceGatewayError';
    this.writeUncertain = writeUncertain;
  }
}

export interface ReaderControlReplaceSaveResult { rule: ReaderReplaceRule; changed: boolean; }
interface ReplaceOnlyBundle {
  schemaVersion: number;
  replaceRules: ReaderReplaceRule[];
  dictRules: string[];
  txtTocRules: string[];
  ruleSubscriptions: string[];
}

function changed(params: JsonObject, key: string, value: string | number | boolean,
  previous: string | number | boolean | undefined, creating: boolean): void {
  if (creating || value !== previous) params[key] = value;
}

/** Partial updates cannot overwrite unseen/unmodified Core fields. */
export function readerControlReplaceDraftParams(draft: ReaderControlReplaceDraft): JsonObject {
  const original = draft.original;
  const creating = original === undefined;
  const params: JsonObject = {};
  if (original !== undefined) params['id'] = original.id;
  changed(params, 'name', draft.name, original?.name, creating);
  changed(params, 'pattern', draft.pattern, original?.pattern, creating);
  changed(params, 'replacement', draft.replacement, original?.replacement, creating);
  changed(params, 'group', draft.group, original?.group ?? '', creating);
  changed(params, 'scope', draft.scope, original?.scope ?? '', creating);
  changed(params, 'excludeScope', draft.excludeScope, original?.excludeScope ?? '', creating);
  changed(params, 'scopeTitle', draft.scopeTitle, original?.scopeTitle, creating);
  changed(params, 'scopeSource', draft.scopeSource, original?.scopeSource ?? false, creating);
  changed(params, 'scopeContent', draft.scopeContent, original?.scopeContent, creating);
  changed(params, 'isEnabled', draft.isEnabled, original?.isEnabled, creating);
  changed(params, 'isRegex', draft.isRegex, original?.isRegex, creating);
  changed(params, 'timeoutMillisecond', draft.timeoutMillisecond, original?.timeoutMillisecond, creating);
  changed(params, 'order', draft.order, original?.order, creating);
  return params;
}

/** In-reader Full uses the same canonical list/preview/decoder as Quick. */
export class ReaderControlReplaceGateway extends ReaderReplaceQuickGateway {
  private readonly fullRuntime: ReadingGatewayRuntime;

  constructor(runtime: ReadingGatewayRuntime) { super(runtime); this.fullRuntime = runtime; }

  async loadRules(isCurrent: () => boolean = (): boolean => true): Promise<ReaderReplaceRule[]> {
    this.assertCurrent(isCurrent);
    const rules = await this.loadAll(isCurrent);
    this.assertCurrent(isCurrent);
    return orderedReaderControlReplaceRules(rules);
  }

  async save(draft: ReaderControlReplaceDraft,
    isCurrent: () => boolean = (): boolean => true): Promise<ReaderControlReplaceSaveResult> {
    this.assertCurrent(isCurrent);
    if (!Number.isSafeInteger(draft.order) || draft.order < -2147483648 || draft.order > 2147483647 ||
      !Number.isSafeInteger(draft.timeoutMillisecond) || draft.timeoutMillisecond <= 0) {
      throw new ReaderControlReplaceGatewayError('排序或超时数值无效');
    }
    const params = readerControlReplaceDraftParams(draft);
    if (draft.original !== undefined && Object.keys(params).length === 1) {
      return { rule: copyReaderReplaceRule(draft.original), changed: false };
    }
    const scope: string[] = [];
    if (draft.scopeTitle) scope.push('title');
    if (draft.scopeSource) scope.push('source');
    if (draft.scopeContent) scope.push('chapter');
    const validation = await this.fullRuntime.request('replace.validate',
      { pattern: draft.pattern, isRegex: draft.isRegex, scope },
      { shouldCancel: (): boolean => !isCurrent() });
    this.assertCurrent(isCurrent);
    if (validation.data['valid'] !== true) {
      throw new ReaderControlReplaceGatewayError('Core 拒绝保存：表达式或作用域未通过校验');
    }
    const operation = draft.original === undefined ? 'create' : 'update';
    try {
      // After dispatch, UI closure must not cancel a real write or discard its
      // result. The Host separately guards presentation and invalidates the
      // original book's processed content after every confirmed mutation.
      const result = await this.fullRuntime.request('replace.persist', { operation, params });
      if (result.data['operation'] !== operation) throw new Error('保存操作回执不匹配');
      const data = this.checkedObject(result.data['data']);
      const rawRule = this.checkedObject(data['rule']);
      const rule = this.decodeRule(rawRule, 'replace.persist');
      for (const key of Object.keys(params)) {
        if (rawRule[key] !== params[key]) throw new Error(`保存字段回执不匹配：${key}`);
      }
      return { rule, changed: true };
    } catch (error) {
      throw this.uncertain(error);
    }
  }

  async toggle(rule: ReaderReplaceRule, enabled: boolean,
    isCurrent: () => boolean = (): boolean => true): Promise<ReaderControlReplaceSaveResult> {
    this.assertCurrent(isCurrent);
    if (rule.isEnabled === enabled) return { rule: copyReaderReplaceRule(rule), changed: false };
    try {
      return { rule: await this.setRuleEnabled(rule.id, enabled), changed: true };
    } catch (error) { throw this.uncertain(error); }
  }

  async deleteRule(id: number, isCurrent: () => boolean = (): boolean => true): Promise<number> {
    this.assertCurrent(isCurrent);
    if (!Number.isSafeInteger(id)) throw new ReaderControlReplaceGatewayError('规则身份无效');
    try {
      const result = await this.fullRuntime.request('replace.persist', { operation: 'delete', params: { id } });
      const data = this.checkedObject(result.data['data']);
      if (result.data['operation'] !== 'delete' || data['id'] !== id || data['deleted'] !== true) {
        throw new Error('删除回执未确认指定规则');
      }
      return id;
    } catch (error) { throw this.uncertain(error); }
  }

  /** Export the Core-returned replace collection only; no arbitrary external file writes. */
  async exportJson(isCurrent: () => boolean = (): boolean => true): Promise<string> {
    this.assertCurrent(isCurrent);
    const result = await this.fullRuntime.request('rule-bundle.export', {},
      { shouldCancel: (): boolean => !isCurrent() });
    this.assertCurrent(isCurrent);
    if (result.data['schemaVersion'] !== 1 || typeof result.data['json'] !== 'string') {
      throw new ReaderControlReplaceGatewayError('规则导出回执无效');
    }
    const bundle = this.checkedObject(JSON.parse(result.data['json'] as string));
    if (bundle['schemaVersion'] !== 1) throw new ReaderControlReplaceGatewayError('规则文档版本无效');
    return this.replaceOnlyJson(this.decodeBundleRules(bundle));
  }

  /** Merge only replacement rules. Replacing all rule families is never allowed here. */
  async importJson(json: string, isCurrent: () => boolean = (): boolean => true): Promise<number> {
    this.assertCurrent(isCurrent);
    const value: unknown = JSON.parse(json);
    const bundle = this.checkedObject(value);
    if (bundle['schemaVersion'] !== 1) throw new ReaderControlReplaceGatewayError('规则文档版本无效');
    for (const key of ['dictRules', 'txtTocRules', 'ruleSubscriptions']) {
      const rows = bundle[key];
      if (rows !== undefined && (!Array.isArray(rows) || rows.length > 0)) {
        throw new ReaderControlReplaceGatewayError('阅读内导入只接受替换规则，不修改其他规则集合');
      }
    }
    const rules = orderedReaderControlReplaceRules(this.decodeBundleRules(bundle));
    if (rules.length === 0) return 0;
    for (const rule of rules) {
      if (rule.order < -2147483648 || rule.order > 2147483647 || rule.timeoutMillisecond <= 0) {
        throw new ReaderControlReplaceGatewayError(`规则数值无效：${rule.name}`);
      }
      const scope: string[] = [];
      if (rule.scopeTitle) scope.push('title');
      if (rule.scopeSource === true) scope.push('source');
      if (rule.scopeContent) scope.push('chapter');
      const validation = await this.fullRuntime.request('replace.validate',
        { pattern: rule.pattern, isRegex: rule.isRegex, scope },
        { shouldCancel: (): boolean => !isCurrent() });
      this.assertCurrent(isCurrent);
      if (validation.data['valid'] !== true) throw new ReaderControlReplaceGatewayError(`规则校验失败：${rule.name}`);
    }
    try {
      const result = await this.fullRuntime.request('rule-bundle.import',
        { json: this.replaceOnlyJson(rules), replaceExisting: false });
      const counts = this.checkedObject(result.data['counts']);
      if (result.data['schemaVersion'] !== 1 || result.data['replaceExisting'] !== false ||
        counts['replaceRules'] !== rules.length || counts['dictRules'] !== 0 ||
        counts['txtTocRules'] !== 0 || counts['ruleSubscriptions'] !== 0) throw new Error('导入回执不匹配');
      return rules.length;
    } catch (error) { throw this.uncertain(error); }
  }

  private decodeBundleRules(bundle: JsonObject): ReaderReplaceRule[] {
    const rows = bundle['replaceRules'];
    if (!Array.isArray(rows)) throw new ReaderControlReplaceGatewayError('规则文档缺少 replaceRules');
    const rules: ReaderReplaceRule[] = [];
    for (const row of rows) rules.push(this.decodeRule(row, 'rule-bundle'));
    return rules;
  }

  private replaceOnlyJson(rules: ReaderReplaceRule[]): string {
    const bundle: ReplaceOnlyBundle = { schemaVersion: 1, replaceRules: rules,
      dictRules: [], txtTocRules: [], ruleSubscriptions: [] };
    return JSON.stringify(bundle, null, 2);
  }

  private checkedObject(value: unknown): JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new ReaderControlReplaceGatewayError('Core 规则回执不是有效对象');
    }
    return value as JsonObject;
  }

  private assertCurrent(isCurrent: () => boolean): void {
    if (!isCurrent()) throw new ReaderControlReplaceGatewayError('规则请求已过期');
  }

  private uncertain(error: unknown): ReaderControlReplaceGatewayError {
    return new ReaderControlReplaceGatewayError(
      `写入结果未确认，请重新加载核对后再操作：${errorMessageOf(error)}`, true);
  }
}
